import { Router, type Response } from 'express';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';

/**
 * Create friends routes
 */
export function createFriendsRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const {
    authMiddleware,
    authManager,
    friendsStorage,
    blockedUsersStorage,
    notificationsStorage,
    userSettingsStorage,
    profileStorage,
    sessionManager,
  } = deps;

  /**
   * GET /api/friends
   * Get user's friends list.
   */
  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const friendIds = await friendsStorage.getFriends(req.user.id);

      // Get friend profiles
      const friends = await Promise.all(
        friendIds.map(async (id) => {
          const user = await authManager.getUserById(id);
          const profile = await profileStorage.getProfile(id);
          return profile ?? user;
        })
      );

      res.json(friends.filter(Boolean));
    } catch (error) {
      console.error('Get friends error:', error);
      res.status(500).json({
        error: 'Failed to get friends',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/friends/request
   * Send friend request.
   */
  router.post('/request', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { toUserId } = req.body as { toUserId?: string };
      if (!toUserId || typeof toUserId !== 'string') {
        return res.status(400).json({ error: 'Invalid toUserId' });
      }

      // Check if user is blocked
      const isBlocked = await blockedUsersStorage.isBlocked(req.user.id, toUserId);
      const isBlockedBy = await blockedUsersStorage.isBlockedBy(req.user.id, toUserId);

      if (isBlocked) {
        return res.status(403).json({ error: 'Cannot send friend request to blocked user' });
      }

      if (isBlockedBy) {
        return res.status(403).json({ error: 'You are blocked by this user' });
      }

      const request = await friendsStorage.createRequest(req.user.id, toUserId);

      // Check notification preference
      const wantsNotifications = await userSettingsStorage.getNotificationPreference(
        toUserId,
        'friendRequests'
      );

      if (wantsNotifications) {
        // Create notification for recipient
        const fromUser = await authManager.getUserById(req.user.id);
        await notificationsStorage.createNotification({
          userId: toUserId,
          type: 'friend_request',
          title: 'New Friend Request',
          message: `${fromUser?.email ?? 'Someone'} sent you a friend request`,
          link: '/friends',
          metadata: { requestId: request.id, fromUserId: req.user.id },
        });

        // Notify via WebSocket if online
        const notification = await notificationsStorage
          .getNotifications(toUserId, 1)
          .then((n) => n[0]);
        if (notification) {
          sessionManager.sendToUser(toUserId, {
            type: 'notification:new',
            timestamp: Date.now(),
            notification: {
              id: notification.id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              createdAt: notification.createdAt,
              link: notification.link,
            },
          });
        }
      }

      res.status(201).json(request);
    } catch (error) {
      console.error('Create friend request error:', error);
      const status = error instanceof Error && error.message.includes('Cannot') ? 400 : 500;
      res.status(status).json({
        error: 'Failed to create friend request',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/friends/requests
   * Get pending friend requests.
   */
  router.get('/requests', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const requests = await friendsStorage.getPendingRequests(req.user.id);
      res.json(requests);
    } catch (error) {
      console.error('Get friend requests error:', error);
      res.status(500).json({
        error: 'Failed to get requests',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/friends/request/:id
   * Accept or decline friend request.
   */
  router.put('/request/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Request ID required' });
      }
      const { action } = req.body as { action?: 'accept' | 'decline' };

      if (action === 'accept') {
        const requests = await friendsStorage.getRequests(req.user.id);
        const request = requests.find((r) => r.id === id);

        const accepted = await friendsStorage.acceptRequest(id, req.user.id);
        if (!accepted) {
          return res.status(404).json({ error: 'Request not found' });
        }

        // Create notification for sender
        if (request) {
          const wantsNotifications = await userSettingsStorage.getNotificationPreference(
            request.fromUserId,
            'friendAccepted'
          );

          if (wantsNotifications) {
            const toUser = await authManager.getUserById(req.user.id);
            await notificationsStorage.createNotification({
              userId: request.fromUserId,
              type: 'friend_accepted',
              title: 'Friend Request Accepted',
              message: `${toUser?.email ?? 'Someone'} accepted your friend request`,
              link: '/friends',
              metadata: { userId: req.user.id },
            });

            // Notify via WebSocket if online
            const notification = await notificationsStorage
              .getNotifications(request.fromUserId, 1)
              .then((n) => n[0]);
            if (notification) {
              sessionManager.sendToUser(request.fromUserId, {
                type: 'notification:new',
                timestamp: Date.now(),
                notification: {
                  id: notification.id,
                  type: notification.type,
                  title: notification.title,
                  message: notification.message,
                  createdAt: notification.createdAt,
                  link: notification.link,
                },
              });
            }
          }
        }

        res.json({ success: true });
      } else if (action === 'decline') {
        const declined = await friendsStorage.declineRequest(id, req.user.id);
        if (!declined) {
          return res.status(404).json({ error: 'Request not found' });
        }
        res.json({ success: true });
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      console.error('Handle friend request error:', error);
      res.status(500).json({
        error: 'Failed to handle request',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/friends/suggestions
   * Get friend suggestions based on mutual friends and activity.
   */
  router.get('/suggestions', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get current user's friends
      const userFriends = await friendsStorage.getFriends(req.user.id);
      const userFriendsSet = new Set(userFriends);

      // Get blocked users
      const blockedUsers = await blockedUsersStorage.getBlockedUsers(req.user.id);
      const blockedUsersSet = new Set(blockedUsers);

      // Get all users (simplified - in production, use pagination/cursor)
      // For now, we'll get users from conversations and friends of friends
      const suggestions = new Map<
        string,
        { userId: string; score: number; mutualFriends: number }
      >();

      // Find mutual friends (friends of friends)
      for (const friendId of userFriends) {
        try {
          const friendFriends = await friendsStorage.getFriends(friendId);

          for (const friendOfFriendId of friendFriends) {
            // Skip if: self, already friend, or blocked
            if (
              friendOfFriendId === req.user.id ||
              userFriendsSet.has(friendOfFriendId) ||
              blockedUsersSet.has(friendOfFriendId)
            ) {
              continue;
            }

            // Calculate score based on mutual friends
            const current = suggestions.get(friendOfFriendId);
            const mutualFriends = current ? current.mutualFriends + 1 : 1;
            const score = mutualFriends * 10; // Base score from mutual friends

            suggestions.set(friendOfFriendId, {
              userId: friendOfFriendId,
              score,
              mutualFriends,
            });
          }
        } catch (error) {
          // Ignore errors for individual friends
          console.error(`Error getting friends for ${friendId}:`, error);
        }
      }

      // Convert to array and sort by score
      const suggestionsArray = Array.from(suggestions.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 20); // Top 20 suggestions

      // Get profiles for suggestions
      const suggestionsWithProfiles = await Promise.all(
        suggestionsArray.map(async ({ userId, mutualFriends }) => {
          try {
            const user = await authManager.getUserById(userId);
            const profile = await profileStorage.getProfile(userId);
            const isOnline = sessionManager.isUserOnline(userId);

            return {
              ...(profile ?? user),
              isOnline,
              mutualFriends,
            };
          } catch (error) {
            console.error(`Error getting profile for ${userId}:`, error);
            return null;
          }
        })
      );

      res.json(suggestionsWithProfiles.filter(Boolean));
    } catch (error) {
      console.error('Get friend suggestions error:', error);
      res.status(500).json({
        error: 'Failed to get suggestions',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/friends/:id
   * Remove friend.
   */
  router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Friend ID required' });
      }
      const removed = await friendsStorage.removeFriend(req.user.id, id);

      if (!removed) {
        return res.status(404).json({ error: 'Friend not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Remove friend error:', error);
      res.status(500).json({
        error: 'Failed to remove friend',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

import type { FastifyInstance } from 'fastify';
import type { RouteDependencies } from './index.js';

/**
 * Create friends routes for Fastify
 */
export async function createFriendsRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const {
    authMiddleware,
    authManager,
    friendsStorage,
    blockedUsersStorage,
    notificationsStorage,
    userSettingsStorage,
    profileStorage,
    sessionManager,
  } = opts.dependencies;

  type FriendRequestBody = { toUserId: string };
  type FriendRequestActionBody = { action: 'accept' | 'decline' };
  type FriendIdParams = { id: string };

  /**
   * GET /api/friends
   * Get user's friends list.
   */
  app.get('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const friendIds = await friendsStorage.getFriends(request.user.id);

      // Get friend profiles
      const friends = await Promise.all(
        friendIds.map(async (id) => {
          const user = await authManager.getUserById(id);
          const profile = await profileStorage.getProfile(id);
          return profile ?? user;
        })
      );

      reply.send(friends.filter(Boolean));
    } catch (error) {
      console.error('Get friends error:', error);
      reply.code(500).send({
        error: 'Failed to get friends',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/friends/request
   * Send friend request.
   */
  app.post<{ Body: FriendRequestBody }>(
    '/request',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['toUserId'],
          properties: {
            toUserId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { toUserId } = request.body;

        // Check if user is blocked
        const isBlocked = await blockedUsersStorage.isBlocked(request.user.id, toUserId);
        const isBlockedBy = await blockedUsersStorage.isBlockedBy(request.user.id, toUserId);

        if (isBlocked) {
          return reply.code(403).send({ error: 'Cannot send friend request to blocked user' });
        }

        if (isBlockedBy) {
          return reply.code(403).send({ error: 'You are blocked by this user' });
        }

        const request_ = await friendsStorage.createRequest(request.user.id, toUserId);

        // Check notification preference
        const wantsNotifications = await userSettingsStorage.getNotificationPreference(
          toUserId,
          'friendRequests'
        );

        if (wantsNotifications) {
          // Create notification for recipient
          const fromUser = await authManager.getUserById(request.user.id);
          await notificationsStorage.createNotification({
            userId: toUserId,
            type: 'friend_request',
            title: 'New Friend Request',
            message: `${fromUser?.email ?? 'Someone'} sent you a friend request`,
            link: '/friends',
            metadata: { requestId: request_.id, fromUserId: request.user.id },
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

        reply.code(201).send(request_);
      } catch (error) {
        console.error('Create friend request error:', error);
        const status = error instanceof Error && error.message.includes('Cannot') ? 400 : 500;
        reply.code(status).send({
          error: 'Failed to create friend request',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/friends/requests
   * Get pending friend requests.
   */
  app.get('/requests', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const requests = await friendsStorage.getPendingRequests(request.user.id);
      reply.send(requests);
    } catch (error) {
      console.error('Get friend requests error:', error);
      reply.code(500).send({
        error: 'Failed to get requests',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/friends/request/:id
   * Accept or decline friend request.
   */
  app.put<{ Params: FriendIdParams; Body: FriendRequestActionBody }>(
    '/request/:id',
    {
      preHandler: [authMiddleware],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['accept', 'decline'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        const { action } = request.body;

        if (action === 'accept') {
          const requests = await friendsStorage.getRequests(request.user.id);
          const request_ = requests.find((r) => r.id === id);

          const accepted = await friendsStorage.acceptRequest(id, request.user.id);
          if (!accepted) {
            return reply.code(404).send({ error: 'Request not found' });
          }

          // Create notification for sender
          if (request_) {
            const wantsNotifications = await userSettingsStorage.getNotificationPreference(
              request_.fromUserId,
              'friendAccepted'
            );

            if (wantsNotifications) {
              const toUser = await authManager.getUserById(request.user.id);
              await notificationsStorage.createNotification({
                userId: request_.fromUserId,
                type: 'friend_accepted',
                title: 'Friend Request Accepted',
                message: `${toUser?.email ?? 'Someone'} accepted your friend request`,
                link: '/friends',
                metadata: { userId: request.user.id },
              });

              // Notify via WebSocket if online
              const notification = await notificationsStorage
                .getNotifications(request_.fromUserId, 1)
                .then((n) => n[0]);
              if (notification) {
                sessionManager.sendToUser(request_.fromUserId, {
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

          reply.send({ success: true });
        } else if (action === 'decline') {
          const declined = await friendsStorage.declineRequest(id, request.user.id);
          if (!declined) {
            return reply.code(404).send({ error: 'Request not found' });
          }
          reply.send({ success: true });
        } else {
          return reply.code(400).send({ error: 'Invalid action' });
        }
      } catch (error) {
        console.error('Handle friend request error:', error);
        reply.code(500).send({
          error: 'Failed to handle request',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/friends/presence
   * Get online presence status for all friends.
   */
  app.get('/presence', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Get user's friends
      const friendIds = await friendsStorage.getFriends(request.user.id);

      // Build presence map
      const presence: Record<string, boolean> = {};
      for (const friendId of friendIds) {
        presence[friendId] = sessionManager.isUserOnline(friendId);
      }

      reply.send(presence);
    } catch (error) {
      console.error('Get friends presence error:', error);
      reply.code(500).send({
        error: 'Failed to get friends presence',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/friends/suggestions
   * Get friend suggestions based on mutual friends and activity.
   */
  app.get('/suggestions', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Get current user's friends
      const userFriends = await friendsStorage.getFriends(request.user.id);
      const userFriendsSet = new Set(userFriends);

      // Get blocked users
      const blockedUsers = await blockedUsersStorage.getBlockedUsers(request.user.id);
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
              friendOfFriendId === request.user.id ||
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

      reply.send(suggestionsWithProfiles.filter(Boolean));
    } catch (error) {
      console.error('Get friend suggestions error:', error);
      reply.code(500).send({
        error: 'Failed to get suggestions',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/friends/:id
   * Remove friend.
   */
  app.delete<{ Params: FriendIdParams }>(
    '/:id',
    {
      preHandler: [authMiddleware],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params;
        const removed = await friendsStorage.removeFriend(request.user.id, id);

        if (!removed) {
          return reply.code(404).send({ error: 'Friend not found' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Remove friend error:', error);
        reply.code(500).send({
          error: 'Failed to remove friend',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}


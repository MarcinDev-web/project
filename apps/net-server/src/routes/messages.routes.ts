import { Router, type Response } from 'express';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';

/**
 * Create messages routes
 */
export function createMessagesRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const {
    authMiddleware,
    messagesStorage,
    messageHandler,
    sessionManager,
    blockedUsersStorage,
    authManager,
    userSettingsStorage,
    notificationsStorage,
  } = deps;

  /**
   * GET /api/messages
   * Get user's conversations.
   */
  router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const conversations = await messagesStorage.getConversations(req.user.id);
      res.json(conversations);
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        error: 'Failed to get conversations',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/messages/:conversationId
   * Get messages in a conversation.
   */
  router.get('/:conversationId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { conversationId } = req.params;
      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID required' });
      }
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;

      const messages = await messagesStorage.getMessages(conversationId, limit);
      res.json(messages);
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        error: 'Failed to get messages',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/messages
   * Send a message.
   */
  router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { toUserId, conversationId, content } = req.body as {
        toUserId?: string;
        conversationId?: string;
        content?: string;
      };

      if (!content) {
        return res.status(400).json({ error: 'Missing content' });
      }

      let message;

      // Check if this is a group message
      if (conversationId) {
        const conversation = await messagesStorage.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.type === 'group') {
          // Group message
          if (!conversation.participants.includes(req.user.id)) {
            return res.status(403).json({ error: 'Not a member of this group' });
          }
          message = await messagesStorage.createMessage(req.user.id, conversationId, content, true);
        } else {
          // Direct message with conversation ID
          if (!toUserId) {
            return res.status(400).json({ error: 'Missing toUserId for direct message' });
          }

          // Check if user is blocked
          const isBlocked = await blockedUsersStorage.isBlocked(req.user.id, toUserId);
          const isBlockedBy = await blockedUsersStorage.isBlockedBy(req.user.id, toUserId);

          if (isBlocked) {
            return res.status(403).json({ error: 'Cannot send message to blocked user' });
          }

          if (isBlockedBy) {
            return res.status(403).json({ error: 'You are blocked by this user' });
          }

          message = await messagesStorage.createMessage(req.user.id, toUserId, content);
        }
      } else if (toUserId) {
        // Direct message
        // Check if user is blocked
        const isBlocked = await blockedUsersStorage.isBlocked(req.user.id, toUserId);
        const isBlockedBy = await blockedUsersStorage.isBlockedBy(req.user.id, toUserId);

        if (isBlocked) {
          return res.status(403).json({ error: 'Cannot send message to blocked user' });
        }

        if (isBlockedBy) {
          return res.status(403).json({ error: 'You are blocked by this user' });
        }

        message = await messagesStorage.createMessage(req.user.id, toUserId, content);
      } else {
        return res.status(400).json({ error: 'Missing toUserId or conversationId' });
      }

      // Create notification for recipient(s) (only if conversation is not currently open)
      const fromUser = await authManager.getUserById(req.user.id);
      const conversation = await messagesStorage.getConversation(message.conversationId);

      if (conversation?.type === 'group') {
        // Group message - create notifications for all members except sender
        for (const memberId of conversation.participants) {
          if (memberId !== req.user.id) {
            const wantsNotifications = await userSettingsStorage.getNotificationPreference(memberId, 'messages');

            if (wantsNotifications) {
              await notificationsStorage.createNotification({
                userId: memberId,
                type: 'message',
                title: `New message in ${conversation.groupName ?? 'group'}`,
                message: `${fromUser?.email ?? 'Someone'}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
                link: `/messages`,
                metadata: { conversationId: message.conversationId, messageId: message.id },
              });

              // Send notification via WebSocket
              const notification = await notificationsStorage.getNotifications(memberId, 1).then(n => n[0]);
              if (notification) {
                sessionManager.sendToUser(memberId, {
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
        }
      } else if (toUserId) {
        // Direct message (toUserId is guaranteed here due to earlier checks)
        const wantsNotifications = await userSettingsStorage.getNotificationPreference(toUserId, 'messages');

        if (wantsNotifications) {
          await notificationsStorage.createNotification({
            userId: toUserId,
            type: 'message',
            title: 'New Message',
            message: `${fromUser?.email ?? 'Someone'}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            link: `/messages`,
            metadata: { conversationId: message.conversationId, messageId: message.id },
          });

          // Send notification via WebSocket
          const notification = await notificationsStorage.getNotifications(toUserId, 1).then(n => n[0]);
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
      }

      // Notify recipient(s) via WebSocket if they're online (always send real-time message)
      await messageHandler.handleNewMessage(message);

      res.status(201).json(message);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        error: 'Failed to send message',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/messages/groups
   * Create a group conversation.
   */
  router.post('/groups', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { groupName, memberIds, groupAvatar } = req.body as {
        groupName?: string;
        memberIds?: string[];
        groupAvatar?: string;
      };

      if (!groupName || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: 'Missing groupName or memberIds' });
      }

      const conversation = await messagesStorage.createGroupConversation(
        req.user.id,
        groupName,
        memberIds,
        groupAvatar
      );

      res.status(201).json(conversation);
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({
        error: 'Failed to create group',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/messages/groups
   * Get user's group conversations.
   */
  router.get('/groups', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const conversations = await messagesStorage.getConversations(req.user.id);
      const groups = conversations.filter(c => c.type === 'group');

      // Add unread count for each group
      const groupsWithUnread = await Promise.all(
        groups.map(async (conv) => {
          const unreadCount = await messagesStorage.getUnreadCountForConversation(
            conv.id,
            req.user!.id
          );
          return {
            ...conv,
            unreadCount,
          };
        })
      );

      res.json(groupsWithUnread);
    } catch (error) {
      console.error('Get groups error:', error);
      res.status(500).json({
        error: 'Failed to get groups',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/messages/groups/:id
   * Update group conversation (name, avatar).
   */
  router.put('/groups/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Group ID required' });
      }

      const { groupName, groupAvatar } = req.body as { groupName?: string; groupAvatar?: string };

      const conversation = await messagesStorage.getConversation(id);
      if (!conversation || conversation.type !== 'group') {
        return res.status(404).json({ error: 'Group not found' });
      }

      if (conversation.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Only owner can update group' });
      }

      const updateData: { groupName?: string; groupAvatar?: string } = {};
      if (groupName !== undefined) updateData.groupName = groupName;
      if (groupAvatar !== undefined) updateData.groupAvatar = groupAvatar;

      const updated = await messagesStorage.updateGroupConversation(id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'Group not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({
        error: 'Failed to update group',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/messages/groups/:id/members
   * Add or remove group members.
   */
  router.put('/groups/:id/members', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Group ID required' });
      }

      const { memberIds, memberId, action } = req.body as {
        memberIds?: string[];
        memberId?: string;
        action?: 'add' | 'remove';
      };

      const conversation = await messagesStorage.getConversation(id);
      if (!conversation || conversation.type !== 'group') {
        return res.status(404).json({ error: 'Group not found' });
      }

      if (action === 'add') {
        if (!memberIds || !Array.isArray(memberIds)) {
          return res.status(400).json({ error: 'memberIds required for add action' });
        }

        // Only owner can add members
        if (conversation.ownerId !== req.user.id) {
          return res.status(403).json({ error: 'Only owner can add members' });
        }

        const added = await messagesStorage.addGroupMembers(id, memberIds);
        if (!added) {
          return res.status(400).json({ error: 'No new members to add' });
        }
      } else if (action === 'remove') {
        if (!memberId) {
          return res.status(400).json({ error: 'memberId required for remove action' });
        }

        // Owner can remove anyone, members can only remove themselves
        if (conversation.ownerId !== req.user.id && memberId !== req.user.id) {
          return res.status(403).json({ error: 'Cannot remove other members' });
        }

        const removed = await messagesStorage.removeGroupMember(id, memberId);
        if (!removed) {
          return res.status(404).json({ error: 'Member not found' });
        }
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const updated = await messagesStorage.getConversation(id);
      res.json(updated);
    } catch (error) {
      console.error('Update group members error:', error);
      res.status(500).json({
        error: 'Failed to update group members',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * DELETE /api/messages/groups/:id/leave
   * Leave a group conversation.
   */
  router.delete('/groups/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Group ID required' });
      }

      if (!req.user.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const removed = await messagesStorage.removeGroupMember(id, req.user.id);

      if (!removed) {
        return res.status(404).json({ error: 'Not a member of this group' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Leave group error:', error);
      res.status(500).json({
        error: 'Failed to leave group',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/messages/:id/read
   * Mark message as read.
   */
  router.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'Message ID required' });
      }

      if (!req.user.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const marked = await messagesStorage.markAsRead(id, req.user.id);

      if (!marked) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Get conversation ID from message
      const message = await messagesStorage.getMessageById(id);

      if (message) {
        await messageHandler.handleMessageRead(id, message.conversationId, req.user.id);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Mark message read error:', error);
      res.status(500).json({
        error: 'Failed to mark message as read',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}


import type { FastifyInstance } from 'fastify';
import type { RouteDependencies } from './index.js';

/**
 * Create messages routes for Fastify
 */
export async function createMessagesRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const {
    authMiddleware,
    messagesStorage,
    messageHandler,
    sessionManager,
    blockedUsersStorage,
    authManager,
    userSettingsStorage,
    notificationsStorage,
  } = opts.dependencies;

  type ConversationParams = { conversationId: string };
  type ConversationQuery = { limit?: number };
  type SendMessageBody = { toUserId?: string; conversationId?: string; content: string };
  type CreateGroupBody = { groupName: string; memberIds: string[]; groupAvatar?: string };
  type GroupParams = { id: string };
  type UpdateGroupBody = { groupName?: string; groupAvatar?: string };
  type UpdateGroupMembersBody = {
    memberIds?: string[];
    memberId?: string;
    action: 'add' | 'remove';
  };
  type BroadcastMessageBody = { content: string };

  /**
   * GET /api/messages
   * Get user's conversations.
   */
  app.get('/', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const conversations = await messagesStorage.getConversations(request.user.id);
      reply.send(conversations);
    } catch (error) {
      console.error('Get conversations error:', error);
      reply.code(500).send({
        error: 'Failed to get conversations',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * GET /api/messages/:conversationId
   * Get messages in a conversation.
   */
  app.get<{ Params: ConversationParams; Querystring: ConversationQuery }>(
    '/:conversationId',
    {
      preHandler: [authMiddleware],
      schema: {
        params: {
          type: 'object',
          required: ['conversationId'],
          properties: {
            conversationId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { conversationId } = request.params;
        const limit = request.query.limit || 100;

        const messages = await messagesStorage.getMessages(conversationId, limit);
        reply.send(messages);
      } catch (error) {
        console.error('Get messages error:', error);
        reply.code(500).send({
          error: 'Failed to get messages',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * POST /api/messages
   * Send a message.
   */
  app.post<{ Body: SendMessageBody }>(
    '/',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            toUserId: { type: 'string' },
            conversationId: { type: 'string' },
            content: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { toUserId, conversationId, content } = request.body;

        let message;

        // Check if this is a group message
        if (conversationId) {
          const conversation = await messagesStorage.getConversation(conversationId);
          if (!conversation) {
            return reply.code(404).send({ error: 'Conversation not found' });
          }

          if (conversation.type === 'group') {
            // Group message
            if (!conversation.participants.includes(request.user.id)) {
              return reply.code(403).send({ error: 'Not a member of this group' });
            }
            message = await messagesStorage.createMessage(request.user.id, conversationId, content, true);
          } else {
            // Direct message with conversation ID
            if (!toUserId) {
              return reply.code(400).send({ error: 'Missing toUserId for direct message' });
            }

            // Check if user is blocked
            const isBlocked = await blockedUsersStorage.isBlocked(request.user.id, toUserId);
            const isBlockedBy = await blockedUsersStorage.isBlockedBy(request.user.id, toUserId);

            if (isBlocked) {
              return reply.code(403).send({ error: 'Cannot send message to blocked user' });
            }

            if (isBlockedBy) {
              return reply.code(403).send({ error: 'You are blocked by this user' });
            }

            message = await messagesStorage.createMessage(request.user.id, toUserId, content);
          }
        } else if (toUserId) {
          // Direct message
          // Check if user is blocked
          const isBlocked = await blockedUsersStorage.isBlocked(request.user.id, toUserId);
          const isBlockedBy = await blockedUsersStorage.isBlockedBy(request.user.id, toUserId);

          if (isBlocked) {
            return reply.code(403).send({ error: 'Cannot send message to blocked user' });
          }

          if (isBlockedBy) {
            return reply.code(403).send({ error: 'You are blocked by this user' });
          }

          message = await messagesStorage.createMessage(request.user.id, toUserId, content);
        } else {
          return reply.code(400).send({ error: 'Missing toUserId or conversationId' });
        }

        // Create notification for recipient(s) (only if conversation is not currently open)
        const fromUser = await authManager.getUserById(request.user.id);
        const conversation = await messagesStorage.getConversation(message.conversationId);

        if (conversation?.type === 'group') {
          // Group message - create notifications for all members except sender
          for (const memberId of conversation.participants) {
            if (memberId !== request.user.id) {
              const wantsNotifications = await userSettingsStorage.getNotificationPreference(
                memberId,
                'messages'
              );

              if (wantsNotifications) {
                await notificationsStorage.createNotification({
                  userId: memberId,
                  type: 'message',
                  title: `New message in ${conversation.groupName ?? 'group'}`,
                  message: `${fromUser?.username || fromUser?.email || 'Someone'}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
                  link: `/messages`,
                  metadata: { conversationId: message.conversationId, messageId: message.id },
                });

                // Send notification via WebSocket
                const notification = await notificationsStorage
                  .getNotifications(memberId, 1)
                  .then((n) => n[0]);
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
              message: `${fromUser?.username || fromUser?.email || 'Someone'}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
              link: `/messages`,
              metadata: { conversationId: message.conversationId, messageId: message.id },
            });

            // Send notification via WebSocket
            const notification = await notificationsStorage.getNotifications(toUserId, 1).then((n) => n[0]);
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

        reply.code(201).send(message);
      } catch (error) {
        console.error('Send message error:', error);
        reply.code(500).send({
          error: 'Failed to send message',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * POST /api/messages/groups
   * Create a group conversation.
   */
  app.post<{ Body: CreateGroupBody }>(
    '/groups',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['groupName', 'memberIds'],
          properties: {
            groupName: { type: 'string' },
            memberIds: { type: 'array', items: { type: 'string' } },
            groupAvatar: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { groupName, memberIds, groupAvatar } = request.body;

        if (!groupName || !Array.isArray(memberIds) || memberIds.length === 0) {
          return reply.code(400).send({ error: 'Missing groupName or memberIds' });
        }

        const conversation = await messagesStorage.createGroupConversation(
          request.user.id,
          groupName,
          memberIds,
          groupAvatar
        );

        reply.code(201).send(conversation);
      } catch (error) {
        console.error('Create group error:', error);
        reply.code(500).send({
          error: 'Failed to create group',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /api/messages/groups
   * Get user's group conversations.
   */
  app.get('/groups', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const conversations = await messagesStorage.getConversations(request.user.id);
      const groups = conversations.filter((c) => c.type === 'group');

      // Add unread count for each group
      const groupsWithUnread = await Promise.all(
        groups.map(async (conv) => {
          const unreadCount = await messagesStorage.getUnreadCountForConversation(conv.id, request.user!.id);
          return {
            ...conv,
            unreadCount,
          };
        })
      );

      reply.send(groupsWithUnread);
    } catch (error) {
      console.error('Get groups error:', error);
      reply.code(500).send({
        error: 'Failed to get groups',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /api/messages/groups/:id
   * Update group conversation (name, avatar).
   */
  app.put<{ Params: GroupParams; Body: UpdateGroupBody }>(
    '/groups/:id',
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
          properties: {
            groupName: { type: 'string' },
            groupAvatar: { type: 'string' },
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
        const { groupName, groupAvatar } = request.body;

        const conversation = await messagesStorage.getConversation(id);
        if (!conversation || conversation.type !== 'group') {
          return reply.code(404).send({ error: 'Group not found' });
        }

        if (conversation.ownerId !== request.user.id) {
          return reply.code(403).send({ error: 'Only owner can update group' });
        }

        const updateData: { groupName?: string; groupAvatar?: string } = {};
        if (groupName !== undefined) updateData.groupName = groupName;
        if (groupAvatar !== undefined) updateData.groupAvatar = groupAvatar;

        const updated = await messagesStorage.updateGroupConversation(id, updateData);
        if (!updated) {
          return reply.code(404).send({ error: 'Group not found' });
        }

        reply.send(updated);
      } catch (error) {
        console.error('Update group error:', error);
        reply.code(500).send({
          error: 'Failed to update group',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * PUT /api/messages/groups/:id/members
   * Add or remove group members.
   */
  app.put<{ Params: GroupParams; Body: UpdateGroupMembersBody }>(
    '/groups/:id/members',
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
            memberIds: { type: 'array', items: { type: 'string' } },
            memberId: { type: 'string' },
            action: { type: 'string', enum: ['add', 'remove'] },
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
        const { memberIds, memberId, action } = request.body;

        const conversation = await messagesStorage.getConversation(id);
        if (!conversation || conversation.type !== 'group') {
          return reply.code(404).send({ error: 'Group not found' });
        }

        if (action === 'add') {
          if (!memberIds || !Array.isArray(memberIds)) {
            return reply.code(400).send({ error: 'memberIds required for add action' });
          }

          // Only owner can add members
          if (conversation.ownerId !== request.user.id) {
            return reply.code(403).send({ error: 'Only owner can add members' });
          }

          const added = await messagesStorage.addGroupMembers(id, memberIds);
          if (!added) {
            return reply.code(400).send({ error: 'No new members to add' });
          }
        } else if (action === 'remove') {
          if (!memberId) {
            return reply.code(400).send({ error: 'memberId required for remove action' });
          }

          // Owner can remove anyone, members can only remove themselves
          if (conversation.ownerId !== request.user.id && memberId !== request.user.id) {
            return reply.code(403).send({ error: 'Cannot remove other members' });
          }

          const removed = await messagesStorage.removeGroupMember(id, memberId);
          if (!removed) {
            return reply.code(404).send({ error: 'Member not found' });
          }
        } else {
          return reply.code(400).send({ error: 'Invalid action' });
        }

        const updated = await messagesStorage.getConversation(id);
        reply.send(updated);
      } catch (error) {
        console.error('Update group members error:', error);
        reply.code(500).send({
          error: 'Failed to update group members',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * DELETE /api/messages/groups/:id/leave
   * Leave a group conversation.
   */
  app.delete<{ Params: GroupParams }>(
    '/groups/:id/leave',
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
        const removed = await messagesStorage.removeGroupMember(id, request.user.id);

        if (!removed) {
          return reply.code(404).send({ error: 'Not a member of this group' });
        }

        reply.code(204).send();
      } catch (error) {
        console.error('Leave group error:', error);
        reply.code(500).send({
          error: 'Failed to leave group',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * PUT /api/messages/:id/read
   * Mark message as read.
   */
  app.put<{ Params: GroupParams }>(
    '/:id/read',
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
        const marked = await messagesStorage.markAsRead(id, request.user.id);

        if (!marked) {
          return reply.code(404).send({ error: 'Message not found' });
        }

        // Get conversation ID from message
        const message = await messagesStorage.getMessageById(id);

        if (message) {
          await messageHandler.handleMessageRead(id, message.conversationId, request.user.id);
        }

        reply.send({ success: true });
      } catch (error) {
        console.error('Mark message read error:', error);
        reply.code(500).send({
          error: 'Failed to mark message as read',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * POST /api/messages/broadcast
   * Send a message to all users (admin/root only).
   */
  app.post<{ Body: BroadcastMessageBody }>(
    '/broadcast',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Check if user is admin or root
        if (request.user.role !== 'admin' && request.user.role !== 'root') {
          return reply.code(403).send({ error: 'Forbidden: Admin or root access required' });
        }

        const { content } = request.body;

        if (!content || !content.trim()) {
          return reply.code(400).send({ error: 'Content is required' });
        }

        // Get all users
        const allUsers = await authManager.getAllUsers();

        // Filter out the sender
        const recipients = allUsers.filter((user) => user.id !== request.user!.id);

        if (recipients.length === 0) {
          return reply.send({ sent: 0 });
        }

        const fromUser = await authManager.getUserById(request.user.id);
        let sentCount = 0;

        // Send message to each recipient
        for (const recipient of recipients) {
          try {
            // Check if user is blocked (skip blocked users)
            const isBlocked = await blockedUsersStorage.isBlocked(request.user.id, recipient.id);
            const isBlockedBy = await blockedUsersStorage.isBlockedBy(request.user.id, recipient.id);

            if (isBlocked || isBlockedBy) {
              continue;
            }

            // Create message
            const message = await messagesStorage.createMessage(request.user.id, recipient.id, content);

            // Create notification if user wants notifications
            const wantsNotifications = await userSettingsStorage.getNotificationPreference(
              recipient.id,
              'messages'
            );

            if (wantsNotifications) {
              await notificationsStorage.createNotification({
                userId: recipient.id,
                type: 'message',
                title: 'New Message',
                message: `${fromUser?.username || fromUser?.email || 'Admin'}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
                link: `/messages`,
                metadata: { conversationId: message.conversationId, messageId: message.id },
              });

              // Send notification via WebSocket
              const notification = await notificationsStorage.getNotifications(recipient.id, 1).then((n) => n[0]);
              if (notification) {
                sessionManager.sendToUser(recipient.id, {
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

            // Notify recipient via WebSocket
            await messageHandler.handleNewMessage(message);
            sentCount++;
          } catch (error) {
            console.error(`Failed to send message to user ${recipient.id}:`, error);
            // Continue with other users even if one fails
          }
        }

        reply.send({ sent: sentCount });
      } catch (error) {
        console.error('Broadcast message error:', error);
        reply.code(500).send({
          error: 'Failed to broadcast message',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}


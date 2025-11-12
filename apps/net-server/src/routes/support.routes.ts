import type { FastifyInstance } from 'fastify';
import type { RouteDependencies } from './index.js';

/**
 * Create support routes for Fastify
 */
export async function createSupportRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { authMiddleware, requireAdmin, requireModerator, supportStorage, getUserIdFromToken, notificationsStorage, sessionManager, authManager } = opts.dependencies;

  type TicketParams = { id: string };
  type FAQParams = { id: string };
  type TicketQuery = {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    limit?: string | number;
    offset?: string | number;
  };
  type FAQQuery = {
    category?: 'general' | 'editor' | 'marketplace' | 'account' | 'technical';
    search?: string;
    limit?: string | number;
    offset?: string | number;
  };
  type CreateTicketBody = {
    type: 'bug' | 'question' | 'feature' | 'other';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    title: string;
    description: string;
    metadata?: Record<string, unknown>;
  };
  type UpdateTicketBody = {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignedTo?: string | null;
  };
  type CreateMessageBody = {
    content: string;
    isInternal?: boolean;
  };
  type CreateFAQBody = {
    question: string;
    answer: string;
    category: 'general' | 'editor' | 'marketplace' | 'account' | 'technical';
    order?: number;
    isPublished?: boolean;
    tags?: string[];
  };
  type UpdateFAQBody = {
    question?: string;
    answer?: string;
    category?: 'general' | 'editor' | 'marketplace' | 'account' | 'technical';
    order?: number;
    isPublished?: boolean;
    tags?: string[];
  };

  // TICKETS - User endpoints

  app.post<{ Body: CreateTicketBody }>(
    '/tickets',
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: 'object',
          required: ['type', 'title', 'description'],
          properties: {
            type: { type: 'string', enum: ['bug', 'question', 'feature', 'other'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            title: { type: 'string' },
            description: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { type, priority, title, description, metadata } = request.body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
          return reply.code(400).send({ error: 'Title is required' });
        }

        if (!description || typeof description !== 'string' || description.trim().length === 0) {
          return reply.code(400).send({ error: 'Description is required' });
        }

        const ticket = await supportStorage.createTicket({
          userId: request.user.id,
          type,
          status: 'open',
          priority: priority ?? 'medium',
          title: title.trim(),
          description: description.trim(),
          metadata,
        });

        // Notify admins about high/urgent priority tickets
        if (ticket.priority === 'high' || ticket.priority === 'urgent') {
          try {
            const allUsers = await authManager['userStorage'].getAllUsers();
            const admins = allUsers.filter((u) => u.role === 'admin' || u.role === 'root' || u.role === 'moderator');
            
            for (const admin of admins) {
              await notificationsStorage.createNotification({
                userId: admin.id,
                type: 'system',
                title: `New ${ticket.priority} priority support ticket`,
                message: `${ticket.title} (${ticket.type})`,
                link: `/admin/support`,
                metadata: { ticketId: ticket.id, priority: ticket.priority },
              });

              // Send WebSocket notification
              const notification = await notificationsStorage
                .getNotifications(admin.id, 1)
                .then((n) => n[0]);
              if (notification) {
                sessionManager.sendToUser(admin.id, {
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
          } catch (error) {
            console.error('Failed to send admin notifications:', error);
            // Don't fail ticket creation if notification fails
          }
        }

        reply.code(201).send(ticket);
      } catch (error) {
        console.error('Create ticket error:', error);
        reply.code(500).send({
          error: 'Failed to create ticket',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get<{ Querystring: TicketQuery }>(
    '/tickets',
    {
      preHandler: [authMiddleware],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            limit: { type: ['string', 'number'] },
            offset: { type: ['string', 'number'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query;
        const limit = query.limit ? parseInt(String(query.limit), 10) : undefined;
        const offset = query.offset ? parseInt(String(query.offset), 10) : undefined;

        const tickets = await supportStorage.getTickets({
          userId: request.user.id,
          status: query.status,
          priority: query.priority,
          limit,
          offset,
        });

        reply.send(tickets);
      } catch (error) {
        console.error('Get tickets error:', error);
        reply.code(500).send({
          error: 'Failed to get tickets',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get<{ Params: TicketParams }>(
    '/tickets/:id',
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
        const ticket = await supportStorage.getTicket(id, request.user.id);

        if (!ticket) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        // Users can only see their own tickets unless they're staff
        const userId = getUserIdFromToken(request.headers.authorization);
        const isStaff = request.user.role === 'admin' || request.user.role === 'moderator' || request.user.role === 'root';

        if (!isStaff && ticket.userId !== request.user.id) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        // Filter out internal messages for non-staff users
        if (!isStaff) {
          ticket.messages = ticket.messages.filter((msg) => !msg.isInternal);
        }

        reply.send(ticket);
      } catch (error) {
        console.error('Get ticket error:', error);
        reply.code(500).send({
          error: 'Failed to get ticket',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: TicketParams; Body: CreateMessageBody }>(
    '/tickets/:id/messages',
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
          required: ['content'],
          properties: {
            content: { type: 'string' },
            isInternal: { type: 'boolean' },
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
        const { content, isInternal } = request.body;

        if (!content || typeof content !== 'string' || content.trim().length === 0) {
          return reply.code(400).send({ error: 'Content is required' });
        }

        const ticket = await supportStorage.getTicket(id);
        if (!ticket) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        // Users can only add messages to their own tickets unless they're staff
        const isStaff = request.user.role === 'admin' || request.user.role === 'moderator' || request.user.role === 'root';
        if (!isStaff && ticket.userId !== request.user.id) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        // Only staff can create internal messages
        const messageIsInternal = isStaff && (isInternal ?? false);

        const message = await supportStorage.addMessage(id, {
          authorId: request.user.id,
          content: content.trim(),
          isInternal: messageIsInternal,
        });

        // Notify ticket owner if message is from staff, or notify staff if message is from user
        if (!messageIsInternal) {
          const isStaff = request.user.role === 'admin' || request.user.role === 'moderator' || request.user.role === 'root';
          
          if (isStaff) {
            // Staff replied - notify ticket owner
            try {
              await notificationsStorage.createNotification({
                userId: ticket.userId,
                type: 'system',
                title: 'New reply to your support ticket',
                message: `${ticket.title}`,
                link: `/support/tickets/${ticket.id}`,
                metadata: { ticketId: ticket.id, messageId: message.id },
              });

              // Send WebSocket notification
              const notification = await notificationsStorage
                .getNotifications(ticket.userId, 1)
                .then((n) => n[0]);
              if (notification) {
                sessionManager.sendToUser(ticket.userId, {
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
            } catch (error) {
              console.error('Failed to send notification to ticket owner:', error);
            }
          } else {
            // User replied - notify assigned staff or all admins if unassigned
            try {
              const notifyUsers = ticket.assignedTo 
                ? [{ id: ticket.assignedTo }]
                : (await authManager['userStorage'].getAllUsers()).filter((u) => u.role === 'admin' || u.role === 'root' || u.role === 'moderator');
              
              for (const user of notifyUsers) {
                await notificationsStorage.createNotification({
                  userId: user.id,
                  type: 'system',
                  title: 'New message on support ticket',
                  message: `${ticket.title}`,
                  link: `/admin/support`,
                  metadata: { ticketId: ticket.id, messageId: message.id },
                });

                // Send WebSocket notification
                const notification = await notificationsStorage
                  .getNotifications(user.id, 1)
                  .then((n) => n[0]);
                if (notification) {
                  sessionManager.sendToUser(user.id, {
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
            } catch (error) {
              console.error('Failed to send notification to staff:', error);
            }
          }
        }

        reply.code(201).send(message);
      } catch (error) {
        console.error('Add message error:', error);
        reply.code(500).send({
          error: 'Failed to add message',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.patch<{ Params: TicketParams; Body: UpdateTicketBody }>(
    '/tickets/:id',
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
            status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            assignedTo: { type: ['string', 'null'] },
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
        const updates = request.body;

        const ticket = await supportStorage.getTicket(id);
        if (!ticket) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        // Users can only update their own tickets (and only close them)
        // Staff can update any ticket
        const isStaff = request.user.role === 'admin' || request.user.role === 'moderator' || request.user.role === 'root';
        if (!isStaff && ticket.userId !== request.user.id) {
          return reply.code(403).send({ error: 'Forbidden' });
        }

        // Non-staff users can only close their own tickets
        if (!isStaff) {
          if (updates.status && updates.status !== 'closed') {
            return reply.code(403).send({ error: 'You can only close your own tickets' });
          }
          // Remove fields that non-staff can't update
          delete updates.assignedTo;
          if (updates.status !== 'closed') {
            delete updates.status;
          }
        }

        // Set resolvedAt when status changes to resolved
        const updateData: Parameters<typeof supportStorage.updateTicket>[1] = { ...updates };
        if (updates.status === 'resolved' && ticket.status !== 'resolved') {
          updateData.resolvedAt = Date.now();
        } else if (updates.status && updates.status !== 'resolved' && ticket.status === 'resolved') {
          updateData.resolvedAt = undefined;
        }

        const updated = await supportStorage.updateTicket(id, updateData);
        if (!updated) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        reply.send(updated);
      } catch (error) {
        console.error('Update ticket error:', error);
        reply.code(500).send({
          error: 'Failed to update ticket',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get(
    '/tickets/stats',
    {
      preHandler: [authMiddleware, requireAdmin()],
    },
    async (request, reply) => {
      try {
        const stats = await supportStorage.getTicketStats();
        reply.send(stats);
      } catch (error) {
        console.error('Get ticket stats error:', error);
        reply.code(500).send({
          error: 'Failed to get ticket stats',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // FAQ - Public endpoints

  app.get<{ Querystring: FAQQuery }>(
    '/faq',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['general', 'editor', 'marketplace', 'account', 'technical'] },
            search: { type: 'string' },
            limit: { type: ['string', 'number'] },
            offset: { type: ['string', 'number'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query;
        const limit = query.limit ? parseInt(String(query.limit), 10) : undefined;
        const offset = query.offset ? parseInt(String(query.offset), 10) : undefined;

        const faqs = await supportStorage.getFAQs({
          category: query.category,
          isPublished: true, // Only published FAQs for public endpoint
          search: query.search,
          limit,
          offset,
        });

        reply.send(faqs);
      } catch (error) {
        console.error('Get FAQ error:', error);
        reply.code(500).send({
          error: 'Failed to get FAQ',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get<{ Params: FAQParams }>(
    '/faq/:id',
    {
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
        const { id } = request.params;
        const faq = await supportStorage.getFAQ(id);

        if (!faq) {
          return reply.code(404).send({ error: 'FAQ not found' });
        }

        // Only return published FAQs for public endpoint
        if (!faq.isPublished) {
          return reply.code(404).send({ error: 'FAQ not found' });
        }

        // Increment view count
        await supportStorage.incrementFAQView(id);

        reply.send(faq);
      } catch (error) {
        console.error('Get FAQ error:', error);
        reply.code(500).send({
          error: 'Failed to get FAQ',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Params: FAQParams }>(
    '/faq/:id/helpful',
    {
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
        const { id } = request.params;
        const faq = await supportStorage.getFAQ(id);

        if (!faq || !faq.isPublished) {
          return reply.code(404).send({ error: 'FAQ not found' });
        }

        await supportStorage.incrementFAQHelpful(id);
        reply.send({ success: true });
      } catch (error) {
        console.error('Mark FAQ helpful error:', error);
        reply.code(500).send({
          error: 'Failed to mark FAQ as helpful',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.get<{ Querystring: { q?: string } }>(
    '/faq/search',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const query = request.query.q;
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          return reply.code(400).send({ error: 'Search query is required' });
        }

        const faqs = await supportStorage.getFAQs({
          isPublished: true,
          search: query.trim(),
          limit: 20,
        });

        reply.send(faqs);
      } catch (error) {
        console.error('Search FAQ error:', error);
        reply.code(500).send({
          error: 'Failed to search FAQ',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  // ADMIN ENDPOINTS

  app.get<{ Querystring: TicketQuery & { userId?: string; assignedTo?: string } }>(
    '/admin/support/tickets',
    {
      preHandler: [authMiddleware, requireAdmin()],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            userId: { type: 'string' },
            assignedTo: { type: 'string' },
            limit: { type: ['string', 'number'] },
            offset: { type: ['string', 'number'] },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const query = request.query;
        const limit = query.limit ? parseInt(String(query.limit), 10) : undefined;
        const offset = query.offset ? parseInt(String(query.offset), 10) : undefined;

        const tickets = await supportStorage.getTickets({
          userId: query.userId,
          status: query.status,
          priority: query.priority,
          assignedTo: query.assignedTo,
          limit,
          offset,
        });

        reply.send(tickets);
      } catch (error) {
        console.error('Get admin tickets error:', error);
        reply.code(500).send({
          error: 'Failed to get tickets',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.patch<{ Params: TicketParams; Body: UpdateTicketBody }>(
    '/admin/support/tickets/:id',
    {
      preHandler: [authMiddleware, requireAdmin()],
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
            status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            assignedTo: { type: ['string', 'null'] },
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
        const updates = request.body;

        // Set resolvedAt when status changes to resolved
        const ticket = await supportStorage.getTicket(id);
        const updateData: Parameters<typeof supportStorage.updateTicket>[1] = { ...updates };
        if (updates.status === 'resolved' && ticket && ticket.status !== 'resolved') {
          updateData.resolvedAt = Date.now();
        } else if (updates.status && updates.status !== 'resolved' && ticket && ticket.status === 'resolved') {
          updateData.resolvedAt = undefined;
        }

        const updated = await supportStorage.updateTicket(id, updateData);
        if (!updated) {
          return reply.code(404).send({ error: 'Ticket not found' });
        }

        reply.send(updated);
      } catch (error) {
        console.error('Update admin ticket error:', error);
        reply.code(500).send({
          error: 'Failed to update ticket',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.post<{ Body: CreateFAQBody }>(
    '/admin/support/faq',
    {
      preHandler: [authMiddleware, requireAdmin()],
      schema: {
        body: {
          type: 'object',
          required: ['question', 'answer', 'category'],
          properties: {
            question: { type: 'string' },
            answer: { type: 'string' },
            category: { type: 'string', enum: ['general', 'editor', 'marketplace', 'account', 'technical'] },
            order: { type: 'number' },
            isPublished: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { question, answer, category, order, isPublished, tags } = request.body;

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
          return reply.code(400).send({ error: 'Question is required' });
        }

        if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
          return reply.code(400).send({ error: 'Answer is required' });
        }

        const faq = await supportStorage.createFAQ({
          question: question.trim(),
          answer: answer.trim(),
          category,
          order: order ?? 999,
          isPublished: isPublished ?? false,
          tags: tags ?? [],
        });

        reply.code(201).send(faq);
      } catch (error) {
        console.error('Create FAQ error:', error);
        reply.code(500).send({
          error: 'Failed to create FAQ',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.patch<{ Params: FAQParams; Body: UpdateFAQBody }>(
    '/admin/support/faq/:id',
    {
      preHandler: [authMiddleware, requireAdmin()],
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
            question: { type: 'string' },
            answer: { type: 'string' },
            category: { type: 'string', enum: ['general', 'editor', 'marketplace', 'account', 'technical'] },
            order: { type: 'number' },
            isPublished: { type: 'boolean' },
            tags: { type: 'array', items: { type: 'string' } },
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
        const updates = request.body;

        const updateData: Parameters<typeof supportStorage.updateFAQ>[1] = {};
        if (updates.question !== undefined) {
          updateData.question = updates.question.trim();
        }
        if (updates.answer !== undefined) {
          updateData.answer = updates.answer.trim();
        }
        if (updates.category !== undefined) {
          updateData.category = updates.category;
        }
        if (updates.order !== undefined) {
          updateData.order = updates.order;
        }
        if (updates.isPublished !== undefined) {
          updateData.isPublished = updates.isPublished;
        }
        if (updates.tags !== undefined) {
          updateData.tags = updates.tags;
        }

        const updated = await supportStorage.updateFAQ(id, updateData);
        if (!updated) {
          return reply.code(404).send({ error: 'FAQ not found' });
        }

        reply.send(updated);
      } catch (error) {
        console.error('Update FAQ error:', error);
        reply.code(500).send({
          error: 'Failed to update FAQ',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  app.delete<{ Params: FAQParams }>(
    '/admin/support/faq/:id',
    {
      preHandler: [authMiddleware, requireAdmin()],
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
        const deleted = await supportStorage.deleteFAQ(id);

        if (!deleted) {
          return reply.code(404).send({ error: 'FAQ not found' });
        }

        reply.send({ success: true });
      } catch (error) {
        console.error('Delete FAQ error:', error);
        reply.code(500).send({
          error: 'Failed to delete FAQ',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}


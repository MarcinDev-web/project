/**
 * Support Storage DB - PostgreSQL implementation using Prisma
 */

import { PrismaClient as PrismaClientType, Prisma } from '@engine/database';
import type {
  SupportTicket,
  SupportTicketMessage,
  SupportFAQ,
  SupportTicketWithMessages,
  SupportTicketStats,
  SupportStorage,
} from './SupportStorage.js';

export class SupportStorageDB implements SupportStorage {
  private static readonly MAX_LIMIT = 100;

  constructor(private readonly prisma: PrismaClientType) {}

  async initialize(): Promise<void> {
    // Schema is managed by Prisma migrations
    // No additional initialization needed
  }

  // Tickets

  async createTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupportTicket> {
    const created = await this.prisma.supportTicket.create({
      data: {
        userId: ticket.userId,
        type: ticket.type,
        status: ticket.status,
        priority: ticket.priority,
        title: ticket.title,
        description: ticket.description,
        metadata: ticket.metadata ? (ticket.metadata as Prisma.JsonObject) : null,
        assignedTo: ticket.assignedTo ?? null,
        resolvedAt: ticket.resolvedAt ? new Date(ticket.resolvedAt) : null,
      },
    });

    return this.mapPrismaToTicket(created);
  }

  async getTicket(id: string, userId?: string): Promise<SupportTicketWithMessages | null> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      return null;
    }

    // If userId is provided, filter out internal messages unless user is staff
    // For now, we'll include all messages - filtering will be done in routes based on user role
    const messages = ticket.messages.map((msg) => this.mapPrismaToMessage(msg));

    return {
      ...this.mapPrismaToTicket(ticket),
      messages,
    };
  }

  async getTickets(options: {
    userId?: string;
    status?: SupportTicket['status'];
    priority?: SupportTicket['priority'];
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<SupportTicket[]> {
    const limit = Math.min(options.limit ?? 50, SupportStorageDB.MAX_LIMIT);
    const offset = options.offset ?? 0;

    const where: Prisma.SupportTicketWhereInput = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.priority) {
      where.priority = options.priority;
    }

    if (options.assignedTo) {
      where.assignedTo = options.assignedTo;
    }

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return tickets.map((ticket) => this.mapPrismaToTicket(ticket));
  }

  async updateTicket(
    id: string,
    updates: Partial<Pick<SupportTicket, 'status' | 'priority' | 'assignedTo' | 'resolvedAt'>>
  ): Promise<SupportTicket | null> {
    const updateData: Prisma.SupportTicketUpdateInput = {};

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.priority !== undefined) {
      updateData.priority = updates.priority;
    }

    if (updates.assignedTo !== undefined) {
      updateData.assignedTo = updates.assignedTo ?? null;
    }

    if (updates.resolvedAt !== undefined) {
      updateData.resolvedAt = updates.resolvedAt ? new Date(updates.resolvedAt) : null;
    }

    try {
      const updated = await this.prisma.supportTicket.update({
        where: { id },
        data: updateData,
      });

      return this.mapPrismaToTicket(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null; // Record not found
      }
      throw error;
    }
  }

  async addMessage(
    ticketId: string,
    message: Omit<SupportTicketMessage, 'id' | 'createdAt'>
  ): Promise<SupportTicketMessage> {
    const created = await this.prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorId: message.authorId,
        content: message.content,
        isInternal: message.isInternal ?? false,
      },
    });

    return this.mapPrismaToMessage(created);
  }

  async getTicketStats(): Promise<SupportTicketStats> {
    const [total, open, inProgress, resolved, closed, byPriority] = await Promise.all([
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.count({ where: { status: 'open' } }),
      this.prisma.supportTicket.count({ where: { status: 'in_progress' } }),
      this.prisma.supportTicket.count({ where: { status: 'resolved' } }),
      this.prisma.supportTicket.count({ where: { status: 'closed' } }),
      Promise.all([
        this.prisma.supportTicket.count({ where: { priority: 'low' } }),
        this.prisma.supportTicket.count({ where: { priority: 'medium' } }),
        this.prisma.supportTicket.count({ where: { priority: 'high' } }),
        this.prisma.supportTicket.count({ where: { priority: 'urgent' } }),
      ]),
    ]);

    // Calculate average response time (time from ticket creation to first staff message)
    // This is a simplified calculation - could be improved
    const resolvedTickets = await this.prisma.supportTicket.findMany({
      where: { status: 'resolved', resolvedAt: { not: null } },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    let totalResponseTime = 0;
    let responseCount = 0;

    for (const ticket of resolvedTickets) {
      if (ticket.resolvedAt && ticket.messages.length > 0) {
        const firstMessage = ticket.messages[0];
        const responseTime = ticket.resolvedAt.getTime() - firstMessage.createdAt.getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    const averageResponseTime =
      responseCount > 0 ? totalResponseTime / responseCount / (1000 * 60 * 60) : undefined; // Convert to hours

    return {
      total,
      open,
      inProgress,
      resolved,
      closed,
      byPriority: {
        low: byPriority[0],
        medium: byPriority[1],
        high: byPriority[2],
        urgent: byPriority[3],
      },
      averageResponseTime,
    };
  }

  // FAQ

  async createFAQ(faq: Omit<SupportFAQ, 'id' | 'viewCount' | 'helpfulCount' | 'createdAt' | 'updatedAt'>): Promise<SupportFAQ> {
    const created = await this.prisma.supportFAQ.create({
      data: {
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        order: faq.order,
        isPublished: faq.isPublished,
        tags: faq.tags,
      },
    });

    return this.mapPrismaToFAQ(created);
  }

  async getFAQ(id: string): Promise<SupportFAQ | null> {
    const faq = await this.prisma.supportFAQ.findUnique({
      where: { id },
    });

    if (!faq) {
      return null;
    }

    return this.mapPrismaToFAQ(faq);
  }

  async getFAQs(options?: {
    category?: SupportFAQ['category'];
    isPublished?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<SupportFAQ[]> {
    const limit = Math.min(options?.limit ?? 50, SupportStorageDB.MAX_LIMIT);
    const offset = options?.offset ?? 0;

    const where: Prisma.SupportFAQWhereInput = {};

    if (options?.category) {
      where.category = options.category;
    }

    if (options?.isPublished !== undefined) {
      where.isPublished = options.isPublished;
    }

    if (options?.search && options.search.trim()) {
      const searchWords = options.search.trim().split(/\s+/).filter((word) => word.length > 0);
      if (searchWords.length > 0) {
        where.OR = [
          { question: { contains: options.search, mode: 'insensitive' } },
          { answer: { contains: options.search, mode: 'insensitive' } },
          { tags: { hasSome: searchWords } },
        ];
      }
    }

    const faqs = await this.prisma.supportFAQ.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });

    return faqs.map((faq) => this.mapPrismaToFAQ(faq));
  }

  async updateFAQ(id: string, updates: Partial<Omit<SupportFAQ, 'id' | 'createdAt'>>): Promise<SupportFAQ | null> {
    const updateData: Prisma.SupportFAQUpdateInput = {};

    if (updates.question !== undefined) {
      updateData.question = updates.question;
    }

    if (updates.answer !== undefined) {
      updateData.answer = updates.answer;
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

    try {
      const updated = await this.prisma.supportFAQ.update({
        where: { id },
        data: updateData,
      });

      return this.mapPrismaToFAQ(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null; // Record not found
      }
      throw error;
    }
  }

  async deleteFAQ(id: string): Promise<boolean> {
    try {
      await this.prisma.supportFAQ.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return false; // Record not found
      }
      throw error;
    }
  }

  async incrementFAQView(id: string): Promise<void> {
    await this.prisma.supportFAQ.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
  }

  async incrementFAQHelpful(id: string): Promise<void> {
    await this.prisma.supportFAQ.update({
      where: { id },
      data: {
        helpfulCount: {
          increment: 1,
        },
      },
    });
  }

  // Helper methods

  private mapPrismaToTicket(ticket: {
    id: string;
    userId: string;
    type: string;
    status: string;
    priority: string;
    title: string;
    description: string;
    metadata: Prisma.JsonValue | null;
    assignedTo: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SupportTicket {
    return {
      id: ticket.id,
      userId: ticket.userId,
      type: ticket.type as SupportTicket['type'],
      status: ticket.status as SupportTicket['status'],
      priority: ticket.priority as SupportTicket['priority'],
      title: ticket.title,
      description: ticket.description,
      metadata: ticket.metadata ? (ticket.metadata as Record<string, unknown>) : undefined,
      assignedTo: ticket.assignedTo ?? undefined,
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.getTime() : undefined,
      createdAt: ticket.createdAt.getTime(),
      updatedAt: ticket.updatedAt.getTime(),
    };
  }

  private mapPrismaToMessage(message: {
    id: string;
    ticketId: string;
    authorId: string;
    content: string;
    isInternal: boolean;
    createdAt: Date;
  }): SupportTicketMessage {
    return {
      id: message.id,
      ticketId: message.ticketId,
      authorId: message.authorId,
      content: message.content,
      isInternal: message.isInternal,
      createdAt: message.createdAt.getTime(),
    };
  }

  private mapPrismaToFAQ(faq: {
    id: string;
    question: string;
    answer: string;
    category: string;
    order: number;
    isPublished: boolean;
    tags: string[];
    viewCount: number;
    helpfulCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): SupportFAQ {
    return {
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category as SupportFAQ['category'],
      order: faq.order,
      isPublished: faq.isPublished,
      tags: faq.tags,
      viewCount: faq.viewCount,
      helpfulCount: faq.helpfulCount,
      createdAt: faq.createdAt.getTime(),
      updatedAt: faq.updatedAt.getTime(),
    };
  }
}


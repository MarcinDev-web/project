/**
 * Tests for SupportStorageDB
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PrismaClient as PrismaClientType } from '@engine/database';
import { SupportStorageDB } from '../SupportStorageDB.js';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mock:prisma';
}

describe('SupportStorageDB', () => {
  let storage: SupportStorageDB;
  let prisma: PrismaClientType;

  beforeEach(async () => {
    prisma = createMockPrismaClient();
    storage = new SupportStorageDB(prisma);
  });

  describe('createTicket', () => {
    it('creates a new support ticket', async () => {
      const ticket = await storage.createTicket({
        userId: 'user1',
        type: 'bug',
        status: 'open',
        priority: 'medium',
        title: 'Test Bug',
        description: 'This is a test bug report',
      });

      expect(ticket.id).toBeDefined();
      expect(ticket.userId).toBe('user1');
      expect(ticket.type).toBe('bug');
      expect(ticket.status).toBe('open');
      expect(ticket.priority).toBe('medium');
      expect(ticket.title).toBe('Test Bug');
      expect(ticket.description).toBe('This is a test bug report');
      expect(ticket.createdAt).toBeGreaterThan(0);
      expect(ticket.updatedAt).toBeGreaterThan(0);
    });
  });

  describe('getTicket', () => {
    it('retrieves a ticket with messages', async () => {
      const ticket = await storage.createTicket({
        userId: 'user1',
        type: 'question',
        status: 'open',
        priority: 'low',
        title: 'Test Question',
        description: 'This is a test question',
      });

      await storage.addMessage(ticket.id, {
        authorId: 'user1',
        content: 'First message',
        isInternal: false,
      });

      const retrieved = await storage.getTicket(ticket.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(ticket.id);
      expect(retrieved?.messages).toHaveLength(1);
      expect(retrieved?.messages[0].content).toBe('First message');
    });
  });

  describe('getTickets', () => {
    it('filters tickets by status', async () => {
      await storage.createTicket({
        userId: 'user1',
        type: 'bug',
        status: 'open',
        priority: 'medium',
        title: 'Open Ticket',
        description: 'Open',
      });

      await storage.createTicket({
        userId: 'user1',
        type: 'question',
        status: 'resolved',
        priority: 'low',
        title: 'Resolved Ticket',
        description: 'Resolved',
      });

      const openTickets = await storage.getTickets({ status: 'open' });
      expect(openTickets.length).toBeGreaterThan(0);
      expect(openTickets.every((t) => t.status === 'open')).toBe(true);
    });
  });

  describe('updateTicket', () => {
    it('updates ticket status', async () => {
      const ticket = await storage.createTicket({
        userId: 'user1',
        type: 'bug',
        status: 'open',
        priority: 'medium',
        title: 'Test Ticket',
        description: 'Test',
      });

      const updated = await storage.updateTicket(ticket.id, { status: 'in_progress' });
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('in_progress');
    });
  });

  describe('addMessage', () => {
    it('adds a message to a ticket', async () => {
      const ticket = await storage.createTicket({
        userId: 'user1',
        type: 'question',
        status: 'open',
        priority: 'low',
        title: 'Test',
        description: 'Test',
      });

      const message = await storage.addMessage(ticket.id, {
        authorId: 'user1',
        content: 'Test message',
        isInternal: false,
      });

      expect(message.id).toBeDefined();
      expect(message.ticketId).toBe(ticket.id);
      expect(message.content).toBe('Test message');
      expect(message.isInternal).toBe(false);
    });
  });

  describe('createFAQ', () => {
    it('creates a new FAQ', async () => {
      const faq = await storage.createFAQ({
        question: 'How do I use this?',
        answer: 'You use it like this.',
        category: 'general',
        order: 1,
        isPublished: true,
        tags: ['help'],
      });

      expect(faq.id).toBeDefined();
      expect(faq.question).toBe('How do I use this?');
      expect(faq.answer).toBe('You use it like this.');
      expect(faq.category).toBe('general');
      expect(faq.isPublished).toBe(true);
      expect(faq.viewCount).toBe(0);
      expect(faq.helpfulCount).toBe(0);
    });
  });

  describe('getFAQs', () => {
    it('filters FAQs by category', async () => {
      await storage.createFAQ({
        question: 'General question',
        answer: 'Answer',
        category: 'general',
        order: 1,
        isPublished: true,
        tags: [],
      });

      await storage.createFAQ({
        question: 'Editor question',
        answer: 'Answer',
        category: 'editor',
        order: 1,
        isPublished: true,
        tags: [],
      });

      const generalFAQs = await storage.getFAQs({ category: 'general', isPublished: true });
      expect(generalFAQs.length).toBeGreaterThan(0);
      expect(generalFAQs.every((f) => f.category === 'general')).toBe(true);
    });
  });

  describe('updateFAQ', () => {
    it('updates FAQ properties', async () => {
      const faq = await storage.createFAQ({
        question: 'Original question',
        answer: 'Original answer',
        category: 'general',
        order: 1,
        isPublished: false,
        tags: [],
      });

      const updated = await storage.updateFAQ(faq.id, {
        question: 'Updated question',
        isPublished: true,
      });

      expect(updated).not.toBeNull();
      expect(updated?.question).toBe('Updated question');
      expect(updated?.isPublished).toBe(true);
      expect(updated?.answer).toBe('Original answer'); // Unchanged
    });
  });

  describe('deleteFAQ', () => {
    it('deletes an FAQ', async () => {
      const faq = await storage.createFAQ({
        question: 'To be deleted',
        answer: 'Answer',
        category: 'general',
        order: 1,
        isPublished: true,
        tags: [],
      });

      const deleted = await storage.deleteFAQ(faq.id);
      expect(deleted).toBe(true);

      const retrieved = await storage.getFAQ(faq.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('incrementFAQView', () => {
    it('increments view count', async () => {
      const faq = await storage.createFAQ({
        question: 'Test',
        answer: 'Answer',
        category: 'general',
        order: 1,
        isPublished: true,
        tags: [],
      });

      await storage.incrementFAQView(faq.id);
      const updated = await storage.getFAQ(faq.id);
      expect(updated?.viewCount).toBe(1);
    });
  });

  describe('incrementFAQHelpful', () => {
    it('increments helpful count', async () => {
      const faq = await storage.createFAQ({
        question: 'Test',
        answer: 'Answer',
        category: 'general',
        order: 1,
        isPublished: true,
        tags: [],
      });

      await storage.incrementFAQHelpful(faq.id);
      const updated = await storage.getFAQ(faq.id);
      expect(updated?.helpfulCount).toBe(1);
    });
  });
});

type TicketRecord = {
  id: string;
  userId: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  metadata: Record<string, unknown> | null;
  assignedTo: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages: MessageRecord[];
};

type MessageRecord = {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
};

type FAQRecord = {
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
};

function createMockPrismaClient(): PrismaClientType {
  const tickets = new Map<string, TicketRecord>();
  const faqs = new Map<string, FAQRecord>();

  const cloneTicket = (record: TicketRecord) => ({
    id: record.id,
    userId: record.userId,
    type: record.type,
    status: record.status,
    priority: record.priority,
    title: record.title,
    description: record.description,
    metadata: record.metadata,
    assignedTo: record.assignedTo,
    resolvedAt: record.resolvedAt,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  });

  const cloneMessage = (record: MessageRecord) => ({
    id: record.id,
    ticketId: record.ticketId,
    authorId: record.authorId,
    content: record.content,
    isInternal: record.isInternal,
    createdAt: new Date(record.createdAt),
  });

  const cloneFaq = (record: FAQRecord) => ({
    id: record.id,
    question: record.question,
    answer: record.answer,
    category: record.category,
    order: record.order,
    isPublished: record.isPublished,
    tags: [...record.tags],
    viewCount: record.viewCount,
    helpfulCount: record.helpfulCount,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  });

  const matchesTicketWhere = (record: TicketRecord, where: any = {}) => {
    if (!where) return true;
    if (where.userId && record.userId !== where.userId) return false;
    if (where.status && record.status !== where.status) return false;
    if (where.priority && record.priority !== where.priority) return false;
    if (where.assignedTo && record.assignedTo !== where.assignedTo) return false;
    if (where.resolvedAt?.not !== undefined) {
      const shouldNot = where.resolvedAt.not;
      if (shouldNot === null && record.resolvedAt === null) {
        return false;
      }
      if (shouldNot !== null && record.resolvedAt && record.resolvedAt.getTime() === new Date(shouldNot).getTime()) {
        return false;
      }
    }
    return true;
  };

  const matchesFaqWhere = (record: FAQRecord, where: any = {}) => {
    if (!where) return true;
    if (where.category && record.category !== where.category) return false;
    if (where.isPublished !== undefined && record.isPublished !== where.isPublished) {
      return false;
    }
    if (where.OR) {
      return where.OR.some((condition: any) => {
        if (condition.question?.contains) {
          const search = condition.question.contains.toLowerCase();
          return record.question.toLowerCase().includes(search);
        }
        if (condition.answer?.contains) {
          const search = condition.answer.contains.toLowerCase();
          return record.answer.toLowerCase().includes(search);
        }
        if (condition.tags?.hasSome) {
          return condition.tags.hasSome.some((tag: string) =>
            record.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
          );
        }
        return false;
      });
    }
    return true;
  };

  return {
    supportTicket: {
      create: async ({ data }: any) => {
        const now = new Date();
        const record: TicketRecord = {
          id: randomUUID(),
          userId: data.userId,
          type: data.type,
          status: data.status,
          priority: data.priority,
          title: data.title,
          description: data.description,
          metadata: (data.metadata as Record<string, unknown>) ?? null,
          assignedTo: data.assignedTo ?? null,
          resolvedAt: data.resolvedAt ?? null,
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        tickets.set(record.id, record);
        return cloneTicket(record);
      },
      findUnique: async ({ where, include }: any) => {
        const record = tickets.get(where.id);
        if (!record) {
          return null;
        }
        const base = cloneTicket(record);
        if (include?.messages) {
          const ordered = [...record.messages].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
          );
          const limited =
            typeof include.messages.take === 'number' ? ordered.slice(0, include.messages.take) : ordered;
          return {
            ...base,
            messages: limited.map(cloneMessage),
          };
        }
        return base;
      },
      findMany: async ({ where, take, skip, orderBy, include }: any) => {
        let results = Array.from(tickets.values()).filter((record) => matchesTicketWhere(record, where));
        const orderConfig = Array.isArray(orderBy) ? orderBy[0] : orderBy;
        if (orderConfig?.createdAt === 'desc') {
          results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else if (orderConfig?.createdAt === 'asc') {
          results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        const sliced = results.slice(skip ?? 0, take ? (skip ?? 0) + take : undefined);
        return sliced.map((record) => {
          if (include?.messages) {
            const ordered = [...record.messages].sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
            );
            const limited =
              typeof include.messages.take === 'number' ? ordered.slice(0, include.messages.take) : ordered;
            return {
              ...cloneTicket(record),
              messages: limited.map(cloneMessage),
            };
          }
          return cloneTicket(record);
        });
      },
      update: async ({ where, data }: any) => {
        const record = tickets.get(where.id);
        if (!record) {
          throw new Error('Record not found');
        }
        if (data.status !== undefined) record.status = data.status;
        if (data.priority !== undefined) record.priority = data.priority;
        if (data.assignedTo !== undefined) record.assignedTo = data.assignedTo;
        if (data.resolvedAt !== undefined) record.resolvedAt = data.resolvedAt;
        record.updatedAt = new Date();
        return cloneTicket(record);
      },
      count: async ({ where }: any = {}) => {
        return Array.from(tickets.values()).filter((record) => matchesTicketWhere(record, where)).length;
      },
    },
    supportTicketMessage: {
      create: async ({ data }: any) => {
        const record = tickets.get(data.ticketId);
        if (!record) {
          throw new Error('Ticket not found');
        }
        const message: MessageRecord = {
          id: randomUUID(),
          ticketId: data.ticketId,
          authorId: data.authorId,
          content: data.content,
          isInternal: data.isInternal ?? false,
          createdAt: new Date(),
        };
        record.messages.push(message);
        record.updatedAt = new Date();
        return cloneMessage(message);
      },
    },
    supportFAQ: {
      create: async ({ data }: any) => {
        const now = new Date();
        const record: FAQRecord = {
          id: randomUUID(),
          question: data.question,
          answer: data.answer,
          category: data.category,
          order: data.order,
          isPublished: data.isPublished,
          tags: data.tags ?? [],
          viewCount: 0,
          helpfulCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        faqs.set(record.id, record);
        return cloneFaq(record);
      },
      findUnique: async ({ where }: any) => {
        const record = faqs.get(where.id);
        return record ? cloneFaq(record) : null;
      },
      findMany: async ({ where, take, skip, orderBy }: any) => {
        let results = Array.from(faqs.values()).filter((record) => matchesFaqWhere(record, where));
        if (orderBy) {
          results.sort((a, b) => {
            if (orderBy[0]?.order === 'asc') {
              if (a.order !== b.order) {
                return a.order - b.order;
              }
            }
            if (orderBy[1]?.createdAt === 'desc') {
              return b.createdAt.getTime() - a.createdAt.getTime();
            }
            return 0;
          });
        }
        const sliced = results.slice(skip ?? 0, take ? (skip ?? 0) + take : undefined);
        return sliced.map(cloneFaq);
      },
      update: async ({ where, data }: any) => {
        const record = faqs.get(where.id);
        if (!record) {
          throw new Error('FAQ not found');
        }
        if (data.question !== undefined) record.question = data.question;
        if (data.answer !== undefined) record.answer = data.answer;
        if (data.category !== undefined) record.category = data.category;
        if (data.order !== undefined) record.order = data.order;
        if (data.isPublished !== undefined) record.isPublished = data.isPublished;
        if (data.tags !== undefined) record.tags = data.tags;
        if (data.viewCount?.increment) record.viewCount += data.viewCount.increment;
        if (data.helpfulCount?.increment) record.helpfulCount += data.helpfulCount.increment;
        record.updatedAt = new Date();
        return cloneFaq(record);
      },
      delete: async ({ where }: any) => {
        const record = faqs.get(where.id);
        if (!record) {
          throw new Error('FAQ not found');
        }
        faqs.delete(where.id);
        return cloneFaq(record);
      },
    },
  } as unknown as PrismaClientType;
}


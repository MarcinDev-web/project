/**
 * Tests for SupportStorageDB
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SupportStorageDB } from '../SupportStorageDB.js';
import { getPrismaClient } from '../../lib/db.js';

describe('SupportStorageDB', () => {
  let storage: SupportStorageDB;
  let prisma: Awaited<ReturnType<typeof getPrismaClient>>;

  beforeEach(async () => {
    prisma = await getPrismaClient();
    storage = new SupportStorageDB(prisma);
    await storage.initialize();
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


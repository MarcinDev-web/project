/**
 * Tests for MessagesStorage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MessagesStorage } from '../MessagesStorage';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('MessagesStorage', () => {
  let storage: MessagesStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));
    storage = new MessagesStorage(tempDir);
    await storage.initialize();
  });

  describe('Direct conversations', () => {
    it('creates conversation between two users', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';

      const conversation = await storage.getOrCreateConversation(userId1, userId2);

      expect(conversation.id).toContain('conv_');
      expect(conversation.type).toBe('direct');
      expect(conversation.participants).toContain(userId1);
      expect(conversation.participants).toContain(userId2);
      expect(conversation.participants.length).toBe(2);
    });

    it('returns same conversation for same users', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';

      const conv1 = await storage.getOrCreateConversation(userId1, userId2);
      const conv2 = await storage.getOrCreateConversation(userId2, userId1);

      expect(conv1.id).toBe(conv2.id);
    });

    it('creates and retrieves messages', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';

      const message = await storage.createMessage(userId1, userId2, 'Hello!');

      expect(message.id).toBeDefined();
      expect(message.fromUserId).toBe(userId1);
      expect(message.toUserId).toBe(userId2);
      expect(message.content).toBe('Hello!');
      expect(message.read).toBe(false);

      const messages = await storage.getMessages(message.conversationId);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.id).toBe(message.id);
    });

    it('updates conversation lastMessage on new message', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';

      const message = await storage.createMessage(userId1, userId2, 'Test message');

      const conversation = await storage.getConversation(message.conversationId);
      expect(conversation?.lastMessage).toBe('Test message');
      expect(conversation?.lastMessageAt).toBeGreaterThan(0);
    });

    it('marks message as read', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';

      const message = await storage.createMessage(userId1, userId2, 'Hello!');
      const marked = await storage.markAsRead(message.id, userId2);

      expect(marked).toBe(true);

      const messages = await storage.getMessages(message.conversationId);
      expect(messages[0]?.read).toBe(true);
    });

    it('gets unread count for conversation', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';

      await storage.createMessage(userId1, userId2, 'Message 1');
      await storage.createMessage(userId1, userId2, 'Message 2');
      await storage.createMessage(userId1, userId2, 'Message 3');

      const conversation = await storage.getOrCreateConversation(userId1, userId2);
      const unreadCount = await storage.getUnreadCountForConversation(conversation.id, userId2);

      expect(unreadCount).toBe(3);
    });
  });

  describe('Group conversations', () => {
    it('creates group conversation', async () => {
      const ownerId = 'owner';
      const memberIds = ['member1', 'member2', 'member3'];

      const conversation = await storage.createGroupConversation(
        ownerId,
        'Test Group',
        memberIds
      );

      expect(conversation.id).toContain('group_');
      expect(conversation.type).toBe('group');
      expect(conversation.groupName).toBe('Test Group');
      expect(conversation.ownerId).toBe(ownerId);
      expect(conversation.participants).toContain(ownerId);
      memberIds.forEach(id => {
        expect(conversation.participants).toContain(id);
      });
      expect(conversation.participants.length).toBe(4);
    });

    it('creates group message', async () => {
      const ownerId = 'owner';
      const memberIds = ['member1', 'member2'];

      const conversation = await storage.createGroupConversation(
        ownerId,
        'Test Group',
        memberIds
      );

      const message = await storage.createMessage(ownerId, conversation.id, 'Group message', true);

      expect(message.conversationId).toBe(conversation.id);
      expect(message.fromUserId).toBe(ownerId);
      expect(message.content).toBe('Group message');

      const messages = await storage.getMessages(conversation.id);
      expect(messages).toHaveLength(1);
    });

    it('updates group name and avatar', async () => {
      const ownerId = 'owner';
      const conversation = await storage.createGroupConversation(ownerId, 'Old Name', []);

      const updated = await storage.updateGroupConversation(conversation.id, {
        groupName: 'New Name',
        groupAvatar: 'https://example.com/avatar.png',
      });

      expect(updated?.groupName).toBe('New Name');
      expect(updated?.groupAvatar).toBe('https://example.com/avatar.png');

      const retrieved = await storage.getConversation(conversation.id);
      expect(retrieved?.groupName).toBe('New Name');
    });

    it('adds members to group', async () => {
      const ownerId = 'owner';
      const conversation = await storage.createGroupConversation(ownerId, 'Group', ['member1']);

      const added = await storage.addGroupMembers(conversation.id, ['member2', 'member3']);

      expect(added).toBe(true);

      const updated = await storage.getConversation(conversation.id);
      expect(updated?.participants).toContain('member2');
      expect(updated?.participants).toContain('member3');
      expect(updated?.participants.length).toBe(4);
    });

    it('removes member from group', async () => {
      const ownerId = 'owner';
      const conversation = await storage.createGroupConversation(
        ownerId,
        'Group',
        ['member1', 'member2']
      );

      const removed = await storage.removeGroupMember(conversation.id, 'member1');

      expect(removed).toBe(true);

      const updated = await storage.getConversation(conversation.id);
      expect(updated?.participants).not.toContain('member1');
      expect(updated?.participants.length).toBe(2); // owner + member2
    });

    it('gets unread count for group (excludes sender)', async () => {
      const ownerId = 'owner';
      const memberId = 'member1';

      const conversation = await storage.createGroupConversation(ownerId, 'Group', [memberId]);

      await storage.createMessage(ownerId, conversation.id, 'Message from owner', true);
      await storage.createMessage(memberId, conversation.id, 'Message from member', true);

      // From owner's perspective - should see member's message as unread
      const ownerUnread = await storage.getUnreadCountForConversation(conversation.id, ownerId);
      expect(ownerUnread).toBe(1); // Only member's message

      // From member's perspective - should see owner's message as unread
      const memberUnread = await storage.getUnreadCountForConversation(conversation.id, memberId);
      expect(memberUnread).toBe(1); // Only owner's message
    });
  });

  describe('Conversation retrieval', () => {
    it('gets all conversations for user', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      const userId3 = 'user3';

      await storage.createMessage(userId1, userId2, 'Message 1');
      await storage.createMessage(userId1, userId3, 'Message 2');

      const conversations = await storage.getConversations(userId1);
      expect(conversations.length).toBeGreaterThanOrEqual(2);
    });

    it('sorts conversations by lastMessageAt', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      const userId3 = 'user3';

      await storage.createMessage(userId1, userId2, 'First');
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.createMessage(userId1, userId3, 'Second');

      const conversations = await storage.getConversations(userId1);

      expect(conversations[0]?.lastMessageAt).toBeGreaterThanOrEqual(
        conversations[conversations.length - 1]?.lastMessageAt ?? 0
      );
    });
  });
});


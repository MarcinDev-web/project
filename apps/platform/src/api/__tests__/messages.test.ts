/**
 * Tests for messages API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { messagesApi } from '../messages';
import { apiClient } from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('messagesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets conversations', async () => {
    const mockConversations = [
      { id: 'conv1', type: 'direct', participants: ['user1', 'user2'], lastMessageAt: Date.now() },
    ];
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockConversations);

    const result = await messagesApi.getConversations();
    expect(result).toEqual(mockConversations);
    expect(apiClient.get).toHaveBeenCalledWith('/messages');
  });

  it('gets messages for conversation', async () => {
    const mockMessages = [
      { id: 'msg1', conversationId: 'conv1', fromUserId: 'user1', toUserId: 'user2', content: 'Hello', read: false, createdAt: Date.now() },
    ];
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessages);

    const result = await messagesApi.getMessages('conv1', 50);
    expect(result).toEqual(mockMessages);
    expect(apiClient.get).toHaveBeenCalledWith('/messages/conv1?limit=50');
  });

  it('sends direct message', async () => {
    const mockMessage = {
      id: 'msg1',
      conversationId: 'conv1',
      fromUserId: 'user1',
      toUserId: 'user2',
      content: 'Hello',
      read: false,
      createdAt: Date.now(),
    };
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessage);

    const result = await messagesApi.sendMessage('user2', 'Hello');
    expect(result).toEqual(mockMessage);
    expect(apiClient.post).toHaveBeenCalledWith('/messages', { toUserId: 'user2', content: 'Hello' });
  });

  it('sends group message', async () => {
    const mockMessage = {
      id: 'msg1',
      conversationId: 'group1',
      fromUserId: 'user1',
      toUserId: 'group1',
      content: 'Hello group',
      read: false,
      createdAt: Date.now(),
    };
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessage);

    const result = await messagesApi.sendMessage('group1', 'Hello group', 'group1');
    expect(result).toEqual(mockMessage);
    expect(apiClient.post).toHaveBeenCalledWith('/messages', {
      conversationId: 'group1',
      content: 'Hello group',
    });
  });

  it('marks message as read', async () => {
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await messagesApi.markAsRead('msg1');
    expect(apiClient.put).toHaveBeenCalledWith('/messages/msg1/read');
  });

  it('creates group conversation', async () => {
    const mockGroup = {
      id: 'group1',
      type: 'group',
      groupName: 'Test Group',
      participants: ['user1', 'user2', 'user3'],
      lastMessageAt: Date.now(),
    };
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroup);

    const result = await messagesApi.createGroup('Test Group', ['user2', 'user3']);
    expect(result).toEqual(mockGroup);
    expect(apiClient.post).toHaveBeenCalledWith('/messages/groups', {
      groupName: 'Test Group',
      memberIds: ['user2', 'user3'],
      groupAvatar: undefined,
    });
  });
});


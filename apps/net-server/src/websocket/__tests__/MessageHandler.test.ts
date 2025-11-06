/**
 * Tests for MessageHandler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageHandler } from '../MessageHandler.js';
import { MessagesStorage } from '../../storage/MessagesStorage.js';
import { SessionManager } from '../SessionManager.js';
import type { WebSocket } from 'ws';

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;
  let messagesStorage: MessagesStorage;
  let sessionManager: SessionManager;
  let mockWs: Partial<WebSocket>;

  beforeEach(async () => {
    const { promises: fs } = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));
    messagesStorage = new MessagesStorage(tempDir);
    await messagesStorage.initialize();
    
    sessionManager = new SessionManager();
    messageHandler = new MessageHandler(messagesStorage, sessionManager);

    mockWs = {
      send: vi.fn(),
      readyState: 1, // OPEN
      OPEN: 1,
    };
  });

  it('handles new direct message notification', async () => {
    const userId1 = 'user1';
    const userId2 = 'user2';

    const message = await messagesStorage.createMessage(userId1, userId2, 'Hello');

    // Mock user2 as online
    const mockWs2 = {
      send: vi.fn(),
      readyState: 1,
      OPEN: 1,
    };
    sessionManager.setUserOnline(userId2, mockWs2 as unknown as WebSocket);

    await messageHandler.handleNewMessage(message);

    expect(mockWs2.send).toHaveBeenCalled();
    const sendCalls = (mockWs2.send as ReturnType<typeof vi.fn>).mock.calls;
    expect(sendCalls.length).toBeGreaterThan(0);
    const sentMessage = JSON.parse(sendCalls[0]?.[0] as string);
    expect(sentMessage?.type).toBe('message:new');
    expect(sentMessage?.message?.id).toBe(message.id);
    expect(sentMessage?.message?.content).toBe('Hello');
  });

  it('handles new group message notification', async () => {
    const ownerId = 'owner';
    const member1 = 'member1';
    const member2 = 'member2';

    const conversation = await messagesStorage.createGroupConversation(
      ownerId,
      'Test Group',
      [member1, member2]
    );

    const message = await messagesStorage.createMessage(ownerId, conversation.id, 'Group message', true);

    // Mock members as online
    const mockWs1 = { send: vi.fn(), readyState: 1, OPEN: 1 };
    const mockWs2 = { send: vi.fn(), readyState: 1, OPEN: 1 };
    sessionManager.setUserOnline(member1, mockWs1 as unknown as WebSocket);
    sessionManager.setUserOnline(member2, mockWs2 as unknown as WebSocket);

    await messageHandler.handleNewMessage(message);

    // Should notify both members, not owner
    expect(mockWs1.send).toHaveBeenCalled();
    expect(mockWs2.send).toHaveBeenCalled();

    const sendCalls1 = (mockWs1.send as ReturnType<typeof vi.fn>).mock.calls;
    expect(sendCalls1.length).toBeGreaterThan(0);
    const sentMessage1 = JSON.parse(sendCalls1[0]?.[0] as string);
    expect(sentMessage1?.type).toBe('message:new');
    expect(sentMessage1?.message?.fromUserId).toBe(ownerId);
  });

  it('handles typing indicator for conversation', async () => {
    const userId1 = 'user1';
    const userId2 = 'user2';

    const conversation = await messagesStorage.getOrCreateConversation(userId1, userId2);

    const mockWs2 = { send: vi.fn(), readyState: 1, OPEN: 1 };
    sessionManager.setUserOnline(userId2, mockWs2 as unknown as WebSocket);

    messageHandler.handleTyping(conversation.id, userId1, true, mockWs as unknown as WebSocket);

    // Wait for async broadcast
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should notify user2
    expect(mockWs2.send).toHaveBeenCalled();
    const callArgs = (mockWs2.send as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs?.[0]).toBeDefined();
    const sentMessage = JSON.parse(callArgs![0] as string);
    expect(sentMessage.type).toBe('message:typing');
    expect(sentMessage.userId).toBe(userId1);
    expect(sentMessage.typing).toBe(true);
  });

  it('handles message read notification', async () => {
    const userId1 = 'user1';
    const userId2 = 'user2';

    const message = await messagesStorage.createMessage(userId1, userId2, 'Hello');
    await messagesStorage.markAsRead(message.id, userId2);

    const mockWs1 = { send: vi.fn(), readyState: 1, OPEN: 1 };
    sessionManager.setUserOnline(userId1, mockWs1 as unknown as unknown as WebSocket);

    await messageHandler.handleMessageRead(message.id, message.conversationId, userId2);

    expect(mockWs1.send).toHaveBeenCalled();
    const callArgs = (mockWs1.send as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs?.[0]).toBeDefined();
    const sentMessage = JSON.parse(callArgs![0] as string);
    expect(sentMessage.type).toBe('message:read');
    expect(sentMessage.messageId).toBe(message.id);
    expect(sentMessage.userId).toBe(userId2);
  });
});



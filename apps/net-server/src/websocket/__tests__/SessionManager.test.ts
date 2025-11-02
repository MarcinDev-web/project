/**
 * Tests for SessionManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../SessionManager';
import type { WebSocket } from 'ws';

// WebSocket readyState constants
const WS_OPEN = 1;

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockWs: Partial<WebSocket>;

  beforeEach(() => {
    sessionManager = new SessionManager();
    mockWs = {
      readyState: WS_OPEN,
      OPEN: WS_OPEN,
      on: vi.fn(),
    };
  });

  it('tracks user online status', () => {
    const userId = 'user1';

    sessionManager.setUserOnline(userId, mockWs as WebSocket);

    expect(sessionManager.isUserOnline(userId)).toBe(true);
  });

  it('tracks user offline status', () => {
    const userId = 'user1';

    sessionManager.setUserOnline(userId, mockWs as WebSocket);
    sessionManager.setUserOffline(userId);

    expect(sessionManager.isUserOnline(userId)).toBe(false);
  });

  it('gets list of online users', () => {
    const userId1 = 'user1';
    const userId2 = 'user2';
    const userId3 = 'user3';

    const mockWs1 = { ...mockWs, readyState: WS_OPEN, OPEN: WS_OPEN };
    const mockWs2 = { ...mockWs, readyState: WS_OPEN, OPEN: WS_OPEN };
    const mockWs3 = { ...mockWs, readyState: 3, OPEN: WS_OPEN }; // CLOSED

    sessionManager.setUserOnline(userId1, mockWs1 as WebSocket);
    sessionManager.setUserOnline(userId2, mockWs2 as WebSocket);
    sessionManager.setUserOnline(userId3, mockWs3 as WebSocket);

    const onlineUsers = sessionManager.getOnlineUsers();
    expect(onlineUsers).toContain(userId1);
    expect(onlineUsers).toContain(userId2);
    expect(onlineUsers).not.toContain(userId3); // CLOSED connection
  });

  it('sends message to specific user', () => {
    const userId = 'user1';
    const mockWsWithSend = {
      ...mockWs,
      readyState: WS_OPEN,
      OPEN: WS_OPEN,
      send: vi.fn(),
    };

    sessionManager.setUserOnline(userId, mockWsWithSend as WebSocket);

    const message = { type: 'test', data: 'hello' };
    sessionManager.sendToUser(userId, message);

    expect(mockWsWithSend.send).toHaveBeenCalledWith(JSON.stringify(message));
  });

  it('does not send to offline user', () => {
    const userId = 'user1';
    const mockWsWithSend = {
      ...mockWs,
      send: vi.fn(),
    };

    // User is not online
    sessionManager.sendToUser(userId, { type: 'test' });

    expect(mockWsWithSend.send).not.toHaveBeenCalled();
  });
});


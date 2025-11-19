/**
 * Tests for SessionManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from '../SessionManager.js';
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

  describe('Max Players', () => {
    it('enforces max players limit', async () => {
      const ownerId = 'owner';
      const session = await sessionManager.createSession('project1', ownerId, { maxPlayers: 2 });
      
      // Mock owner joining (createSession adds owner to map but we need to "join" for websocket tracking in this test context if we use joinSession, 
      // but createSession manually adds to users map. joinSession is for NEW users)
      
      // Add owner connection to be safe, though createSession adds to user map
      sessionManager.setUserOnline(ownerId, mockWs as WebSocket);
      // Owner is already in session.users from createSession

      const user2 = 'user2';
      const user3 = 'user3';

      // User 2 joins - should succeed (1 owner + 1 new = 2)
      sessionManager.joinSession(session.id, user2, { id: user2, email: 'u2', createdAt: 0 }, mockWs as WebSocket);
      expect(session.users.size).toBe(2);

      // User 3 joins - should fail
      expect(() => {
        sessionManager.joinSession(session.id, user3, { id: user3, email: 'u3', createdAt: 0 }, mockWs as WebSocket);
      }).toThrow('Session is full');
      
      expect(session.users.size).toBe(2);
    });

    it('allows unlimited players if maxPlayers is not set', async () => {
      const ownerId = 'owner';
      const session = await sessionManager.createSession('project1', ownerId); // No maxPlayers

      const user2 = 'user2';
      const user3 = 'user3';

      sessionManager.joinSession(session.id, user2, { id: user2, email: 'u2', createdAt: 0 }, mockWs as WebSocket);
      sessionManager.joinSession(session.id, user3, { id: user3, email: 'u3', createdAt: 0 }, mockWs as WebSocket);

      expect(session.users.size).toBe(3);
    });
  });

  describe('Join In Progress', () => {
    it('prevents new users from joining if disabled', async () => {
      const ownerId = 'owner';
      const session = await sessionManager.createSession('project1', ownerId, { allowJoinInProgress: false });

      const user2 = 'user2';

      expect(() => {
        sessionManager.joinSession(session.id, user2, { id: user2, email: 'u2', createdAt: 0 }, mockWs as WebSocket);
      }).toThrow('Join in progress is disabled');
    });

    it('allows existing users to reconnect if disabled', async () => {
      const ownerId = 'owner';
      const session = await sessionManager.createSession('project1', ownerId, { allowJoinInProgress: false });

      const user2 = 'user2';
      
      // Manually add user2 to simulate they were there before
      session.users.set(user2, { id: user2, email: 'u2', createdAt: 0 });
      // Note: In real flow, user would be in sessionUsers set. 
      // We need to hack internal state slightly because we can't "join" initially if it's disabled.
      // But wait, createSession sets allowJoinInProgress. 
      // Typically the creator joins first.
      // If we want to simulate a user who disconnected and is reconnecting:
      
      // Let's use the internal sessionUsers map which SessionManager uses to track who "is in"
      // Access private property for test setup (or use a public method if available)
      // sessionManager.joinSession puts them in.
      
      // To properly test RECONNECT, we need the user to be in session.users.
      // Since joinSession throws, we can't use it to "seed" the user.
      // We'll rely on the fact that createSession adds the owner.
      
      // Test owner reconnecting
      expect(() => {
        sessionManager.joinSession(session.id, ownerId, { id: ownerId, email: 'owner', createdAt: 0 }, mockWs as WebSocket);
      }).not.toThrow();
    });

    it('allows new users if enabled', async () => {
      const ownerId = 'owner';
      const session = await sessionManager.createSession('project1', ownerId, { allowJoinInProgress: true });

      const user2 = 'user2';

      expect(() => {
        sessionManager.joinSession(session.id, user2, { id: user2, email: 'u2', createdAt: 0 }, mockWs as WebSocket);
      }).not.toThrow();
    });
  });
});

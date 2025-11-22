import type { WebSocket } from 'ws';
import type { CollaborationSession, PublicUser } from '../types/websocket.js';
import type { PublicUser as AuthPublicUser } from '../types/auth.js';
import type { AuthManager } from '../auth/AuthManager.js';
import { PhysicsManager, PHYSICS_CONSTANTS } from '../physics/PhysicsManager.js';

/**
 * Manages active collaboration sessions and WebSocket connections.
 */
export class SessionManager {
  private readonly authManager: AuthManager | null;
  private sessions = new Map<string, CollaborationSession>();
  private connections = new Map<string, WebSocket>(); // userId -> WebSocket
  private sessionUsers = new Map<string, Set<string>>(); // sessionId -> Set<userId>
  private userSessions = new Map<string, string>(); // userId -> sessionId
  private physicsManagers = new Map<string, PhysicsManager>(); // sessionId -> PhysicsManager
  private physicsLoop: NodeJS.Timeout | null = null;

  constructor(authManager?: AuthManager) {
    this.authManager = authManager ?? null;
    
    // Start physics loop
    this.physicsLoop = setInterval(() => this.updatePhysics(), PHYSICS_CONSTANTS.STEP_DT * 1000);
  }

  /**
   * Update physics for all sessions.
   */
  private updatePhysics() {
    for (const manager of this.physicsManagers.values()) {
      manager.step(PHYSICS_CONSTANTS.STEP_DT);
    }
  }

  /**
   * Get physics manager for a session.
   */
  getPhysicsManager(sessionId: string): PhysicsManager | null {
    return this.physicsManagers.get(sessionId) ?? null;
  }

  /**
   * Create a new collaboration session.
   */
  async createSession(
    projectId: string,
    ownerId: string,
    options?: { maxPlayers?: number; allowJoinInProgress?: boolean }
  ): Promise<CollaborationSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const ownerUser = await this.getPublicUser(ownerId);

    const session: CollaborationSession = {
      id: sessionId,
      projectId,
      ownerId,
      createdAt: Date.now(),
      users: new Map([[ownerId, ownerUser]]),
      maxPlayers: options?.maxPlayers,
      allowJoinInProgress: options?.allowJoinInProgress,
    };

    this.sessions.set(sessionId, session);
    this.sessionUsers.set(sessionId, new Set([ownerId]));
    
    // Initialize physics
    const physics = new PhysicsManager();
    physics.addPlayer(ownerId, 0, 10, 0); // Initial spawn
    this.physicsManagers.set(sessionId, physics);

    return session;
  }

  /**
   * Join a user to a session.
   */
  joinSession(sessionId: string, userId: string, user: AuthPublicUser, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check max players
    if (session.maxPlayers !== undefined && session.users.size >= session.maxPlayers) {
      throw new Error('Session is full');
    }

    // Check join in progress
    if (session.allowJoinInProgress === false && !session.users.has(userId)) {
      // Allow if user was already in session (reconnect)
      // But if it's a new user and join in progress is disabled, block
      // Note: logic might need refinement based on whether game has started
      // For now, we'll assume if session exists, game is in progress
      throw new Error('Join in progress is disabled');
    }

    // Add user to session
    session.users.set(userId, user);
    const users = this.sessionUsers.get(sessionId) ?? new Set();
    users.add(userId);
    this.sessionUsers.set(sessionId, users);

    // Track connection
    this.connections.set(userId, ws);
    this.userSessions.set(userId, sessionId);
    
    // Add user to physics
    const physics = this.physicsManagers.get(sessionId);
    if (physics) {
       physics.addPlayer(userId, 0, 10, 0);
    }

    // Handle connection close
    ws.on('close', () => {
      this.leaveSession(sessionId, userId);
    });
  }

  /**
   * Remove a user from a session.
   */
  leaveSession(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.users.delete(userId);
    }

    const users = this.sessionUsers.get(sessionId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        // Session is empty, remove it
        this.sessions.delete(sessionId);
        this.sessionUsers.delete(sessionId);
        
        // Cleanup physics
        const physics = this.physicsManagers.get(sessionId);
        if (physics) {
            physics.dispose();
            this.physicsManagers.delete(sessionId);
        }
      }
    }

    // Remove user from physics (if session still exists)
    const physics = this.physicsManagers.get(sessionId);
    if (physics) {
        physics.removePlayer(userId);
    }

    this.connections.delete(userId);
    this.userSessions.delete(userId);
  }

  /**
   * Get all users in a session.
   */
  getSessionUsers(sessionId: string): PublicUser[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return Array.from(session.users.values());
  }

  /**
   * Get session by ID.
   */
  getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Broadcast a message to all users in a session.
   */
  broadcast(sessionId: string, message: unknown, excludeUserId?: string): void {
    const users = this.sessionUsers.get(sessionId);
    if (!users) {
      return;
    }

    const messageJson = JSON.stringify(message);

    for (const userId of users) {
      if (userId === excludeUserId) {
        continue;
      }

      const ws = this.connections.get(userId);
      if (ws && ws.readyState === ws.OPEN) {
        try {
          ws.send(messageJson);
        } catch (error) {
          console.error(`Failed to send message to user ${userId}:`, error);
        }
      }
    }
  }

  /**
   * Send a message to a specific user.
   */
  sendToUser(userId: string, message: unknown): void {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to user ${userId}:`, error);
      }
    }
  }

  /**
   * Get session ID for a user.
   */
  getUserSession(userId: string): string | null {
    return this.userSessions.get(userId) ?? null;
  }

  /**
   * Check if user is in a session.
   */
  isUserInSession(userId: string, sessionId: string): boolean {
    const users = this.sessionUsers.get(sessionId);
    return users?.has(userId) ?? false;
  }

  /**
   * Helper to create PublicUser from userId.
   */
  private async getPublicUser(userId: string): Promise<PublicUser> {
    // If AuthManager is available, fetch user data
    if (this.authManager) {
      const user = await this.authManager.getUserById(userId);
      if (user) {
        return {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        };
      }
    }

    // Fallback if AuthManager is not available or user not found
    return {
      id: userId,
      email: 'unknown@example.com',
      createdAt: Date.now(),
    };
  }

  /**
   * Set user data for a connection (called when user joins with full user info).
   */
  setUserData(userId: string, user: AuthPublicUser): void {
    // Update user in all their sessions
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.users.set(userId, user);
      }
    }
  }

  /**
   * Check if user is online (has active WebSocket connection).
   */
  isUserOnline(userId: string): boolean {
    const ws = this.connections.get(userId);
    return ws !== undefined && ws.readyState === ws.OPEN;
  }

  /**
   * Get list of online user IDs.
   */
  getOnlineUsers(): string[] {
    const online: string[] = [];
    for (const [userId, ws] of this.connections.entries()) {
      if (ws.readyState === ws.OPEN) {
        online.push(userId);
      }
    }
    return online;
  }

  /**
   * Register a user as online (called when WebSocket connects).
   */
  setUserOnline(userId: string, ws: WebSocket): void {
    const wasOnline = this.isUserOnline(userId);
    this.connections.set(userId, ws);

    // Broadcast online status to friends if this is a new connection
    if (!wasOnline) {
      this.broadcastPresenceChange(userId, true);
    }
  }

  /**
   * Unregister a user as online (called when WebSocket disconnects).
   */
  setUserOffline(userId: string): void {
    const wasOnline = this.isUserOnline(userId);
    this.connections.delete(userId);

    // Broadcast offline status to friends if user was online
    if (wasOnline) {
      this.broadcastPresenceChange(userId, false);
    }
  }

  /**
   * Broadcast presence change to friends (requires FriendsStorage - will be injected).
   */
  private broadcastPresenceChange(userId: string, isOnline: boolean): void {
    // This will be called from outside with FriendsStorage
    // For now, we'll add a callback mechanism
    if (this.presenceCallback) {
      this.presenceCallback(userId, isOnline);
    }
  }

  private presenceCallback?: (userId: string, isOnline: boolean) => void;

  /**
   * Set callback for presence changes (used by WebSocketHandler).
   */
  setPresenceCallback(callback: (userId: string, isOnline: boolean) => void): void {
    this.presenceCallback = callback;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.physicsLoop) {
        clearInterval(this.physicsLoop);
        this.physicsLoop = null;
    }
    for (const manager of this.physicsManagers.values()) {
        manager.dispose();
    }
    this.physicsManagers.clear();
  }
}


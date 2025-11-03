import { WebSocketServer, WebSocket } from 'ws';
import { ReplicationServer } from './ReplicationServer';
import { SessionManager } from './SessionManager';
import { AuthManager } from '../auth/AuthManager';
import { MessageHandler } from './MessageHandler';
import { FriendsStorage } from '../storage/FriendsStorage';
import { securityLogger } from '../logging/SecurityLogger';
import type { PresenceOnlineMessage, PresenceOfflineMessage } from '../types/websocket';

/**
 * WebSocket security constants.
 */
const MAX_MESSAGE_SIZE = 1 * 1024 * 1024; // 1MB max message size
const MAX_CONNECTIONS_PER_IP = 5; // Max 5 connections per IP
const CONNECTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes inactivity timeout

/**
 * WebSocket server handler for real-time collaboration.
 */
export class WebSocketHandler {
  private readonly wss: WebSocketServer;
  private readonly replicationServer: ReplicationServer;
  private readonly sessionManager: SessionManager;
  private readonly connections = new Map<WebSocket, string>(); // ws -> userId
  private readonly connectionTimes = new Map<WebSocket, number>(); // ws -> last activity time
  private readonly ipConnectionCounts = new Map<string, number>(); // ip -> connection count
  private readonly connectionIPs = new Map<WebSocket, string>(); // ws -> ip
  private friendsStorage: FriendsStorage | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    port: number,
    sessionManager: SessionManager,
    authManager: AuthManager,
    messageHandler?: MessageHandler,
    friendsStorage?: FriendsStorage
  ) {
    this.sessionManager = sessionManager;
    this.replicationServer = new ReplicationServer(sessionManager, authManager, messageHandler);
    this.friendsStorage = friendsStorage ?? null;

    // Set up presence callback
    this.sessionManager.setPresenceCallback((userId, isOnline) => {
      this.handlePresenceChange(userId, isOnline);
    });

    this.wss = new WebSocketServer({
      port,
      maxPayload: MAX_MESSAGE_SIZE, // Limit message size
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // Start cleanup interval for timed-out connections
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupInactiveConnections();
      },
      5 * 60 * 1000
    ); // Check every 5 minutes

    console.log(`WebSocket server listening on ws://localhost:${port}`);
  }

  /**
   * Handle new WebSocket connection.
   */
  private handleConnection(ws: WebSocket, req: any): void {
    // Get client IP
    const ip = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

    // Rate limit connections per IP
    const connectionCount = this.ipConnectionCounts.get(ip) || 0;
    if (connectionCount >= MAX_CONNECTIONS_PER_IP) {
      securityLogger.logSuspiciousActivity(
        undefined,
        `Too many WebSocket connections from IP ${ip}`,
        ip
      );
      ws.close(1008, 'Too many connections from this IP');
      return;
    }

    this.ipConnectionCounts.set(ip, connectionCount + 1);
    this.connectionIPs.set(ws, ip);
    this.connectionTimes.set(ws, Date.now());

    console.log(`New WebSocket connection from ${ip}`);

    // Set up connection metadata
    const userId: string | null = null;

    // Handle incoming messages with size validation
    ws.on('message', async (data: Buffer) => {
      try {
        // Check message size
        if (data.length > MAX_MESSAGE_SIZE) {
          securityLogger.logSuspiciousActivity(
            userId || undefined,
            `Message too large: ${data.length} bytes`,
            ip
          );
          ws.close(1009, 'Message too large');
          return;
        }

        // Update last activity time
        this.connectionTimes.set(ws, Date.now());

        const message = data.toString('utf-8');

        // Validate JSON
        let parsed: any;
        try {
          parsed = JSON.parse(message);
        } catch (error) {
          securityLogger.logSuspiciousActivity(
            userId || undefined,
            'Invalid JSON in WebSocket message',
            ip
          );
          ws.close(1003, 'Invalid message format');
          return;
        }

        // Validate message structure
        if (!parsed.type || typeof parsed.type !== 'string') {
          securityLogger.logSuspiciousActivity(
            userId || undefined,
            'Invalid message structure',
            ip
          );
          ws.close(1003, 'Invalid message structure');
          return;
        }

        await this.replicationServer.handleMessage(ws, message);

        // After join-session, track the user as online
        if (parsed.type === 'join-session' && this.connections.has(ws)) {
          // User ID will be set after authentication
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        securityLogger.logSuspiciousActivity(
          userId || undefined,
          `WebSocket message processing error: ${error instanceof Error ? error.message : String(error)}`,
          ip
        );
      }
    });

    // Handle connection close
    ws.on('close', () => {
      const connectionIP = this.connectionIPs.get(ws);
      if (connectionIP) {
        const count = this.ipConnectionCounts.get(connectionIP) || 1;
        this.ipConnectionCounts.set(connectionIP, Math.max(0, count - 1));
        this.connectionIPs.delete(ws);
      }
      this.connectionTimes.delete(ws);

      if (userId) {
        const sessionId = this.sessionManager.getUserSession(userId);
        if (sessionId) {
          this.sessionManager.leaveSession(sessionId, userId);
        }
        this.sessionManager.setUserOffline(userId);
        this.connections.delete(ws);
        this.replicationServer.unregisterConnection(ws);
      }
      console.log('WebSocket connection closed');
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Store user ID for a connection.
   */
  setConnectionUser(ws: WebSocket, userId: string): void {
    this.connections.set(ws, userId);
    this.sessionManager.setUserOnline(userId, ws);
  }

  /**
   * Handle presence change and broadcast to friends.
   */
  private async handlePresenceChange(userId: string, isOnline: boolean): Promise<void> {
    if (!this.friendsStorage) {
      return;
    }

    try {
      // Get user's friends
      const friends = await this.friendsStorage.getFriends(userId);

      // Broadcast presence change to all friends
      const presenceMessage: PresenceOnlineMessage | PresenceOfflineMessage = {
        type: isOnline ? 'presence:online' : 'presence:offline',
        timestamp: Date.now(),
        userId,
      };

      for (const friendId of friends) {
        this.sessionManager.sendToUser(friendId, presenceMessage);
      }
    } catch (error) {
      console.error('Error broadcasting presence change:', error);
    }
  }

  /**
   * Get user ID for a connection.
   */
  getConnectionUser(ws: WebSocket): string | null {
    return this.connections.get(ws) ?? null;
  }

  /**
   * Clean up inactive connections (timeout).
   */
  private cleanupInactiveConnections(): void {
    const now = Date.now();
    const toClose: WebSocket[] = [];

    for (const [ws, lastActivity] of this.connectionTimes.entries()) {
      if (now - lastActivity > CONNECTION_TIMEOUT) {
        toClose.push(ws);
      }
    }

    for (const ws of toClose) {
      const userId = this.connections.get(ws);
      securityLogger.logSuspiciousActivity(
        userId || undefined,
        'WebSocket connection timed out due to inactivity'
      );
      ws.close(1008, 'Connection timeout');
    }
  }

  /**
   * Close WebSocket server.
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.wss.close();
  }
}

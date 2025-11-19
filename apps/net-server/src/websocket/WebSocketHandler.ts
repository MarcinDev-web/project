import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { ReplicationServer } from './ReplicationServer.js';
import { SessionManager } from './SessionManager.js';
import { AuthManager } from '../auth/AuthManager.js';
import { MessageHandler } from './MessageHandler.js';
import { FriendsStorage } from '../storage/FriendsStorage.js';
import { securityLogger } from '../logging/SecurityLogger.js';
import {
  type CorsConfig,
  getCorsConfig,
  isOriginAllowed,
  describeAllowedOrigins,
} from '@shared/config/cors';
import type { PresenceOnlineMessage, PresenceOfflineMessage } from '../types/websocket.js';

/**
 * WebSocket security constants.
 */
const MAX_MESSAGE_SIZE = 1 * 1024 * 1024; // 1MB max message size
const MAX_CONNECTIONS_PER_IP = 5; // Max 5 connections per IP
const CONNECTION_TIMEOUT = 30 * 60 * 1000; // 30 minutes inactivity timeout
const LOG_THROTTLE_MS = 5000; // Log same event max once per 5 seconds per IP

/**
 * WebSocket server handler for real-time collaboration.
 */
export class WebSocketHandler {
  private readonly wss: WebSocketServer;
  private readonly replicationServer: ReplicationServer;
  private readonly sessionManager: SessionManager;
  private readonly authManager: AuthManager;
  private readonly connections = new Map<WebSocket, string>(); // ws -> userId
  private readonly connectionTimes = new Map<WebSocket, number>(); // ws -> last activity time
  private readonly ipConnectionCounts = new Map<string, number>(); // ip -> connection count
  private readonly connectionIPs = new Map<WebSocket, string>(); // ws -> ip
  private readonly lastLogTimes = new Map<string, number>(); // logKey -> last log time
  private friendsStorage: FriendsStorage | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly corsConfig: CorsConfig;
  private readonly allowedOriginsDescription: string;

  constructor(
    options: { port: number } | { server: HttpServer; path?: string },
    sessionManager: SessionManager,
    authManager: AuthManager,
    messageHandler?: MessageHandler,
    friendsStorage?: FriendsStorage,
    corsConfig?: CorsConfig
  ) {
    this.sessionManager = sessionManager;
    this.authManager = authManager;
    this.replicationServer = new ReplicationServer(sessionManager, authManager, messageHandler);
    this.friendsStorage = friendsStorage ?? null;
    this.corsConfig = corsConfig ?? getCorsConfig();
    this.allowedOriginsDescription = describeAllowedOrigins(this.corsConfig);

    // Set up presence callback
    this.sessionManager.setPresenceCallback((userId, isOnline) => {
      this.handlePresenceChange(userId, isOnline);
    });

    // Create WebSocket server - either attach to existing HTTP server (prod) or listen on a port (dev)
    if ('server' in options) {
      this.wss = new WebSocketServer({
        server: options.server,
        path: options.path ?? '/ws',
        maxPayload: MAX_MESSAGE_SIZE,
      });
    } else {
      this.wss = new WebSocketServer({
        host: '0.0.0.0',
        port: options.port,
        maxPayload: MAX_MESSAGE_SIZE,
      });
    }

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

    if ('server' in options) {
      console.log(`WebSocket server attached at path ${options.path ?? '/ws'}`);
    } else {
      console.log(`WebSocket server listening on ws://localhost:${options.port}`);
    }
  }

  /**
   * Check if log should be throttled (rate limited).
   */
  private shouldLog(key: string): boolean {
    const now = Date.now();
    const lastLog = this.lastLogTimes.get(key) || 0;
    if (now - lastLog < LOG_THROTTLE_MS) {
      return false;
    }
    this.lastLogTimes.set(key, now);
    return true;
  }

  /**
   * Handle new WebSocket connection.
   */
  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    // Get client IP
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const ip = (req.socket.remoteAddress || forwardedIp || 'unknown') as string;

    const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (originHeader && !isOriginAllowed(originHeader, this.corsConfig)) {
      const logKey = `security:cors:${originHeader}:${ip}`;
      if (this.shouldLog(logKey)) {
        securityLogger.logSuspiciousActivity(
          undefined,
          `Blocked WebSocket origin: ${originHeader}. Allowed: ${this.allowedOriginsDescription}`,
          ip
        );
      }
      ws.close(1008, 'Origin not allowed');
      return;
    }

    // Rate limit connections per IP
    const connectionCount = this.ipConnectionCounts.get(ip) || 0;
    if (connectionCount >= MAX_CONNECTIONS_PER_IP) {
      const logKey = `security:too-many-connections:${ip}`;
      if (this.shouldLog(logKey)) {
        securityLogger.logSuspiciousActivity(
          undefined,
          `Too many WebSocket connections from IP ${ip}`,
          ip
        );
      }
      ws.close(1008, 'Too many connections from this IP');
      return;
    }

    this.ipConnectionCounts.set(ip, connectionCount + 1);
    this.connectionIPs.set(ws, ip);
    this.connectionTimes.set(ws, Date.now());

    // Throttle connection logs
    const connectionLogKey = `connection:${ip}`;
    if (this.shouldLog(connectionLogKey)) {
      console.log(`New WebSocket connection from ${ip}`);
    }

    // Set up connection metadata
    let userId: string | null = null;

    // Handshake Authentication
    let token: string | undefined;

    // 1. Check Query String
    if (req.url) {
      try {
        const url = new URL(req.url, 'http://localhost');
        token = url.searchParams.get('token') || undefined;
      } catch {
        // Ignore invalid URLs
      }
    }

    // 2. Check Protocol Header (if no token in query)
    if (!token && req.headers['sec-websocket-protocol']) {
      const protocols = req.headers['sec-websocket-protocol'].split(',').map((p) => p.trim());
      // Look for a token-like string (simple heuristic: length > 20)
      for (const protocol of protocols) {
        if (protocol.length > 20) {
          token = protocol;
          break;
        }
      }
    }

    // 3. Verify Token
    if (token) {
      try {
        const verification = await this.authManager.verifyTokenWithExpiration(token);
        if (verification.user) {
          userId = verification.user.id;
          this.setConnectionUser(ws, userId);

          // Register with ReplicationServer
          this.replicationServer.registerAuthenticatedConnection(
            ws,
            userId,
            token,
            verification.expiresAt
          );
        }
      } catch (error) {
        // Token invalid, ignore (will fall back to unauthenticated or fail later)
      }
    }

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
      // Throttle close logs
      const closeLogKey = connectionIP ? `close:${connectionIP}` : 'close:unknown';
      if (this.shouldLog(closeLogKey)) {
        console.log('WebSocket connection closed');
      }
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


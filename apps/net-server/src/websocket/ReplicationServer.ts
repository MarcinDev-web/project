import type { WebSocket } from 'ws';
import { SessionManager } from './SessionManager';
import { AuthManager } from '../auth/AuthManager';
import { MessageHandler } from './MessageHandler';
import { securityLogger } from '../logging/SecurityLogger';
import { websocketMessageSchema } from '../validation/schemas/websocket';
import type {
  WebSocketMessage,
  JoinSessionMessage,
  LeaveSessionMessage,
  OperationMessage,
  PlayerUpdateMessage,
  CursorUpdateMessage,
  UserJoinedMessage,
  UserLeftMessage,
  ErrorMessage,
  PingMessage,
  PongMessage,
  MessageTypingMessage,
} from '../types/websocket';

/**
 * Handles WebSocket message routing and replication logic.
 */
export class ReplicationServer {
  private readonly sessionManager: SessionManager;
  private readonly authManager: AuthManager;
  private readonly messageHandler: MessageHandler | null;
  private readonly connections = new Map<WebSocket, string>(); // ws -> userId
  private readonly connectionTokens = new Map<WebSocket, { token: string; expiresAt: number | null }>(); // ws -> token info

  constructor(sessionManager: SessionManager, authManager: AuthManager, messageHandler?: MessageHandler) {
    this.sessionManager = sessionManager;
    this.authManager = authManager;
    this.messageHandler = messageHandler ?? null;
  }

  /**
   * Register a connection with a user ID and token info.
   */
  registerConnection(ws: WebSocket, userId: string, token: string, expiresAt: number | null): void {
    this.connections.set(ws, userId);
    this.connectionTokens.set(ws, { token, expiresAt });
  }

  /**
   * Unregister a connection.
   */
  unregisterConnection(ws: WebSocket): void {
    this.connections.delete(ws);
    this.connectionTokens.delete(ws);
  }

  /**
   * Handle incoming WebSocket message.
   */
  async handleMessage(ws: WebSocket, rawMessage: string): Promise<void> {
    try {
      // Parse JSON first
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawMessage);
      } catch (error: unknown) {
        this.sendError(ws, 'Invalid JSON format', 'INVALID_FORMAT');
        securityLogger.logSuspiciousActivity(
          undefined,
          'Invalid JSON in WebSocket message'
        );
        return;
      }

      // Validate message schema
      const validationResult = websocketMessageSchema.safeParse(parsed);
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map((e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`).join(', ');
        this.sendError(ws, `Invalid message format: ${errors}`, 'VALIDATION_FAILED');
        securityLogger.logSuspiciousActivity(
          undefined,
          `WebSocket message validation failed: ${errors}`
        );
        return;
      }

      const message = validationResult.data as WebSocketMessage;

      switch (message.type) {
        case 'join-session':
          await this.handleJoinSession(ws, message as JoinSessionMessage);
          break;
        case 'leave-session':
          await this.handleLeaveSession(ws, message as LeaveSessionMessage);
          break;
        case 'operation':
          await this.handleOperation(ws, message as OperationMessage);
          break;
        case 'player-update':
          await this.handlePlayerUpdate(ws, message as PlayerUpdateMessage);
          break;
        case 'cursor-update':
          await this.handleCursorUpdate(ws, message as CursorUpdateMessage);
          break;
        case 'ping':
          await this.handlePing(ws, message as PingMessage);
          break;
        case 'message:typing':
          await this.handleMessageTyping(ws, message as MessageTypingMessage);
          break;
        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendError(ws, 'Failed to process message', 'INVALID_MESSAGE');
    }
  }

  /**
   * Handle join session request.
   */
  async handleJoinSession(ws: WebSocket, message: JoinSessionMessage): Promise<void> {
    try {
      // Verify authentication token and get expiration
      const verification = await this.authManager.verifyTokenWithExpiration(message.token);
      if (!verification.user) {
        this.sendError(ws, 'Authentication failed', 'AUTH_FAILED');
        return;
      }

      const publicUser = {
        id: verification.user.id,
        email: verification.user.email,
        createdAt: verification.user.createdAt,
      };

      // Check if session exists
      let session = this.sessionManager.getSession(message.sessionId);
      if (!session) {
        // Create new session (first user becomes owner)
        session = await this.sessionManager.createSession(message.sessionId, verification.user.id);
      }

      // Register connection with token info
      this.registerConnection(ws, verification.user.id, message.token, verification.expiresAt);

      // Track user as online
      this.sessionManager.setUserOnline(verification.user.id, ws);

      // Join session
      this.sessionManager.joinSession(message.sessionId, verification.user.id, publicUser, ws);
      this.sessionManager.setUserData(verification.user.id, publicUser);

      // Notify other users
      const userJoinedMessage: UserJoinedMessage = {
        type: 'user-joined',
        timestamp: Date.now(),
        sessionId: message.sessionId,
        userId: verification.user.id,
        user: publicUser,
      };
      this.sessionManager.broadcast(message.sessionId, userJoinedMessage, verification.user.id);

      // Send confirmation to joining user
      const confirmation = {
        type: 'user-joined' as const,
        timestamp: Date.now(),
        sessionId: message.sessionId,
        userId: verification.user.id,
        user: publicUser,
      };
      this.sendToWebSocket(ws, confirmation);

    } catch (error) {
      console.error('Error joining session:', error);
      this.sendError(ws, 'Failed to join session', 'JOIN_FAILED');
    }
  }

  /**
   * Handle leave session request.
   */
  private async handleLeaveSession(ws: WebSocket, message: LeaveSessionMessage): Promise<void> {
    try {
      // Get user from connection
      const userId = this.getUserIdFromConnection(ws);
      if (!userId) {
        return;
      }

      this.sessionManager.leaveSession(message.sessionId, userId);

      // Notify other users
      const userLeftMessage: UserLeftMessage = {
        type: 'user-left',
        timestamp: Date.now(),
        sessionId: message.sessionId,
        userId,
      };
      this.sessionManager.broadcast(message.sessionId, userLeftMessage);
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  }

  /**
   * Handle operation message (edit/gameplay action).
   */
  private async handleOperation(ws: WebSocket, message: OperationMessage): Promise<void> {
    try {
      // Check token expiration before processing
      if (!this.isTokenValid(ws)) {
        this.sendError(ws, 'Token expired', 'TOKEN_EXPIRED');
        return;
      }
      
      const userId = this.getUserIdFromConnection(ws);
      if (!userId) {
        this.sendError(ws, 'Not authenticated', 'NOT_AUTHENTICATED');
        return;
      }

      // Set userId in operation
      message.operation.userId = userId;
      message.userId = userId;

      // Broadcast to other users in session
      const sessionId = this.sessionManager.getUserSession(userId);
      if (sessionId) {
        this.sessionManager.broadcast(sessionId, message, userId);
      }
    } catch (error) {
      console.error('Error handling operation:', error);
      this.sendError(ws, 'Failed to process operation', 'OPERATION_FAILED');
    }
  }

  /**
   * Handle player update (gameplay position/state).
   */
  private async handlePlayerUpdate(ws: WebSocket, message: PlayerUpdateMessage): Promise<void> {
    try {
      // Check token expiration before processing
      if (!this.isTokenValid(ws)) {
        return; // Silently ignore expired token for player updates (frequent messages)
      }
      
      const userId = this.getUserIdFromConnection(ws);
      if (!userId) {
        return;
      }

      message.userId = userId;

      // Broadcast to other users in session
      const sessionId = this.sessionManager.getUserSession(userId);
      if (sessionId) {
        this.sessionManager.broadcast(sessionId, message, userId);
      }
    } catch (error) {
      console.error('Error handling player update:', error);
    }
  }

  /**
   * Handle cursor update (camera position for visual indicators).
   */
  private async handleCursorUpdate(ws: WebSocket, message: CursorUpdateMessage): Promise<void> {
    try {
      // Check token expiration before processing
      if (!this.isTokenValid(ws)) {
        return; // Silently ignore expired token for cursor updates (frequent messages)
      }
      
      const userId = this.getUserIdFromConnection(ws);
      if (!userId) {
        return;
      }

      message.userId = userId;

      // Broadcast to other users in session (throttled in real implementation)
      const sessionId = this.sessionManager.getUserSession(userId);
      if (sessionId) {
        this.sessionManager.broadcast(sessionId, message, userId);
      }
    } catch (error) {
      console.error('Error handling cursor update:', error);
    }
  }

  /**
   * Handle ping message (heartbeat).
   */
  private async handlePing(ws: WebSocket, _message: PingMessage): Promise<void> {
    const pong: PongMessage = {
      type: 'pong',
      timestamp: Date.now(),
    };
    this.sendToWebSocket(ws, pong);
  }

  /**
   * Handle typing indicator message.
   */
  private async handleMessageTyping(ws: WebSocket, message: MessageTypingMessage): Promise<void> {
    try {
      // Check token expiration before processing
      if (!this.isTokenValid(ws)) {
        return; // Silently ignore expired token for typing indicators
      }

      const userId = this.getUserIdFromConnection(ws);
      if (!userId) {
        return;
      }

      if (!this.messageHandler) {
        return;
      }

      message.userId = userId;
      this.messageHandler.handleTyping(message.conversationId, userId, message.typing, ws);
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  }

  /**
   * Get user ID from WebSocket connection.
   */
  private getUserIdFromConnection(ws: WebSocket): string | null {
    return this.connections.get(ws) ?? null;
  }
  
  /**
   * Check if token is still valid (not expired).
   */
  private isTokenValid(ws: WebSocket): boolean {
    const tokenInfo = this.connectionTokens.get(ws);
    if (!tokenInfo) {
      return false;
    }
    
    // If expiration time is available, check if it's expired
    if (tokenInfo.expiresAt !== null) {
      const now = Date.now();
      // Add 5 minute buffer before expiration
      return tokenInfo.expiresAt > now + 5 * 60 * 1000;
    }
    
    // If expiration time is not available, assume valid (backward compatibility)
    return true;
  }

  /**
   * Send error message to WebSocket client.
   */
  private sendError(ws: WebSocket, error: string, code?: string): void {
    const errorMessage: ErrorMessage = {
      type: 'error',
      timestamp: Date.now(),
      error,
      ...(code !== undefined && { code }),
    };
    this.sendToWebSocket(ws, errorMessage);
  }

  /**
   * Send message to WebSocket client.
   */
  private sendToWebSocket(ws: WebSocket, message: unknown): void {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    }
  }
}


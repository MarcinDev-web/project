import {
  ReplicationState,
} from './types/replication';
import type {
  WebSocketMessage,
  JoinSessionMessage,
  LeaveSessionMessage,
  OperationMessage,
  PlayerUpdateMessage,
  CursorUpdateMessage,
  SnapshotMessage,
  UserJoinedMessage,
  UserLeftMessage,
  ErrorMessage,
  ConnectedMessage,
  PingMessage,
  PongMessage,
  Operation,
  SceneSnapshot,
  PublicUser,
  InputMessage,
  PhysicsStateMessage,
  PlayModeRequestMessage,
  PlayModeResponseMessage,
  PlayModeStartMessage,
  PlayModeEndMessage,
} from './types/replication';

// Re-export PublicUser for external use
export type { PublicUser };

/**
 * Callback types for event handlers.
 */
export type OnOperationCallback = (operation: Operation) => void;
export type OnPlayerUpdateCallback = (message: PlayerUpdateMessage) => void;
export type OnCursorUpdateCallback = (message: CursorUpdateMessage) => void;
export type OnSnapshotCallback = (snapshot: SceneSnapshot) => void;
export type OnInputCallback = (message: InputMessage) => void;
export type OnPhysicsStateCallback = (message: PhysicsStateMessage) => void;
export type OnUserJoinedCallback = (user: PublicUser) => void;
export type OnUserLeftCallback = (userId: string) => void;
export type OnErrorCallback = (error: string, code?: string) => void;
export type OnStateChangeCallback = (state: ReplicationState) => void;
export type OnPlayModeRequestCallback = (message: PlayModeRequestMessage) => void;
export type OnPlayModeStartCallback = (message: PlayModeStartMessage) => void;

/**
 * WebSocket client for real-time replication and collaboration.
 * Handles connection to replication server, session management, and message routing.
 */
export class ReplicationClient {
  private ws: WebSocket | null = null;
  private state: ReplicationState = ReplicationState.Disconnected;
  private currentSessionId: string | null = null;
  private currentUserId: string | null = null; // Local user ID from server
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: number | null = null;
  private readonly pingIntervalMs = 30000; // 30 seconds
  private readonly wsUrl: string; // WebSocket URL (normalized)

  // Event handlers
  private onOperationHandlers: OnOperationCallback[] = [];
  private onPlayerUpdateHandlers: OnPlayerUpdateCallback[] = [];
  private onCursorUpdateHandlers: OnCursorUpdateCallback[] = [];
  private onSnapshotHandlers: OnSnapshotCallback[] = [];
  private onInputHandlers: OnInputCallback[] = [];
  private onPhysicsStateHandlers: OnPhysicsStateCallback[] = [];
  private onUserJoinedHandlers: OnUserJoinedCallback[] = [];
  private onUserLeftHandlers: OnUserLeftCallback[] = [];
  private onErrorHandlers: OnErrorCallback[] = [];
  private onStateChangeHandlers: OnStateChangeCallback[] = [];
  private onPlayModeRequestHandlers: OnPlayModeRequestCallback[] = [];
  private onPlayModeStartHandlers: OnPlayModeStartCallback[] = [];

  constructor(
    wsUrl: string,
    private readonly jwtToken: string
  ) {
    // Convert HTTP URL to WebSocket URL if needed
    this.wsUrl = wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://')
      ? wsUrl
      : wsUrl.replace(/^http/, 'ws');
  }

  /**
   * Connect to WebSocket server and join a collaboration session.
   */
  async connect(sessionId: string): Promise<void> {
    if (this.state === ReplicationState.Connecting || this.state === ReplicationState.Connected) {
      throw new Error('Already connected or connecting');
    }

    this.currentSessionId = sessionId;
    this.setState(ReplicationState.Connecting);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.setState(ReplicationState.Connected);
          this.reconnectAttempts = 0;

          // Start ping interval
          this.startPingInterval();

          // Send join session message
          const joinMessage: JoinSessionMessage = {
            type: 'join-session',
            timestamp: Date.now(),
            sessionId,
            token: this.jwtToken,
          };
          this.send(joinMessage);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data as string);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          const errorMessage: ErrorMessage = {
            type: 'error',
            timestamp: Date.now(),
            error: 'Connection error',
          };
          this.handleError(errorMessage);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.ws = null;
          this.stopPingInterval();

          if (this.state !== ReplicationState.Disconnected) {
            this.setState(ReplicationState.Disconnected);
            this.attemptReconnect(sessionId);
          }
        };

        // Resolve after successful connection and join confirmation
        // (will be set to Joined state when user-joined message is received)
        setTimeout(() => {
          if (this.state === ReplicationState.Connected || this.state === ReplicationState.Joined) {
            resolve();
          } else {
            reject(new Error('Connection timeout'));
          }
        }, 5000);
      } catch (error) {
        this.setState(ReplicationState.Error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server and leave session.
   */
  disconnect(): void {
    if (this.state === ReplicationState.Disconnected) {
      return;
    }

    // Send leave message if in a session
    if (this.currentSessionId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const leaveMessage: LeaveSessionMessage = {
        type: 'leave-session',
        timestamp: Date.now(),
        sessionId: this.currentSessionId,
      };
      this.send(leaveMessage);
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.currentSessionId = null;
    this.currentUserId = null; // Clear userId on disconnect
    this.setState(ReplicationState.Disconnected);
  }

  /**
   * Send an operation to the server (for replication).
   */
  sendOperation(operation: Operation): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send operation: not connected');
      return;
    }

    const message: OperationMessage = {
      type: 'operation',
      timestamp: Date.now(),
      operation,
      ...(this.currentSessionId && { sessionId: this.currentSessionId }),
    };

    this.send(message);
  }

  /**
   * Send input message (gameplay input events).
   */
  sendInput(message: Omit<InputMessage, 'type' | 'timestamp' | 'sessionId' | 'userId'>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    const fullMessage: InputMessage = {
      type: 'input',
      timestamp: Date.now(),
      ...message,
      ...(this.currentSessionId && { sessionId: this.currentSessionId }),
      ...(this.currentUserId && { userId: this.currentUserId }),
    };

    this.send(fullMessage);
  }

  /**
   * Send physics state message.
   */
  sendPhysicsState(message: Omit<PhysicsStateMessage, 'type' | 'timestamp' | 'sessionId' | 'userId'>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    const fullMessage: PhysicsStateMessage = {
      type: 'physics-state',
      timestamp: Date.now(),
      ...message,
      ...(this.currentSessionId && { sessionId: this.currentSessionId }),
      ...(this.currentUserId && { userId: this.currentUserId }),
    };

    this.send(fullMessage);
  }

  /**
   * Send player update (gameplay position/state).
   */
  sendPlayerUpdate(message: Omit<PlayerUpdateMessage, 'type' | 'timestamp' | 'sessionId' | 'userId'>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    const fullMessage: PlayerUpdateMessage = {
      type: 'player-update',
      timestamp: Date.now(),
      ...message,
      ...(this.currentSessionId && { sessionId: this.currentSessionId }),
      ...(this.currentUserId && { userId: this.currentUserId }),
    };

    this.send(fullMessage);
  }

  /**
   * Send cursor update (camera position for visual indicators).
   */
  sendCursorUpdate(position: [number, number, number], rotation?: [number, number, number, number]): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: CursorUpdateMessage = {
      type: 'cursor-update',
      timestamp: Date.now(),
      position,
      ...(this.currentSessionId && { sessionId: this.currentSessionId }),
      ...(rotation && { rotation }),
    };

    this.send(message);
  }

  /**
   * Send Play Mode request to invite other users to join Play Mode.
   */
  sendPlayModeRequest(requestId: string, fromUser: PublicUser): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send Play Mode request: not connected');
      return;
    }

    const message: PlayModeRequestMessage = {
      type: 'play-mode-request',
      timestamp: Date.now(),
      requestId,
      fromUser,
      ...(this.currentSessionId && { sessionId: this.currentSessionId }),
      ...(this.currentUserId && { userId: this.currentUserId }),
    };

    this.send(message);
  }

  /**
   * Send response to a Play Mode request.
   */
  sendPlayModeResponse(requestId: string, accepted: boolean): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send Play Mode response: not connected');
      return;
    }

    const message: PlayModeResponseMessage = {
      type: 'play-mode-response',
      timestamp: Date.now(),
      requestId,
      accepted,
      ...(this.currentSessionId && { sessionId: this.currentSessionId }),
      ...(this.currentUserId && { userId: this.currentUserId }),
    };

    this.send(message);
  }

  /**
   * Send Play Mode end notification (when exiting Play Mode).
   */
  sendPlayModeEnd(): void {
    if (this.ws?.readyState !== WebSocket.OPEN || !this.currentUserId) {
      return;
    }

    const message: PlayModeEndMessage = {
      type: 'play-mode-end',
      timestamp: Date.now(),
      userId: this.currentUserId,
      ...(this.currentSessionId && { sessionId: this.currentSessionId }),
    };

    this.send(message);
  }

  /**
   * Request a full snapshot from the server.
   */
  requestSnapshot(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    // Server will send snapshot automatically on join, but we can request it explicitly
    // For now, we'll just log - server-side implementation can add snapshot request message type
    console.log('Snapshot request (server should implement snapshot-request message type)');
  }

  /**
   * Get local user ID (from server authentication).
   * Returns null if not connected or userId not yet received.
   */
  getLocalUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Get current connection state.
   */
  getState(): ReplicationState {
    return this.state;
  }

  /**
   * Check if connected and joined.
   */
  isConnected(): boolean {
    return this.state === ReplicationState.Joined && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Register event handlers.
   */
  onOperation(callback: OnOperationCallback): () => void {
    this.onOperationHandlers.push(callback);
    return () => {
      const index = this.onOperationHandlers.indexOf(callback);
      if (index >= 0) {
        this.onOperationHandlers.splice(index, 1);
      }
    };
  }

  onPlayerUpdate(callback: OnPlayerUpdateCallback): () => void {
    this.onPlayerUpdateHandlers.push(callback);
    return () => {
      const index = this.onPlayerUpdateHandlers.indexOf(callback);
      if (index >= 0) {
        this.onPlayerUpdateHandlers.splice(index, 1);
      }
    };
  }

  onCursorUpdate(callback: OnCursorUpdateCallback): () => void {
    this.onCursorUpdateHandlers.push(callback);
    return () => {
      const index = this.onCursorUpdateHandlers.indexOf(callback);
      if (index >= 0) {
        this.onCursorUpdateHandlers.splice(index, 1);
      }
    };
  }

  onSnapshot(callback: OnSnapshotCallback): () => void {
    this.onSnapshotHandlers.push(callback);
    return () => {
      const index = this.onSnapshotHandlers.indexOf(callback);
      if (index >= 0) {
        this.onSnapshotHandlers.splice(index, 1);
      }
    };
  }

  onInput(callback: OnInputCallback): () => void {
    this.onInputHandlers.push(callback);
    return () => {
      const index = this.onInputHandlers.indexOf(callback);
      if (index >= 0) {
        this.onInputHandlers.splice(index, 1);
      }
    };
  }

  onPhysicsState(callback: OnPhysicsStateCallback): () => void {
    this.onPhysicsStateHandlers.push(callback);
    return () => {
      const index = this.onPhysicsStateHandlers.indexOf(callback);
      if (index >= 0) {
        this.onPhysicsStateHandlers.splice(index, 1);
      }
    };
  }

  onUserJoined(callback: OnUserJoinedCallback): () => void {
    this.onUserJoinedHandlers.push(callback);
    return () => {
      const index = this.onUserJoinedHandlers.indexOf(callback);
      if (index >= 0) {
        this.onUserJoinedHandlers.splice(index, 1);
      }
    };
  }

  onUserLeft(callback: OnUserLeftCallback): () => void {
    this.onUserLeftHandlers.push(callback);
    return () => {
      const index = this.onUserLeftHandlers.indexOf(callback);
      if (index >= 0) {
        this.onUserLeftHandlers.splice(index, 1);
      }
    };
  }

  onError(callback: OnErrorCallback): () => void {
    this.onErrorHandlers.push(callback);
    return () => {
      const index = this.onErrorHandlers.indexOf(callback);
      if (index >= 0) {
        this.onErrorHandlers.splice(index, 1);
      }
    };
  }

  onStateChange(callback: OnStateChangeCallback): () => void {
    this.onStateChangeHandlers.push(callback);
    return () => {
      const index = this.onStateChangeHandlers.indexOf(callback);
      if (index >= 0) {
        this.onStateChangeHandlers.splice(index, 1);
      }
    };
  }

  onPlayModeRequest(callback: OnPlayModeRequestCallback): () => void {
    this.onPlayModeRequestHandlers.push(callback);
    return () => {
      const index = this.onPlayModeRequestHandlers.indexOf(callback);
      if (index >= 0) {
        this.onPlayModeRequestHandlers.splice(index, 1);
      }
    };
  }

  onPlayModeStart(callback: OnPlayModeStartCallback): () => void {
    this.onPlayModeStartHandlers.push(callback);
    return () => {
      const index = this.onPlayModeStartHandlers.indexOf(callback);
      if (index >= 0) {
        this.onPlayModeStartHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Handle incoming WebSocket message.
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WebSocketMessage;

      switch (message.type) {
        case 'connected':
          this.handleConnected(message as ConnectedMessage);
          break;
        case 'user-joined':
          this.handleUserJoined(message as UserJoinedMessage);
          break;
        case 'user-left':
          this.handleUserLeft(message as UserLeftMessage);
          break;
        case 'operation':
          this.handleOperation(message as OperationMessage);
          break;
        case 'snapshot':
          this.handleSnapshot(message as SnapshotMessage);
          break;
        case 'player-update':
          this.handlePlayerUpdate(message as PlayerUpdateMessage);
          break;
        case 'cursor-update':
          this.handleCursorUpdate(message as CursorUpdateMessage);
          break;
        case 'input':
          this.handleInput(message as InputMessage);
          break;
        case 'physics-state':
          this.handlePhysicsState(message as PhysicsStateMessage);
          break;
        case 'play-mode-request':
          this.handlePlayModeRequest(message as PlayModeRequestMessage);
          break;
        case 'play-mode-start':
          this.handlePlayModeStart(message as PlayModeStartMessage);
          break;
        case 'error':
          this.handleError(message as ErrorMessage);
          break;
        case 'ping':
          this.handlePing(message as PingMessage);
          break;
        case 'pong':
          // No action needed for pong
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleConnected(message: ConnectedMessage): void {
    // Connection established, waiting for join confirmation
    // Store userId if provided in ConnectedMessage
    if (message.userId) {
      this.currentUserId = message.userId;
    }
  }

  private handleUserJoined(message: UserJoinedMessage): void {
    this.setState(ReplicationState.Joined);
    
    // If this is our own join confirmation, store userId
    if (message.userId && !this.currentUserId) {
      this.currentUserId = message.userId;
    }
    
    this.onUserJoinedHandlers.forEach((cb) => cb(message.user));
  }

  private handleUserLeft(message: UserLeftMessage): void {
    this.onUserLeftHandlers.forEach((cb) => cb(message.userId));
  }

  private handleOperation(message: OperationMessage): void {
    this.onOperationHandlers.forEach((cb) => cb(message.operation));
  }

  private handleSnapshot(message: SnapshotMessage): void {
    this.onSnapshotHandlers.forEach((cb) => cb(message.snapshot));
  }

  private handlePlayerUpdate(message: PlayerUpdateMessage): void {
    this.onPlayerUpdateHandlers.forEach((cb) => cb(message));
  }

  private handleCursorUpdate(message: CursorUpdateMessage): void {
    this.onCursorUpdateHandlers.forEach((cb) => cb(message));
  }

  private handleInput(message: InputMessage): void {
    this.onInputHandlers.forEach((cb) => cb(message));
  }

  private handlePhysicsState(message: PhysicsStateMessage): void {
    this.onPhysicsStateHandlers.forEach((cb) => cb(message));
  }

  private handleError(message: ErrorMessage): void {
    this.setState(ReplicationState.Error);
    this.onErrorHandlers.forEach((cb) => cb(message.error, message.code));
  }

  private handlePing(_message: PingMessage): void {
    // Respond with pong
    const pong: PongMessage = {
      type: 'pong',
      timestamp: Date.now(),
    };
    this.send(pong);
  }

  private handlePlayModeRequest(message: PlayModeRequestMessage): void {
    // Don't trigger handler if this request came from ourselves
    if (message.userId && message.userId === this.currentUserId) {
      return;
    }
    this.onPlayModeRequestHandlers.forEach((cb) => cb(message));
  }

  private handlePlayModeStart(message: PlayModeStartMessage): void {
    this.onPlayModeStartHandlers.forEach((cb) => cb(message));
  }

  /**
   * Send message to server.
   */
  private send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    }
  }

  /**
   * Set connection state and notify handlers.
   */
  private setState(newState: ReplicationState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChangeHandlers.forEach((cb) => cb(newState));
    }
  }

  /**
   * Attempt to reconnect after disconnection.
   */
  private async attemptReconnect(sessionId: string): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.setState(ReplicationState.Error);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connect(sessionId);
    } catch (error) {
      console.error('Reconnection failed:', error);
      // Will retry on next close event if not at max attempts
    }
  }

  /**
   * Start ping interval to keep connection alive.
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const ping: PingMessage = {
          type: 'ping',
          timestamp: Date.now(),
        };
        this.send(ping);
      }
    }, this.pingIntervalMs);
  }

  /**
   * Stop ping interval.
   */
  private stopPingInterval(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}


import { Logger } from '../utils/logger';
import type { Vec3 } from '@engine/core/math';

/**
 * Multiplayer connection state
 */
export enum MultiplayerConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
}

/**
 * Player data from server
 */
export interface RemotePlayer {
  id: string;
  displayName: string;
  position: Vec3;
  rotation: number;
  timestamp: number;
}

/**
 * Multiplayer message types
 */
export type MultiplayerMessage =
  | { type: 'player_joined'; player: RemotePlayer }
  | { type: 'player_left'; playerId: string }
  | { type: 'player_update'; player: RemotePlayer }
  | { type: 'chat_message'; playerId: string; message: string; timestamp: number }
  | { type: 'server_message'; message: string };

/**
 * Multiplayer event callbacks
 */
export interface MultiplayerCallbacks {
  onPlayerJoined?: (player: RemotePlayer) => void;
  onPlayerLeft?: (playerId: string) => void;
  onPlayerUpdate?: (player: RemotePlayer) => void;
  onChatMessage?: (playerId: string, message: string) => void;
  onServerMessage?: (message: string) => void;
  onConnectionStateChanged?: (state: MultiplayerConnectionState) => void;
  onError?: (error: Error) => void;
}

/**
 * MultiplayerSystem manages WebSocket connection and player synchronization
 */
export class MultiplayerSystem {
  private ws: WebSocket | null = null;
  private connectionState = MultiplayerConnectionState.DISCONNECTED;
  private buildId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly callbacks: MultiplayerCallbacks;
  private remotePlayers = new Map<string, RemotePlayer>();
  private lastPositionUpdate = 0;
  private readonly positionUpdateInterval = 100; // ms

  constructor(callbacks: MultiplayerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to multiplayer server
   */
  async connect(buildId: string): Promise<void> {
    if (this.connectionState === MultiplayerConnectionState.CONNECTED) {
      Logger.warn('[MultiplayerSystem] Already connected');
      return;
    }

    this.buildId = buildId;
    this.setConnectionState(MultiplayerConnectionState.CONNECTING);

    try {
      // Get WebSocket URL from API or use default
      const wsUrl = await this.getWebSocketUrl(buildId);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        Logger.info('[MultiplayerSystem] Connected to server');
        this.setConnectionState(MultiplayerConnectionState.CONNECTED);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.sendJoinMessage(buildId);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.ws.onerror = (error) => {
        Logger.error('[MultiplayerSystem] WebSocket error:', error);
        this.callbacks.onError?.(new Error('WebSocket connection error'));
      };
      
      this.ws.onclose = () => {
        Logger.warn('[MultiplayerSystem] Connection closed');
        this.stopHeartbeat();
        this.handleDisconnect();
      };
    } catch (error) {
      Logger.error('[MultiplayerSystem] Failed to connect:', error as unknown as Error);
      this.setConnectionState(MultiplayerConnectionState.DISCONNECTED);
      throw error;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.setConnectionState(MultiplayerConnectionState.DISCONNECTED);
    this.remotePlayers.clear();
  }

  /**
   * Send player position update
   */
  sendPositionUpdate(position: Vec3, rotation: number): void {
    if (this.connectionState !== MultiplayerConnectionState.CONNECTED || !this.ws) {
      return;
    }

    const now = Date.now();
    if (now - this.lastPositionUpdate < this.positionUpdateInterval) {
      return; // Throttle updates
    }
    this.lastPositionUpdate = now;

    try {
      this.send({
        type: 'player_position',
        position,
        rotation,
        timestamp: now,
      });
    } catch (error) {
      Logger.warn('[MultiplayerSystem] Failed to send position update:', error as unknown as Error);
    }
  }

  /**
   * Send chat message
   */
  sendChatMessage(message: string): void {
    if (this.connectionState !== MultiplayerConnectionState.CONNECTED || !this.ws) {
      return;
    }

    try {
      this.send({
        type: 'chat',
        message,
        timestamp: Date.now(),
      });
    } catch (error) {
      Logger.warn('[MultiplayerSystem] Failed to send chat message:', error as unknown as Error);
    }
  }

  /**
   * Get all remote players
   */
  getRemotePlayers(): ReadonlyMap<string, RemotePlayer> {
    return this.remotePlayers;
  }

  /**
   * Get connection state
   */
  getConnectionState(): MultiplayerConnectionState {
    return this.connectionState;
  }

  /**
   * Update - call each frame
   */
  update(): void {
    // Position updates are sent via sendPositionUpdate
    // This method can be used for other periodic updates
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disconnect();
  }

  private async getWebSocketUrl(buildId: string): Promise<string> {
    // Try to get WebSocket URL from API
    try {
      const response = await fetch(`/api/marketplace/${buildId}/ws-url`);
      if (response.ok) {
        const data = (await response.json()) as { url?: string };
        if (data.url) {
          return data.url;
        }
      }
    } catch (error) {
      Logger.warn('[MultiplayerSystem] Failed to get WebSocket URL from API:', error as unknown as Error);
    }

    // Fallback to default WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/game/${buildId}`;
  }

  private send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(data));
    } catch (error) {
      Logger.error('[MultiplayerSystem] Failed to send message:', error as unknown as Error);
      throw error;
    }
  }

  private sendJoinMessage(buildId: string): void {
    this.send({
      type: 'join',
      buildId,
      timestamp: Date.now(),
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as MultiplayerMessage;
      
      switch (message.type) {
        case 'player_joined':
          this.remotePlayers.set(message.player.id, message.player);
          this.callbacks.onPlayerJoined?.(message.player);
          break;
        case 'player_left':
          this.remotePlayers.delete(message.playerId);
          this.callbacks.onPlayerLeft?.(message.playerId);
          break;
        case 'player_update':
          this.remotePlayers.set(message.player.id, message.player);
          this.callbacks.onPlayerUpdate?.(message.player);
          break;
        case 'chat_message':
          this.callbacks.onChatMessage?.(message.playerId, message.message);
          break;
        case 'server_message':
          this.callbacks.onServerMessage?.(message.message);
          break;
        default:
          Logger.warn('[MultiplayerSystem] Unknown message type:', (message as any).type);
      }
    } catch (error) {
      Logger.error('[MultiplayerSystem] Failed to parse message:', error as unknown as Error);
    }
  }

  private handleDisconnect(): void {
    this.setConnectionState(MultiplayerConnectionState.DISCONNECTED);
    this.remotePlayers.clear();

    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.buildId) {
      this.setConnectionState(MultiplayerConnectionState.RECONNECTING);
      this.reconnectAttempts += 1;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
      
      Logger.info(`[MultiplayerSystem] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimer = setTimeout(() => {
        if (this.buildId) {
          void this.connect(this.buildId).catch((error) => {
            Logger.error('[MultiplayerSystem] Reconnection failed:', error as unknown as Error);
          });
        }
      }, delay);
    } else {
      Logger.error('[MultiplayerSystem] Max reconnection attempts reached');
      this.callbacks.onError?.(new Error('Failed to reconnect to server'));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setConnectionState(state: MultiplayerConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.callbacks.onConnectionStateChanged?.(state);
    }
  }
}


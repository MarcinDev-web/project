/**
 * Singleton WebSocket manager - shares single connection across all components
 */

import { getTokens } from '../utils/storage';
import type { WebSocketMessage } from './useWebSocket';

// WebSocket URL - direct connection in dev (no CORS issues), proxy in production
// Use 127.0.0.1 instead of localhost to force IPv4
const WS_URL = process.env.NODE_ENV === 'production'
  ? `wss://${window.location.hostname}/ws`
  : 'ws://127.0.0.1:3001';

class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscribers = new Set<(message: WebSocketMessage) => void>();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private enabled = false;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    if (!this.enabled) {
      this.enabled = true;
    }

    this.isConnecting = true;
    console.log('WebSocketManager: Attempting connection to:', WS_URL);

    try {
      const ws = new WebSocket(WS_URL);
      this.ws = ws;

      ws.onopen = () => {
        console.log('WebSocketManager: Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Send authentication token if available
        const { token } = getTokens();
        if (token) {
          // For now, we'll rely on session-based auth via the initial connection
        }

        // Send ping to keep connection alive
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          } else {
            this.stopPing();
          }
        }, 30000); // Every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle pong
          if (data.type === 'pong') {
            return;
          }

          // Handle connected
          if (data.type === 'connected') {
            return;
          }

          // Broadcast to all subscribers
          this.subscribers.forEach((callback) => {
            try {
              callback(data as WebSocketMessage);
            } catch (error) {
              console.error('WebSocketManager: Error in subscriber callback:', error);
            }
          });
        } catch (error) {
          console.error('WebSocketManager: Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocketManager: Error:', error);
        this.isConnecting = false;
      };

      ws.onclose = (event) => {
        console.log('WebSocketManager: Disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        this.isConnecting = false;
        this.stopPing();
        this.ws = null;

        // Attempt reconnect if enabled and under max attempts
        if (this.enabled && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('WebSocketManager: Failed to create connection:', error);
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    this.enabled = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(callback: (message: WebSocketMessage) => void): () => void {
    this.subscribers.add(callback);

    // Auto-connect if not connected and enabled
    if (!this.ws && this.enabled) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  send(message: unknown): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Export singleton instance
export const webSocketManager = new WebSocketManager();


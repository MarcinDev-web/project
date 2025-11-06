/**
 * Singleton WebSocket manager - shares single connection across all components
 */

import { getTokens } from '../utils/storage';
import type { WebSocketMessage } from './useWebSocket';

// Resolve WebSocket URL
// Priority:
// 1) VITE_WS_URL (absolute, e.g. wss://your-railway-app.railway.app/ws)
// 2) Derive from VITE_API_URL by replacing /api with /ws and http->ws
// 3) Dev fallback
function resolveWsUrl(): string {
  const explicit = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;

  const api = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (api) {
    try {
      const u = new URL(api, window.location.origin);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      // Replace trailing /api (with or without slash) with /ws
      const newPath = u.pathname.replace(/\/?api\/?$/, '/ws');
      u.pathname = newPath.endsWith('/ws') ? newPath : `${newPath}/ws`;
      u.search = '';
      u.hash = '';
      return u.toString().replace(/\/$/, '');
    } catch {
      // fall through to dev default
    }
  }

  // Use 127.0.0.1 instead of localhost to force IPv4
  return 'ws://127.0.0.1:3001';
}

const WS_URL = resolveWsUrl();

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


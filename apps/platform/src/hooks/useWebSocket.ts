/**
 * WebSocket hook for real-time messaging
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getTokens } from '../utils/storage';

export type WebSocketMessage =
  | { type: 'message:new'; message: Message }
  | { type: 'message:read'; messageId: string; conversationId: string; userId: string }
  | { type: 'message:typing'; conversationId: string; userId: string; typing: boolean }
  | { type: 'presence:online'; userId: string }
  | { type: 'presence:offline'; userId: string }
  | { type: 'notification:new'; notification: { id: string; type: string; title: string; message: string; createdAt: number; link?: string } }
  | { type: 'connected'; timestamp: number }
  | { type: 'forum:thread:new'; thread: any; categoryId: string }
  | { type: 'forum:thread:updated'; thread: any }
  | { type: 'forum:thread:deleted'; threadId: string; categoryId: string }
  | { type: 'forum:post:new'; post: any; threadId: string }
  | { type: 'forum:post:updated'; post: any }
  | { type: 'forum:post:deleted'; postId: string; threadId: string }
  | { type: 'forum:reaction:new'; threadId?: string; postId?: string; reaction: any }
  | { type: 'forum:reaction:removed'; threadId?: string; postId?: string; emoji: string; userId: string }
  | { type: 'forum:vote:changed'; threadId?: string; postId?: string; score: number; upvotes: number; downvotes: number };

export interface Message {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  read: boolean;
  createdAt: number;
}

const WS_URL = process.env.NODE_ENV === 'production'
  ? `wss://${window.location.hostname}:3001`
  : 'ws://localhost:3001';

export function useWebSocket(
  onMessage: (message: WebSocketMessage) => void,
  enabled = true
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttempts.current = 0;

        // Send authentication token if available
        const { token } = getTokens();
        if (token) {
          // For now, we'll rely on session-based auth via the initial connection
          // In production, you might want to send token explicitly
        }

        // Send ping to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000); // Every 30 seconds

        // Store interval for cleanup
        (ws as unknown as { pingInterval?: NodeJS.Timeout }).pingInterval = pingInterval;
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
            setConnected(true);
            return;
          }

          // Pass other messages to handler
          onMessage(data as WebSocketMessage);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        
        // Cleanup ping interval
        const wsWithInterval = wsRef.current as unknown as { pingInterval?: NodeJS.Timeout };
        if (wsWithInterval.pingInterval) {
          clearInterval(wsWithInterval.pingInterval);
        }

        // Attempt reconnect if enabled and under max attempts
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnected(false);
    }
  }, [enabled, onMessage]);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      const wsWithInterval = wsRef.current as unknown as { pingInterval?: NodeJS.Timeout };
      if (wsWithInterval.pingInterval) {
        clearInterval(wsWithInterval.pingInterval);
      }
      
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return { connected, sendMessage, disconnect };
}


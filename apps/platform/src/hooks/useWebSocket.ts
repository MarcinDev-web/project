/**
 * WebSocket hook for real-time messaging
 * Uses singleton WebSocketManager to share single connection across all components
 */

import { useEffect, useState, useCallback } from 'react';
import { webSocketManager } from './WebSocketManager';

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

export function useWebSocket(
  onMessage: (message: WebSocketMessage) => void,
  enabled = true
) {
  const [connected, setConnected] = useState(webSocketManager.isConnected());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Subscribe to messages
    const unsubscribe = webSocketManager.subscribe((message) => {
      onMessage(message);
    });

    // Update connected state periodically
    const interval = setInterval(() => {
      setConnected(webSocketManager.isConnected());
    }, 1000);

    // Ensure connection is active
    webSocketManager.connect();

    return () => {
      unsubscribe();
      clearInterval(interval);
      // Note: We don't disconnect here - other components might be using it
    };
  }, [enabled, onMessage]);

  const sendMessage = useCallback((message: unknown) => {
    return webSocketManager.send(message);
  }, []);

  const disconnect = useCallback(() => {
    // Only disconnect if no other components are using it
    // For now, we'll let the manager handle disconnection on page unload
    webSocketManager.disconnect();
  }, []);

  return { connected, sendMessage, disconnect };
}


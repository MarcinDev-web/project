/**
 * WebSocket handler for real-time messaging.
 */

import type { WebSocket } from 'ws';
import { MessagesStorage, type Message } from '../storage/MessagesStorage';
import { SessionManager } from './SessionManager';
import type {
  MessageNewMessage,
  MessageReadMessage,
  MessageTypingMessage,
} from '../types/websocket';

export class MessageHandler {
  private readonly messagesStorage: MessagesStorage;
  private readonly sessionManager: SessionManager;
  private readonly typingUsers = new Map<string, Map<string, NodeJS.Timeout>>(); // conversationId -> userId -> timeout

  constructor(messagesStorage: MessagesStorage, sessionManager: SessionManager) {
    this.messagesStorage = messagesStorage;
    this.sessionManager = sessionManager;
  }

  /**
   * Handle new message notification.
   * Broadcast to recipient(s) if they're connected.
   */
  async handleNewMessage(message: Message): Promise<void> {
    const conversation = await this.messagesStorage.getConversation(message.conversationId);
    
    if (conversation?.type === 'group') {
      // Group message - send to all members except sender
      for (const participantId of conversation.participants) {
        if (participantId !== message.fromUserId) {
          this.sessionManager.sendToUser(participantId, {
            type: 'message:new',
            timestamp: Date.now(),
            message: {
              id: message.id,
              conversationId: message.conversationId,
              fromUserId: message.fromUserId,
              toUserId: message.toUserId,
              content: message.content,
              read: message.read,
              createdAt: message.createdAt,
            },
          } as MessageNewMessage);
        }
      }
    } else {
      // Direct message - send to recipient
      this.sessionManager.sendToUser(message.toUserId, {
        type: 'message:new',
        timestamp: Date.now(),
        message: {
          id: message.id,
          conversationId: message.conversationId,
          fromUserId: message.fromUserId,
          toUserId: message.toUserId,
          content: message.content,
          read: message.read,
          createdAt: message.createdAt,
        },
      } as MessageNewMessage);
    }
  }

  /**
   * Handle message read notification.
   * Broadcast to sender if they're connected.
   */
  async handleMessageRead(messageId: string, conversationId: string, userId: string): Promise<void> {
    // Get message to find sender
    const message = await this.messagesStorage.getMessageById(messageId);
    
    if (message && message.fromUserId !== userId) {
      // Notify sender that their message was read
      this.sessionManager.sendToUser(message.fromUserId, {
        type: 'message:read',
        timestamp: Date.now(),
        messageId,
        conversationId,
        userId,
      } as MessageReadMessage);
    }
  }

  /**
   * Handle typing indicator.
   * Broadcast to other participants in conversation.
   */
  handleTyping(
    conversationId: string,
    userId: string,
    typing: boolean,
    ws: WebSocket
  ): void {
    // Clear existing timeout for this user in this conversation
    const conversationTyping = this.typingUsers.get(conversationId);
    if (conversationTyping) {
      const timeout = conversationTyping.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        conversationTyping.delete(userId);
      }
    }

    if (typing) {
      // User started typing - broadcast to conversation participants
      this.broadcastTypingToConversation(conversationId, userId, true);

      // Set timeout to auto-stop typing after 3 seconds
      const timeout = setTimeout(() => {
        this.handleTyping(conversationId, userId, false, ws);
      }, 3000);

      if (!this.typingUsers.has(conversationId)) {
        this.typingUsers.set(conversationId, new Map());
      }
      this.typingUsers.get(conversationId)!.set(userId, timeout);
    } else {
      // User stopped typing - broadcast stop
      this.broadcastTypingToConversation(conversationId, userId, false);
    }
  }

  /**
   * Broadcast typing indicator to all participants in a conversation.
   */
  private async broadcastTypingToConversation(
    conversationId: string,
    userId: string,
    typing: boolean
  ): Promise<void> {
    // Get conversation participants
    const conversation = await this.messagesStorage.getConversation(conversationId);

    if (!conversation) {
      return;
    }

    // Send typing indicator to all participants except the typist
    const typingMessage: MessageTypingMessage = {
      type: 'message:typing',
      timestamp: Date.now(),
      conversationId,
      userId,
      typing,
    };

    for (const participantId of conversation.participants) {
      if (participantId !== userId) {
        this.sessionManager.sendToUser(participantId, typingMessage);
      }
    }
  }
}


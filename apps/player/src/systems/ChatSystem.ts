import { Logger } from '../utils/logger';
import type { MultiplayerSystem } from './MultiplayerSystem.js';

export interface ChatMessage {
  id: string;
  playerId: string;
  displayName: string;
  message: string;
  timestamp: number;
  isSystem: boolean;
}

/**
 * ChatSystem manages chat messages and UI state
 */
export class ChatSystem {
  private multiplayerSystem: MultiplayerSystem | null = null;
  private messages: ChatMessage[] = [];
  private maxMessages = 100;
  private messageIdCounter = 0;

  /**
   * Initialize chat system
   */
  initialize(multiplayerSystem: MultiplayerSystem): void {
    this.multiplayerSystem = multiplayerSystem;
    Logger.debug('[ChatSystem] Initialized');
  }

  /**
   * Send chat message
   */
  sendMessage(message: string): void {
    if (!this.multiplayerSystem) {
      Logger.warn('[ChatSystem] Cannot send message: multiplayer system not initialized');
      return;
    }

    if (!message.trim()) {
      return; // Don't send empty messages
    }

    this.multiplayerSystem.sendChatMessage(message);
    
    // Add to local messages immediately (optimistic update)
    const chatMessage: ChatMessage = {
      id: `local_${this.messageIdCounter++}`,
      playerId: 'local',
      displayName: 'You',
      message: message.trim(),
      timestamp: Date.now(),
      isSystem: false,
    };
    
    this.addMessage(chatMessage);
  }

  /**
   * Add message to chat history
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    
    // Limit message history
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  /**
   * Add system message
   */
  addSystemMessage(text: string): void {
    const message: ChatMessage = {
      id: `system_${this.messageIdCounter++}`,
      playerId: 'system',
      displayName: 'System',
      message: text,
      timestamp: Date.now(),
      isSystem: true,
    };
    
    this.addMessage(message);
  }

  /**
   * Handle incoming chat message from multiplayer
   */
  handleIncomingMessage(playerId: string, message: string, displayName?: string): void {
    const chatMessage: ChatMessage = {
      id: `remote_${this.messageIdCounter++}`,
      playerId,
      displayName: displayName ?? `Player ${playerId.substring(0, 8)}`,
      message,
      timestamp: Date.now(),
      isSystem: false,
    };
    
    this.addMessage(chatMessage);
  }

  /**
   * Get all messages
   */
  getMessages(): ReadonlyArray<ChatMessage> {
    return this.messages;
  }

  /**
   * Get recent messages (last N messages)
   */
  getRecentMessages(count: number): ChatMessage[] {
    return this.messages.slice(-count);
  }

  /**
   * Clear all messages
   */
  clearMessages(): void {
    this.messages = [];
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.multiplayerSystem = null;
    this.messages = [];
  }
}


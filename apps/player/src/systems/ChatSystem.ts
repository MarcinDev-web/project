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

type ChatListener = (messages: ChatMessage[]) => void;

const BAD_WORDS = ['badword', 'spam', 'offensive']; // Simplified list

/**
 * ChatSystem manages chat messages and UI state
 */
export class ChatSystem {
  private multiplayerSystem: MultiplayerSystem | null = null;
  private messages: ChatMessage[] = [];
  private maxMessages = 100;
  private messageIdCounter = 0;
  private listeners: Set<ChatListener> = new Set();

  // Singleton instance
  private static instance: ChatSystem;

  public static getInstance(): ChatSystem {
    if (!ChatSystem.instance) {
      ChatSystem.instance = new ChatSystem();
    }
    return ChatSystem.instance;
  }

  constructor() {
    if (ChatSystem.instance) {
      return ChatSystem.instance;
    }
    ChatSystem.instance = this;
  }

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
    // Local simulation if no multiplayer system
    // if (!this.multiplayerSystem) { ... }

    let text = message.trim();
    if (!text) return;

    // Profanity filter
    text = this.filterProfanity(text);

    if (this.multiplayerSystem) {
      this.multiplayerSystem.sendChatMessage(text);
    }
    
    // Add to local messages immediately (optimistic update)
    const chatMessage: ChatMessage = {
      id: `local_${this.messageIdCounter++}`,
      playerId: 'local',
      displayName: 'You',
      message: text,
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

    this.notifyListeners();
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
    const filteredMessage = this.filterProfanity(message);

    const chatMessage: ChatMessage = {
      id: `remote_${this.messageIdCounter++}`,
      playerId,
      displayName: displayName ?? `Player ${playerId.substring(0, 8)}`,
      message: filteredMessage,
      timestamp: Date.now(),
      isSystem: false,
    };
    
    this.addMessage(chatMessage);
  }

  private filterProfanity(text: string): string {
    let filtered = text;
    for (const word of BAD_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        filtered = filtered.replace(regex, '*'.repeat(word.length));
    }
    return filtered;
  }

  subscribe(listener: ChatListener): () => void {
    this.listeners.add(listener);
    // Initial call
    listener(this.messages);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.messages]));
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
    this.notifyListeners();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.multiplayerSystem = null;
    this.messages = [];
    this.listeners.clear();
  }
}

export const chatSystem = ChatSystem.getInstance();

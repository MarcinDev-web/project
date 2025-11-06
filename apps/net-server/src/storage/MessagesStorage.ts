/**
 * Messages Storage - manages conversations and messages
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface Message {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  read: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  lastMessageAt: number;
  lastMessage?: string;
  // Group-specific fields
  groupName?: string;
  groupAvatar?: string;
  ownerId?: string;
  members?: string[]; // For groups, this is the same as participants but more explicit
}

export class MessagesStorage {
  private readonly dataDir: string;
  private readonly messagesFile: string;
  private readonly conversationsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.messagesFile = path.join(dataDir, 'messages.json');
    this.conversationsFile = path.join(dataDir, 'conversations.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      await fs.access(this.messagesFile);
    } catch {
      await fs.writeFile(this.messagesFile, JSON.stringify([], null, 2));
    }

    try {
      await fs.access(this.conversationsFile);
    } catch {
      await fs.writeFile(this.conversationsFile, JSON.stringify([], null, 2));
    }
  }

  private async readMessages(): Promise<Message[]> {
    try {
      const data = await fs.readFile(this.messagesFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeMessages(messages: Message[]): Promise<void> {
    await fs.writeFile(this.messagesFile, JSON.stringify(messages, null, 2));
  }

  private async readConversations(): Promise<Conversation[]> {
    try {
      const data = await fs.readFile(this.conversationsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeConversations(conversations: Conversation[]): Promise<void> {
    await fs.writeFile(this.conversationsFile, JSON.stringify(conversations, null, 2));
  }

  private getConversationId(userId1: string, userId2: string): string {
    // Create consistent conversation ID from two user IDs
    const ids = [userId1, userId2].sort();
    return `conv_${ids[0]}_${ids[1]}`;
  }

  private generateGroupConversationId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  async getOrCreateConversation(userId1: string, userId2: string): Promise<Conversation> {
    const conversations = await this.readConversations();
    const conversationId = this.getConversationId(userId1, userId2);

    let conversation = conversations.find((c) => c.id === conversationId);

    if (!conversation) {
      conversation = {
        id: conversationId,
        type: 'direct',
        participants: [userId1, userId2].sort(),
        lastMessageAt: 0,
      };
      conversations.push(conversation);
      await this.writeConversations(conversations);
    }

    return conversation;
  }

  async createGroupConversation(
    ownerId: string,
    groupName: string,
    memberIds: string[],
    groupAvatar?: string
  ): Promise<Conversation> {
    const conversations = await this.readConversations();

    // Ensure owner is in members
    const allMembers = Array.from(new Set([ownerId, ...memberIds]));

    const conversation: Conversation = {
      id: this.generateGroupConversationId(),
      type: 'group',
      participants: allMembers,
      members: allMembers,
      ownerId,
      groupName,
      ...(groupAvatar !== undefined && { groupAvatar }),
      lastMessageAt: Date.now(),
    };

    conversations.push(conversation);
    await this.writeConversations(conversations);

    return conversation;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    const conversations = await this.readConversations();
    return conversations
      .filter((c) => c.participants.includes(userId))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const conversations = await this.readConversations();
    return conversations.find((c) => c.id === conversationId) ?? null;
  }

  async createMessage(fromUserId: string, toUserId: string, content: string): Promise<Message>;
  async createMessage(
    fromUserId: string,
    conversationId: string,
    content: string,
    isGroup: boolean
  ): Promise<Message>;
  async createMessage(
    fromUserId: string,
    toUserIdOrConversationId: string,
    content: string,
    isGroup = false
  ): Promise<Message> {
    let conversation: Conversation;

    if (isGroup) {
      // Group message - conversation ID provided
      const foundConversation = await this.getConversation(toUserIdOrConversationId);
      if (!foundConversation) {
        throw new Error('Conversation not found');
      }
      conversation = foundConversation;
      if (conversation.type !== 'group') {
        throw new Error('Conversation is not a group');
      }
    } else {
      // Direct message
      conversation = await this.getOrCreateConversation(fromUserId, toUserIdOrConversationId);
    }

    const messages = await this.readMessages();

    // For groups, toUserId represents the conversation (for consistency with Message interface)
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      conversationId: conversation.id,
      fromUserId,
      toUserId: isGroup ? conversation.id : toUserIdOrConversationId, // For groups, use conversation ID
      content,
      read: false,
      createdAt: Date.now(),
    };

    messages.push(message);
    await this.writeMessages(messages);

    // Update conversation
    const conversations = await this.readConversations();
    const conv = conversations.find((c) => c.id === conversation.id);
    if (conv) {
      conv.lastMessageAt = message.createdAt;
      conv.lastMessage = content;
      await this.writeConversations(conversations);
    }

    return message;
  }

  async getMessages(conversationId: string, limit = 100): Promise<Message[]> {
    const messages = await this.readMessages();
    return messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-limit);
  }

  async getMessageById(messageId: string): Promise<Message | null> {
    const messages = await this.readMessages();
    return messages.find((m) => m.id === messageId) ?? null;
  }

  async markAsRead(messageId: string, userId: string): Promise<boolean> {
    const messages = await this.readMessages();
    const message = messages.find((m) => m.id === messageId && m.toUserId === userId);

    if (!message || message.read) {
      return false;
    }

    message.read = true;
    await this.writeMessages(messages);

    return true;
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    const messages = await this.readMessages();
    const unread = messages.filter(
      (m) => m.conversationId === conversationId && m.toUserId === userId && !m.read
    );

    for (const message of unread) {
      message.read = true;
    }

    if (unread.length > 0) {
      await this.writeMessages(messages);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const messages = await this.readMessages();
    return messages.filter((m) => m.toUserId === userId && !m.read).length;
  }

  async getUnreadCountForConversation(conversationId: string, userId: string): Promise<number> {
    const messages = await this.readMessages();
    const conversation = await this.getConversation(conversationId);

    if (conversation?.type === 'group') {
      // For groups, count messages not from the user
      return messages.filter(
        (m) => m.conversationId === conversationId && m.fromUserId !== userId && !m.read
      ).length;
    }

    // For direct messages
    return messages.filter(
      (m) => m.conversationId === conversationId && m.toUserId === userId && !m.read
    ).length;
  }

  async updateGroupConversation(
    conversationId: string,
    updates: { groupName?: string; groupAvatar?: string }
  ): Promise<Conversation | null> {
    const conversations = await this.readConversations();
    const conversation = conversations.find((c) => c.id === conversationId && c.type === 'group');

    if (!conversation) {
      return null;
    }

    if (updates.groupName !== undefined) {
      conversation.groupName = updates.groupName;
    }
    if (updates.groupAvatar !== undefined) {
      conversation.groupAvatar = updates.groupAvatar;
    }

    await this.writeConversations(conversations);
    return conversation;
  }

  async addGroupMembers(conversationId: string, memberIds: string[]): Promise<boolean> {
    const conversations = await this.readConversations();
    const conversation = conversations.find((c) => c.id === conversationId && c.type === 'group');

    if (!conversation) {
      return false;
    }

    const existingMembers = new Set(conversation.participants);
    const newMembers = memberIds.filter((id) => !existingMembers.has(id));

    if (newMembers.length === 0) {
      return false;
    }

    conversation.participants = [...conversation.participants, ...newMembers];
    conversation.members = conversation.participants;

    await this.writeConversations(conversations);
    return true;
  }

  async removeGroupMember(conversationId: string, memberId: string): Promise<boolean> {
    const conversations = await this.readConversations();
    const conversation = conversations.find((c) => c.id === conversationId && c.type === 'group');

    if (!conversation) {
      return false;
    }

    const index = conversation.participants.indexOf(memberId);
    if (index === -1) {
      return false;
    }

    conversation.participants.splice(index, 1);
    conversation.members = conversation.participants;

    await this.writeConversations(conversations);
    return true;
  }

  async deleteGroupConversation(conversationId: string, userId: string): Promise<boolean> {
    const conversations = await this.readConversations();
    const conversation = conversations.find((c) => c.id === conversationId && c.type === 'group');

    if (!conversation || conversation.ownerId !== userId) {
      return false;
    }

    const index = conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) {
      return false;
    }

    conversations.splice(index, 1);
    await this.writeConversations(conversations);

    // Optionally delete all messages in this conversation
    // For now, we'll keep them for history

    return true;
  }
}


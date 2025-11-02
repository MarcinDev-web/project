/**
 * Messages API calls
 */

import { apiClient } from './client';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  read: boolean;
  createdAt: number;
  status?: MessageStatus; // Optional for backward compatibility
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  lastMessageAt: number;
  lastMessage?: string;
  unreadCount?: number; // Number of unread messages in this conversation
  // Group-specific fields
  groupName?: string;
  groupAvatar?: string;
  ownerId?: string;
  members?: string[];
}

export const messagesApi = {
  async getConversations(): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>('/messages');
  },

  async getMessages(conversationId: string, limit = 100): Promise<Message[]> {
    const params = new URLSearchParams();
    if (limit) {
      params.append('limit', String(limit));
    }
    const query = params.toString();
    return apiClient.get<Message[]>(`/messages/${conversationId}${query ? `?${query}` : ''}`);
  },

  async sendMessage(toUserId: string, content: string, conversationId?: string): Promise<Message> {
    if (conversationId) {
      return apiClient.post<Message>('/messages', { conversationId, content });
    }
    return apiClient.post<Message>('/messages', { toUserId, content });
  },

  async markAsRead(messageId: string): Promise<void> {
    return apiClient.put(`/messages/${messageId}/read`);
  },

  // Group conversations
  async createGroup(groupName: string, memberIds: string[], groupAvatar?: string): Promise<Conversation> {
    return apiClient.post<Conversation>('/messages/groups', {
      groupName,
      memberIds,
      groupAvatar,
    });
  },

  async getGroupConversations(): Promise<Conversation[]> {
    return apiClient.get<Conversation[]>('/messages/groups');
  },

  async updateGroup(groupId: string, updates: { groupName?: string; groupAvatar?: string }): Promise<Conversation> {
    return apiClient.put<Conversation>(`/messages/groups/${groupId}`, updates);
  },

  async addGroupMembers(groupId: string, memberIds: string[]): Promise<void> {
    return apiClient.put(`/messages/groups/${groupId}/members`, { memberIds, action: 'add' });
  },

  async removeGroupMember(groupId: string, memberId: string): Promise<void> {
    return apiClient.put(`/messages/groups/${groupId}/members`, { memberId, action: 'remove' });
  },

  async leaveGroup(groupId: string): Promise<void> {
    return apiClient.delete(`/messages/groups/${groupId}/leave`);
  },
};


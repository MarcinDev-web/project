/**
 * Moderator API calls
 */

import { apiClient } from './client';
import type { ForumThread, ForumPost } from './forum';

export interface MarketplaceItem {
  id: string;
  type: 'build' | 'avatar';
  title: string;
  description?: string;
  authorId: string;
  authorName?: string;
  thumbnailUrl?: string;
  fileUrl: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  downloads: number;
  likes: number;
  public: boolean;
}

export interface PendingItemsResponse {
  items: MarketplaceItem[];
  total: number;
}

export interface ReportedUser {
  id: string;
  email: string;
  reports: number;
  // Can be extended
}

export interface ReportedUsersResponse {
  users: ReportedUser[];
  total: number;
}

export interface Message {
  id: string;
  fromUserId: string;
  conversationId: string;
  content: string;
  createdAt: number;
  read: boolean;
  isGroupMessage?: boolean;
}

export const moderatorApi = {
  /**
   * Get marketplace items pending moderation
   */
  async getPendingItems(): Promise<PendingItemsResponse> {
    return apiClient.get('/moderator/marketplace/pending');
  },

  /**
   * Approve marketplace item
   */
  async approveItem(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post(`/moderator/marketplace/${id}/approve`);
  },

  /**
   * Reject marketplace item
   */
  async rejectItem(id: string, reason?: string): Promise<{ success: boolean; message: string; reason?: string }> {
    return apiClient.post(`/moderator/marketplace/${id}/reject`, { reason });
  },

  /**
   * Delete marketplace item
   */
  async deleteItem(id: string): Promise<void> {
    return apiClient.delete(`/moderator/marketplace/${id}`);
  },

  /**
   * Get reported users
   */
  async getReportedUsers(): Promise<ReportedUsersResponse> {
    return apiClient.get('/moderator/users/reported');
  },

  /**
   * Ban a user
   */
  async banUser(id: string, reason?: string): Promise<{
    id: string;
    email: string;
    active: boolean;
    banned: boolean;
    reason?: string;
  }> {
    return apiClient.put(`/moderator/users/${id}/ban`, { reason });
  },

  /**
   * Warn a user
   */
  async warnUser(id: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    reason?: string;
  }> {
    return apiClient.put(`/moderator/users/${id}/warn`, { reason });
  },

  /**
   * Get messages in a conversation (read-only)
   */
  async getMessages(conversationId: string, limit?: number): Promise<Message[]> {
    const query = limit ? `?limit=${limit}` : '';
    return apiClient.get(`/moderator/messages/${conversationId}${query}`);
  },

  /**
   * Get forum threads for moderation
   */
  async getForumThreads(params?: {
    limit?: number;
    offset?: number;
    categoryId?: string;
    authorId?: string;
    search?: string;
  }): Promise<{
    threads: ForumThread[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.authorId) query.set('authorId', params.authorId);
    if (params?.search) query.set('search', params.search);

    return apiClient.get(`/moderator/forum/threads?${query.toString()}`);
  },

  /**
   * Approve forum thread
   */
  async approveForumThread(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post(`/moderator/forum/threads/${id}/approve`);
  },

  /**
   * Reject forum thread
   */
  async rejectForumThread(id: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    reason?: string;
  }> {
    return apiClient.post(`/moderator/forum/threads/${id}/reject`, { reason });
  },

  /**
   * Delete forum thread
   */
  async deleteForumThread(id: string): Promise<void> {
    return apiClient.delete(`/moderator/forum/threads/${id}`);
  },

  /**
   * Warn forum thread author
   */
  async warnForumThreadAuthor(id: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    reason?: string;
    authorId: string;
  }> {
    return apiClient.post(`/moderator/forum/threads/${id}/warn`, { reason });
  },

  /**
   * Get forum posts for moderation
   */
  async getForumPosts(params?: {
    limit?: number;
    offset?: number;
    threadId?: string;
    authorId?: string;
    search?: string;
  }): Promise<{
    posts: ForumPost[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.threadId) query.set('threadId', params.threadId);
    if (params?.authorId) query.set('authorId', params.authorId);
    if (params?.search) query.set('search', params.search);

    return apiClient.get(`/moderator/forum/posts?${query.toString()}`);
  },

  /**
   * Delete forum post
   */
  async deleteForumPost(id: string): Promise<void> {
    return apiClient.delete(`/moderator/forum/posts/${id}`);
  },

  /**
   * Warn forum post author
   */
  async warnForumPostAuthor(id: string, reason?: string): Promise<{
    success: boolean;
    message: string;
    reason?: string;
    authorId: string;
  }> {
    return apiClient.post(`/moderator/forum/posts/${id}/warn`, { reason });
  },
};


/**
 * Support API calls
 */

import { apiClient } from './client';

export interface SupportTicket {
  id: string;
  userId: string;
  type: 'bug' | 'question' | 'feature' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  assignedTo?: string;
  resolvedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  isInternal: boolean;
  createdAt: number;
}

export interface SupportTicketWithMessages extends SupportTicket {
  messages: SupportTicketMessage[];
}

export interface SupportTicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  averageResponseTime?: number;
}

export interface SupportFAQ {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'editor' | 'marketplace' | 'account' | 'technical';
  order: number;
  isPublished: boolean;
  tags: string[];
  viewCount: number;
  helpfulCount: number;
  createdAt: number;
  updatedAt: number;
}

export const supportApi = {
  // Tickets
  async createTicket(data: {
    type: 'bug' | 'question' | 'feature' | 'other';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    title: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<SupportTicket> {
    return apiClient.post<SupportTicket>('/support/tickets', data);
  },

  async getTickets(options?: {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    limit?: number;
    offset?: number;
  }): Promise<SupportTicket[]> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.priority) params.append('priority', options.priority);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    const query = params.toString();
    return apiClient.get<SupportTicket[]>(`/support/tickets${query ? `?${query}` : ''}`);
  },

  async getTicket(id: string): Promise<SupportTicketWithMessages> {
    return apiClient.get<SupportTicketWithMessages>(`/support/tickets/${id}`);
  },

  async updateTicket(
    id: string,
    data: {
      status?: 'open' | 'in_progress' | 'resolved' | 'closed';
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      assignedTo?: string | null;
    }
  ): Promise<SupportTicket> {
    return apiClient.patch<SupportTicket>(`/support/tickets/${id}`, data);
  },

  async addMessage(ticketId: string, data: { content: string; isInternal?: boolean }): Promise<SupportTicketMessage> {
    return apiClient.post<SupportTicketMessage>(`/support/tickets/${ticketId}/messages`, data);
  },

  async getTicketStats(): Promise<SupportTicketStats> {
    return apiClient.get<SupportTicketStats>('/support/tickets/stats');
  },

  // FAQ
  async getFAQs(options?: {
    category?: 'general' | 'editor' | 'marketplace' | 'account' | 'technical';
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<SupportFAQ[]> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.search) params.append('search', options.search);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    const query = params.toString();
    return apiClient.get<SupportFAQ[]>(`/support/faq${query ? `?${query}` : ''}`);
  },

  async getFAQ(id: string): Promise<SupportFAQ> {
    return apiClient.get<SupportFAQ>(`/support/faq/${id}`);
  },

  async markFAQHelpful(id: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(`/support/faq/${id}/helpful`);
  },

  async searchFAQ(query: string): Promise<SupportFAQ[]> {
    return apiClient.get<SupportFAQ[]>(`/support/faq/search?q=${encodeURIComponent(query)}`);
  },

  // Admin endpoints
  async getAdminTickets(options?: {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    userId?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<SupportTicket[]> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.priority) params.append('priority', options.priority);
    if (options?.userId) params.append('userId', options.userId);
    if (options?.assignedTo) params.append('assignedTo', options.assignedTo);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    const query = params.toString();
    return apiClient.get<SupportTicket[]>(`/admin/support/tickets${query ? `?${query}` : ''}`);
  },

  async updateAdminTicket(
    id: string,
    data: {
      status?: 'open' | 'in_progress' | 'resolved' | 'closed';
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      assignedTo?: string | null;
    }
  ): Promise<SupportTicket> {
    return apiClient.patch<SupportTicket>(`/admin/support/tickets/${id}`, data);
  },

  async createFAQ(data: {
    question: string;
    answer: string;
    category: 'general' | 'editor' | 'marketplace' | 'account' | 'technical';
    order?: number;
    isPublished?: boolean;
    tags?: string[];
  }): Promise<SupportFAQ> {
    return apiClient.post<SupportFAQ>('/admin/support/faq', data);
  },

  async updateFAQ(
    id: string,
    data: {
      question?: string;
      answer?: string;
      category?: 'general' | 'editor' | 'marketplace' | 'account' | 'technical';
      order?: number;
      isPublished?: boolean;
      tags?: string[];
    }
  ): Promise<SupportFAQ> {
    return apiClient.patch<SupportFAQ>(`/admin/support/faq/${id}`, data);
  },

  async deleteFAQ(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/admin/support/faq/${id}`);
  },
};


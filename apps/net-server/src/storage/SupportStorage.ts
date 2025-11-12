/**
 * Support Storage - interfaces for support tickets and FAQ
 */

export interface SupportTicket {
  id: string;
  userId: string;
  type: 'bug' | 'question' | 'feature' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  metadata?: Record<string, unknown>; // Additional data (browser info, screenshots, etc.)
  assignedTo?: string; // User ID of moderator/admin
  resolvedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  content: string;
  isInternal: boolean; // For staff notes
  createdAt: number;
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
  averageResponseTime?: number; // In hours
}

/**
 * Support Storage interface - defines methods for managing support tickets and FAQ
 */
export interface SupportStorage {
  // Tickets
  createTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupportTicket>;
  getTicket(id: string, userId?: string): Promise<SupportTicketWithMessages | null>;
  getTickets(options: {
    userId?: string;
    status?: SupportTicket['status'];
    priority?: SupportTicket['priority'];
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<SupportTicket[]>;
  updateTicket(
    id: string,
    updates: Partial<Pick<SupportTicket, 'status' | 'priority' | 'assignedTo' | 'resolvedAt'>>
  ): Promise<SupportTicket | null>;
  addMessage(ticketId: string, message: Omit<SupportTicketMessage, 'id' | 'createdAt'>): Promise<SupportTicketMessage>;
  getTicketStats(): Promise<SupportTicketStats>;

  // FAQ
  createFAQ(faq: Omit<SupportFAQ, 'id' | 'viewCount' | 'helpfulCount' | 'createdAt' | 'updatedAt'>): Promise<SupportFAQ>;
  getFAQ(id: string): Promise<SupportFAQ | null>;
  getFAQs(options?: {
    category?: SupportFAQ['category'];
    isPublished?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<SupportFAQ[]>;
  updateFAQ(id: string, updates: Partial<Omit<SupportFAQ, 'id' | 'createdAt'>>): Promise<SupportFAQ | null>;
  deleteFAQ(id: string): Promise<boolean>;
  incrementFAQView(id: string): Promise<void>;
  incrementFAQHelpful(id: string): Promise<void>;
}


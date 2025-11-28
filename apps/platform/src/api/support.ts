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

// ============================================
// MOCK DATA FOR DEVELOPMENT
// ============================================

const MOCK_FAQS: SupportFAQ[] = [
  // General
  {
    id: 'faq-1',
    question: 'What is Forge World?',
    answer: 'Forge World is a UGC (User Generated Content) 3D games platform that allows creators to build, share, and monetize their own games and experiences. Using our powerful WebGPU-based engine, you can create stunning 3D worlds directly in your browser.',
    category: 'general',
    order: 1,
    isPublished: true,
    tags: ['about', 'platform', 'introduction'],
    viewCount: 1250,
    helpfulCount: 342,
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-2',
    question: 'Is Forge World free to use?',
    answer: 'Yes! Forge World is free to play and create. We offer a freemium model where basic features are available to everyone. Premium features, additional storage, and advanced tools are available through our subscription plans. Creators can also earn revenue through the marketplace.',
    category: 'general',
    order: 2,
    isPublished: true,
    tags: ['pricing', 'free', 'premium'],
    viewCount: 2100,
    helpfulCount: 567,
    createdAt: Date.now() - 85 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-3',
    question: 'What browsers are supported?',
    answer: 'Forge World works best on modern browsers that support WebGPU:\n\n• Chrome 113+ (recommended)\n• Edge 113+\n• Firefox (with WebGPU flag enabled)\n• Safari 17+ (macOS Sonoma)\n\nFor the best experience, we recommend using the latest version of Chrome or Edge.',
    category: 'general',
    order: 3,
    isPublished: true,
    tags: ['browsers', 'compatibility', 'webgpu'],
    viewCount: 890,
    helpfulCount: 234,
    createdAt: Date.now() - 80 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  // Editor
  {
    id: 'faq-4',
    question: 'How do I create my first game?',
    answer: 'Getting started is easy!\n\n1. Click "Create Game" in the navigation\n2. Choose a template or start from scratch\n3. Use the Editor to add objects, terrain, and logic\n4. Test your game with the Play button\n5. Publish when ready!\n\nCheck out our tutorials in the Studio section for detailed guides.',
    category: 'editor',
    order: 1,
    isPublished: true,
    tags: ['getting-started', 'tutorial', 'create'],
    viewCount: 3400,
    helpfulCount: 890,
    createdAt: Date.now() - 75 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-5',
    question: 'How do I add custom scripts to my game?',
    answer: 'Forge World supports custom scripting using our visual scripting system and TypeScript:\n\n**Visual Scripting:**\n• Open the Script Editor panel\n• Drag and drop logic blocks\n• Connect triggers and actions\n\n**TypeScript:**\n• Create a new script asset\n• Write code using our API\n• Attach to game objects\n\nVisit our documentation for the full API reference.',
    category: 'editor',
    order: 2,
    isPublished: true,
    tags: ['scripting', 'code', 'programming'],
    viewCount: 1560,
    helpfulCount: 423,
    createdAt: Date.now() - 70 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-6',
    question: 'What are the keyboard shortcuts in the Editor?',
    answer: 'Here are the most useful shortcuts:\n\n**Navigation:**\n• WASD - Move camera\n• Middle Mouse - Orbit\n• Scroll - Zoom\n• F - Focus on selection\n\n**Editing:**\n• G - Move tool\n• R - Rotate tool\n• S - Scale tool\n• Ctrl+D - Duplicate\n• Delete - Remove\n• Ctrl+Z - Undo\n• Ctrl+Y - Redo\n\n**View:**\n• H - Toggle hierarchy\n• I - Toggle inspector\n• Space - Play/Stop',
    category: 'editor',
    order: 3,
    isPublished: true,
    tags: ['shortcuts', 'keyboard', 'controls'],
    viewCount: 2200,
    helpfulCount: 678,
    createdAt: Date.now() - 65 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  // Marketplace
  {
    id: 'faq-7',
    question: 'How do I sell my creations on the Marketplace?',
    answer: 'To sell on the Marketplace:\n\n1. Create high-quality assets (models, scripts, templates)\n2. Go to your Studio → Assets\n3. Click "Publish to Marketplace"\n4. Set your price and description\n5. Submit for review\n\nOnce approved, your item will be listed and you\'ll earn 70% of each sale. Make sure to read our Marketplace Guidelines for best practices.',
    category: 'marketplace',
    order: 1,
    isPublished: true,
    tags: ['selling', 'monetization', 'assets'],
    viewCount: 1890,
    helpfulCount: 456,
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-8',
    question: 'What payment methods do you accept?',
    answer: 'We accept multiple payment methods:\n\n• Credit/Debit Cards (Visa, Mastercard, Amex)\n• PayPal\n• Forge Coins (our virtual currency)\n• Apple Pay / Google Pay\n\nCreators can receive payouts via PayPal or bank transfer once they reach the minimum threshold of $50.',
    category: 'marketplace',
    order: 2,
    isPublished: true,
    tags: ['payment', 'money', 'payouts'],
    viewCount: 1340,
    helpfulCount: 312,
    createdAt: Date.now() - 55 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
  },
  // Account
  {
    id: 'faq-9',
    question: 'How do I change my username?',
    answer: 'To change your username:\n\n1. Click on your profile icon in the top right\n2. Select "Settings"\n3. Go to "Account" tab\n4. Click "Edit" next to your username\n5. Enter your new username and save\n\nNote: You can only change your username once every 30 days, and some usernames may be unavailable.',
    category: 'account',
    order: 1,
    isPublished: true,
    tags: ['username', 'profile', 'settings'],
    viewCount: 980,
    helpfulCount: 234,
    createdAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-10',
    question: 'How do I enable two-factor authentication?',
    answer: 'Two-factor authentication (2FA) adds an extra layer of security:\n\n1. Go to Settings → Security\n2. Click "Enable 2FA"\n3. Scan the QR code with your authenticator app\n4. Enter the verification code\n5. Save your backup codes\n\nWe recommend using Google Authenticator or Authy for 2FA.',
    category: 'account',
    order: 2,
    isPublished: true,
    tags: ['security', '2fa', 'authentication'],
    viewCount: 567,
    helpfulCount: 189,
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-11',
    question: 'How do I delete my account?',
    answer: 'We\'re sorry to see you go! To delete your account:\n\n1. Go to Settings → Account\n2. Scroll to "Danger Zone"\n3. Click "Delete Account"\n4. Enter your password to confirm\n5. Follow the verification steps\n\n⚠️ Warning: This action is permanent. All your games, assets, and purchases will be deleted and cannot be recovered.',
    category: 'account',
    order: 3,
    isPublished: true,
    tags: ['delete', 'remove', 'close'],
    viewCount: 345,
    helpfulCount: 78,
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
  },
  // Technical
  {
    id: 'faq-12',
    question: 'Why is my game running slowly?',
    answer: 'Performance issues can have several causes:\n\n**Hardware:**\n• Ensure WebGPU is enabled and supported\n• Close other browser tabs\n• Update your graphics drivers\n\n**Game Optimization:**\n• Reduce polygon count in models\n• Use texture atlases\n• Enable LOD (Level of Detail)\n• Limit dynamic lights\n• Use occlusion culling\n\nCheck the Performance panel in the Editor for detailed metrics.',
    category: 'technical',
    order: 1,
    isPublished: true,
    tags: ['performance', 'lag', 'fps', 'optimization'],
    viewCount: 2800,
    helpfulCount: 734,
    createdAt: Date.now() - 35 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-13',
    question: 'How do I report a bug?',
    answer: 'Found a bug? Help us fix it!\n\n1. Go to Support → Create Ticket\n2. Select "Bug Report" as the type\n3. Describe the issue in detail:\n   • What happened?\n   • What did you expect?\n   • Steps to reproduce\n4. Include screenshots or screen recordings\n5. Submit the ticket\n\nYou can also report bugs on our Discord server or GitHub repository.',
    category: 'technical',
    order: 2,
    isPublished: true,
    tags: ['bug', 'report', 'issue'],
    viewCount: 670,
    helpfulCount: 156,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'faq-14',
    question: 'What file formats are supported for imports?',
    answer: 'Forge World supports various file formats:\n\n**3D Models:**\n• GLTF/GLB (recommended)\n• OBJ\n• FBX\n\n**Images:**\n• PNG, JPG, WebP\n• HDR (for environment maps)\n\n**Audio:**\n• MP3, WAV, OGG\n\n**Other:**\n• JSON (for data)\n• WASM (for custom modules)\n\nMaximum file sizes vary by subscription tier.',
    category: 'technical',
    order: 3,
    isPublished: true,
    tags: ['import', 'files', 'formats', 'upload'],
    viewCount: 1120,
    helpfulCount: 289,
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
  },
];

// Mock tickets storage (in-memory for development)
let mockTickets: SupportTicket[] = [];
let mockMessages: Record<string, SupportTicketMessage[]> = {};

// Helper to check if we should use mock data
const shouldUseMockData = () => {
  // In development, use mock data if API fails
  return import.meta.env.DEV;
};

export const supportApi = {
  // Tickets
  async createTicket(data: {
    type: 'bug' | 'question' | 'feature' | 'other';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    title: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<SupportTicket> {
    try {
      return await apiClient.post<SupportTicket>('/support/tickets', data);
    } catch (error) {
      if (shouldUseMockData()) {
        // Create mock ticket
        const ticket: SupportTicket = {
          id: `ticket-${Date.now()}`,
          userId: 'current-user',
          type: data.type,
          status: 'open',
          priority: data.priority || 'medium',
          title: data.title,
          description: data.description,
          metadata: data.metadata,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        mockTickets.unshift(ticket);
        mockMessages[ticket.id] = [];
        return ticket;
      }
      throw error;
    }
  },

  async getTickets(options?: {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    limit?: number;
    offset?: number;
  }): Promise<SupportTicket[]> {
    try {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.priority) params.append('priority', options.priority);
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));
      const query = params.toString();
      return await apiClient.get<SupportTicket[]>(`/support/tickets${query ? `?${query}` : ''}`);
    } catch (error) {
      if (shouldUseMockData()) {
        let tickets = [...mockTickets];
        if (options?.status) {
          tickets = tickets.filter(t => t.status === options.status);
        }
        if (options?.priority) {
          tickets = tickets.filter(t => t.priority === options.priority);
        }
        return tickets;
      }
      throw error;
    }
  },

  async getTicket(id: string): Promise<SupportTicketWithMessages> {
    try {
      return await apiClient.get<SupportTicketWithMessages>(`/support/tickets/${id}`);
    } catch (error) {
      if (shouldUseMockData()) {
        const ticket = mockTickets.find(t => t.id === id);
        if (ticket) {
          return {
            ...ticket,
            messages: mockMessages[id] || [],
          };
        }
        throw new Error('Ticket not found');
      }
      throw error;
    }
  },

  async updateTicket(
    id: string,
    data: {
      status?: 'open' | 'in_progress' | 'resolved' | 'closed';
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      assignedTo?: string | null;
    }
  ): Promise<SupportTicket> {
    try {
      return await apiClient.patch<SupportTicket>(`/support/tickets/${id}`, data);
    } catch (error) {
      if (shouldUseMockData()) {
        const ticketIndex = mockTickets.findIndex(t => t.id === id);
        if (ticketIndex !== -1) {
          mockTickets[ticketIndex] = {
            ...mockTickets[ticketIndex],
            ...data,
            updatedAt: Date.now(),
          };
          return mockTickets[ticketIndex];
        }
        throw new Error('Ticket not found');
      }
      throw error;
    }
  },

  async addMessage(ticketId: string, data: { content: string; isInternal?: boolean }): Promise<SupportTicketMessage> {
    try {
      return await apiClient.post<SupportTicketMessage>(`/support/tickets/${ticketId}/messages`, data);
    } catch (error) {
      if (shouldUseMockData()) {
        const message: SupportTicketMessage = {
          id: `msg-${Date.now()}`,
          ticketId,
          authorId: 'current-user',
          content: data.content,
          isInternal: data.isInternal || false,
          createdAt: Date.now(),
        };
        if (!mockMessages[ticketId]) {
          mockMessages[ticketId] = [];
        }
        mockMessages[ticketId].push(message);
        return message;
      }
      throw error;
    }
  },

  async getTicketStats(): Promise<SupportTicketStats> {
    try {
      return await apiClient.get<SupportTicketStats>('/support/tickets/stats');
    } catch (error) {
      if (shouldUseMockData()) {
        const stats: SupportTicketStats = {
          total: mockTickets.length,
          open: mockTickets.filter(t => t.status === 'open').length,
          inProgress: mockTickets.filter(t => t.status === 'in_progress').length,
          resolved: mockTickets.filter(t => t.status === 'resolved').length,
          closed: mockTickets.filter(t => t.status === 'closed').length,
          byPriority: {
            low: mockTickets.filter(t => t.priority === 'low').length,
            medium: mockTickets.filter(t => t.priority === 'medium').length,
            high: mockTickets.filter(t => t.priority === 'high').length,
            urgent: mockTickets.filter(t => t.priority === 'urgent').length,
          },
          averageResponseTime: 3600000, // 1 hour mock
        };
        return stats;
      }
      throw error;
    }
  },

  // FAQ
  async getFAQs(options?: {
    category?: 'general' | 'editor' | 'marketplace' | 'account' | 'technical';
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<SupportFAQ[]> {
    try {
      const params = new URLSearchParams();
      if (options?.category) params.append('category', options.category);
      if (options?.search) params.append('search', options.search);
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));
      const query = params.toString();
      return await apiClient.get<SupportFAQ[]>(`/support/faq${query ? `?${query}` : ''}`);
    } catch (error) {
      if (shouldUseMockData()) {
        let faqs = MOCK_FAQS.filter(f => f.isPublished);
        if (options?.category) {
          faqs = faqs.filter(f => f.category === options.category);
        }
        if (options?.search) {
          const searchLower = options.search.toLowerCase();
          faqs = faqs.filter(f => 
            f.question.toLowerCase().includes(searchLower) ||
            f.answer.toLowerCase().includes(searchLower) ||
            f.tags.some(t => t.toLowerCase().includes(searchLower))
          );
        }
        faqs.sort((a, b) => a.order - b.order);
        const offset = options?.offset || 0;
        const limit = options?.limit || faqs.length;
        return faqs.slice(offset, offset + limit);
      }
      throw error;
    }
  },

  async getFAQ(id: string): Promise<SupportFAQ> {
    try {
      return await apiClient.get<SupportFAQ>(`/support/faq/${id}`);
    } catch (error) {
      if (shouldUseMockData()) {
        const faq = MOCK_FAQS.find(f => f.id === id);
        if (faq) {
          // Increment view count
          faq.viewCount++;
          return faq;
        }
        throw new Error('FAQ not found');
      }
      throw error;
    }
  },

  async markFAQHelpful(id: string): Promise<{ success: boolean }> {
    try {
      return await apiClient.post<{ success: boolean }>(`/support/faq/${id}/helpful`);
    } catch (error) {
      if (shouldUseMockData()) {
        const faq = MOCK_FAQS.find(f => f.id === id);
        if (faq) {
          faq.helpfulCount++;
          return { success: true };
        }
        throw new Error('FAQ not found');
      }
      throw error;
    }
  },

  async searchFAQ(query: string): Promise<SupportFAQ[]> {
    try {
      return await apiClient.get<SupportFAQ[]>(`/support/faq/search?q=${encodeURIComponent(query)}`);
    } catch (error) {
      if (shouldUseMockData()) {
        const searchLower = query.toLowerCase();
        return MOCK_FAQS.filter(f => 
          f.isPublished && (
            f.question.toLowerCase().includes(searchLower) ||
            f.answer.toLowerCase().includes(searchLower) ||
            f.tags.some(t => t.toLowerCase().includes(searchLower))
          )
        ).sort((a, b) => a.order - b.order);
      }
      throw error;
    }
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


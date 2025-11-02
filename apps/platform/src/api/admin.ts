/**
 * Admin API calls
 */

import { apiClient } from './client';
import type { ForumCategory, ForumThread, ForumPost } from './forum';

export interface AdminUser {
  id: string;
  email: string;
  createdAt: number;
  updatedAt: number;
  active: boolean;
  role: 'user' | 'moderator' | 'admin';
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminStats {
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: {
      user: number;
      moderator: number;
      admin: number;
    };
  };
  marketplace: {
    total: number;
    builds: number;
    avatars: number;
    public: number;
    totalLikes: number;
    totalDownloads: number;
  };
  projects: {
    total: number;
  };
  forum?: {
    categories: {
      total: number;
    };
    threads: {
      total: number;
      last24h: number;
      last7d: number;
      last30d: number;
    };
    posts: {
      total: number;
      last24h: number;
      last7d: number;
      last30d: number;
    };
    topCategories: Array<{
      id: string;
      name: string;
      threadCount: number;
      postCount: number;
    }>;
  };
  activity: {
    onlineUsers: number;
  };
}

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
  price?: { currency: string; amount: number }; // Optional price for paid items
}

export interface MarketplaceItemsResponse {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SharedProject {
  token: string;
  createdAt: number;
  expiresAt?: number;
  projectId: string;
  projectName: string;
}

export interface ProjectsResponse {
  projects: SharedProject[];
  total: number;
}

export const adminApi = {
  /**
   * Get all users (paginated)
   */
  async getUsers(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    role?: string;
    active?: boolean;
  }): Promise<AdminUsersResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.search) query.set('search', params.search);
    if (params?.role) query.set('role', params.role);
    if (params?.active !== undefined) query.set('active', params.active.toString());

    return apiClient.get<AdminUsersResponse>(`/admin/users?${query.toString()}`);
  },

  /**
   * Get user details
   */
  async getUser(id: string): Promise<AdminUser & { profile?: unknown }> {
    return apiClient.get(`/admin/users/${id}`);
  },

  /**
   * Update user
   */
  async updateUser(id: string, updates: { active?: boolean; role?: string }): Promise<AdminUser> {
    return apiClient.put(`/admin/users/${id}`, updates);
  },

  /**
   * Get system statistics
   */
  async getStats(): Promise<AdminStats> {
    return apiClient.get('/admin/stats');
  },

  /**
   * Get all marketplace items
   */
  async getMarketplaceItems(params?: {
    limit?: number;
    offset?: number;
    type?: 'build' | 'avatar';
  }): Promise<MarketplaceItemsResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.type) query.set('type', params.type);

    return apiClient.get<MarketplaceItemsResponse>(`/admin/marketplace?${query.toString()}`);
  },

  /**
   * Force delete marketplace item
   */
  async deleteMarketplaceItem(id: string): Promise<void> {
    return apiClient.delete(`/admin/marketplace/${id}`);
  },

  /**
   * Get all shared projects
   */
  async getProjects(): Promise<ProjectsResponse> {
    return apiClient.get('/admin/projects');
  },

  /**
   * Delete shared project
   */
  async deleteProject(token: string): Promise<void> {
    return apiClient.delete(`/admin/projects/${token}`);
  },

  /**
   * Get shop statistics
   */
  async getShopStats(): Promise<{
    shopItems: {
      total: number;
      available: number;
      outOfStock: number;
    };
    assets: {
      total: number;
      available: number;
    };
    purchases: {
      total: number;
      last30Days: number;
    };
    revenue: Array<{
      currency: string;
      amount: number;
    }>;
  }> {
    return apiClient.get('/admin/shop/stats');
  },

  /**
   * Get forum statistics
   */
  async getForumStats(): Promise<{
    categories: {
      total: number;
    };
    threads: {
      total: number;
      last24h: number;
      last7d: number;
      last30d: number;
    };
    posts: {
      total: number;
      last24h: number;
      last7d: number;
      last30d: number;
    };
    topCategories: Array<{
      id: string;
      name: string;
      threadCount: number;
      postCount: number;
    }>;
  }> {
    return apiClient.get('/admin/forum/stats');
  },

  /**
   * Get economy metrics
   */
  async getEconomyMetrics(): Promise<{
    totalWallets: number;
    totalTransactions: number;
    totalsByCurrency: Record<string, number>;
  }> {
    return apiClient.get('/economy/metrics');
  },

  /**
   * Get all forum categories
   */
  async getForumCategories(): Promise<ForumCategory[]> {
    return apiClient.get('/admin/forum/categories');
  },

  /**
   * Update forum category
   */
  async updateForumCategory(id: string, updates: Partial<ForumCategory>): Promise<ForumCategory> {
    return apiClient.put(`/admin/forum/categories/${id}`, updates);
  },

  /**
   * Delete forum category
   */
  async deleteForumCategory(id: string): Promise<void> {
    return apiClient.delete(`/admin/forum/categories/${id}`);
  },

  /**
   * Get all forum threads (with pagination)
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

    return apiClient.get(`/admin/forum/threads?${query.toString()}`);
  },

  /**
   * Force delete forum thread
   */
  async deleteForumThread(id: string): Promise<void> {
    return apiClient.delete(`/admin/forum/threads/${id}`);
  },

  /**
   * Get all forum posts (with pagination)
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

    return apiClient.get(`/admin/forum/posts?${query.toString()}`);
  },

  /**
   * Force delete forum post
   */
  async deleteForumPost(id: string): Promise<void> {
    return apiClient.delete(`/admin/forum/posts/${id}`);
  },
};


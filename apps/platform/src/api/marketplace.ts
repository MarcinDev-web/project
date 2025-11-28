/**
 * Marketplace API calls
 */

import { apiClient } from './client';

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
  playersOnline?: number; // Current active players in the game
  liked?: boolean; // Whether current user liked this item
  forumThreadId?: string; // Links to associated forum thread
}

export interface MarketplaceResponse {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateMarketplaceItemRequest {
  type: 'build' | 'avatar';
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl: string;
  tags?: string[];
  price?: { currency: string; amount: number }; // Optional price for paid items
}

export const marketplaceApi = {
  async getBuilds(options?: {
    tags?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'popular' | 'downloads' | 'likes';
  }): Promise<MarketplaceResponse> {
    const params = new URLSearchParams();
    if (options?.tags && options.tags.length > 0) {
      params.append('tags', options.tags.join(','));
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }
    if (options?.sortBy) {
      params.append('sortBy', options.sortBy);
    }

    const query = params.toString();
    return apiClient.get<MarketplaceResponse>(`/marketplace/builds${query ? `?${query}` : ''}`);
  },

  async getAvatars(options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'popular' | 'downloads' | 'likes';
  }): Promise<MarketplaceResponse> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }
    if (options?.sortBy) {
      params.append('sortBy', options.sortBy);
    }

    const query = params.toString();
    return apiClient.get<MarketplaceResponse>(`/marketplace/avatars${query ? `?${query}` : ''}`);
  },

  async getItem(id: string): Promise<MarketplaceItem> {
    return apiClient.get<MarketplaceItem>(`/marketplace/${id}`);
  },

  async publishItem(data: CreateMarketplaceItemRequest): Promise<MarketplaceItem> {
    return apiClient.post<MarketplaceItem>('/marketplace', data);
  },

  async deleteItem(id: string): Promise<void> {
    return apiClient.delete(`/marketplace/${id}`);
  },

  /**
   * Get number of active players in a game
   */
  async getPlayersOnline(id: string): Promise<number> {
    const response = await apiClient.get<{ gameId: string; playersOnline: number }>(`/marketplace/${id}/players-online`);
    return response.playersOnline;
  },

  /**
   * Join a game (track player as online)
   */
  async joinGame(id: string): Promise<{ success: boolean; playersOnline: number }> {
    return apiClient.post(`/marketplace/${id}/join`);
  },

  /**
   * Leave a game (remove player from online count)
   */
  async leaveGame(id: string): Promise<{ success: boolean; playersOnline: number }> {
    return apiClient.post(`/marketplace/${id}/leave`);
  },

  /**
   * Search marketplace items
   */
  async search(
    query: string,
    options?: {
      type?: 'build' | 'avatar';
      tags?: string[];
      limit?: number;
      offset?: number;
      sortBy?: 'newest' | 'popular' | 'downloads' | 'likes';
    }
  ): Promise<MarketplaceResponse & { query: string }> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options?.type) {
      params.append('type', options.type);
    }
    if (options?.tags && options.tags.length > 0) {
      params.append('tags', options.tags.join(','));
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }
    if (options?.sortBy) {
      params.append('sortBy', options.sortBy);
    }

    return apiClient.get<MarketplaceResponse & { query: string }>(`/marketplace/search?${params.toString()}`);
  },

  /**
   * Like or unlike an item (toggle)
   */
  async likeItem(id: string): Promise<{ liked: boolean; likes: number }> {
    return apiClient.post<{ liked: boolean; likes: number }>(`/marketplace/${id}/like`);
  },

  /**
   * Get like count and status for an item
   */
  async getItemLikes(id: string): Promise<{ likes: number; liked?: boolean }> {
    return apiClient.get<{ likes: number; liked?: boolean }>(`/marketplace/${id}/likes`);
  },

  /**
   * Get paid marketplace items
   */
  async getPaidItems(options?: {
    type?: 'build' | 'avatar';
    limit?: number;
    offset?: number;
  }): Promise<MarketplaceResponse> {
    const params = new URLSearchParams();
    if (options?.type) {
      params.append('type', options.type);
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }

    const query = params.toString();
    return apiClient.get<MarketplaceResponse>(`/marketplace/paid${query ? `?${query}` : ''}`);
  },

  /**
   * Set or update price for marketplace item
   */
  async setPrice(id: string, price?: { currency: string; amount: number } | null): Promise<MarketplaceItem> {
    return apiClient.put<MarketplaceItem>(`/marketplace/${id}/price`, { price });
  },

  /**
   * Download free marketplace item
   * Returns file URL for download
   */
  async downloadFreeItem(id: string): Promise<{ fileUrl: string; itemId: string; title: string }> {
    return apiClient.get<{ fileUrl: string; itemId: string; title: string }>(`/marketplace/${id}/download`);
  },

  /**
   * Purchase a paid marketplace item
   */
  async purchaseItem(id: string): Promise<{
    success: boolean;
    itemId: string;
    title: string;
    fileUrl: string;
    newBalance?: number;
  }> {
    return apiClient.post<{
      success: boolean;
      itemId: string;
      title: string;
      fileUrl: string;
      newBalance?: number;
    }>(`/marketplace/${id}/purchase`);
  },
};


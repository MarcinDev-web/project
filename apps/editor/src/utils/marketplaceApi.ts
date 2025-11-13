/**
 * Marketplace API Client for Editor
 * 
 * Provides access to marketplace API endpoints for browsing and purchasing
 * builds and assets from within the editor.
 */

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
  price?: { currency: string; amount: number };
  playersOnline?: number;
  liked?: boolean;
  forumThreadId?: string;
}

export interface MarketplaceResponse {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MarketplaceFilterOptions {
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'newest' | 'popular' | 'downloads' | 'likes';
}

export interface MarketplaceApiClientOptions {
  baseUrl?: string; // e.g. '/api'
  getAuthToken?: () => string | null;
}

export class MarketplaceApiClient {
  private readonly baseUrl: string;
  private readonly getAuthToken: (() => string | null) | undefined;

  constructor(options: MarketplaceApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '/api';
    this.getAuthToken = options.getAuthToken;
  }

  private headers(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = this.getAuthToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  /**
   * Get builds from marketplace
   */
  async getBuilds(options?: MarketplaceFilterOptions): Promise<MarketplaceResponse> {
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
    const res = await fetch(`${this.baseUrl}/marketplace/builds${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Get builds failed: ${res.status}`);
    return (await res.json()) as MarketplaceResponse;
  }

  /**
   * Get avatars from marketplace
   */
  async getAvatars(options?: MarketplaceFilterOptions): Promise<MarketplaceResponse> {
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
    const res = await fetch(`${this.baseUrl}/marketplace/avatars${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Get avatars failed: ${res.status}`);
    return (await res.json()) as MarketplaceResponse;
  }

  /**
   * Get a specific marketplace item by ID
   */
  async getItem(id: string): Promise<MarketplaceItem> {
    const res = await fetch(`${this.baseUrl}/marketplace/${id}`, {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Get item failed: ${res.status}`);
    return (await res.json()) as MarketplaceItem;
  }

  /**
   * Download a free marketplace item
   * Returns file URL for download
   */
  async downloadFreeItem(id: string): Promise<{ fileUrl: string; itemId: string; title: string }> {
    const res = await fetch(`${this.baseUrl}/marketplace/${id}/download`, {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Download free item failed: ${res.status}`);
    return (await res.json()) as { fileUrl: string; itemId: string; title: string };
  }

  /**
   * Purchase a paid marketplace item
   * Returns success status and file URL
   */
  async purchaseItem(id: string): Promise<{ success: boolean; fileUrl: string; itemId: string; title: string }> {
    const res = await fetch(`${this.baseUrl}/marketplace/${id}/purchase`, {
      method: 'POST',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Purchase item failed: ${res.status} - ${errorText}`);
    }
    return (await res.json()) as { success: boolean; fileUrl: string; itemId: string; title: string };
  }

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

    const res = await fetch(`${this.baseUrl}/marketplace/search?${params.toString()}`, {
      method: 'GET',
      headers: this.headers(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return (await res.json()) as MarketplaceResponse & { query: string };
  }
}


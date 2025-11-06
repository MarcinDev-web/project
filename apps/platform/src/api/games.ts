import { apiClient } from './client';

export type GamesSortOption = 'newest' | 'popular' | 'trending' | 'updated';

export interface GameSummary {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  authorId: string;
  authorName?: string;
  thumbnailUrl?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  downloads: number;
  likes: number;
  playersOnline: number;
}

export interface GamesResponse {
  items: GameSummary[];
  total: number;
  limit: number;
  offset: number;
}

export const gamesApi = {
  async list(options?: {
    limit?: number;
    offset?: number;
    sortBy?: GamesSortOption;
    search?: string;
    tags?: string[];
  }): Promise<GamesResponse> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.set('limit', String(options.limit));
    }
    if (options?.offset) {
      params.set('offset', String(options.offset));
    }
    if (options?.sortBy) {
      params.set('sortBy', options.sortBy);
    }
    if (options?.search && options.search.trim()) {
      params.set('search', options.search.trim());
    }
    if (options?.tags && options.tags.length > 0) {
      params.set('tags', options.tags.join(','));
    }

    const query = params.toString();
    return apiClient.get<GamesResponse>(`/games${query ? `?${query}` : ''}`);
  },
};

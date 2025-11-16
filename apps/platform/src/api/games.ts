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

export interface DiscoverCategorySection {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  tags: string[];
  games: GameSummary[];
}

export interface DiscoverFreshGame extends GameSummary {
  freshnessScore: number;
  publishedHoursAgo: number;
}

export interface DiscoverCuratedPick {
  id: string;
  title: string;
  description: string;
  tags: string[];
  game: GameSummary | null;
  reason: string;
}

export interface FairnessSlot {
  slot: number;
  game: GameSummary;
  boostMultiplier: number;
  score: number;
  exposureDebt: number;
  expectedExposure: number;
  actualExposure: number;
  reason: string;
}

export interface GamesDiscoverResponse {
  generatedAt: number;
  totalGames: number;
  featured: GameSummary[];
  categories: DiscoverCategorySection[];
  fresh: {
    windowDays: number;
    games: DiscoverFreshGame[];
  };
  curated: DiscoverCuratedPick[];
  fairness: {
    strategy: string;
    slots: FairnessSlot[];
  };
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

  async discover(): Promise<GamesDiscoverResponse> {
    return apiClient.get<GamesDiscoverResponse>('/games/discover');
  },
};

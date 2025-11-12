/**
 * Public News API calls
 */

import { apiClient } from './client';

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  authorId: string;
  authorName?: string;
  published: boolean;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  imageUrl?: string;
}

export interface NewsResponse {
  news: NewsItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const newsApi = {
  /**
   * Get published news items (public)
   */
  async getNews(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<NewsResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.search) query.set('search', params.search);

    return apiClient.get<NewsResponse>(`/news?${query.toString()}`);
  },

  /**
   * Get single news item (public)
   */
  async getNewsItem(id: string): Promise<NewsItem> {
    return apiClient.get<NewsItem>(`/news/${id}`);
  },
};


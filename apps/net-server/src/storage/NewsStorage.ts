/**
 * News Storage - manages news articles
 */

import { promises as fs } from 'fs';
import path from 'path';

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

export class NewsStorage {
  private readonly dataDir: string;
  private readonly newsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.newsFile = path.join(dataDir, 'news.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      await fs.access(this.newsFile);
    } catch {
      await fs.writeFile(this.newsFile, JSON.stringify([], null, 2));
    }
  }

  private async readNews(): Promise<NewsItem[]> {
    try {
      const data = await fs.readFile(this.newsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeNews(news: NewsItem[]): Promise<void> {
    await fs.writeFile(this.newsFile, JSON.stringify(news, null, 2));
  }

  /**
   * Get all news items (optionally filtered by published status)
   */
  async getNews(params?: {
    limit?: number;
    offset?: number;
    published?: boolean;
    authorId?: string;
    search?: string;
  }): Promise<{ news: NewsItem[]; total: number }> {
    let news = await this.readNews();

    // Filter by published status
    if (params?.published !== undefined) {
      news = news.filter((item) => item.published === params.published);
    }

    // Filter by author
    if (params?.authorId) {
      news = news.filter((item) => item.authorId === params.authorId);
    }

    // Search in title and content
    if (params?.search) {
      const searchLower = params.search.toLowerCase();
      news = news.filter(
        (item) =>
          item.title.toLowerCase().includes(searchLower) ||
          item.content.toLowerCase().includes(searchLower) ||
          item.excerpt?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by date (newest first)
    news.sort((a, b) => {
      const dateA = a.publishedAt ?? a.createdAt;
      const dateB = b.publishedAt ?? b.createdAt;
      return dateB - dateA;
    });

    const total = news.length;

    // Pagination
    if (params?.offset !== undefined || params?.limit !== undefined) {
      const offset = params.offset ?? 0;
      const limit = params.limit ?? news.length;
      news = news.slice(offset, offset + limit);
    }

    return { news, total };
  }

  /**
   * Get a single news item by ID
   */
  async getNewsItem(id: string): Promise<NewsItem | null> {
    const news = await this.readNews();
    return news.find((item) => item.id === id) ?? null;
  }

  /**
   * Create a new news item
   */
  async createNewsItem(
    newsItem: Omit<NewsItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<NewsItem> {
    const news = await this.readNews();
    const now = Date.now();

    const newItem: NewsItem = {
      ...newsItem,
      id: `news_${now}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      publishedAt: newsItem.published ? now : undefined,
    };

    news.push(newItem);
    await this.writeNews(news);
    return newItem;
  }

  /**
   * Update a news item
   */
  async updateNewsItem(id: string, updates: Partial<NewsItem>): Promise<NewsItem | null> {
    const news = await this.readNews();
    const item = news.find((n) => n.id === id);

    if (!item) {
      return null;
    }

    // If publishing for the first time, set publishedAt
    if (updates.published === true && !item.published && !item.publishedAt) {
      updates.publishedAt = Date.now();
    }

    // Remove publishedAt if unpublishing
    if (updates.published === false && item.published) {
      updates.publishedAt = undefined;
    }

    Object.assign(item, updates, { updatedAt: Date.now() });
    await this.writeNews(news);
    return item;
  }

  /**
   * Delete a news item
   */
  async deleteNewsItem(id: string): Promise<boolean> {
    const news = await this.readNews();
    const index = news.findIndex((n) => n.id === id);

    if (index === -1) {
      return false;
    }

    news.splice(index, 1);
    await this.writeNews(news);
    return true;
  }

  /**
   * Get news statistics
   */
  async getNewsStats(): Promise<{
    total: number;
    published: number;
    draft: number;
    last30Days: number;
  }> {
    const news = await this.readNews();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    return {
      total: news.length,
      published: news.filter((n) => n.published).length,
      draft: news.filter((n) => !n.published).length,
      last30Days: news.filter(
        (n) => (n.publishedAt ?? n.createdAt) >= thirtyDaysAgo
      ).length,
    };
  }
}


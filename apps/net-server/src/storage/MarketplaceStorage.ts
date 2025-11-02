/**
 * Marketplace Storage - manages published builds and avatars
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { CurrencyAmount } from '@engine/economy';

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
  price?: CurrencyAmount; // Optional price for paid items
  forumThreadId?: string; // Links to associated forum thread
}

export class MarketplaceStorage {
  private readonly dataDir: string;
  private readonly itemsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.itemsFile = path.join(dataDir, 'marketplace.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    try {
      await fs.access(this.itemsFile);
    } catch {
      await fs.writeFile(this.itemsFile, JSON.stringify({}, null, 2));
    }
  }

  private async readItems(): Promise<Record<string, MarketplaceItem>> {
    try {
      const data = await fs.readFile(this.itemsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeItems(items: Record<string, MarketplaceItem>): Promise<void> {
    await fs.writeFile(this.itemsFile, JSON.stringify(items, null, 2));
  }

  async createItem(item: Omit<MarketplaceItem, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'likes'>): Promise<MarketplaceItem> {
    const items = await this.readItems();
    
    const id = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newItem: MarketplaceItem = {
      ...item,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      downloads: 0,
      likes: 0,
    };

    items[id] = newItem;
    await this.writeItems(items);
    
    return newItem;
  }

  async getItem(id: string): Promise<MarketplaceItem | null> {
    const items = await this.readItems();
    return items[id] ?? null;
  }

  async getItems(options: {
    type?: 'build' | 'avatar';
    authorId?: string;
    tags?: string[];
    public?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: 'newest' | 'popular' | 'downloads' | 'likes';
  } = {}): Promise<MarketplaceItem[]> {
    const items = await this.readItems();
    let filtered = Object.values(items);

    if (options.type) {
      filtered = filtered.filter(item => item.type === options.type);
    }

    if (options.authorId) {
      filtered = filtered.filter(item => item.authorId === options.authorId);
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(item =>
        options.tags!.some(tag => item.tags.includes(tag))
      );
    }

    if (options.public !== undefined) {
      filtered = filtered.filter(item => item.public === options.public);
    }

    // Client-side search (case-insensitive)
    if (options.search && options.search.trim()) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(item => {
        const titleMatch = item.title.toLowerCase().includes(searchLower);
        const descMatch = item.description?.toLowerCase().includes(searchLower) ?? false;
        const tagsMatch = item.tags.some(tag => tag.toLowerCase().includes(searchLower));
        return titleMatch || descMatch || tagsMatch;
      });
    }

    // Sort based on sortBy option
    const sortBy = options.sortBy || 'newest';
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'popular':
        filtered.sort((a, b) => {
          const scoreA = a.downloads * 2 + a.likes;
          const scoreB = b.downloads * 2 + b.likes;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return b.createdAt - a.createdAt;
        });
        break;
      case 'downloads':
        filtered.sort((a, b) => {
          if (a.downloads !== b.downloads) return b.downloads - a.downloads;
          return b.createdAt - a.createdAt;
        });
        break;
      case 'likes':
        filtered.sort((a, b) => {
          if (a.likes !== b.likes) return b.likes - a.likes;
          return b.createdAt - a.createdAt;
        });
        break;
    }

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;

    return filtered.slice(offset, offset + limit);
  }

  async updateItem(id: string, updates: Partial<Omit<MarketplaceItem, 'id' | 'createdAt' | 'authorId'>>): Promise<MarketplaceItem | null> {
    const items = await this.readItems();
    const item = items[id];
    
    if (!item) {
      return null;
    }

    const updated: MarketplaceItem = {
      ...item,
      ...updates,
      updatedAt: Date.now(),
    };

    items[id] = updated;
    await this.writeItems(items);
    
    return updated;
  }

  async deleteItem(id: string, authorId: string): Promise<boolean> {
    const items = await this.readItems();
    const item = items[id];
    
    if (!item || item.authorId !== authorId) {
      return false;
    }

    delete items[id];
    await this.writeItems(items);
    
    return true;
  }

  async incrementDownloads(id: string): Promise<void> {
    const items = await this.readItems();
    const item = items[id];
    
    if (item) {
      item.downloads++;
      await this.writeItems(items);
    }
  }
}


/**
 * Shop Storage - manages virtual shop items
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { CurrencyAmount } from '@engine/economy';

export interface ShopItem {
  id: string;
  name: string;
  description?: string;
  category: 'consumable' | 'cosmetic' | 'upgrade' | 'collectible';
  price: CurrencyAmount;
  imageUrl?: string;
  available: boolean;
  stock?: number; // null = unlimited
  createdAt: number;
  updatedAt: number;
}

export interface ShopItemsFilter {
  category?: ShopItem['category'];
  currency?: string;
  available?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}

export class ShopStorage {
  private readonly dataDir: string;
  private readonly itemsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.itemsFile = path.join(dataDir, 'shop.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    try {
      await fs.access(this.itemsFile);
    } catch {
      await fs.writeFile(this.itemsFile, JSON.stringify({}, null, 2));
    }
  }

  private async readItems(): Promise<Record<string, ShopItem>> {
    try {
      const data = await fs.readFile(this.itemsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeItems(items: Record<string, ShopItem>): Promise<void> {
    await fs.writeFile(this.itemsFile, JSON.stringify(items, null, 2));
  }

  async createItem(item: Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShopItem> {
    const items = await this.readItems();
    
    const id = `shop_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    const newItem: ShopItem = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };

    items[id] = newItem;
    await this.writeItems(items);
    
    return newItem;
  }

  async getItem(id: string): Promise<ShopItem | null> {
    const items = await this.readItems();
    return items[id] ?? null;
  }

  async getItems(filter: ShopItemsFilter = {}): Promise<ShopItem[]> {
    const items = await this.readItems();
    let filtered = Object.values(items);

    if (filter.category) {
      filtered = filtered.filter(item => item.category === filter.category);
    }

    if (filter.currency) {
      filtered = filtered.filter(item => item.price.currency === filter.currency);
    }

    if (filter.available !== undefined) {
      filtered = filtered.filter(item => item.available === filter.available);
    } else {
      // By default, only show available items
      filtered = filtered.filter(item => item.available);
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by createdAt (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;

    return filtered.slice(offset, offset + limit);
  }

  async updateItem(id: string, updates: Partial<Omit<ShopItem, 'id' | 'createdAt'>>): Promise<ShopItem | null> {
    const items = await this.readItems();
    const item = items[id];

    if (!item) {
      return null;
    }

    const updatedItem: ShopItem = {
      ...item,
      ...updates,
      updatedAt: Date.now(),
    };

    items[id] = updatedItem;
    await this.writeItems(items);
    
    return updatedItem;
  }

  async deleteItem(id: string): Promise<boolean> {
    const items = await this.readItems();
    
    if (!items[id]) {
      return false;
    }

    delete items[id];
    await this.writeItems(items);
    
    return true;
  }

  async getItemsCount(filter: ShopItemsFilter = {}): Promise<number> {
    const countFilter: ShopItemsFilter = { ...filter };
    // Remove limit and offset for count query
    delete countFilter.limit;
    delete countFilter.offset;
    const items = await this.getItems(countFilter);
    return items.length;
  }
}


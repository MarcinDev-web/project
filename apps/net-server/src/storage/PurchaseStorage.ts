/**
 * Purchase Storage - manages purchase history and ownership
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { CurrencyAmount } from '@engine/economy';

export type PurchaseItemType = 'shop-item' | 'asset' | 'marketplace-item';
export type PurchaseStatus = 'pending' | 'completed' | 'failed';

export interface PurchaseItem {
  itemId: string;
  type: PurchaseItemType;
  name: string;
  price: CurrencyAmount;
}

export interface Purchase {
  id: string;
  userId: string;
  items: PurchaseItem[];
  totalCost: CurrencyAmount;
  status: PurchaseStatus;
  createdAt: number;
}

export interface PurchaseFilter {
  userId?: string;
  status?: PurchaseStatus;
  limit?: number;
  offset?: number;
}

export class PurchaseStorage {
  private readonly dataDir: string;
  private readonly purchasesFile: string;
  private readonly ownedItemsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.purchasesFile = path.join(dataDir, 'purchases.json');
    this.ownedItemsFile = path.join(dataDir, 'owned-items.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    try {
      await fs.access(this.purchasesFile);
    } catch {
      await fs.writeFile(this.purchasesFile, JSON.stringify({}, null, 2));
    }

    try {
      await fs.access(this.ownedItemsFile);
    } catch {
      await fs.writeFile(this.ownedItemsFile, JSON.stringify({}, null, 2));
    }
  }

  private async readPurchases(): Promise<Record<string, Purchase>> {
    try {
      const data = await fs.readFile(this.purchasesFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writePurchases(purchases: Record<string, Purchase>): Promise<void> {
    await fs.writeFile(this.purchasesFile, JSON.stringify(purchases, null, 2));
  }

  private async readOwnedItems(): Promise<Record<string, Record<string, { itemType: PurchaseItemType; purchasedAt: number }>>> {
    try {
      const data = await fs.readFile(this.ownedItemsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeOwnedItems(owned: Record<string, Record<string, { itemType: PurchaseItemType; purchasedAt: number }>>): Promise<void> {
    await fs.writeFile(this.ownedItemsFile, JSON.stringify(owned, null, 2));
  }

  async createPurchase(purchase: Omit<Purchase, 'id' | 'createdAt'>): Promise<Purchase> {
    const purchases = await this.readPurchases();
    const ownedItems = await this.readOwnedItems();
    
    const id = `purchase_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    const newPurchase: Purchase = {
      ...purchase,
      id,
      createdAt: now,
    };

    purchases[id] = newPurchase;

    // Update owned items
    if (!ownedItems[purchase.userId]) {
      ownedItems[purchase.userId] = {};
    }

    for (const item of purchase.items) {
      const key = `${item.itemId}:${item.type}`;
      ownedItems[purchase.userId]![key] = {
        itemType: item.type,
        purchasedAt: now,
      };
    }

    await this.writePurchases(purchases);
    await this.writeOwnedItems(ownedItems);
    
    return newPurchase;
  }

  async getPurchase(id: string): Promise<Purchase | null> {
    const purchases = await this.readPurchases();
    return purchases[id] ?? null;
  }

  async getPurchases(filter: PurchaseFilter = {}): Promise<Purchase[]> {
    const purchases = await this.readPurchases();
    let filtered = Object.values(purchases);

    if (filter.userId) {
      filtered = filtered.filter(p => p.userId === filter.userId);
    }

    if (filter.status) {
      filtered = filtered.filter(p => p.status === filter.status);
    }

    // Sort by createdAt (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;

    return filtered.slice(offset, offset + limit);
  }

  async updatePurchaseStatus(id: string, status: PurchaseStatus): Promise<Purchase | null> {
    const purchases = await this.readPurchases();
    const purchase = purchases[id];

    if (!purchase) {
      return null;
    }

    purchase.status = status;
    purchases[id] = purchase;
    await this.writePurchases(purchases);
    
    return purchase;
  }

  async isOwned(userId: string, itemId: string, itemType: PurchaseItemType): Promise<boolean> {
    const ownedItems = await this.readOwnedItems();
    const userOwned = ownedItems[userId];
    if (!userOwned) {
      return false;
    }

    const key = `${itemId}:${itemType}`;
    return key in userOwned;
  }

  async getOwnedItems(userId: string): Promise<Array<{ itemId: string; itemType: PurchaseItemType; purchasedAt: number }>> {
    const ownedItems = await this.readOwnedItems();
    const userOwned = ownedItems[userId];
    if (!userOwned) {
      return [];
    }

    return Object.entries(userOwned).map(([key, value]) => {
      const [itemId, itemType] = key.split(':');
      if (!itemId || !itemType) {
        throw new Error(`Invalid owned item key: ${key}`);
      }
      return {
        itemId,
        itemType: itemType as PurchaseItemType,
        purchasedAt: value.purchasedAt,
      };
    }).filter((item): item is { itemId: string; itemType: PurchaseItemType; purchasedAt: number } => item.itemId !== undefined);
  }

  /**
   * Transfer ownership of an item from one user to another (secondary sale).
   * Returns true if transfer completed, false if source did not own the item.
   */
  async transferOwnership(
    itemId: string,
    itemType: PurchaseItemType,
    fromUserId: string,
    toUserId: string
  ): Promise<boolean> {
    const ownedItems = await this.readOwnedItems();
    const fromOwned = ownedItems[fromUserId] ?? {};
    const key = `${itemId}:${itemType}`;
    if (!(key in fromOwned)) {
      return false;
    }

    // Remove from seller
    delete fromOwned[key];
    ownedItems[fromUserId] = fromOwned;

    // Add to buyer
    if (!ownedItems[toUserId]) ownedItems[toUserId] = {};
    ownedItems[toUserId]![key] = {
      itemType,
      purchasedAt: Date.now(),
    };

    await this.writeOwnedItems(ownedItems);
    return true;
  }
}


/**
 * Shop Storage DB - PostgreSQL implementation using Prisma
 */

import type { PrismaClient as PrismaClientType } from '../../node_modules/.prisma/net-client/index.js';
import { Prisma } from '../../node_modules/.prisma/net-client/index.js';
import type { ShopItem, ShopItemsFilter } from './ShopStorage.js';

export class ShopStorageDB {
  constructor(private readonly prisma: PrismaClientType) {}

  async initialize(): Promise<void> {
    // Schema is managed by Prisma migrations
    // No additional initialization needed
  }

  async createItem(item: Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShopItem> {
    const id = `shop_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const created = await this.prisma.shopItem.create({
      data: {
        id,
        name: item.name,
        description: item.description ?? null,
        category: item.category,
        priceCurrency: item.price.currency,
        priceAmount: item.price.amount,
        imageUrl: item.imageUrl ?? null,
        available: item.available,
        stock: item.stock ?? null,
      },
    });

    return this.mapPrismaToItem(created);
  }

  async getItem(id: string): Promise<ShopItem | null> {
    const item = await this.prisma.shopItem.findUnique({
      where: { id },
    });

    if (!item) {
      return null;
    }

    return this.mapPrismaToItem(item);
  }

  async getItems(filter: ShopItemsFilter = {}): Promise<ShopItem[]> {
    const where: Prisma.ShopItemWhereInput = {};

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.currency) {
      where.priceCurrency = filter.currency;
    }

    if (filter.available !== undefined) {
      where.available = filter.available;
    } else {
      // By default, only show available items
      where.available = true;
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const items = await this.prisma.shopItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return items.map((item: Parameters<typeof this.mapPrismaToItem>[0]) =>
      this.mapPrismaToItem(item)
    );
  }

  async updateItem(
    id: string,
    updates: Partial<Omit<ShopItem, 'id' | 'createdAt'>>
  ): Promise<ShopItem | null> {
    const updateData: Prisma.ShopItemUpdateInput = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description ?? null;
    }

    if (updates.category !== undefined) {
      updateData.category = updates.category;
    }

    if (updates.price !== undefined) {
      updateData.priceCurrency = updates.price.currency;
      updateData.priceAmount = updates.price.amount;
    }

    if (updates.imageUrl !== undefined) {
      updateData.imageUrl = updates.imageUrl ?? null;
    }

    if (updates.available !== undefined) {
      updateData.available = updates.available;
    }

    if (updates.stock !== undefined) {
      updateData.stock = updates.stock ?? null;
    }

    // updatedAt is handled automatically by Prisma @updatedAt

    if (Object.keys(updateData).length === 0) {
      return this.getItem(id);
    }

    try {
      const updated = await this.prisma.shopItem.update({
        where: { id },
        data: updateData,
      });

      return this.mapPrismaToItem(updated);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          return null;
        }
      }
      throw error;
    }
  }

  async deleteItem(id: string): Promise<boolean> {
    try {
      await this.prisma.shopItem.delete({
        where: { id },
      });
      return true;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return false;
        }
      }
      throw error;
    }
  }

  async getItemsCount(filter: ShopItemsFilter = {}): Promise<number> {
    const where: Prisma.ShopItemWhereInput = {};

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.currency) {
      where.priceCurrency = filter.currency;
    }

    if (filter.available !== undefined) {
      where.available = filter.available;
    } else {
      where.available = true;
    }

    if (filter.search) {
      const searchTerm = filter.search.toLowerCase();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.shopItem.count({ where });
  }

  private mapPrismaToItem(item: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    priceCurrency: string;
    priceAmount: Prisma.Decimal;
    imageUrl: string | null;
    available: boolean;
    stock: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): ShopItem {
    const mapped: ShopItem = {
      id: item.id,
      name: item.name,
      category: item.category as ShopItem['category'],
      price: {
        currency: item.priceCurrency,
        amount: Number(item.priceAmount),
      },
      available: item.available,
      createdAt: item.createdAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
    };

    if (item.description !== null) {
      mapped.description = item.description;
    }
    if (item.imageUrl !== null) {
      mapped.imageUrl = item.imageUrl;
    }
    if (item.stock !== null) {
      mapped.stock = item.stock;
    }

    return mapped;
  }
}



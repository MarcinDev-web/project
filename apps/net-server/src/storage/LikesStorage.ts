/**
 * Likes Storage - manages likes for marketplace items
 */

import { promises as fs } from 'fs';
import path from 'path';
// @ts-expect-error - Prisma client is generated at build time
import type { PrismaClient } from '../../node_modules/.prisma/net-client';
import type { MarketplaceStorage } from './MarketplaceStorage';

export class LikesStorage {
  private readonly dataDir?: string;
  private readonly likesFile?: string;
  private readonly prisma?: PrismaClient;
  private readonly marketplaceStorage: MarketplaceStorage | undefined;

  constructor(storage: PrismaClient | string, marketplaceStorage?: MarketplaceStorage) {
    if (typeof storage === 'string') {
      // JSON file storage
      this.dataDir = storage;
      this.likesFile = path.join(storage, 'likes.json');
      this.marketplaceStorage = marketplaceStorage;
      // prisma stays undefined (not set)
    } else {
      // PostgreSQL storage
      this.prisma = storage;
      // dataDir and likesFile stay undefined (not set)
    }
  }

  async initialize(): Promise<void> {
    if (this.dataDir) {
      await fs.mkdir(this.dataDir, { recursive: true });
      try {
        await fs.access(this.likesFile!);
      } catch {
        await fs.writeFile(this.likesFile!, JSON.stringify({}, null, 2));
      }
    }
    // PostgreSQL schema is managed by ensureSchema()
  }

  private async readLikes(): Promise<Record<string, Set<string>>> {
    if (!this.likesFile) {
      return {};
    }
    try {
      const data = await fs.readFile(this.likesFile, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, string[]>;
      const result: Record<string, Set<string>> = {};
      for (const [itemId, userIds] of Object.entries(parsed)) {
        result[itemId] = new Set(userIds);
      }
      return result;
    } catch {
      return {};
    }
  }

  private async writeLikes(likes: Record<string, Set<string>>): Promise<void> {
    if (!this.likesFile) {
      return;
    }
    const serialized: Record<string, string[]> = {};
    for (const [itemId, userIds] of Object.entries(likes)) {
      serialized[itemId] = Array.from(userIds);
    }
    await fs.writeFile(this.likesFile, JSON.stringify(serialized, null, 2));
  }

  async likeItem(itemId: string, userId: string): Promise<void> {
    if (this.prisma) {
      // PostgreSQL
      await this.prisma.marketplaceLike.upsert({
        where: {
          itemId_userId: {
            itemId,
            userId,
          },
        },
        create: {
          itemId,
          userId,
        },
        update: {},
      });
      // Update like count in marketplace_items
      await this.prisma.marketplaceItem.update({
        where: { id: itemId },
        data: {
          likes: { increment: 1 },
        },
      }).catch(() => {
        // Ignore if item doesn't exist
      });
    } else {
      // JSON file
      const likes = await this.readLikes();
      const wasLiked = likes[itemId]?.has(userId) ?? false;
      if (!likes[itemId]) {
        likes[itemId] = new Set();
      }
      likes[itemId].add(userId);
      await this.writeLikes(likes);
      
      // Update like count in marketplace item (only if it wasn't already liked)
      if (!wasLiked && this.marketplaceStorage) {
        const item = await this.marketplaceStorage.getItem(itemId);
        if (item) {
          await this.marketplaceStorage.updateItem(itemId, {
            likes: item.likes + 1,
          });
        }
      }
    }
  }

  async unlikeItem(itemId: string, userId: string): Promise<void> {
    if (this.prisma) {
      // PostgreSQL
      const deleted = await this.prisma.marketplaceLike.deleteMany({
        where: {
          itemId,
          userId,
        },
      });
      // Update like count if a like was actually removed
      if (deleted.count > 0) {
        await this.prisma.marketplaceItem.update({
          where: { id: itemId },
          data: {
            likes: { decrement: 1 },
          },
        }).catch(() => {
          // Ignore if item doesn't exist
        });
      }
    } else {
      // JSON file
      const likes = await this.readLikes();
      const wasLiked = likes[itemId]?.has(userId) ?? false;
      if (likes[itemId]) {
        likes[itemId].delete(userId);
        if (likes[itemId].size === 0) {
          delete likes[itemId];
        }
        await this.writeLikes(likes);
      }
      
      // Update like count in marketplace item (only if it was actually liked)
      if (wasLiked && this.marketplaceStorage) {
        const item = await this.marketplaceStorage.getItem(itemId);
        if (item) {
          await this.marketplaceStorage.updateItem(itemId, {
            likes: Math.max(0, item.likes - 1),
          });
        }
      }
    }
  }

  async isLiked(itemId: string, userId: string): Promise<boolean> {
    if (this.prisma) {
      const count = await this.prisma.marketplaceLike.count({
        where: {
          itemId,
          userId,
        },
      });
      return count > 0;
    } else {
      const likes = await this.readLikes();
      return likes[itemId]?.has(userId) ?? false;
    }
  }

  async getUserLikes(userId: string): Promise<string[]> {
    if (this.prisma) {
      const likes = await this.prisma.marketplaceLike.findMany({
        where: { userId },
        select: { itemId: true },
      });
      return likes.map((like: { itemId: string }) => like.itemId);
    } else {
      const likes = await this.readLikes();
      const userLikes: string[] = [];
      for (const [itemId, userIds] of Object.entries(likes)) {
        if (userIds.has(userId)) {
          userLikes.push(itemId);
        }
      }
      return userLikes;
    }
  }

  async getItemLikeCount(itemId: string): Promise<number> {
    if (this.prisma) {
      return await this.prisma.marketplaceLike.count({
        where: { itemId },
      });
    } else {
      const likes = await this.readLikes();
      return likes[itemId]?.size ?? 0;
    }
  }

  async getItemLikes(itemId: string): Promise<string[]> {
    if (this.prisma) {
      const likes = await this.prisma.marketplaceLike.findMany({
        where: { itemId },
        select: { userId: true },
      });
      return likes.map((like: { userId: string }) => like.userId);
    } else {
      const likes = await this.readLikes();
      return Array.from(likes[itemId] ?? []);
    }
  }
}

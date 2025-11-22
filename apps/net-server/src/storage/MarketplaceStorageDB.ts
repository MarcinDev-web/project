/**
 * Marketplace Storage DB - PostgreSQL implementation using Prisma
 */

import { PrismaClient as PrismaClientType, Prisma } from '@engine/database';
import type { MarketplaceItem } from './MarketplaceStorage.js';
import { updateItemSchema } from '../validation/schemas/marketplace.js';

/**
 * Interface for raw SQL search results from PostgreSQL
 */
interface SearchResultRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  author_id: string;
  author_name: string | null;
  thumbnail_url: string | null;
  file_url: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  downloads: number;
  likes: number;
  public: boolean;
  price_currency?: string | null;
  price_amount?: number | null;
  forum_thread_id?: string | null;
}

export class MarketplaceStorageDB {
  // Maximum limit for pagination to prevent DoS attacks
  private static readonly MAX_LIMIT = 100;

  constructor(private readonly prisma: PrismaClientType) {}

  async initialize(): Promise<void> {
    // Schema is managed by Prisma migrations
    // No additional initialization needed
  }

  async createItem(
    item: Omit<MarketplaceItem, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'likes'>,
    tx?: PrismaClientType
  ): Promise<MarketplaceItem> {
    const id = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const client = tx ?? this.prisma;

    const created = await client.marketplaceItem.create({
      data: {
        id,
        type: item.type,
        title: item.title,
        description: item.description ?? null,
        authorId: item.authorId,
        authorName: item.authorName ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        fileUrl: item.fileUrl,
        tags: item.tags,
        downloads: 0,
        likes: 0,
        isPublic: item.public,
        priceCurrency: item.price?.currency ?? null,
        priceAmount: item.price?.amount ?? null,
        forumThreadId: item.forumThreadId ?? null,
      },
    });

    return this.mapPrismaToItem(created);
  }

  async getItem(id: string): Promise<MarketplaceItem | null> {
    const item = await this.prisma.marketplaceItem.findUnique({
      where: { id },
    });

    if (!item) {
      return null;
    }

    return this.mapPrismaToItem(item);
  }

  async getItems(
    options: {
      type?: 'build' | 'avatar';
      authorId?: string;
      tags?: string[];
      public?: boolean;
      limit?: number;
      offset?: number;
      search?: string;
      sortBy?: 'newest' | 'popular' | 'downloads' | 'likes';
    } = {}
  ): Promise<MarketplaceItem[]> {
    const limit = Math.min(options.limit ?? 50, MarketplaceStorageDB.MAX_LIMIT);
    const offset = options.offset ?? 0;

    // Build where clause for Prisma
    const where: Prisma.MarketplaceItemWhereInput = {};

    if (options.type) {
      where.type = options.type;
    }

    if (options.authorId) {
      where.authorId = options.authorId;
    }

    if (options.tags && options.tags.length > 0) {
      where.tags = {
        hasSome: options.tags,
      };
    }

    if (options.public !== undefined) {
      where.isPublic = options.public;
    }

    // For full-text search, we need to use raw SQL
    if (options.search && options.search.trim()) {
      // Use raw SQL for full-text search with tsvector
      const searchWords = options.search
        .trim()
        .split(/\s+/)
        .map((word) => word.replace(/[:'&!|()]/g, ''))
        .filter((word) => word.length > 0);

      if (searchWords.length > 0) {
        const searchQuery = searchWords.map((word) => `${word}:*`).join(' & ');

        // Use raw SQL for full-text search
        const rawQuery = Prisma.sql`
          SELECT * FROM marketplace_items
          WHERE ${Prisma.join([
            options.type ? Prisma.sql`type = ${options.type}` : Prisma.empty,
            options.authorId ? Prisma.sql`author_id = ${options.authorId}` : Prisma.empty,
            options.tags && options.tags.length > 0
              ? Prisma.sql`tags && ${options.tags}::text[]`
              : Prisma.empty,
            options.public !== undefined ? Prisma.sql`public = ${options.public}` : Prisma.empty,
            Prisma.sql`to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' ')) @@ to_tsquery('english', ${searchQuery})`,
          ])}
          ORDER BY ts_rank(
            to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' ')),
            to_tsquery('english', ${searchQuery})
          ) DESC, created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

        const results = (await this.prisma.$queryRaw(rawQuery)) as SearchResultRow[];

        return results.map((row) => this.mapRowToItem(row));
      }
    }

    // Build orderBy for Prisma
    let orderBy:
      | Prisma.MarketplaceItemOrderByWithRelationInput
      | Prisma.MarketplaceItemOrderByWithRelationInput[] = { createdAt: 'desc' };
    if (options.sortBy) {
      switch (options.sortBy) {
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'popular':
          orderBy = [{ downloads: 'desc' }, { likes: 'desc' }, { createdAt: 'desc' }];
          break;
        case 'downloads':
          orderBy = [{ downloads: 'desc' }, { createdAt: 'desc' }];
          break;
        case 'likes':
          orderBy = [{ likes: 'desc' }, { createdAt: 'desc' }];
          break;
      }
    }

    const items = await this.prisma.marketplaceItem.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    });

    return items.map((item: Parameters<typeof this.mapPrismaToItem>[0]) =>
      this.mapPrismaToItem(item)
    );
  }

  async updateItem(
    id: string,
    updates: Partial<Omit<MarketplaceItem, 'id' | 'createdAt' | 'authorId'>>,
    tx?: PrismaClientType
  ): Promise<MarketplaceItem | null> {
    // Validate updates before applying
    const validationResult = updateItemSchema.safeParse(updates);
    if (!validationResult.success) {
      throw new Error(`Invalid update data: ${validationResult.error.message}`);
    }

    const client = tx ?? this.prisma;

    // Build update data
    const updateData: Prisma.MarketplaceItemUpdateInput = {};

    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description ?? null;
    }

    if (updates.authorName !== undefined) {
      updateData.authorName = updates.authorName ?? null;
    }

    if (updates.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = updates.thumbnailUrl ?? null;
    }

    if (updates.fileUrl !== undefined) {
      updateData.fileUrl = updates.fileUrl;
    }

    if (updates.tags !== undefined) {
      updateData.tags = updates.tags;
    }

    if (updates.downloads !== undefined) {
      updateData.downloads = updates.downloads;
    }

    if (updates.likes !== undefined) {
      updateData.likes = updates.likes;
    }

    if (updates.public !== undefined) {
      updateData.isPublic = updates.public;
    }

    if (updates.price !== undefined) {
      if (updates.price) {
        updateData.priceCurrency = updates.price.currency;
        updateData.priceAmount = updates.price.amount;
      } else {
        updateData.priceCurrency = null;
        updateData.priceAmount = null;
      }
    }

    if (updates.forumThreadId !== undefined) {
      updateData.forumThreadId = updates.forumThreadId ?? null;
    }

    // updatedAt is handled automatically by Prisma @updatedAt

    if (Object.keys(updateData).length === 0) {
      // No updates provided, just return the item
      return this.getItem(id);
    }

    try {
      const updated = await client.marketplaceItem.update({
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

  async deleteItem(id: string, authorId: string): Promise<boolean> {
    try {
      const result = await this.prisma.marketplaceItem.deleteMany({
        where: {
          id,
          authorId,
        },
      });

      return result.count > 0;
    } catch {
      return false;
    }
  }

  async incrementDownloads(id: string): Promise<void> {
    await this.prisma.marketplaceItem.update({
      where: { id },
      data: {
        downloads: {
          increment: 1,
          // updatedAt is handled automatically
        },
      },
    });
  }

  /**
   * Maps Prisma MarketplaceItem to MarketplaceItem interface
   */
  private mapPrismaToItem(item: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    authorId: string;
    authorName: string | null;
    thumbnailUrl: string | null;
    fileUrl: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    downloads: number;
    likes: number;
    isPublic: boolean;
    priceCurrency?: string | null;
    priceAmount?: Prisma.Decimal | null;
    forumThreadId?: string | null;
  }): MarketplaceItem {
    const mapped: MarketplaceItem = {
      id: item.id,
      type: item.type as 'build' | 'avatar',
      title: item.title,
      authorId: item.authorId,
      fileUrl: item.fileUrl,
      tags: item.tags,
      createdAt: item.createdAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
      downloads: item.downloads,
      likes: item.likes,
      public: item.isPublic,
    };

    if (item.description !== null) {
      mapped.description = item.description;
    }
    if (item.authorName !== null) {
      mapped.authorName = item.authorName;
    }
    if (item.thumbnailUrl !== null) {
      mapped.thumbnailUrl = item.thumbnailUrl;
    }
    if (item.priceCurrency && item.priceAmount !== null && item.priceAmount !== undefined) {
      mapped.price = { currency: item.priceCurrency, amount: Number(item.priceAmount) };
    }
    if (item.forumThreadId !== null && item.forumThreadId !== undefined) {
      mapped.forumThreadId = item.forumThreadId;
    }

    return mapped;
  }

  /**
   * Maps database row (from raw SQL) to MarketplaceItem
   */
  private mapRowToItem(row: SearchResultRow): MarketplaceItem {
    const item: MarketplaceItem = {
      id: row.id,
      type: row.type as 'build' | 'avatar',
      title: row.title,
      authorId: row.author_id,
      fileUrl: row.file_url,
      tags: row.tags,
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
      downloads: row.downloads,
      likes: row.likes,
      public: row.public,
    };

    if (row.description !== null) {
      item.description = row.description;
    }
    if (row.author_name !== null) {
      item.authorName = row.author_name;
    }
    if (row.thumbnail_url !== null) {
      item.thumbnailUrl = row.thumbnail_url;
    }
    if (row.price_currency && row.price_amount !== null && row.price_amount !== undefined) {
      item.price = { currency: row.price_currency, amount: Number(row.price_amount) };
    }
    if (row.forum_thread_id !== null && row.forum_thread_id !== undefined) {
      item.forumThreadId = row.forum_thread_id;
    }

    return item;
  }
}



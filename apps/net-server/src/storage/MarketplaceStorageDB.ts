/**
 * Marketplace Storage DB - PostgreSQL implementation
 */

import type { Pool, PoolClient } from 'pg';
import type { MarketplaceItem } from './MarketplaceStorage';

export class MarketplaceStorageDB {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
    // No additional initialization needed
  }

  async createItem(
    item: Omit<MarketplaceItem, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'likes'>,
    client?: PoolClient
  ): Promise<MarketplaceItem> {
    const id = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    const queryClient = client ?? this.pool;

    const result = await queryClient.query<{
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
      price_currency: string | null;
      price_amount: number | null;
    }>(
      `INSERT INTO marketplace_items (
        id, type, title, description, author_id, author_name,
        thumbnail_url, file_url, tags, created_at, updated_at,
        downloads, likes, public, price_currency, price_amount, forum_thread_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        id,
        item.type,
        item.title,
        item.description ?? null,
        item.authorId,
        item.authorName ?? null,
        item.thumbnailUrl ?? null,
        item.fileUrl,
        item.tags,
        now,
        now,
        0, // downloads
        0, // likes
        item.public,
        item.price?.currency ?? null,
        item.price?.amount ?? null,
        item.forumThreadId ?? null,
      ]
    );

    return this.mapRowToItem(result.rows[0]!);
  }

  async getItem(id: string): Promise<MarketplaceItem | null> {
    const result = await this.pool.query<{
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
      price_currency: string | null;
      price_amount: number | null;
      forum_thread_id: string | null;
    }>('SELECT * FROM marketplace_items WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToItem(result.rows[0]!);
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
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;
    let searchParamIndex = 0;

    if (options.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(options.type);
      paramIndex++;
    }

    if (options.authorId) {
      conditions.push(`author_id = $${paramIndex}`);
      params.push(options.authorId);
      paramIndex++;
    }

    if (options.tags && options.tags.length > 0) {
      conditions.push(`tags && $${paramIndex}::text[]`);
      params.push(options.tags);
      paramIndex++;
    }

    if (options.public !== undefined) {
      conditions.push(`public = $${paramIndex}`);
      params.push(options.public);
      paramIndex++;
    }

    if (options.search && options.search.trim()) {
      // Escape special characters for tsquery
      const searchQuery = options.search
        .trim()
        .split(/\s+/)
        .map((word) => word.replace(/[:'&!|()]/g, ''))
        .filter((word) => word.length > 0)
        .join(' & ');

      if (searchQuery) {
        searchParamIndex = paramIndex;
        conditions.push(
          `to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' ')) @@ to_tsquery('english', $${paramIndex})`
        );
        params.push(searchQuery);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    params.push(limit, offset);
    const limitParam = paramIndex;
    const offsetParam = paramIndex + 1;

    // Determine sort order
    let orderBy = 'ORDER BY created_at DESC'; // Default
    if (searchParamIndex > 0) {
      // Use relevance ranking if search is provided
      orderBy = `ORDER BY ts_rank(
        to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' ')),
        to_tsquery('english', $${searchParamIndex})
      ) DESC, created_at DESC`;
    } else if (options.sortBy) {
      // Use specified sort option
      switch (options.sortBy) {
        case 'newest':
          orderBy = 'ORDER BY created_at DESC';
          break;
        case 'popular':
          orderBy = 'ORDER BY downloads DESC, likes DESC, created_at DESC';
          break;
        case 'downloads':
          orderBy = 'ORDER BY downloads DESC, created_at DESC';
          break;
        case 'likes':
          orderBy = 'ORDER BY likes DESC, created_at DESC';
          break;
      }
    }

    const query = `
      SELECT * FROM marketplace_items
      ${whereClause}
      ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await this.pool.query<{
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
      price_currency: string | null;
      price_amount: number | null;
    }>(query, params);

    return result.rows.map((row) => this.mapRowToItem(row));
  }

  async updateItem(
    id: string,
    updates: Partial<Omit<MarketplaceItem, 'id' | 'createdAt' | 'authorId'>>,
    client?: PoolClient
  ): Promise<MarketplaceItem | null> {
    const updateFields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      params.push(updates.title);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      params.push(updates.description ?? null);
      paramIndex++;
    }

    if (updates.authorName !== undefined) {
      updateFields.push(`author_name = $${paramIndex}`);
      params.push(updates.authorName ?? null);
      paramIndex++;
    }

    if (updates.thumbnailUrl !== undefined) {
      updateFields.push(`thumbnail_url = $${paramIndex}`);
      params.push(updates.thumbnailUrl ?? null);
      paramIndex++;
    }

    if (updates.fileUrl !== undefined) {
      updateFields.push(`file_url = $${paramIndex}`);
      params.push(updates.fileUrl);
      paramIndex++;
    }

    if (updates.tags !== undefined) {
      updateFields.push(`tags = $${paramIndex}`);
      params.push(updates.tags);
      paramIndex++;
    }

    if (updates.downloads !== undefined) {
      updateFields.push(`downloads = $${paramIndex}`);
      params.push(updates.downloads);
      paramIndex++;
    }

    if (updates.likes !== undefined) {
      updateFields.push(`likes = $${paramIndex}`);
      params.push(updates.likes);
      paramIndex++;
    }

    if (updates.public !== undefined) {
      updateFields.push(`public = $${paramIndex}`);
      params.push(updates.public);
      paramIndex++;
    }

    if (updates.price !== undefined) {
      if (updates.price) {
        updateFields.push(`price_currency = $${paramIndex}, price_amount = $${paramIndex + 1}`);
        params.push(updates.price.currency, updates.price.amount);
        paramIndex += 2;
      } else {
        updateFields.push(`price_currency = $${paramIndex}, price_amount = $${paramIndex + 1}`);
        params.push(null, null);
        paramIndex += 2;
      }
    }

    if (updates.forumThreadId !== undefined) {
      updateFields.push(`forum_thread_id = $${paramIndex}`);
      params.push(updates.forumThreadId ?? null);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      // No updates provided, just return the item
      return this.getItem(id);
    }

    // Always update updated_at
    updateFields.push(`updated_at = $${paramIndex}`);
    params.push(new Date());
    paramIndex++;

    params.push(id);
    const idParam = paramIndex;

    const query = `
      UPDATE marketplace_items
      SET ${updateFields.join(', ')}
      WHERE id = $${idParam}
      RETURNING *
    `;

    const queryClient = client ?? this.pool;

    const result = await queryClient.query<{
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
      price_currency: string | null;
      price_amount: number | null;
    }>(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToItem(result.rows[0]!);
  }

  async deleteItem(id: string, authorId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM marketplace_items WHERE id = $1 AND author_id = $2',
      [id, authorId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  async incrementDownloads(id: string): Promise<void> {
    await this.pool.query('UPDATE marketplace_items SET downloads = downloads + 1 WHERE id = $1', [
      id,
    ]);
  }

  /**
   * Maps database row to MarketplaceItem
   */
  private mapRowToItem(row: {
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
  }): MarketplaceItem {
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
      item.price = { currency: row.price_currency, amount: row.price_amount };
    }
    if (row.forum_thread_id !== null && row.forum_thread_id !== undefined) {
      item.forumThreadId = row.forum_thread_id;
    }

    return item;
  }
}

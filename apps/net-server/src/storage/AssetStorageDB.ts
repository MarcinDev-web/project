/**
 * Asset Storage DB - PostgreSQL implementation
 */

import type { Pool } from 'pg';
import type { Asset, AssetFilter, AssetMetadata } from './AssetStorage';

export class AssetStorageDB {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
    // No additional initialization needed
  }

  async createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
    const id = `asset_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    const result = await this.pool.query<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      category: string | null;
      price_currency: string;
      price_amount: number;
      preview_url: string | null;
      file_url: string;
      metadata: AssetMetadata;
      author_id: string;
      available: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO shop_assets (
        id, name, description, type, category, price_currency, price_amount,
        preview_url, file_url, metadata, author_id, available, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id,
        asset.name,
        asset.description ?? null,
        asset.type,
        asset.category ?? null,
        asset.price.currency,
        asset.price.amount,
        asset.previewUrl ?? null,
        asset.fileUrl,
        JSON.stringify(asset.metadata),
        asset.authorId,
        asset.available,
        now,
        now,
      ]
    );

    return this.mapRowToAsset(result.rows[0]!);
  }

  async getAsset(id: string): Promise<Asset | null> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      category: string | null;
      price_currency: string;
      price_amount: number;
      preview_url: string | null;
      file_url: string;
      metadata: AssetMetadata;
      author_id: string;
      available: boolean;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM shop_assets WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAsset(result.rows[0]!);
  }

  async getAssets(filter: AssetFilter = {}): Promise<Asset[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(filter.type);
      paramIndex++;
    }

    if (filter.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(filter.category);
      paramIndex++;
    }

    if (filter.authorId) {
      conditions.push(`author_id = $${paramIndex}`);
      params.push(filter.authorId);
      paramIndex++;
    }

    if (filter.available !== undefined) {
      conditions.push(`available = $${paramIndex}`);
      params.push(filter.available);
      paramIndex++;
    } else {
      conditions.push('available = true');
    }

    if (filter.search) {
      conditions.push(
        `(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`
      );
      const searchTerm = `%${filter.search.toLowerCase()}%`;
      params.push(searchTerm, searchTerm);
      paramIndex += 2;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : 'WHERE available = true';

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const query = `
      SELECT * FROM shop_assets
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await this.pool.query<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      category: string | null;
      price_currency: string;
      price_amount: number;
      preview_url: string | null;
      file_url: string;
      metadata: AssetMetadata;
      author_id: string;
      available: boolean;
      created_at: Date;
      updated_at: Date;
    }>(query, params);

    return result.rows.map((row) => this.mapRowToAsset(row));
  }

  async updateAsset(
    id: string,
    updates: Partial<Omit<Asset, 'id' | 'createdAt'>>
  ): Promise<Asset | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(updates.name);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(updates.description ?? null);
      paramIndex++;
    }

    if (updates.type !== undefined) {
      setClauses.push(`type = $${paramIndex}`);
      params.push(updates.type);
      paramIndex++;
    }

    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex}`);
      params.push(updates.category ?? null);
      paramIndex++;
    }

    if (updates.price !== undefined) {
      setClauses.push(`price_currency = $${paramIndex}, price_amount = $${paramIndex + 1}`);
      params.push(updates.price.currency, updates.price.amount);
      paramIndex += 2;
    }

    if (updates.previewUrl !== undefined) {
      setClauses.push(`preview_url = $${paramIndex}`);
      params.push(updates.previewUrl ?? null);
      paramIndex++;
    }

    if (updates.fileUrl !== undefined) {
      setClauses.push(`file_url = $${paramIndex}`);
      params.push(updates.fileUrl);
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    if (updates.available !== undefined) {
      setClauses.push(`available = $${paramIndex}`);
      params.push(updates.available);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.getAsset(id);
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    params.push(new Date(), id);
    paramIndex++;

    const query = `
      UPDATE shop_assets
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      category: string | null;
      price_currency: string;
      price_amount: number;
      preview_url: string | null;
      file_url: string;
      metadata: AssetMetadata;
      author_id: string;
      available: boolean;
      created_at: Date;
      updated_at: Date;
    }>(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAsset(result.rows[0]!);
  }

  async deleteAsset(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM shop_assets WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getAssetsCount(filter: AssetFilter = {}): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(filter.type);
      paramIndex++;
    }

    if (filter.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(filter.category);
      paramIndex++;
    }

    if (filter.authorId) {
      conditions.push(`author_id = $${paramIndex}`);
      params.push(filter.authorId);
      paramIndex++;
    }

    if (filter.available !== undefined) {
      conditions.push(`available = $${paramIndex}`);
      params.push(filter.available);
      paramIndex++;
    } else {
      conditions.push('available = true');
    }

    if (filter.search) {
      conditions.push(
        `(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`
      );
      const searchTerm = `%${filter.search.toLowerCase()}%`;
      params.push(searchTerm, searchTerm);
      paramIndex += 2;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : 'WHERE available = true';

    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM shop_assets ${whereClause}`,
      params
    );

    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  private mapRowToAsset(row: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    category: string | null;
    price_currency: string;
    price_amount: number;
    preview_url: string | null;
    file_url: string;
    metadata: AssetMetadata | string;
    author_id: string;
    available: boolean;
    created_at: Date;
    updated_at: Date;
  }): Asset {
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    const asset: Asset = {
      id: row.id,
      name: row.name,
      type: row.type as Asset['type'],
      price: {
        currency: row.price_currency,
        amount: row.price_amount,
      },
      fileUrl: row.file_url,
      metadata,
      authorId: row.author_id,
      available: row.available,
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
    };
    if (row.description) asset.description = row.description;
    if (row.category) asset.category = row.category;
    if (row.preview_url) asset.previewUrl = row.preview_url;
    return asset;
  }
}

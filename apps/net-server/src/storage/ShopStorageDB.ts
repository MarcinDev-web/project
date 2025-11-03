/**
 * Shop Storage DB - PostgreSQL implementation
 */

import type { Pool } from 'pg';
import type { ShopItem, ShopItemsFilter } from './ShopStorage';

export class ShopStorageDB {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
    // No additional initialization needed
  }

  async createItem(item: Omit<ShopItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShopItem> {
    const id = `shop_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    const result = await this.pool.query<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      price_currency: string;
      price_amount: number;
      image_url: string | null;
      available: boolean;
      stock: number | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO shop_items (
        id, name, description, category, price_currency, price_amount,
        image_url, available, stock, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id,
        item.name,
        item.description ?? null,
        item.category,
        item.price.currency,
        item.price.amount,
        item.imageUrl ?? null,
        item.available,
        item.stock ?? null,
        now,
        now,
      ]
    );

    return this.mapRowToItem(result.rows[0]!);
  }

  async getItem(id: string): Promise<ShopItem | null> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      price_currency: string;
      price_amount: number;
      image_url: string | null;
      available: boolean;
      stock: number | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM shop_items WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToItem(result.rows[0]!);
  }

  async getItems(filter: ShopItemsFilter = {}): Promise<ShopItem[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(filter.category);
      paramIndex++;
    }

    if (filter.currency) {
      conditions.push(`price_currency = $${paramIndex}`);
      params.push(filter.currency);
      paramIndex++;
    }

    if (filter.available !== undefined) {
      conditions.push(`available = $${paramIndex}`);
      params.push(filter.available);
      paramIndex++;
    } else {
      // By default, only show available items
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
      SELECT * FROM shop_items
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await this.pool.query<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      price_currency: string;
      price_amount: number;
      image_url: string | null;
      available: boolean;
      stock: number | null;
      created_at: Date;
      updated_at: Date;
    }>(query, params);

    return result.rows.map((row) => this.mapRowToItem(row));
  }

  async updateItem(
    id: string,
    updates: Partial<Omit<ShopItem, 'id' | 'createdAt'>>
  ): Promise<ShopItem | null> {
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

    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex}`);
      params.push(updates.category);
      paramIndex++;
    }

    if (updates.price !== undefined) {
      setClauses.push(`price_currency = $${paramIndex}, price_amount = $${paramIndex + 1}`);
      params.push(updates.price.currency, updates.price.amount);
      paramIndex += 2;
    }

    if (updates.imageUrl !== undefined) {
      setClauses.push(`image_url = $${paramIndex}`);
      params.push(updates.imageUrl ?? null);
      paramIndex++;
    }

    if (updates.available !== undefined) {
      setClauses.push(`available = $${paramIndex}`);
      params.push(updates.available);
      paramIndex++;
    }

    if (updates.stock !== undefined) {
      setClauses.push(`stock = $${paramIndex}`);
      params.push(updates.stock ?? null);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      return this.getItem(id);
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    params.push(new Date(), id);
    paramIndex++;

    const query = `
      UPDATE shop_items
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      price_currency: string;
      price_amount: number;
      image_url: string | null;
      available: boolean;
      stock: number | null;
      created_at: Date;
      updated_at: Date;
    }>(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToItem(result.rows[0]!);
  }

  async deleteItem(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM shop_items WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getItemsCount(filter: ShopItemsFilter = {}): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(filter.category);
      paramIndex++;
    }

    if (filter.currency) {
      conditions.push(`price_currency = $${paramIndex}`);
      params.push(filter.currency);
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
      `SELECT COUNT(*) as count FROM shop_items ${whereClause}`,
      params
    );

    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  private mapRowToItem(row: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    price_currency: string;
    price_amount: number;
    image_url: string | null;
    available: boolean;
    stock: number | null;
    created_at: Date;
    updated_at: Date;
  }): ShopItem {
    const item: ShopItem = {
      id: row.id,
      name: row.name,
      category: row.category as ShopItem['category'],
      price: {
        currency: row.price_currency,
        amount: row.price_amount,
      },
      available: row.available,
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
    };

    if (row.description !== null) {
      item.description = row.description;
    }
    if (row.image_url !== null) {
      item.imageUrl = row.image_url;
    }
    if (row.stock !== null) {
      item.stock = row.stock;
    }

    return item;
  }
}

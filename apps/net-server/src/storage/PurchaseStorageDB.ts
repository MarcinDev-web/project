/**
 * Purchase Storage DB - PostgreSQL implementation
 */

import type { Pool } from 'pg';
import type { Purchase, PurchaseFilter, PurchaseItem, PurchaseItemType, PurchaseStatus } from './PurchaseStorage';

export class PurchaseStorageDB {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
    // No additional initialization needed
  }

  async createPurchase(purchase: Omit<Purchase, 'id' | 'createdAt'>): Promise<Purchase> {
    const id = `purchase_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert purchase
      await client.query(
        `INSERT INTO purchases (id, user_id, total_currency, total_amount, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          purchase.userId,
          purchase.totalCost.currency,
          purchase.totalCost.amount,
          purchase.status,
          now,
        ]
      );

      // Insert purchase items
      for (const item of purchase.items) {
        await client.query(
          `INSERT INTO purchase_items (purchase_id, item_id, item_type, name, price_currency, price_amount)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            item.itemId,
            item.type,
            item.name,
            item.price.currency,
            item.price.amount,
          ]
        );

        // Update owned items
        await client.query(
          `INSERT INTO user_owned_items (user_id, item_id, item_type, purchased_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, item_id, item_type) DO NOTHING`,
          [purchase.userId, item.itemId, item.type, now]
        );
      }

      await client.query('COMMIT');

      return {
        ...purchase,
        id,
        createdAt: now.getTime(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPurchase(id: string): Promise<Purchase | null> {
    const purchaseResult = await this.pool.query<{
      id: string;
      user_id: string;
      total_currency: string;
      total_amount: number;
      status: string;
      created_at: Date;
    }>('SELECT * FROM purchases WHERE id = $1', [id]);

    if (purchaseResult.rows.length === 0) {
      return null;
    }

    const purchaseRow = purchaseResult.rows[0]!;

    const itemsResult = await this.pool.query<{
      item_id: string;
      item_type: string;
      name: string;
      price_currency: string;
      price_amount: number;
    }>('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);

    const items: PurchaseItem[] = itemsResult.rows.map(row => ({
      itemId: row.item_id,
      type: row.item_type as PurchaseItemType,
      name: row.name,
      price: {
        currency: row.price_currency,
        amount: row.price_amount,
      },
    }));

    return {
      id: purchaseRow.id,
      userId: purchaseRow.user_id,
      items,
      totalCost: {
        currency: purchaseRow.total_currency,
        amount: purchaseRow.total_amount,
      },
      status: purchaseRow.status as PurchaseStatus,
      createdAt: purchaseRow.created_at.getTime(),
    };
  }

  async getPurchases(filter: PurchaseFilter = {}): Promise<Purchase[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(filter.userId);
      paramIndex++;
    }

    if (filter.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filter.status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const purchaseQuery = `
      SELECT * FROM purchases
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const purchaseResult = await this.pool.query<{
      id: string;
      user_id: string;
      total_currency: string;
      total_amount: number;
      status: string;
      created_at: Date;
    }>(purchaseQuery, params);

    const purchases: Purchase[] = [];

    for (const purchaseRow of purchaseResult.rows) {
      const itemsResult = await this.pool.query<{
        item_id: string;
        item_type: string;
        name: string;
        price_currency: string;
        price_amount: number;
      }>('SELECT * FROM purchase_items WHERE purchase_id = $1', [purchaseRow.id]);

      const items: PurchaseItem[] = itemsResult.rows.map(row => ({
        itemId: row.item_id,
        type: row.item_type as PurchaseItemType,
        name: row.name,
        price: {
          currency: row.price_currency,
          amount: row.price_amount,
        },
      }));

      purchases.push({
        id: purchaseRow.id,
        userId: purchaseRow.user_id,
        items,
        totalCost: {
          currency: purchaseRow.total_currency,
          amount: purchaseRow.total_amount,
        },
        status: purchaseRow.status as PurchaseStatus,
        createdAt: purchaseRow.created_at.getTime(),
      });
    }

    return purchases;
  }

  async updatePurchaseStatus(id: string, status: PurchaseStatus): Promise<Purchase | null> {
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      total_currency: string;
      total_amount: number;
      status: string;
      created_at: Date;
    }>(
      'UPDATE purchases SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const purchaseRow = result.rows[0]!;

    const itemsResult = await this.pool.query<{
      item_id: string;
      item_type: string;
      name: string;
      price_currency: string;
      price_amount: number;
    }>('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);

    const items: PurchaseItem[] = itemsResult.rows.map(row => ({
      itemId: row.item_id,
      type: row.item_type as PurchaseItemType,
      name: row.name,
      price: {
        currency: row.price_currency,
        amount: row.price_amount,
      },
    }));

    return {
      id: purchaseRow.id,
      userId: purchaseRow.user_id,
      items,
      totalCost: {
        currency: purchaseRow.total_currency,
        amount: purchaseRow.total_amount,
      },
      status: purchaseRow.status as PurchaseStatus,
      createdAt: purchaseRow.created_at.getTime(),
    };
  }

  async isOwned(userId: string, itemId: string, itemType: PurchaseItemType): Promise<boolean> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_owned_items 
       WHERE user_id = $1 AND item_id = $2 AND item_type = $3`,
      [userId, itemId, itemType]
    );

    return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
  }

  async getOwnedItems(userId: string): Promise<Array<{ itemId: string; itemType: PurchaseItemType; purchasedAt: number }>> {
    const result = await this.pool.query<{
      item_id: string;
      item_type: string;
      purchased_at: Date;
    }>(
      'SELECT item_id, item_type, purchased_at FROM user_owned_items WHERE user_id = $1',
      [userId]
    );

    return result.rows.map(row => ({
      itemId: row.item_id,
      itemType: row.item_type as PurchaseItemType,
      purchasedAt: row.purchased_at.getTime(),
    }));
  }

  /**
   * Transfer ownership of an item from one user to another (secondary sale).
   * Uses a transaction to ensure atomicity.
   */
  async transferOwnership(
    itemId: string,
    itemType: PurchaseItemType,
    fromUserId: string,
    toUserId: string
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify source owns the item
      const check = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM user_owned_items WHERE user_id = $1 AND item_id = $2 AND item_type = $3`,
        [fromUserId, itemId, itemType]
      );
      const hasItem = parseInt(check.rows[0]?.count ?? '0', 10) > 0;
      if (!hasItem) {
        await client.query('ROLLBACK');
        return false;
      }

      // Remove from seller
      await client.query(
        `DELETE FROM user_owned_items WHERE user_id = $1 AND item_id = $2 AND item_type = $3`,
        [fromUserId, itemId, itemType]
      );

      // Add to buyer
      await client.query(
        `INSERT INTO user_owned_items (user_id, item_id, item_type, purchased_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, item_id, item_type) DO NOTHING`,
        [toUserId, itemId, itemType, new Date()]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}


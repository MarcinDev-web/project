/**
 * Likes Storage - manages likes for marketplace items
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Pool } from 'pg';

export class LikesStorage {
  private readonly dataDir?: string;
  private readonly likesFile?: string;
  private readonly pool?: Pool;

  constructor(storage: Pool | string) {
    if (typeof storage === 'string') {
      // JSON file storage
      this.dataDir = storage;
      this.likesFile = path.join(storage, 'likes.json');
      // pool stays undefined (not set)
    } else {
      // PostgreSQL storage
      this.pool = storage;
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
    if (this.pool) {
      // PostgreSQL
      await this.pool.query(
        'INSERT INTO marketplace_likes (item_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [itemId, userId]
      );
      // Update like count in marketplace_items
      await this.pool.query('UPDATE marketplace_items SET likes = likes + 1 WHERE id = $1', [
        itemId,
      ]);
    } else {
      // JSON file
      const likes = await this.readLikes();
      if (!likes[itemId]) {
        likes[itemId] = new Set();
      }
      likes[itemId].add(userId);
      await this.writeLikes(likes);
    }
  }

  async unlikeItem(itemId: string, userId: string): Promise<void> {
    if (this.pool) {
      // PostgreSQL
      const result = await this.pool.query(
        'DELETE FROM marketplace_likes WHERE item_id = $1 AND user_id = $2',
        [itemId, userId]
      );
      // Update like count if a like was actually removed
      if (result.rowCount && result.rowCount > 0) {
        await this.pool.query(
          'UPDATE marketplace_items SET likes = GREATEST(likes - 1, 0) WHERE id = $1',
          [itemId]
        );
      }
    } else {
      // JSON file
      const likes = await this.readLikes();
      if (likes[itemId]) {
        likes[itemId].delete(userId);
        if (likes[itemId].size === 0) {
          delete likes[itemId];
        }
        await this.writeLikes(likes);
      }
    }
  }

  async isLiked(itemId: string, userId: string): Promise<boolean> {
    if (this.pool) {
      const result = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM marketplace_likes WHERE item_id = $1 AND user_id = $2',
        [itemId, userId]
      );
      return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
    } else {
      const likes = await this.readLikes();
      return likes[itemId]?.has(userId) ?? false;
    }
  }

  async getUserLikes(userId: string): Promise<string[]> {
    if (this.pool) {
      const result = await this.pool.query<{ item_id: string }>(
        'SELECT item_id FROM marketplace_likes WHERE user_id = $1',
        [userId]
      );
      return result.rows.map((row) => row.item_id);
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
    if (this.pool) {
      const result = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM marketplace_likes WHERE item_id = $1',
        [itemId]
      );
      return parseInt(result.rows[0]?.count ?? '0', 10);
    } else {
      const likes = await this.readLikes();
      return likes[itemId]?.size ?? 0;
    }
  }

  async getItemLikes(itemId: string): Promise<string[]> {
    if (this.pool) {
      const result = await this.pool.query<{ user_id: string }>(
        'SELECT user_id FROM marketplace_likes WHERE item_id = $1',
        [itemId]
      );
      return result.rows.map((row) => row.user_id);
    } else {
      const likes = await this.readLikes();
      return Array.from(likes[itemId] ?? []);
    }
  }
}

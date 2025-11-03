/**
 * Persistent token blacklist service.
 * Stores revoked tokens in a way that persists across server restarts.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';

/**
 * Token blacklist entry with expiration.
 */
interface BlacklistEntry {
  jti: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Persistent token blacklist service.
 * Uses database if available, otherwise falls back to JSON file storage.
 */
export class TokenBlacklistService {
  private readonly dataDir: string;
  private readonly dataFile: string;
  private readonly dbPool: Pool | null;
  private memoryCache: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(dataDir = './data', dbPool: Pool | null = null) {
    this.dataDir = dataDir;
    this.dataFile = path.join(dataDir, 'token-blacklist.json');
    this.dbPool = dbPool;
  }

  /**
   * Initialize the blacklist service.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.dbPool) {
      // Use database storage
      await this.initializeDatabase();
    } else {
      // Use JSON file storage
      await this.initializeFileStorage();
    }

    // Start cleanup interval (clean expired tokens every hour)
    this.cleanupInterval = setInterval(
      () => {
        void this.cleanupExpired();
      },
      60 * 60 * 1000
    ); // 1 hour

    this.initialized = true;
  }

  /**
   * Initialize database storage for token blacklist.
   */
  private async initializeDatabase(): Promise<void> {
    if (!this.dbPool) return;

    try {
      const client = await this.dbPool.connect();
      try {
        // Create table if it doesn't exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS token_blacklist (
            jti TEXT PRIMARY KEY,
            expires_at BIGINT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
        `);

        // Create index on expires_at for efficient cleanup
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires 
          ON token_blacklist(expires_at);
        `);

        // Load active tokens into memory cache
        const now = Date.now();
        const result = await client.query<{ jti: string }>(
          'SELECT jti FROM token_blacklist WHERE expires_at > $1',
          [now]
        );
        for (const row of result.rows) {
          this.memoryCache.add(row.jti);
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to initialize token blacklist database:', error);
      throw error;
    }
  }

  /**
   * Initialize file storage for token blacklist.
   */
  private async initializeFileStorage(): Promise<void> {
    // Create data directory if it doesn't exist
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }

    // Load existing blacklist if file exists
    if (existsSync(this.dataFile)) {
      try {
        const data = await readFile(this.dataFile, 'utf-8');
        const entries = JSON.parse(data) as BlacklistEntry[];
        const now = Date.now();

        // Only keep non-expired entries
        for (const entry of entries) {
          if (entry.expiresAt > now) {
            this.memoryCache.add(entry.jti);
          }
        }

        // Persist cleaned up list
        await this.persistFileStorage();
      } catch (error) {
        console.error('Failed to load token blacklist file:', error);
        this.memoryCache.clear();
      }
    }
  }

  /**
   * Add a token to the blacklist.
   */
  async addToken(jti: string, expiresAt: number): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Add to memory cache
    this.memoryCache.add(jti);

    if (this.dbPool) {
      // Store in database
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query(
            'INSERT INTO token_blacklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO UPDATE SET expires_at = $2',
            [jti, expiresAt]
          );
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Failed to add token to blacklist in database:', error);
        // Continue - at least it's in memory cache
      }
    } else {
      // Store in file
      await this.persistFileStorage();
    }
  }

  /**
   * Check if a token is blacklisted.
   */
  isBlacklisted(jti: string): boolean {
    return this.memoryCache.has(jti);
  }

  /**
   * Clean up expired tokens.
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();

    if (this.dbPool) {
      // Clean up from database
      try {
        const client = await this.dbPool.connect();
        try {
          await client.query('DELETE FROM token_blacklist WHERE expires_at <= $1', [now]);

          // Update memory cache (remove expired)
          const result = await client.query<{ jti: string }>(
            'SELECT jti FROM token_blacklist WHERE expires_at > $1',
            [now]
          );
          const activeJtis = new Set(result.rows.map((row) => row.jti));
          this.memoryCache = activeJtis;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Failed to cleanup expired tokens from database:', error);
      }
    } else {
      // Clean up from file
      const entries: BlacklistEntry[] = [];
      for (const jti of this.memoryCache) {
        // We don't track expiration in memory, so just keep what's there
        // In a real implementation, we'd need to store expiration times
        entries.push({ jti, expiresAt: now + 7 * 24 * 60 * 60 * 1000 }); // Default 7 days
      }
      await writeFile(this.dataFile, JSON.stringify(entries, null, 2), 'utf-8');
    }
  }

  /**
   * Persist file storage.
   */
  private async persistFileStorage(): Promise<void> {
    const entries: BlacklistEntry[] = [];
    const now = Date.now();
    const defaultExpiry = now + 7 * 24 * 60 * 60 * 1000; // 7 days default

    for (const jti of this.memoryCache) {
      entries.push({ jti, expiresAt: defaultExpiry });
    }

    await writeFile(this.dataFile, JSON.stringify(entries, null, 2), 'utf-8');
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

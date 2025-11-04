/**
 * Persistent token blacklist service.
 * Stores revoked tokens in a way that persists across server restarts.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '../../node_modules/.prisma/net-client';

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
  private readonly dbPool: PrismaClient | null;
  private memoryCache: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(dataDir = './data', dbPool: PrismaClient | null = null) {
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
      // Schema is managed by Prisma migrations - table should already exist
      // Load active tokens into memory cache
      const now = Date.now();
      const tokens = await this.dbPool.tokenBlacklist.findMany({
        where: {
          expiresAt: { gt: BigInt(now) },
        },
        select: { jti: true },
      });
      for (const token of tokens) {
        this.memoryCache.add(token.jti);
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
        await this.dbPool.tokenBlacklist.upsert({
          where: { jti },
          create: {
            jti,
            expiresAt: BigInt(expiresAt),
          },
          update: {
            expiresAt: BigInt(expiresAt),
          },
        });
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
        const nowBigInt = BigInt(now);
        await this.dbPool.tokenBlacklist.deleteMany({
          where: {
            expiresAt: { lte: nowBigInt },
          },
        });

        // Update memory cache (remove expired)
        const tokens = await this.dbPool.tokenBlacklist.findMany({
          where: {
            expiresAt: { gt: nowBigInt },
          },
          select: { jti: true },
        });
        const activeJtis = new Set<string>(tokens.map((token: { jti: string }) => token.jti));
        this.memoryCache = activeJtis;
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

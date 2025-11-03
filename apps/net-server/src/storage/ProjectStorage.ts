import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { StoredShare } from '../types';

/**
 * JSON file-based storage for shared projects.
 * Stores shares in a simple key-value format: { [token]: StoredShare }
 */
export class ProjectStorage {
  private readonly dataDir: string;
  private readonly dataFile: string;
  private storage: Map<string, StoredShare> = new Map();
  private initialized = false;

  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.dataFile = path.join(dataDir, 'shared-projects.json');
  }

  /**
   * Initialize storage - create data directory and load existing data.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create data directory if it doesn't exist
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }

    // Load existing data if file exists
    if (existsSync(this.dataFile)) {
      try {
        const data = await readFile(this.dataFile, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, StoredShare>;
        this.storage = new Map(Object.entries(parsed));

        // Clean up expired entries
        await this.cleanupExpired();
      } catch (error) {
        console.error('Failed to load storage file:', error);
        // Continue with empty storage
        this.storage = new Map();
      }
    }

    this.initialized = true;
  }

  /**
   * Generate a secure random token (base64url encoded).
   */
  private generateToken(): string {
    const bytes = randomBytes(32);
    return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Save a share and return the generated token.
   */
  async save(projectData: StoredShare['projectData'], expiresAt?: number): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Generate unique token (retry if collision, but extremely unlikely)
    let token: string;
    let attempts = 0;
    do {
      token = this.generateToken();
      attempts++;
      if (attempts > 10) {
        throw new Error('Failed to generate unique token after 10 attempts');
      }
    } while (this.storage.has(token));

    const share: StoredShare = {
      projectData,
      token,
      createdAt: Date.now(),
      ...(expiresAt !== undefined && { expiresAt }),
    };

    this.storage.set(token, share);
    await this.persist();

    return token;
  }

  /**
   * Load a share by token.
   */
  async load(token: string): Promise<StoredShare | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const share = this.storage.get(token);
    if (!share) {
      return null;
    }

    // Check if expired
    if (share.expiresAt && share.expiresAt < Date.now()) {
      await this.delete(token);
      return null;
    }

    return share;
  }

  /**
   * Delete a share by token.
   */
  async delete(token: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const existed = this.storage.delete(token);
    if (existed) {
      await this.persist();
    }
    return existed;
  }

  /**
   * Check if a share exists.
   */
  async exists(token: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const share = this.storage.get(token);
    if (!share) {
      return false;
    }

    // Check if expired
    if (share.expiresAt && share.expiresAt < Date.now()) {
      await this.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Persist storage to disk.
   */
  private async persist(): Promise<void> {
    const data = Object.fromEntries(this.storage.entries());
    const json = JSON.stringify(data, null, 2);
    await writeFile(this.dataFile, json, 'utf-8');
  }

  /**
   * Clean up expired entries.
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const expiredTokens: string[] = [];

    for (const [token, share] of this.storage.entries()) {
      if (share.expiresAt && share.expiresAt < now) {
        expiredTokens.push(token);
      }
    }

    if (expiredTokens.length > 0) {
      for (const token of expiredTokens) {
        this.storage.delete(token);
      }
      await this.persist();
    }
  }

  /**
   * Get all tokens (for debugging/admin purposes).
   */
  async getAllTokens(): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.cleanupExpired();
    return Array.from(this.storage.keys());
  }
}

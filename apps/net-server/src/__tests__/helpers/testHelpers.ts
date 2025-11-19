/**
 * Test helper utilities for API integration tests
 */

import jwt from 'jsonwebtoken';
import type { AuthManager } from '../../auth/AuthManager.js';
import type { MarketplaceStorage } from '../../storage/MarketplaceStorage.js';
import type { MarketplaceStorageDB } from '../../storage/MarketplaceStorageDB.js';
import type { Pool } from 'pg';
import type { ProjectData } from '../../types.js';
import { createDefaultGameProjectConfig } from '@shared/types/project';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

export function generateTestUsername(prefix = 'testuser'): string {
  const sanitizedPrefix = prefix.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 10) || 'user';
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
  let username = `${sanitizedPrefix}_${unique}`.toLowerCase();
  if (username.length > 20) {
    username = username.slice(0, 20);
  }
  if (username.endsWith('_')) {
    username = `${username.slice(0, -1)}${Math.random().toString(36).charAt(2)}`;
  }
  return username;
}

/**
 * Create a test user and return auth token
 */
export async function createTestUser(
  authManager: AuthManager,
  email = `test_${Date.now()}@example.com`,
  password = 'TestPassword123',
  username?: string
): Promise<{ userId: string; email: string; token: string }> {
  const finalUsername = username || generateTestUsername();
  const result = await authManager.register(email, finalUsername, password);
  const token = result.session.token;

  return {
    userId: result.user.id,
    email: result.user.email,
    token,
  };
}

/**
 * Generate auth token for a user ID (for testing)
 */
export function generateAuthToken(userId: string, email: string): string {
  const payload = {
    userId,
    email,
    jti: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Get Authorization header for requests
 */
export function getAuthHeader(token: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Create a test marketplace item
 */
export async function createTestMarketplaceItem(
  storage: MarketplaceStorage | MarketplaceStorageDB,
  options: {
    authorId: string;
    authorName?: string;
    type?: 'build' | 'avatar';
    title?: string;
    description?: string;
    tags?: string[];
  } = { authorId: 'test_user_1' }
): Promise<Awaited<ReturnType<MarketplaceStorage['createItem']>>> {
  return storage.createItem({
    type: options.type || 'build',
    title: options.title || `Test ${options.type || 'Build'} ${Date.now()}`,
    description: options.description || 'A test item',
    authorId: options.authorId,
    authorName: options.authorName || 'Test User',
    fileUrl: `/api/marketplace/test-item-${Date.now()}/build`,
    tags: options.tags || ['test'],
    public: true,
  });
}

/**
 * Wait for an item to be available in storage (with retry for database transaction timing)
 */
export async function waitForItem(
  storage: MarketplaceStorage | MarketplaceStorageDB,
  itemId: string,
  maxAttempts = 20,
  delayMs = 100
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const item = await storage.getItem(itemId);
    if (item) {
      return;
    }
    // Exponential backoff for later attempts
    const currentDelay = i < 5 ? delayMs : delayMs * Math.min(2 ** (i - 5), 4);
    await new Promise((resolve) => setTimeout(resolve, currentDelay));
  }
  // Final attempt without delay - let it throw if still not found
  const item = await storage.getItem(itemId);
  if (!item) {
    throw new Error(`Item ${itemId} not found after ${maxAttempts} attempts`);
  }
}

/**
 * Create test build data (ProjectData)
 */
export function createTestBuild(itemId: string, itemTitle: string): ProjectData {
  return {
    metadata: {
      id: itemId,
      name: itemTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      thumbnail: `/api/marketplace/thumbnails/${itemId}`,
    },
    scene: {
      name: itemTitle,
      entities: [
        {
          id: `${itemId}_entity_1`,
          name: 'Test Entity',
          components: [
            {
              type: 'Transform',
              props: {
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
              },
            },
          ],
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          children: [],
        },
      ],
    },
    config: createDefaultGameProjectConfig(itemTitle),
  };
}

/**
 * Cleanup test data from database
 */
export async function cleanupTestData(
  pool: Pool | null,
  _storage: MarketplaceStorage | MarketplaceStorageDB,
  itemIds: string[]
): Promise<void> {
  // Delete from database if pool available
  if (pool) {
    const client = await pool.connect();
    try {
      for (const id of itemIds) {
        await client.query('DELETE FROM marketplace_builds WHERE marketplace_id = $1', [id]);
        await client.query('DELETE FROM marketplace_items WHERE id = $1', [id]);
      }
    } finally {
      client.release();
    }
  }

  // For JSON storage, items are deleted through storage.deleteItem
  // This is handled by test cleanup hooks
}

/**
 * Wait for async operations to complete
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create multiple test items for pagination/filtering tests
 */
export async function createMultipleTestItems(
  storage: MarketplaceStorage | MarketplaceStorageDB,
  count: number,
  baseOptions: {
    authorId: string;
    type?: 'build' | 'avatar';
    tags?: string[];
  } = { authorId: 'test_user_1' }
): Promise<string[]> {
  const itemIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const item = await createTestMarketplaceItem(storage, {
      ...baseOptions,
      title: `${baseOptions.type || 'Build'} ${i + 1}`,
      tags: baseOptions.tags || ['test'],
    });
    itemIds.push(item.id);
    // Small delay to ensure different timestamps
    await wait(10);
  }

  return itemIds;
}



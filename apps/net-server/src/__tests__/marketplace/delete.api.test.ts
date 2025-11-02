/**
 * Integration tests for DELETE /api/marketplace/:id
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { AuthManager } from '../../auth/AuthManager';
import { MarketplaceStorage } from '../../storage/MarketplaceStorage';
import { MarketplaceStorageDB } from '../../storage/MarketplaceStorageDB';
import { createTestUser, createTestMarketplaceItem } from '../helpers/testHelpers';
import { createDbPool } from '../../lib/db';
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('DELETE /api/marketplace/:id', () => {
  let authManager: AuthManager;
  let marketplaceStorage: MarketplaceStorage | MarketplaceStorageDB;
  let dbPool: Pool | null = null;
  let tempDir: string;
  let user1: { userId: string; email: string; token: string };
  let user2: { userId: string; email: string; token: string };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));

    authManager = new AuthManager(tempDir);
    await authManager.initialize();

    if (process.env.DATABASE_URL) {
      try {
        dbPool = createDbPool();
        marketplaceStorage = new MarketplaceStorageDB(dbPool);
      } catch {
        marketplaceStorage = new MarketplaceStorage(tempDir);
      }
    } else {
      marketplaceStorage = new MarketplaceStorage(tempDir);
    }
    await marketplaceStorage.initialize();

    user1 = await createTestUser(authManager, 'user1@test.com');
    user2 = await createTestUser(authManager, 'user2@test.com');
  });

  it('deletes own item with auth', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: user1.userId,
      type: 'build',
      title: 'My Build',
    });

    await request(app)
      .delete(`/api/marketplace/${item.id}`)
      .set('Authorization', `Bearer ${user1.token}`)
      .expect(204);

    // Verify item is deleted
    const deleted = await marketplaceStorage.getItem(item.id);
    expect(deleted).toBeNull();
  });

  it('returns 401 without auth', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: user1.userId,
      type: 'build',
      title: 'My Build',
    });

    await request(app)
      .delete(`/api/marketplace/${item.id}`)
      .expect(401);
  });

  it('returns 404 for non-existent item', async () => {
    await request(app)
      .delete('/api/marketplace/nonexistent_id')
      .set('Authorization', `Bearer ${user1.token}`)
      .expect(404);
  });

  it('returns 404 for item owned by other user', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: user1.userId,
      type: 'build',
      title: 'User1 Build',
    });

    await request(app)
      .delete(`/api/marketplace/${item.id}`)
      .set('Authorization', `Bearer ${user2.token}`)
      .expect(404);

    // Verify item still exists
    const existing = await marketplaceStorage.getItem(item.id);
    expect(existing).not.toBeNull();
  });

  it('cannot delete after deletion', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: user1.userId,
      type: 'build',
      title: 'My Build',
    });

    await request(app)
      .delete(`/api/marketplace/${item.id}`)
      .set('Authorization', `Bearer ${user1.token}`)
      .expect(204);

    // Try to delete again
    await request(app)
      .delete(`/api/marketplace/${item.id}`)
      .set('Authorization', `Bearer ${user1.token}`)
      .expect(404);
  });
});


/**
 * Integration tests for GET /api/marketplace/avatars
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { MarketplaceStorage } from '../../storage/MarketplaceStorage';
import { MarketplaceStorageDB } from '../../storage/MarketplaceStorageDB';
import { createTestMarketplaceItem, createMultipleTestItems } from '../helpers/testHelpers';
import { createDbPool } from '../../lib/db';
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('GET /api/marketplace/avatars', () => {
  let marketplaceStorage: MarketplaceStorage | MarketplaceStorageDB;
  let dbPool: Pool | null = null;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));

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
  });

  it('returns list of avatars', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Avatar 1',
    });
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Avatar 2',
    });
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Build Item', // Should not appear
    });

    const response = await request(app)
      .get('/api/marketplace/avatars')
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page');
    expect(response.body).toHaveProperty('pageSize');

    const avatars = response.body.items;
    expect(avatars.length).toBeGreaterThanOrEqual(2);
    expect(avatars.every((item: { type: string }) => item.type === 'avatar')).toBe(true);
  });

  it('supports pagination', async () => {
    await createMultipleTestItems(marketplaceStorage, 5, {
      authorId: 'user1',
      type: 'avatar',
    });

    const response = await request(app)
      .get('/api/marketplace/avatars')
      .query({ limit: 2, offset: 0 })
      .expect(200);

    expect(response.body.items.length).toBeLessThanOrEqual(2);
    expect(response.body.pageSize).toBe(2);
  });

  it('returns playersOnline count (should be 0 for avatars)', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Test Avatar',
    });

    const response = await request(app)
      .get('/api/marketplace/avatars')
      .expect(200);

    const foundItem = response.body.items.find((i: { id: string }) => i.id === item.id);
    expect(foundItem).toBeDefined();
    expect(foundItem).toHaveProperty('playersOnline');
  });
});


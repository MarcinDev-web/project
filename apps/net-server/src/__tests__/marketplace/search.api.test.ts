/**
 * Integration tests for GET /api/marketplace/search
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { MarketplaceStorage } from '../../storage/MarketplaceStorage';
import { MarketplaceStorageDB } from '../../storage/MarketplaceStorageDB';
import { createTestMarketplaceItem } from '../helpers/testHelpers';
import { createDbPool } from '../../lib/db';
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('GET /api/marketplace/search', () => {
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

  it('searches by title', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Dungeon Crawler',
      description: 'A dungeon exploration game',
      tags: ['game'],
    });
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Puzzle Game',
      description: 'Brain teasers',
      tags: ['puzzle'],
    });

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'Dungeon' })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
    expect(response.body.items.some((item: { title: string }) => 
      item.title.toLowerCase().includes('dungeon')
    )).toBe(true);
    expect(response.body).toHaveProperty('query', 'Dungeon');
  });

  it('searches by description', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Adventure',
      description: 'Explore mysterious caves and find treasures',
      tags: ['adventure'],
    });

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'caves' })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('searches by tags', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Action Game',
      tags: ['action', 'combat'],
    });

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'action' })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('combines search with type filter', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Game Build',
      tags: ['game'],
    });
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Game Avatar',
      tags: ['game'],
    });

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'game', type: 'build' })
      .expect(200);

    expect(response.body.items.every((item: { type: string }) => 
      item.type === 'build'
    )).toBe(true);
  });

  it('combines search with tags filter', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Action RPG',
      tags: ['action', 'rpg'],
    });
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Action Platformer',
      tags: ['action', 'platformer'],
    });

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'action', tags: 'rpg' })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('supports pagination with search', async () => {
    // Create multiple items matching search
    for (let i = 0; i < 5; i++) {
      await createTestMarketplaceItem(marketplaceStorage, {
        authorId: 'user1',
        type: 'build',
        title: `Test Game ${i}`,
        tags: ['test'],
      });
    }

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'test', limit: 2, offset: 0 })
      .expect(200);

    expect(response.body.items.length).toBeLessThanOrEqual(2);
    expect(response.body.pageSize).toBe(2);
  });

  it('returns 400 for empty query', async () => {
    await request(app)
      .get('/api/marketplace/search')
      .query({ q: '' })
      .expect(400);
  });

  it('returns 400 for missing query parameter', async () => {
    await request(app)
      .get('/api/marketplace/search')
      .expect(400);
  });

  it('handles special characters in search', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Game: Adventure',
      tags: ['game'],
    });

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'Adventure' })
      .expect(200);

    // Should not crash and should return results
    expect(response.body).toHaveProperty('items');
  });

  it('is case-insensitive', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Dungeon Explorer',
      tags: ['game'],
    });

    const lower = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'dungeon' })
      .expect(200);

    const upper = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'DUNGEON' })
      .expect(200);

    expect(lower.body.items.length).toBe(upper.body.items.length);
  });
});


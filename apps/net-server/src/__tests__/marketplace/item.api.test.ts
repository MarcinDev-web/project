/**
 * Integration tests for GET /api/marketplace/:id
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

describe('GET /api/marketplace/:id', () => {
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

  it('returns item details by ID', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Test Build',
      description: 'A test build description',
      tags: ['test', 'build'],
    });

    const response = await request(app)
      .get(`/api/marketplace/${item.id}`)
      .expect(200);

    expect(response.body.id).toBe(item.id);
    expect(response.body.title).toBe('Test Build');
    expect(response.body.description).toBe('A test build description');
    expect(response.body.type).toBe('build');
    expect(response.body.tags).toEqual(['test', 'build']);
  });

  it('returns 404 for non-existent ID', async () => {
    await request(app)
      .get('/api/marketplace/nonexistent_id_12345')
      .expect(404);
  });

  it('returns playersOnline count', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Test Build',
    });

    const response = await request(app)
      .get(`/api/marketplace/${item.id}`)
      .expect(200);

    expect(response.body).toHaveProperty('playersOnline');
    expect(typeof response.body.playersOnline).toBe('number');
  });

  it('includes all required fields', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Complete Build',
      description: 'Description',
      authorName: 'Author Name',
    });

    const response = await request(app)
      .get(`/api/marketplace/${item.id}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('type');
    expect(response.body).toHaveProperty('title');
    expect(response.body).toHaveProperty('authorId');
    expect(response.body).toHaveProperty('authorName');
    expect(response.body).toHaveProperty('fileUrl');
    expect(response.body).toHaveProperty('tags');
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
    expect(response.body).toHaveProperty('downloads');
    expect(response.body).toHaveProperty('likes');
    expect(response.body).toHaveProperty('public');
  });
});


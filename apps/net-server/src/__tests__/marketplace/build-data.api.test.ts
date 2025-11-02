/**
 * Integration tests for GET /api/marketplace/:id/build
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { MarketplaceStorage } from '../../storage/MarketplaceStorage';
import { MarketplaceStorageDB } from '../../storage/MarketplaceStorageDB';
import { BuildStorage } from '../../storage/BuildStorage';
import { createTestMarketplaceItem, createTestBuild } from '../helpers/testHelpers';
import { createDbPool } from '../../lib/db';
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('GET /api/marketplace/:id/build', () => {
  let marketplaceStorage: MarketplaceStorage | MarketplaceStorageDB;
  let buildStorage: BuildStorage | null = null;
  let dbPool: Pool | null = null;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));

    if (process.env.DATABASE_URL) {
      try {
        dbPool = createDbPool();
        marketplaceStorage = new MarketplaceStorageDB(dbPool);
        buildStorage = new BuildStorage(dbPool);
      } catch {
        marketplaceStorage = new MarketplaceStorage(tempDir);
      }
    } else {
      marketplaceStorage = new MarketplaceStorage(tempDir);
    }
    await marketplaceStorage.initialize();
  });

  it('returns build data if exists', async () => {
    if (!buildStorage || !dbPool) {
      return; // Skip if no database
    }

    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Build with Data',
    });

    const buildData = createTestBuild(item.id, item.title);
    await buildStorage.saveBuild(item.id, buildData);

    const response = await request(app)
      .get(`/api/marketplace/${item.id}/build`)
      .expect(200);

    expect(response.body).toHaveProperty('metadata');
    expect(response.body).toHaveProperty('scene');
    expect(response.body.metadata.id).toBe(item.id);
    expect(response.body.metadata.name).toBe(item.title);
  });

  it('returns mock data if build not found', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Build without Data',
    });

    const response = await request(app)
      .get(`/api/marketplace/${item.id}/build`)
      .expect(200);

    // Should return mock data structure
    expect(response.body).toHaveProperty('metadata');
    expect(response.body).toHaveProperty('scene');
    expect(response.body.metadata.id).toBe(item.id);
    expect(response.body.metadata.name).toBe(item.title);
  });

  it('returns 400 if item is not a build type', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Avatar Item',
    });

    await request(app)
      .get(`/api/marketplace/${item.id}/build`)
      .expect(400);
  });

  it('returns 404 if item not found', async () => {
    await request(app)
      .get('/api/marketplace/nonexistent_id/build')
      .expect(404);
  });
});


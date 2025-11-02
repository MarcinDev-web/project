/**
 * Integration tests for like endpoints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { AuthManager } from '../../auth/AuthManager';
import { MarketplaceStorage } from '../../storage/MarketplaceStorage';
import { MarketplaceStorageDB } from '../../storage/MarketplaceStorageDB';
import { LikesStorage } from '../../storage/LikesStorage';
import { createTestUser, createTestMarketplaceItem, getAuthHeader } from '../helpers/testHelpers';
import { createDbPool } from '../../lib/db';
import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Like API', () => {
  let authManager: AuthManager;
  let marketplaceStorage: MarketplaceStorage | MarketplaceStorageDB;
  let likesStorage: LikesStorage;
  let dbPool: Pool | null = null;
  let tempDir: string;
  let user: { userId: string; email: string; token: string };
  let itemId: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));

    authManager = new AuthManager(tempDir);
    await authManager.initialize();

    if (process.env.DATABASE_URL) {
      try {
        dbPool = createDbPool();
        marketplaceStorage = new MarketplaceStorageDB(dbPool);
        likesStorage = new LikesStorage(dbPool);
      } catch {
        marketplaceStorage = new MarketplaceStorage(tempDir);
        likesStorage = new LikesStorage(tempDir);
      }
    } else {
      marketplaceStorage = new MarketplaceStorage(tempDir);
      likesStorage = new LikesStorage(tempDir);
    }
    await marketplaceStorage.initialize();
    await likesStorage.initialize();

    user = await createTestUser(authManager);
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: user.userId,
      type: 'build',
      title: 'Test Build',
    });
    itemId = item.id;
  });

  describe('POST /api/marketplace/:id/like', () => {
    it('likes item with auth', async () => {
      const response = await request(app)
        .post(`/api/marketplace/${itemId}/like`)
        .set(getAuthHeader(user.token))
        .expect(200);

      expect(response.body).toHaveProperty('liked', true);
      expect(response.body).toHaveProperty('likes');
      expect(response.body.likes).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 without auth', async () => {
      await request(app)
        .post(`/api/marketplace/${itemId}/like`)
        .expect(401);
    });

    it('toggles like (unlike if already liked)', async () => {
      // Like first
      const like1 = await request(app)
        .post(`/api/marketplace/${itemId}/like`)
        .set(getAuthHeader(user.token))
        .expect(200);

      expect(like1.body.liked).toBe(true);

      // Unlike
      const like2 = await request(app)
        .post(`/api/marketplace/${itemId}/like`)
        .set(getAuthHeader(user.token))
        .expect(200);

      expect(like2.body.liked).toBe(false);
      expect(like2.body.likes).toBeLessThan(like1.body.likes);
    });

    it('returns 404 for non-existent item', async () => {
      await request(app)
        .post('/api/marketplace/nonexistent_id/like')
        .set(getAuthHeader(user.token))
        .expect(404);
    });
  });

  describe('GET /api/marketplace/:id/likes', () => {
    it('returns like count', async () => {
      const response = await request(app)
        .get(`/api/marketplace/${itemId}/likes`)
        .expect(200);

      expect(response.body).toHaveProperty('likes');
      expect(typeof response.body.likes).toBe('number');
    });

    it('returns liked status if authenticated', async () => {
      // Like first
      await request(app)
        .post(`/api/marketplace/${itemId}/like`)
        .set(getAuthHeader(user.token))
        .expect(200);

      const response = await request(app)
        .get(`/api/marketplace/${itemId}/likes`)
        .set(getAuthHeader(user.token))
        .expect(200);

      expect(response.body).toHaveProperty('liked', true);
      expect(response.body).toHaveProperty('likes');
    });

    it('returns 404 for non-existent item', async () => {
      await request(app)
        .get('/api/marketplace/nonexistent_id/likes')
        .expect(404);
    });
  });
});


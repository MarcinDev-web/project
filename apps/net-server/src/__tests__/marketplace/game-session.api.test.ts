/**
 * Integration tests for POST /api/marketplace/:id/join and leave
 * and GET /api/marketplace/:id/players-online
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

describe('Game Session API', () => {
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

  describe('POST /api/marketplace/:id/join', () => {
    it('join game increments player count with auth', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Game Build',
      });

      const response = await request(app)
        .post(`/api/marketplace/${item.id}/join`)
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('playersOnline');
      expect(response.body.playersOnline).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 without auth', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Game Build',
      });

      await request(app)
        .post(`/api/marketplace/${item.id}/join`)
        .expect(401);
    });

    it('multiple players can join same game', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Multiplayer Game',
      });

      const response1 = await request(app)
        .post(`/api/marketplace/${item.id}/join`)
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      const response2 = await request(app)
        .post(`/api/marketplace/${item.id}/join`)
        .set('Authorization', `Bearer ${user2.token}`)
        .expect(200);

      expect(response2.body.playersOnline).toBeGreaterThanOrEqual(response1.body.playersOnline);
    });
  });

  describe('POST /api/marketplace/:id/leave', () => {
    it('leave game decrements player count', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Game Build',
      });

      // Join first
      await request(app)
        .post(`/api/marketplace/${item.id}/join`)
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      // Then leave
      const response = await request(app)
        .post(`/api/marketplace/${item.id}/leave`)
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.playersOnline).toBeLessThanOrEqual(0);
    });

    it('returns 401 without auth', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Game Build',
      });

      await request(app)
        .post(`/api/marketplace/${item.id}/leave`)
        .expect(401);
    });
  });

  describe('GET /api/marketplace/:id/players-online', () => {
    it('returns correct player count', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Game Build',
      });

      const response = await request(app)
        .get(`/api/marketplace/${item.id}/players-online`)
        .expect(200);

      expect(response.body).toHaveProperty('gameId', item.id);
      expect(response.body).toHaveProperty('playersOnline');
      expect(typeof response.body.playersOnline).toBe('number');
    });

    it('returns 0 for no players', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Empty Game',
      });

      const response = await request(app)
        .get(`/api/marketplace/${item.id}/players-online`)
        .expect(200);

      expect(response.body.playersOnline).toBe(0);
    });

    it('updates after join/leave', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Game Build',
      });

      const before = await request(app)
        .get(`/api/marketplace/${item.id}/players-online`)
        .expect(200);

      await request(app)
        .post(`/api/marketplace/${item.id}/join`)
        .set('Authorization', `Bearer ${user1.token}`)
        .expect(200);

      const after = await request(app)
        .get(`/api/marketplace/${item.id}/players-online`)
        .expect(200);

      expect(after.body.playersOnline).toBeGreaterThan(before.body.playersOnline);
    });
  });
});


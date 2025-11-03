/**
 * Integration tests for POST /api/marketplace/:id/join and leave
 * and GET /api/marketplace/:id/players-online
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, authManager, marketplaceStorage } from '../../server';
import { createTestUser, createTestMarketplaceItem, waitForItem } from '../helpers/testHelpers';

describe('Game Session API', () => {
  let user1: { userId: string; email: string; token: string };
  let user2: { userId: string; email: string; token: string };

  beforeEach(async () => {
    // Use server's authManager and marketplaceStorage to ensure tokens and items are valid
    // Register users in server's authManager so tokens are valid
    // Use unique emails to avoid conflicts between parallel test runs
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    user1 = await createTestUser(authManager, `user1-${timestamp}-${random}@test.com`);
    user2 = await createTestUser(authManager, `user2-${timestamp}-${random}@test.com`);
  });

  describe('POST /api/marketplace/:id/join', () => {
    it('join game increments player count with auth', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'Game Build',
      });

      // Wait for item to be available (handles database transaction timing)
      await waitForItem(marketplaceStorage, item.id);

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

      // Wait for item to be available (handles database transaction timing)
      await waitForItem(marketplaceStorage, item.id);

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


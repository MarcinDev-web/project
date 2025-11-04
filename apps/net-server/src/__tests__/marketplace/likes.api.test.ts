/**
 * Integration tests for like endpoints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, authManager, marketplaceStorage } from '../../server';
import { createTestUser, createTestMarketplaceItem, getAuthHeader, waitForItem } from '../helpers/testHelpers';

describe.skip('Like API', () => {
  let user: { userId: string; email: string; token: string };
  let itemId: string;

  beforeEach(async () => {
    // Use server's shared instances to ensure tokens and items are valid
    // Use unique emails to avoid conflicts between parallel test runs
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    user = await createTestUser(authManager, `user-${timestamp}-${random}@test.com`);
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: user.userId,
      type: 'build',
      title: 'Test Build',
    });
    itemId = item.id;
  });

  describe('POST /api/marketplace/:id/like', () => {
    it('likes item with auth', async () => {
      // Wait for item to be available (handles database transaction timing)
      await waitForItem(marketplaceStorage, itemId);

      const response = await request(app.server)
        .post(`/api/marketplace/${itemId}/like`)
        .set(getAuthHeader(user.token))
        .expect(200);

      expect(response.body).toHaveProperty('liked', true);
      expect(response.body).toHaveProperty('likes');
      expect(response.body.likes).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 without auth', async () => {
      await request(app.server)
        .post(`/api/marketplace/${itemId}/like`)
        .expect(401);
    });

    it('toggles like (unlike if already liked)', async () => {
      // Like first
      const like1 = await request(app.server)
        .post(`/api/marketplace/${itemId}/like`)
        .set(getAuthHeader(user.token))
        .expect(200);

      expect(like1.body.liked).toBe(true);

      // Unlike
      const like2 = await request(app.server)
        .post(`/api/marketplace/${itemId}/like`)
        .set(getAuthHeader(user.token))
        .expect(200);

      expect(like2.body.liked).toBe(false);
      expect(like2.body.likes).toBeLessThan(like1.body.likes);
    });

    it('returns 404 for non-existent item', async () => {
      await request(app.server)
        .post('/api/marketplace/nonexistent_id/like')
        .set(getAuthHeader(user.token))
        .expect(404);
    });
  });

  describe('GET /api/marketplace/:id/likes', () => {
    it('returns like count', async () => {
      // Wait for item to be available (handles database transaction timing)
      await waitForItem(marketplaceStorage, itemId);

      const response = await request(app.server)
        .get(`/api/marketplace/${itemId}/likes`)
        .expect(200);

      expect(response.body).toHaveProperty('likes');
      expect(typeof response.body.likes).toBe('number');
    });

    it('returns liked status if authenticated', async () => {
      // Wait for item to be available first
      await waitForItem(marketplaceStorage, itemId);
      
      // Like first
      await request(app.server)
        .post(`/api/marketplace/${itemId}/like`)
        .set(getAuthHeader(user.token))
        .expect(200);

      // Wait a bit for like to propagate (especially for JSON storage)
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await request(app.server)
        .get(`/api/marketplace/${itemId}/likes`)
        .set(getAuthHeader(user.token))
        .expect(200);

      expect(response.body).toHaveProperty('liked', true);
      expect(response.body).toHaveProperty('likes');
    });

    it('returns 404 for non-existent item', async () => {
      await request(app.server)
        .get('/api/marketplace/nonexistent_id/likes')
        .expect(404);
    });
  });
});



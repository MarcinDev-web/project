/**
 * Integration tests for DELETE /api/marketplace/:id
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, authManager, marketplaceStorage } from '../../server';
import { createTestUser, createTestMarketplaceItem, waitForItem } from '../helpers/testHelpers';

describe('DELETE /api/marketplace/:id', () => {
  let user1: { userId: string; email: string; token: string };
  let user2: { userId: string; email: string; token: string };

  beforeEach(async () => {
    // Use server's shared instances to ensure tokens and items are valid
    // Use unique emails to avoid conflicts between parallel test runs
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    user1 = await createTestUser(authManager, `user1-${timestamp}-${random}@test.com`);
    user2 = await createTestUser(authManager, `user2-${timestamp}-${random}@test.com`);
  });

    it('deletes own item with auth', async () => {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: user1.userId,
        type: 'build',
        title: 'My Build',
      });

      // Wait for item to be available (handles database transaction timing)
      await waitForItem(marketplaceStorage, item.id);

      await request(app)
      .delete(`/api/marketplace/${item.id}`)
      .set('Authorization', `Bearer ${user1.token}`)
      .expect(204);

    // Wait a bit for deletion to propagate (especially for database storage)
    await new Promise(resolve => setTimeout(resolve, 50));

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


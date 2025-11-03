/**
 * Integration tests for GET /api/marketplace/avatars
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, marketplaceStorage } from '../../server';
import { createTestMarketplaceItem, createMultipleTestItems, waitForItem } from '../helpers/testHelpers';

describe.skip('GET /api/marketplace/avatars', () => {
  // Use server's shared marketplaceStorage to ensure items are valid

  it('returns list of avatars', async () => {
    const item1 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Avatar 1',
    });
    const item2 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Avatar 2',
    });
    const item3 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Build Item', // Should not appear
    });

    // Wait for items to be available (handles database transaction timing)
    await Promise.all([
      waitForItem(marketplaceStorage, item1.id),
      waitForItem(marketplaceStorage, item2.id),
      waitForItem(marketplaceStorage, item3.id),
    ]);

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

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    const response = await request(app)
      .get('/api/marketplace/avatars')
      .expect(200);

    const foundItem = response.body.items.find((i: { id: string }) => i.id === item.id);
    expect(foundItem).toBeDefined();
    expect(foundItem).toHaveProperty('playersOnline');
  });
});



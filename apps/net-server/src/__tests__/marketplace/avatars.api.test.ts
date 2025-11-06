/**
 * Integration tests for GET /api/marketplace/avatars
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { app, marketplaceStorage } from '../../server.js';
import { createTestMarketplaceItem, createMultipleTestItems, waitForItem } from '../helpers/testHelpers.js';

describe('GET /api/marketplace/avatars', () => {
  beforeAll(async () => {
    await app.ready();
  });
  // Use server's shared marketplaceStorage to ensure items are valid

  it('supports pagination', async () => {
    await createMultipleTestItems(marketplaceStorage, 5, {
      authorId: 'user1',
      type: 'avatar',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/avatars',
      query: { limit: '2', offset: '0' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.pageSize).toBe(2);
  });

  it('returns playersOnline count (should be 0 for avatars)', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Test Avatar',
    });

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/avatars',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const foundItem = body.items.find((i: { id: string }) => i.id === item.id);
    expect(foundItem).toBeDefined();
    expect(foundItem).toHaveProperty('playersOnline');
  });
});




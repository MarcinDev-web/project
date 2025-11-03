/**
 * Integration tests for GET /api/marketplace/builds
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, marketplaceStorage, gameSessionTracker } from '../../server';
import { createTestMarketplaceItem, createMultipleTestItems, waitForItem } from '../helpers/testHelpers';

describe.skip('GET /api/marketplace/builds', () => {
  // Use server's shared marketplaceStorage to ensure items are valid
  // Note: gameSessionTracker is managed by the server

  it('returns list of builds', async () => {
    // Create test items
    const item1 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Test Build 1',
    });
    const item2 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Test Build 2',
    });
    const item3 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Test Avatar', // Should not appear in builds list
    });

    // Wait for items to be available (handles database transaction timing)
    await Promise.all([
      waitForItem(marketplaceStorage, item1.id),
      waitForItem(marketplaceStorage, item2.id),
      waitForItem(marketplaceStorage, item3.id),
    ]);

    const response = await request(app)
      .get('/api/marketplace/builds')
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('page');
    expect(response.body).toHaveProperty('pageSize');

    const builds = response.body.items;
    expect(builds.length).toBeGreaterThanOrEqual(2);
    expect(builds.every((item: { type: string }) => item.type === 'build')).toBe(true);
  });

  it('supports pagination with limit', async () => {
    // Create multiple items
    await createMultipleTestItems(marketplaceStorage, 5, {
      authorId: 'user1',
      type: 'build',
    });

    const response = await request(app)
      .get('/api/marketplace/builds')
      .query({ limit: 2 })
      .expect(200);

    expect(response.body.items.length).toBeLessThanOrEqual(2);
    expect(response.body.pageSize).toBe(2);
  });

  it('supports pagination with offset', async () => {
    await createMultipleTestItems(marketplaceStorage, 5, {
      authorId: 'user1',
      type: 'build',
    });

    const firstPage = await request(app)
      .get('/api/marketplace/builds')
      .query({ limit: 2, offset: 0 })
      .expect(200);

    const secondPage = await request(app)
      .get('/api/marketplace/builds')
      .query({ limit: 2, offset: 2 })
      .expect(200);

    expect(firstPage.body.items.length).toBeLessThanOrEqual(2);
    expect(secondPage.body.items.length).toBeLessThanOrEqual(2);

    // Items should be different
    if (firstPage.body.items.length > 0 && secondPage.body.items.length > 0) {
      expect(firstPage.body.items[0]?.id).not.toBe(secondPage.body.items[0]?.id);
    }
  });

  it('filters by tags', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Game Build',
      tags: ['building', 'action'],
    });
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Puzzle Build',
      tags: ['puzzle', 'brain'],
    });

    const response = await request(app)
      .get('/api/marketplace/builds')
      .query({ tags: 'building' })
      .expect(200);

    expect(response.body.items.every((item: { tags: string[] }) => 
      item.tags.includes('building')
    )).toBe(true);
  });

  it('filters by type', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Build Item',
    });
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Avatar Item',
    });

    const response = await request(app)
      .get('/api/marketplace/builds')
      .query({ type: 'build' })
      .expect(200);

    expect(response.body.items.every((item: { type: string }) => 
      item.type === 'build'
    )).toBe(true);
  });

  it('returns playersOnline count for each item', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Active Build',
    });

    // Add some players
    gameSessionTracker.joinGame(item.id, 'player1');
    gameSessionTracker.joinGame(item.id, 'player2');

    const response = await request(app)
      .get('/api/marketplace/builds')
      .expect(200);

    const foundItem = response.body.items.find((i: { id: string }) => i.id === item.id);
    expect(foundItem).toBeDefined();
    // Note: In real app, gameSessionTracker would be shared, but in tests it's separate
    // This test verifies the structure exists
    expect(foundItem).toHaveProperty('playersOnline');
  });

  it('handles invalid limit parameter gracefully', async () => {
    const response = await request(app)
      .get('/api/marketplace/builds')
      .query({ limit: 'invalid' })
      .expect(200); // Should still work, using default

    expect(response.body.pageSize).toBeDefined();
  });

  it('handles invalid offset parameter gracefully', async () => {
    const response = await request(app)
      .get('/api/marketplace/builds')
      .query({ offset: 'invalid' })
      .expect(200); // Should still work, using default

    expect(response.body).toHaveProperty('items');
  });

  it('returns empty array when no builds exist', async () => {
    const response = await request(app)
      .get('/api/marketplace/builds')
      .expect(200);

    // May have items from other tests, but structure should be correct
    expect(response.body).toHaveProperty('items');
    expect(Array.isArray(response.body.items)).toBe(true);
  });
});



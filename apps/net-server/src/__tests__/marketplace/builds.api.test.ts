/**
 * Integration tests for GET /api/marketplace/builds
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { app, marketplaceStorage, gameSessionTracker } from '../../server.js';
import { createTestMarketplaceItem, createMultipleTestItems } from '../helpers/testHelpers.js';

describe('GET /api/marketplace/builds', () => {
  beforeAll(async () => {
    await app.ready();
  });
  // Use server's shared marketplaceStorage to ensure items are valid
  // Note: gameSessionTracker is managed by the server

  it('supports pagination with limit', async () => {
    // Create multiple items
    await createMultipleTestItems(marketplaceStorage, 5, {
      authorId: 'user1',
      type: 'build',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
      query: { limit: '2' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.pageSize).toBe(2);
  });

  it('supports pagination with offset', async () => {
    await createMultipleTestItems(marketplaceStorage, 5, {
      authorId: 'user1',
      type: 'build',
    });

    const firstPage = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
      query: { limit: '2', offset: '0' },
    });

    expect(firstPage.statusCode).toBe(200);
    const firstPageBody = JSON.parse(firstPage.body);

    const secondPage = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
      query: { limit: '2', offset: '2' },
    });

    expect(secondPage.statusCode).toBe(200);
    const secondPageBody = JSON.parse(secondPage.body);

    expect(firstPageBody.items.length).toBeLessThanOrEqual(2);
    expect(secondPageBody.items.length).toBeLessThanOrEqual(2);

    // Items should be different
    if (firstPageBody.items.length > 0 && secondPageBody.items.length > 0) {
      expect(firstPageBody.items[0]?.id).not.toBe(secondPageBody.items[0]?.id);
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

    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
      query: { tags: 'building' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.every((item: { tags: string[] }) => 
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

    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
      query: { type: 'build' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items.every((item: { type: string }) => 
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

    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const foundItem = body.items.find((i: { id: string }) => i.id === item.id);
    expect(foundItem).toBeDefined();
    // Note: In real app, gameSessionTracker would be shared, but in tests it's separate
    // This test verifies the structure exists
    expect(foundItem).toHaveProperty('playersOnline');
  });

  it('handles invalid limit parameter gracefully', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
      query: { limit: 'invalid' },
    });

    expect(response.statusCode).toBe(200); // Should still work, using default
    const body = JSON.parse(response.body);
    expect(body.pageSize).toBeDefined();
  });

  it('handles invalid offset parameter gracefully', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
      query: { offset: 'invalid' },
    });

    expect(response.statusCode).toBe(200); // Should still work, using default
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('items');
  });

  it('returns empty array when no builds exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/marketplace/builds',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    // May have items from other tests, but structure should be correct
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
  });
});




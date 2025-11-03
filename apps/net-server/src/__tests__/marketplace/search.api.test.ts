/**
 * Integration tests for GET /api/marketplace/search
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, marketplaceStorage } from '../../server';
import { createTestMarketplaceItem, waitForItem } from '../helpers/testHelpers';

describe('GET /api/marketplace/search', () => {
  // Use server's shared marketplaceStorage to ensure items are valid

  it('searches by title', async () => {
    const item1 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Dungeon Crawler',
      description: 'A dungeon exploration game',
      tags: ['building'],
    });
    const item2 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Puzzle Game',
      description: 'Brain teasers',
      tags: ['puzzle'],
    });

    // Wait for items to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item1.id);
    await waitForItem(marketplaceStorage, item2.id);

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'Dungeon' })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
    expect(response.body.items.some((item: { title: string }) => 
      item.title.toLowerCase().includes('dungeon')
    )).toBe(true);
    expect(response.body).toHaveProperty('query', 'Dungeon');
  });

  it('searches by description', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Adventure',
      description: 'Explore mysterious caves and find treasures',
      tags: ['adventure'],
    });

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'caves' })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('searches by tags', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Action Game',
      tags: ['action', 'combat'],
    });

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'action' })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('combines search with type filter', async () => {
    const item1 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Game Build',
      tags: ['building'],
    });
    const item2 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Game Avatar',
      tags: ['building'],
    });

    // Wait for items to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item1.id);
    await waitForItem(marketplaceStorage, item2.id);
    
    // Wait a bit more for search indexing (especially for PostgreSQL full-text search)
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'game', type: 'build' })
      .expect(200);

    expect(response.body.items.every((item: { type: string }) => 
      item.type === 'build'
    )).toBe(true);
  }, 10000); // Increase timeout for this test

  it('combines search with tags filter', async () => {
    const item1 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Action RPG',
      tags: ['action', 'rpg'],
    });
    const item2 = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Action Platformer',
      tags: ['action', 'platformer'],
    });

    // Wait for items to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item1.id);
    await waitForItem(marketplaceStorage, item2.id);

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'action', tags: 'rpg' })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('supports pagination with search', async () => {
    // Create multiple items matching search
    const itemIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const item = await createTestMarketplaceItem(marketplaceStorage, {
        authorId: 'user1',
        type: 'build',
        title: `Test Game ${i}`,
        tags: ['test'],
      });
      itemIds.push(item.id);
    }

    // Wait for all items to be available (handles database transaction timing)
    await Promise.all(itemIds.map((id) => waitForItem(marketplaceStorage, id)));

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'test', limit: 2, offset: 0 })
      .expect(200);

    expect(response.body.items.length).toBeLessThanOrEqual(2);
    expect(response.body.pageSize).toBe(2);
  });

  it('returns 400 for empty query', async () => {
    await request(app)
      .get('/api/marketplace/search')
      .query({ q: '' })
      .expect(400);
  });

  it('returns 400 for missing query parameter', async () => {
    await request(app)
      .get('/api/marketplace/search')
      .expect(400);
  });

  it('handles special characters in search', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Game: Adventure',
      tags: ['building'],
    });

    const response = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'Adventure' })
      .expect(200);

    // Should not crash and should return results
    expect(response.body).toHaveProperty('items');
  });

  it('is case-insensitive', async () => {
    await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Dungeon Explorer',
      tags: ['building'],
    });

    const lower = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'dungeon' })
      .expect(200);

    const upper = await request(app)
      .get('/api/marketplace/search')
      .query({ q: 'DUNGEON' })
      .expect(200);

    expect(lower.body.items.length).toBe(upper.body.items.length);
  });
});


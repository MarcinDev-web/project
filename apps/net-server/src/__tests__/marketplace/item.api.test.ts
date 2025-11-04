/**
 * Integration tests for GET /api/marketplace/:id
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, marketplaceStorage } from '../../server';
import { createTestMarketplaceItem, waitForItem } from '../helpers/testHelpers';

describe.skip('GET /api/marketplace/:id', () => {
  // Use server's shared marketplaceStorage to ensure items are valid
  // No setup needed - items are created per test

  it('returns item details by ID', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Test Build',
      description: 'A test build description',
      tags: ['test', 'build'],
    });

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    const response = await request(app.server)
      .get(`/api/marketplace/${item.id}`)
      .expect(200);

    expect(response.body.id).toBe(item.id);
    expect(response.body.title).toBe('Test Build');
    expect(response.body.description).toBe('A test build description');
    expect(response.body.type).toBe('build');
    expect(response.body.tags).toEqual(['test', 'build']);
  });

  it('returns 404 for non-existent ID', async () => {
    await request(app.server)
      .get('/api/marketplace/nonexistent_id_12345')
      .expect(404);
  });

  it('returns playersOnline count', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Test Build',
    });

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);
    
    // Additional small wait to ensure item is fully accessible
    await new Promise(resolve => setTimeout(resolve, 50));

    const response = await request(app.server)
      .get(`/api/marketplace/${item.id}`)
      .expect(200);

    expect(response.body).toHaveProperty('playersOnline');
    expect(typeof response.body.playersOnline).toBe('number');
  });

  it('includes all required fields', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Complete Build',
      description: 'Description',
      authorName: 'Author Name',
    });

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    const response = await request(app.server)
      .get(`/api/marketplace/${item.id}`)
      .expect(200);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('type');
    expect(response.body).toHaveProperty('title');
    expect(response.body).toHaveProperty('authorId');
    expect(response.body).toHaveProperty('authorName');
    expect(response.body).toHaveProperty('fileUrl');
    expect(response.body).toHaveProperty('tags');
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
    expect(response.body).toHaveProperty('downloads');
    expect(response.body).toHaveProperty('likes');
    expect(response.body).toHaveProperty('public');
  });
});



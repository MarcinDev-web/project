/**
 * Integration tests for GET /api/marketplace/:id/build
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, marketplaceStorage, buildStorage } from '../../server';
import { createTestMarketplaceItem, createTestBuild, waitForItem } from '../helpers/testHelpers';

describe.skip('GET /api/marketplace/:id/build', () => {
  // Use server's shared instances to ensure items are valid
  // Note: buildStorage may be null if database is not available

  it('returns build data if exists', async () => {
    if (!buildStorage) {
      return; // Skip if no database
    }

    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Build with Data',
    });

    const buildData = createTestBuild(item.id, item.title);
    await buildStorage.saveBuild(item.id, buildData);

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    const response = await request(app.server)
      .get(`/api/marketplace/${item.id}/build`)
      .expect(200);

    expect(response.body).toHaveProperty('metadata');
    expect(response.body).toHaveProperty('scene');
    expect(response.body.metadata.id).toBe(item.id);
    expect(response.body.metadata.name).toBe(item.title);
  });

  it('returns mock data if build not found', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'build',
      title: 'Build without Data',
    });

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    const response = await request(app.server)
      .get(`/api/marketplace/${item.id}/build`)
      .expect(200);

    // Should return mock data structure
    expect(response.body).toHaveProperty('metadata');
    expect(response.body).toHaveProperty('scene');
    expect(response.body.metadata.id).toBe(item.id);
    expect(response.body.metadata.name).toBe(item.title);
  });

  it('returns 400 if item is not a build type', async () => {
    const item = await createTestMarketplaceItem(marketplaceStorage, {
      authorId: 'user1',
      type: 'avatar',
      title: 'Avatar Item',
    });

    // Wait for item to be available (handles database transaction timing)
    await waitForItem(marketplaceStorage, item.id);

    await request(app.server)
      .get(`/api/marketplace/${item.id}/build`)
      .expect(400);
  });

  it('returns 404 if item not found', async () => {
    await request(app.server)
      .get('/api/marketplace/nonexistent_id/build')
      .expect(404);
  });
});



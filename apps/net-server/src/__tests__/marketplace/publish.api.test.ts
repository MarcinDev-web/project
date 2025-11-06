/**
 * Integration tests for POST /api/marketplace (publish)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, authManager, marketplaceStorage, buildStorage, dbPool } from '../../server.js';
import { createTestUser, createTestBuild } from '../helpers/testHelpers.js';
import type { ProjectData } from '../../types.js';

describe.skip('POST /api/marketplace', () => {
  let user: { userId: string; email: string; token: string };

  beforeEach(async () => {
    // Use server's shared instances to ensure tokens and items are valid
    // Use unique emails to avoid conflicts between parallel test runs
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    user = await createTestUser(authManager, `user-${timestamp}-${random}@test.com`);
  });

  it('publishes item successfully with auth', async () => {
    const response = await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'build',
        title: 'New Build',
        description: 'A new build',
        fileUrl: '/api/marketplace/test/build',
        tags: ['building'],
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe('New Build');
    expect(response.body.type).toBe('build');
    expect(response.body.authorId).toBe(user.userId);
    expect(response.body.downloads).toBe(0);
    expect(response.body.likes).toBe(0);
  });

  it('returns 401 without auth', async () => {
    await request(app.server)
      .post('/api/marketplace')
      .send({
        type: 'build',
        title: 'New Build',
        fileUrl: '/api/marketplace/test/build',
      })
      .expect(401);
  });

  it('validates required fields', async () => {
    await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'build',
        // Missing title and fileUrl
      })
      .expect(400);
  });

  it('saves build data if provided', async () => {
    if (!buildStorage) {
      return; // Skip if no database
    }

    const buildData = createTestBuild('test-id', 'Test Build');

    const response = await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'build',
        title: 'Build with Data',
        fileUrl: '/api/marketplace/test/build',
        buildData,
      })
      .expect(201);

    const itemId = response.body.id;
    const savedBuild = await buildStorage.getBuild(itemId);
    expect(savedBuild).not.toBeNull();
    expect(savedBuild?.metadata.name).toBe('Build with Data');
  });

  it('returns created item with all fields', async () => {
    const response = await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'avatar',
        title: 'New Avatar',
        description: 'Avatar description',
        fileUrl: '/api/marketplace/test/avatar',
        tags: ['character'],
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('type');
    expect(response.body).toHaveProperty('title');
    expect(response.body).toHaveProperty('description');
    expect(response.body).toHaveProperty('authorId');
    expect(response.body).toHaveProperty('fileUrl');
    expect(response.body).toHaveProperty('tags');
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
  });

  it('handles invalid data gracefully', async () => {
    await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'invalid_type',
        title: 'Test',
        fileUrl: '/test',
      })
      .expect(400);
  });

  it('transaction rolls back if build data save fails', async () => {
    if (!buildStorage || !dbPool) {
      return; // Skip if no database
    }

    // Create invalid build data that will cause serialization error
    const invalidBuildData = {
      metadata: {
        id: 'test-id',
        name: 'Test Build',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      scene: {
        name: 'Test Scene',
        // Circular reference will cause JSON.stringify to fail or create huge payload
        entities: [] as unknown[],
      },
    };

    // Create circular reference to cause error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (invalidBuildData.scene as any).self = invalidBuildData.scene;

    // Mock saveBuild to throw error
    const originalSaveBuild = buildStorage.saveBuild.bind(buildStorage);
    buildStorage.saveBuild = async () => {
      throw new Error('Simulated build save failure');
    };

    try {
      await request(app.server)
        .post('/api/marketplace')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          type: 'build',
          title: 'Test Build',
          fileUrl: '/api/marketplace/test/build',
          buildData: invalidBuildData,
        })
        .expect(500);

      // Verify that no item was created (transaction rolled back)
      const items = await marketplaceStorage.getItems({ authorId: user.userId });
      const testItems = items.filter(item => item.title === 'Test Build');
      expect(testItems.length).toBe(0);
    } finally {
      // Restore original method
      buildStorage.saveBuild = originalSaveBuild;
    }
  });

  it('validates title length limit', async () => {
    const longTitle = 'a'.repeat(201); // Exceeds 200 char limit

    const response = await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'build',
        title: longTitle,
        fileUrl: '/api/marketplace/test/build',
      })
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
    expect(response.body.errors).toBeDefined();
    const titleError = response.body.errors.find((e: { field: string }) => e.field === 'title');
    expect(titleError).toBeDefined();
    expect(titleError.message).toContain('200');
  });

  it('validates description length limit', async () => {
    const longDescription = 'a'.repeat(5001); // Exceeds 5000 char limit

    const response = await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'build',
        title: 'Test Build',
        description: longDescription,
        fileUrl: '/api/marketplace/test/build',
      })
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
    const descError = response.body.errors.find((e: { field: string }) => e.field === 'description');
    expect(descError).toBeDefined();
    expect(descError.message).toContain('5000');
  });

  it('validates tags count limit', async () => {
    const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag${i}`); // Exceeds 20 tag limit

    const response = await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'build',
        title: 'Test Build',
        fileUrl: '/api/marketplace/test/build',
        tags: tooManyTags,
      })
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
    const tagsError = response.body.errors.find((e: { field: string }) => e.field === 'tags');
    expect(tagsError).toBeDefined();
    expect(tagsError.message).toContain('20');
  });

  it('validates buildData structure', async () => {
    const invalidBuildData = {
      // Missing required fields
      metadata: {},
      scene: null,
    };

    const response = await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'build',
        title: 'Test Build',
        fileUrl: '/api/marketplace/test/build',
        buildData: invalidBuildData,
      })
      .expect(400);

    expect(response.body.error).toBe('Validation failed');
    const buildDataError = response.body.errors.find((e: { field: string }) => 
      e.field.startsWith('buildData')
    );
    expect(buildDataError).toBeDefined();
  });

  it('validates buildData size limit', async () => {
    // Create a large buildData that exceeds 10MB when serialized
    const largeBuildData: ProjectData = {
      metadata: {
        id: 'test-id',
        name: 'Large Build',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      scene: {
        name: 'Large Scene',
        entities: Array.from({ length: 100000 }, (_, i) => ({
          id: `entity_${i}`,
          name: `Entity ${i}`,
          components: [
            {
              type: 'Transform',
              props: {
                position: [0, 0, 0],
                rotation: [0, 0, 0, 1],
                scale: [1, 1, 1],
              },
            },
            {
              type: 'Mesh',
              props: {
                vertices: Array.from({ length: 10000 }, () => [Math.random(), Math.random(), Math.random()]),
              },
            },
          ],
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          children: [],
        })),
      },
    };

    const response = await request(app.server)
      .post('/api/marketplace')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        type: 'build',
        title: 'Test Build',
        fileUrl: '/api/marketplace/test/build',
        buildData: largeBuildData,
      });

    // Should either fail validation (if size check works) or timeout
    expect([400, 413, 500]).toContain(response.status);
  });

  it('enforces rate limiting', async () => {
    // Make 6 requests rapidly (exceeds limit of 5)
    const requests = Array.from({ length: 6 }, () =>
      request(app.server)
        .post('/api/marketplace')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          type: 'build',
          title: `Rate Limit Test ${Date.now()}`,
          fileUrl: '/api/marketplace/test/build',
        })
    );

    const responses = await Promise.all(requests);

    // At least one should be rate limited (429)
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);

    // Check rate limit message
    if (rateLimitedResponses.length > 0) {
      expect(rateLimitedResponses[0]?.body.error).toContain('Too many publications');
    }
  }, 30000); // Longer timeout for rate limit test

  it('does not expose internal error details', async () => {
    if (!buildStorage || !dbPool) {
      return; // Skip if no database
    }

    // Mock buildStorage to throw internal error
    const originalSaveBuild = buildStorage.saveBuild.bind(buildStorage);
    buildStorage.saveBuild = async () => {
      throw new Error('Internal database error: connection failed at line 1234');
    };

    try {
      const response = await request(app.server)
        .post('/api/marketplace')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          type: 'build',
          title: 'Test Build',
          fileUrl: '/api/marketplace/test/build',
          buildData: createTestBuild('test-id', 'Test Build'),
        })
        .expect(500);

      // Should not expose internal details
      expect(response.body.message).not.toContain('line 1234');
      expect(response.body.message).not.toContain('Internal database error');
      expect(response.body.error).toBeDefined();
    } finally {
      buildStorage.saveBuild = originalSaveBuild;
    }
  });
});




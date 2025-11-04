/**
 * Tests for BuildStorage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPrismaClient, ensureSchema } from '../../lib/db';
import { BuildStorage } from '../BuildStorage';
import type { PrismaClient } from '../../../node_modules/.prisma/net-client';
import type { ProjectData } from '../../types';

describe('BuildStorage', () => {
  let prisma: PrismaClient;
  let storage: BuildStorage;
  let testMarketplaceId: string;

  beforeEach(async () => {
    if (!process.env.DATABASE_URL) {
      // Skip tests if DATABASE_URL is not set
      return;
    }

    prisma = await getPrismaClient();
    await ensureSchema();
    storage = new BuildStorage(prisma);

    // Create a test marketplace item (required for foreign key constraint)
    testMarketplaceId = `test_item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await prisma.marketplaceItem.create({
      data: {
        id: testMarketplaceId,
        type: 'build',
        title: 'Test Build',
        authorId: 'test_user',
        fileUrl: '/test',
        tags: [],
        isPublic: true,
      },
    });
  });

  afterEach(async () => {
    if (prisma) {
      // Cleanup
      await prisma.marketplaceBuild.deleteMany({
        where: { marketplaceId: testMarketplaceId },
      });
      await prisma.marketplaceItem.deleteMany({
        where: { id: testMarketplaceId },
      });
    }
  });

  describe('saveBuild and getBuild', () => {
    it('saves and retrieves build data', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      const projectData: ProjectData = {
        metadata: {
          id: 'test-project',
          name: 'Test Project',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          thumbnail: '/test-thumbnail.png',
        },
        scene: {
          name: 'Test Scene',
          entities: [
            {
              id: 'entity1',
              name: 'Entity 1',
              components: [
                {
                  type: 'Transform',
                  props: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
                },
              ],
              transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
              children: [],
            },
          ],
        },
      };

      await storage.saveBuild(testMarketplaceId, projectData);
      const retrieved = await storage.getBuild(testMarketplaceId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.metadata.id).toBe(projectData.metadata.id);
      expect(retrieved?.metadata.name).toBe(projectData.metadata.name);
      expect(retrieved?.scene.name).toBe(projectData.scene.name);
      expect(retrieved?.scene.entities).toHaveLength(1);
    });

    it('updates existing build data', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      const initialData: ProjectData = {
        metadata: {
          id: 'test-project',
          name: 'Initial Name',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        scene: { name: 'Initial Scene', entities: [] },
      };

      await storage.saveBuild(testMarketplaceId, initialData);
      const version1 = await storage.getBuildVersion(testMarketplaceId);
      expect(version1).toBe(1);

      const updatedData: ProjectData = {
        ...initialData,
        metadata: {
          ...initialData.metadata,
          name: 'Updated Name',
        },
      };

      await storage.saveBuild(testMarketplaceId, updatedData);
      const version2 = await storage.getBuildVersion(testMarketplaceId);
      expect(version2).toBe(2);

      const retrieved = await storage.getBuild(testMarketplaceId);
      expect(retrieved?.metadata.name).toBe('Updated Name');
    });

    it('returns null for non-existent build', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      const retrieved = await storage.getBuild('nonexistent_id');
      expect(retrieved).toBeNull();
    });
  });

  describe('deleteBuild', () => {
    it('deletes build data', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      const projectData: ProjectData = {
        metadata: {
          id: 'test-project',
          name: 'Test Project',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        scene: { name: 'Test Scene', entities: [] },
      };

      await storage.saveBuild(testMarketplaceId, projectData);
      expect(await storage.buildExists(testMarketplaceId)).toBe(true);

      await storage.deleteBuild(testMarketplaceId);
      expect(await storage.buildExists(testMarketplaceId)).toBe(false);
      expect(await storage.getBuild(testMarketplaceId)).toBeNull();
    });

    it('does not throw when deleting non-existent build', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      await expect(storage.deleteBuild('nonexistent_id')).resolves.not.toThrow();
    });
  });

  describe('buildExists', () => {
    it('returns true for existing build', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      const projectData: ProjectData = {
        metadata: {
          id: 'test-project',
          name: 'Test Project',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        scene: { name: 'Test Scene', entities: [] },
      };

      await storage.saveBuild(testMarketplaceId, projectData);
      expect(await storage.buildExists(testMarketplaceId)).toBe(true);
    });

    it('returns false for non-existent build', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      expect(await storage.buildExists('nonexistent_id')).toBe(false);
    });
  });

  describe('getBuildVersion', () => {
    it('returns version number for existing build', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      const projectData: ProjectData = {
        metadata: {
          id: 'test-project',
          name: 'Test Project',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        scene: { name: 'Test Scene', entities: [] },
      };

      await storage.saveBuild(testMarketplaceId, projectData);
      expect(await storage.getBuildVersion(testMarketplaceId)).toBe(1);

      await storage.saveBuild(testMarketplaceId, projectData);
      expect(await storage.getBuildVersion(testMarketplaceId)).toBe(2);
    });

    it('returns null for non-existent build', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      expect(await storage.getBuildVersion('nonexistent_id')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('throws error on invalid JSON data', async () => {
      if (!process.env.DATABASE_URL) {
        return;
      }

      // Manually insert corrupted data
      await prisma.marketplaceBuild.create({
        data: {
          marketplaceId: testMarketplaceId,
          projectData: Buffer.from('invalid json'),
          version: 1,
        },
      });

      await expect(storage.getBuild(testMarketplaceId)).rejects.toThrow();
    });
  });
});

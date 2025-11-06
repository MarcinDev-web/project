/**
 * Tests for MarketplaceStorage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceStorage } from '../MarketplaceStorage.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('MarketplaceStorage', () => {
  let storage: MarketplaceStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));
    storage = new MarketplaceStorage(tempDir);
    await storage.initialize();
  });

  describe('createItem', () => {
    it('creates a new marketplace item', async () => {
      const item = await storage.createItem({
        type: 'build',
        title: 'Test Build',
        description: 'A test build',
        authorId: 'user1',
        authorName: 'TestUser',
        fileUrl: '/api/marketplace/item1/build',
        tags: ['test', 'build'],
        public: true,
      });

      expect(item.id).toContain('item_');
      expect(item.type).toBe('build');
      expect(item.title).toBe('Test Build');
      expect(item.description).toBe('A test build');
      expect(item.authorId).toBe('user1');
      expect(item.authorName).toBe('TestUser');
      expect(item.fileUrl).toBe('/api/marketplace/item1/build');
      expect(item.tags).toEqual(['test', 'build']);
      expect(item.public).toBe(true);
      expect(item.downloads).toBe(0);
      expect(item.likes).toBe(0);
      expect(item.createdAt).toBeGreaterThan(0);
      expect(item.updatedAt).toBeGreaterThan(0);
    });

    it('creates avatar item', async () => {
      const item = await storage.createItem({
        type: 'avatar',
        title: 'Test Avatar',
        authorId: 'user2',
        fileUrl: '/api/marketplace/item2/avatar',
        tags: [],
        public: true,
      });

      expect(item.type).toBe('avatar');
      expect(item.id).toBeDefined();
    });

    it('generates unique IDs for each item', async () => {
      const item1 = await storage.createItem({
        type: 'build',
        title: 'Build 1',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item1/build',
        tags: [],
        public: true,
      });

      const item2 = await storage.createItem({
        type: 'build',
        title: 'Build 2',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item2/build',
        tags: [],
        public: true,
      });

      expect(item1.id).not.toBe(item2.id);
    });
  });

  describe('getItem', () => {
    it('retrieves an item by ID', async () => {
      const created = await storage.createItem({
        type: 'build',
        title: 'Test Build',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item1/build',
        tags: ['test'],
        public: true,
      });

      const retrieved = await storage.getItem(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test Build');
    });

    it('returns null for non-existent item', async () => {
      const item = await storage.getItem('nonexistent_id');
      expect(item).toBeNull();
    });
  });

  describe('getItems', () => {
    beforeEach(async () => {
      // Create test items
      await storage.createItem({
        type: 'build',
        title: 'Build 1',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item1/build',
        tags: ['building', 'action'],
        public: true,
      });

      await storage.createItem({
        type: 'build',
        title: 'Build 2',
        authorId: 'user2',
        fileUrl: '/api/marketplace/item2/build',
        tags: ['building', 'puzzle'],
        public: true,
      });

      await storage.createItem({
        type: 'avatar',
        title: 'Avatar 1',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item3/avatar',
        tags: [],
        public: true,
      });

      await storage.createItem({
        type: 'build',
        title: 'Private Build',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item4/build',
        tags: [],
        public: false,
      });
    });

    it('returns all items when no filters applied', async () => {
      const items = await storage.getItems();
      expect(items.length).toBeGreaterThanOrEqual(4);
    });

    it('filters by type', async () => {
      const builds = await storage.getItems({ type: 'build' });
      expect(builds.length).toBeGreaterThanOrEqual(3);
      expect(builds.every(item => item.type === 'build')).toBe(true);

      const avatars = await storage.getItems({ type: 'avatar' });
      expect(avatars.length).toBeGreaterThanOrEqual(1);
      expect(avatars.every(item => item.type === 'avatar')).toBe(true);
    });

    it('filters by authorId', async () => {
      const items = await storage.getItems({ authorId: 'user1' });
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.every(item => item.authorId === 'user1')).toBe(true);
    });

    it('filters by tags', async () => {
      const items = await storage.getItems({ tags: ['building'] });
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.every(item => item.tags.includes('building'))).toBe(true);
    });

    it('filters by public flag', async () => {
      const publicItems = await storage.getItems({ public: true });
      expect(publicItems.length).toBeGreaterThanOrEqual(3);
      expect(publicItems.every(item => item.public === true)).toBe(true);

      const privateItems = await storage.getItems({ public: false });
      expect(privateItems.length).toBeGreaterThanOrEqual(1);
      expect(privateItems.every(item => item.public === false)).toBe(true);
    });

    it('filters by multiple tags', async () => {
      const items = await storage.getItems({ tags: ['building', 'puzzle'] });
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(
        items.every(item => item.tags.includes('building') || item.tags.includes('puzzle'))
      ).toBe(true);
    });

    it('sorts by creation date (newest first)', async () => {
      const items = await storage.getItems();
      for (let i = 0; i < items.length - 1; i++) {
        expect(items[i]!.createdAt).toBeGreaterThanOrEqual(items[i + 1]!.createdAt);
      }
    });

    it('supports pagination with limit', async () => {
      const items = await storage.getItems({ limit: 2 });
      expect(items.length).toBeLessThanOrEqual(2);
    });

    it('supports pagination with offset', async () => {
      const first = await storage.getItems({ limit: 2, offset: 0 });
      const second = await storage.getItems({ limit: 2, offset: 2 });

      expect(first.length).toBeLessThanOrEqual(2);
      expect(second.length).toBeLessThanOrEqual(2);
      if (first.length === 2 && second.length > 0) {
        expect(first[0]?.id).not.toBe(second[0]?.id);
      }
    });

    it('combines multiple filters', async () => {
      const items = await storage.getItems({
        type: 'build',
        authorId: 'user1',
        public: true,
      });
      expect(items.every(item => 
        item.type === 'build' && 
        item.authorId === 'user1' && 
        item.public === true
      )).toBe(true);
    });
  });

  describe('updateItem', () => {
    it('updates item fields', async () => {
      const item = await storage.createItem({
        type: 'build',
        title: 'Original Title',
        description: 'Original description',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item1/build',
        tags: ['original'],
        public: true,
      });

      const originalUpdatedAt = item.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await storage.updateItem(item.id, {
        title: 'Updated Title',
        description: 'Updated description',
        tags: ['updated'],
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.tags).toEqual(['updated']);
      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
      expect(updated?.id).toBe(item.id);
      expect(updated?.authorId).toBe(item.authorId); // Should not change
    });

    it('returns null for non-existent item', async () => {
      const updated = await storage.updateItem('nonexistent', { title: 'New Title' });
      expect(updated).toBeNull();
    });

    it('does not update immutable fields', async () => {
      const item = await storage.createItem({
        type: 'build',
        title: 'Test',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item1/build',
        tags: [],
        public: true,
      });

      const originalId = item.id;
      const originalCreatedAt = item.createdAt;
      const originalAuthorId = item.authorId;

      await storage.updateItem(item.id, {
        title: 'Updated',
      });

      const retrieved = await storage.getItem(item.id);
      expect(retrieved?.id).toBe(originalId);
      expect(retrieved?.createdAt).toBe(originalCreatedAt);
      expect(retrieved?.authorId).toBe(originalAuthorId);
    });
  });

  describe('deleteItem', () => {
    it('deletes item by author', async () => {
      const item = await storage.createItem({
        type: 'build',
        title: 'To Delete',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item1/build',
        tags: [],
        public: true,
      });

      const deleted = await storage.deleteItem(item.id, 'user1');
      expect(deleted).toBe(true);

      const retrieved = await storage.getItem(item.id);
      expect(retrieved).toBeNull();
    });

    it('does not delete item if author does not match', async () => {
      const item = await storage.createItem({
        type: 'build',
        title: 'To Delete',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item1/build',
        tags: [],
        public: true,
      });

      const deleted = await storage.deleteItem(item.id, 'user2');
      expect(deleted).toBe(false);

      const retrieved = await storage.getItem(item.id);
      expect(retrieved).not.toBeNull();
    });

    it('returns false for non-existent item', async () => {
      const deleted = await storage.deleteItem('nonexistent', 'user1');
      expect(deleted).toBe(false);
    });
  });

  describe('incrementDownloads', () => {
    it('increments download count', async () => {
      const item = await storage.createItem({
        type: 'build',
        title: 'Test Build',
        authorId: 'user1',
        fileUrl: '/api/marketplace/item1/build',
        tags: [],
        public: true,
      });

      expect(item.downloads).toBe(0);

      await storage.incrementDownloads(item.id);
      const updated = await storage.getItem(item.id);
      expect(updated?.downloads).toBe(1);

      await storage.incrementDownloads(item.id);
      const updated2 = await storage.getItem(item.id);
      expect(updated2?.downloads).toBe(2);
    });

    it('does nothing for non-existent item', async () => {
      // Should not throw
      await expect(storage.incrementDownloads('nonexistent')).resolves.not.toThrow();
    });
  });
});


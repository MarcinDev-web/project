/**
 * Tests for FavoritesManager
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FavoritesManager } from '../FavoritesManager';
import type { Asset } from '../../types/BlockAssetTypes';
import { BLOCK_LIBRARY } from '@engine/blocks';
import { blockToAsset } from '../../types/BlockAssetTypes';

describe('FavoritesManager', () => {
  let manager: FavoritesManager;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    manager = new FavoritesManager();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('adding favorites', () => {
    it('should add a favorite', () => {
      manager.addFavorite('asset-1');
      expect(manager.isFavorite('asset-1')).toBe(true);
      expect(manager.getCount()).toBe(1);
    });

    it('should not add duplicate favorites', () => {
      manager.addFavorite('asset-1');
      manager.addFavorite('asset-1');
      expect(manager.getCount()).toBe(1);
    });

    it('should add multiple favorites', () => {
      manager.addFavorite('asset-1');
      manager.addFavorite('asset-2');
      manager.addFavorite('asset-3');
      expect(manager.getCount()).toBe(3);
      expect(manager.getFavorites()).toEqual(['asset-1', 'asset-2', 'asset-3']);
    });
  });

  describe('removing favorites', () => {
    it('should remove a favorite', () => {
      manager.addFavorite('asset-1');
      manager.removeFavorite('asset-1');
      expect(manager.isFavorite('asset-1')).toBe(false);
      expect(manager.getCount()).toBe(0);
    });

    it('should handle removing non-existent favorite', () => {
      manager.removeFavorite('asset-1');
      expect(manager.getCount()).toBe(0);
    });
  });

  describe('toggling favorites', () => {
    it('should toggle favorite on', () => {
      const result = manager.toggleFavorite('asset-1');
      expect(result).toBe(true);
      expect(manager.isFavorite('asset-1')).toBe(true);
    });

    it('should toggle favorite off', () => {
      manager.addFavorite('asset-1');
      const result = manager.toggleFavorite('asset-1');
      expect(result).toBe(false);
      expect(manager.isFavorite('asset-1')).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should persist favorites to localStorage', () => {
      manager.addFavorite('asset-1');
      manager.addFavorite('asset-2');

      // Create new manager to test loading
      const newManager = new FavoritesManager();
      expect(newManager.getCount()).toBe(2);
      expect(newManager.isFavorite('asset-1')).toBe(true);
      expect(newManager.isFavorite('asset-2')).toBe(true);
    });

    it('should load from empty localStorage', () => {
      const newManager = new FavoritesManager();
      expect(newManager.getCount()).toBe(0);
    });
  });

  describe('clearing favorites', () => {
    it('should clear all favorites', () => {
      manager.addFavorite('asset-1');
      manager.addFavorite('asset-2');
      manager.clear();
      expect(manager.getCount()).toBe(0);
      expect(manager.getFavorites()).toEqual([]);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on add', () => {
      const listener = vi.fn();
      manager.addListener(listener);
      manager.addFavorite('asset-1');
      expect(listener).toHaveBeenCalled();
    });

    it('should notify listeners on remove', () => {
      manager.addFavorite('asset-1');
      const listener = vi.fn();
      manager.addListener(listener);
      manager.removeFavorite('asset-1');
      expect(listener).toHaveBeenCalled();
    });

    it('should notify listeners on toggle', () => {
      const listener = vi.fn();
      manager.addListener(listener);
      manager.toggleFavorite('asset-1');
      expect(listener).toHaveBeenCalled();
    });

    it('should remove listeners', () => {
      const listener = vi.fn();
      const cleanup = manager.addListener(listener);
      cleanup();
      manager.addFavorite('asset-1');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getFavoriteAssets', () => {
    // Helper to create mock assets
    const createMockAsset = (id: string, name: string): Asset => {
      const block = Object.values(BLOCK_LIBRARY)[0];
      if (!block) {
        throw new Error('BLOCK_LIBRARY is empty - cannot create mock asset');
      }
      const asset = blockToAsset(block);
      return {
        ...asset,
        id,
        name,
      };
    };

    it('should get favorite assets', () => {
      const mockAssets: Record<string, Asset> = {
        'asset-1': createMockAsset('asset-1', 'Asset 1'),
        'asset-2': createMockAsset('asset-2', 'Asset 2'),
      };

      manager.addFavorite('asset-1');
      manager.addFavorite('asset-2');

      const assets = manager.getFavoriteAssets((id) => mockAssets[id]);
      expect(assets).toHaveLength(2);
      expect(assets[0]?.id).toBe('asset-1');
      expect(assets[1]?.id).toBe('asset-2');
    });

    it('should filter out missing assets', () => {
      const mockAssets: Record<string, Asset> = {
        'asset-1': createMockAsset('asset-1', 'Asset 1'),
      };

      manager.addFavorite('asset-1');
      manager.addFavorite('asset-missing');

      const assets = manager.getFavoriteAssets((id) => mockAssets[id]);
      expect(assets).toHaveLength(1);
      expect(assets[0]?.id).toBe('asset-1');
    });
  });
});



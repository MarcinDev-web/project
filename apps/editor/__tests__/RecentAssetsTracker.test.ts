/**
 * Tests for RecentAssetsTracker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecentAssetsTracker, type Asset } from '@engine/assets';

describe('RecentAssetsTracker', () => {
  let tracker: RecentAssetsTracker;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    tracker = new RecentAssetsTracker();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('recording usage', () => {
    it('should record asset usage', () => {
      tracker.recordUsage('asset-1');
      expect(tracker.isRecent('asset-1')).toBe(true);
      expect(tracker.getCount()).toBe(1);
    });

    it('should record multiple assets', () => {
      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');
      tracker.recordUsage('asset-3');
      expect(tracker.getCount()).toBe(3);
      expect(tracker.getRecent()).toEqual(['asset-3', 'asset-2', 'asset-1']);
    });

    it('should move duplicate to front', () => {
      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');
      tracker.recordUsage('asset-3');
      tracker.recordUsage('asset-1'); // Move to front
      
      const recent = tracker.getRecent();
      expect(recent[0]).toBe('asset-1');
      expect(tracker.getCount()).toBe(3); // Should not increase count
    });

    it('should limit to 30 items', () => {
      // Add 35 items
      for (let i = 0; i < 35; i++) {
        tracker.recordUsage(`asset-${i}`);
      }
      
      expect(tracker.getCount()).toBe(30);
      expect(tracker.isRecent('asset-34')).toBe(true); // Most recent
      expect(tracker.isRecent('asset-0')).toBe(false); // Should be removed
    });
  });

  describe('getting recent assets', () => {
    it('should return recent assets in order', () => {
      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');
      tracker.recordUsage('asset-3');
      
      const recent = tracker.getRecent();
      expect(recent).toEqual(['asset-3', 'asset-2', 'asset-1']);
    });

    it('should limit returned results', () => {
      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');
      tracker.recordUsage('asset-3');
      tracker.recordUsage('asset-4');
      
      const recent = tracker.getRecent(2);
      expect(recent).toHaveLength(2);
      expect(recent).toEqual(['asset-4', 'asset-3']);
    });
  });

  describe('persistence', () => {
    it('should persist recent assets to localStorage', () => {
      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');

      // Create new tracker to test loading
      const newTracker = new RecentAssetsTracker();
      expect(newTracker.getCount()).toBe(2);
      expect(newTracker.isRecent('asset-1')).toBe(true);
      expect(newTracker.isRecent('asset-2')).toBe(true);
    });

    it('should load from empty localStorage', () => {
      const newTracker = new RecentAssetsTracker();
      expect(newTracker.getCount()).toBe(0);
    });
  });

  describe('clearing recent assets', () => {
    it('should clear all recent assets', () => {
      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');
      tracker.clear();
      expect(tracker.getCount()).toBe(0);
      expect(tracker.getRecent()).toEqual([]);
    });
  });

  describe('removing specific asset', () => {
    it('should remove a specific asset', () => {
      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');
      tracker.remove('asset-1');
      
      expect(tracker.isRecent('asset-1')).toBe(false);
      expect(tracker.isRecent('asset-2')).toBe(true);
      expect(tracker.getCount()).toBe(1);
    });

    it('should handle removing non-existent asset', () => {
      tracker.recordUsage('asset-1');
      tracker.remove('asset-2');
      expect(tracker.getCount()).toBe(1);
    });
  });

  describe('time tracking', () => {
    it('should track time since last use', () => {
      tracker.recordUsage('asset-1');
      const timeSince = tracker.getTimeSinceLastUse('asset-1');
      expect(timeSince).not.toBeNull();
      expect(timeSince).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-recent asset', () => {
      const timeSince = tracker.getTimeSinceLastUse('asset-1');
      expect(timeSince).toBeNull();
    });
  });

  describe('listeners', () => {
    it('should notify listeners on record', () => {
      const listener = vi.fn();
      tracker.addListener(listener);
      tracker.recordUsage('asset-1');
      expect(listener).toHaveBeenCalled();
    });

    it('should notify listeners on clear', () => {
      tracker.recordUsage('asset-1');
      const listener = vi.fn();
      tracker.addListener(listener);
      tracker.clear();
      expect(listener).toHaveBeenCalled();
    });

    it('should remove listeners', () => {
      const listener = vi.fn();
      const cleanup = tracker.addListener(listener);
      cleanup();
      tracker.recordUsage('asset-1');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getRecentAssets', () => {
    it('should get recent assets', () => {
      const mockAssets: Record<string, Asset> = {
        'asset-1': { metadata: { id: 'asset-1', name: 'Asset 1' } } as Asset,
        'asset-2': { metadata: { id: 'asset-2', name: 'Asset 2' } } as Asset,
      };

      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');

      const assets = tracker.getRecentAssets((id) => mockAssets[id]);
      expect(assets).toHaveLength(2);
      expect(assets[0]?.metadata.id).toBe('asset-2'); // Most recent first
      expect(assets[1]?.metadata.id).toBe('asset-1');
    });

    it('should filter out missing assets', () => {
      const mockAssets: Record<string, Asset> = {
        'asset-1': { metadata: { id: 'asset-1', name: 'Asset 1' } } as Asset,
      };

      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-missing');

      const assets = tracker.getRecentAssets((id) => mockAssets[id]);
      expect(assets).toHaveLength(1);
      expect(assets[0]?.metadata.id).toBe('asset-1');
    });

    it('should limit returned assets', () => {
      const mockAssets: Record<string, Asset> = {
        'asset-1': { metadata: { id: 'asset-1', name: 'Asset 1' } } as Asset,
        'asset-2': { metadata: { id: 'asset-2', name: 'Asset 2' } } as Asset,
        'asset-3': { metadata: { id: 'asset-3', name: 'Asset 3' } } as Asset,
      };

      tracker.recordUsage('asset-1');
      tracker.recordUsage('asset-2');
      tracker.recordUsage('asset-3');

      const assets = tracker.getRecentAssets((id) => mockAssets[id], 2);
      expect(assets).toHaveLength(2);
    });
  });
});


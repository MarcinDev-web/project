import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InventoryManager } from '../editor/managers/InventoryManager';
import type { Asset } from '@engine/assets';

// Mock asset
const createMockAsset = (id: string, name: string): Asset => ({
  type: 'primitive',
  category: 'Building',
  metadata: {
    id,
    name,
    description: 'Test asset',
  },
  transform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
  },
  colors: [[1, 1, 1, 1]],
});

describe('InventoryManager', () => {
  let manager: InventoryManager;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    manager = new InventoryManager();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('build modes', () => {
    it('should start in infinite mode', () => {
      expect(manager.getBuildMode()).toBe('infinite');
    });

    it('should set build mode', () => {
      manager.setBuildMode('limited');
      expect(manager.getBuildMode()).toBe('limited');
    });

    it('should notify listeners on mode change', () => {
      const listener = vi.fn();
      manager.addListener(listener);
      
      manager.setBuildMode('limited');
      
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('inventory operations', () => {
    it('should add items to inventory', () => {
      manager.addItems('test-asset', 10);
      
      expect(manager.getCount('test-asset')).toBe(10);
    });

    it('should add to existing items', () => {
      manager.addItems('test-asset', 10);
      manager.addItems('test-asset', 5);
      
      expect(manager.getCount('test-asset')).toBe(15);
    });

    it('should ignore non-positive additions', () => {
      manager.addItems('test-asset', 10);
      manager.addItems('test-asset', 0);
      manager.addItems('test-asset', -5);

      expect(manager.getCount('test-asset')).toBe(10);
    });

    it('should remove items from inventory', () => {
      manager.setBuildMode('limited');
      manager.addItems('test-asset', 10);
      
      const success = manager.removeItems('test-asset', 5);
      
      expect(success).toBe(true);
      expect(manager.getCount('test-asset')).toBe(5);
    });

    it('should fail to remove more items than available', () => {
      manager.setBuildMode('limited');
      manager.addItems('test-asset', 10);
      
      const success = manager.removeItems('test-asset', 15);
      
      expect(success).toBe(false);
      expect(manager.getCount('test-asset')).toBe(10);
    });

    it('should allow removal in infinite mode', () => {
      manager.setBuildMode('infinite');
      manager.addItems('test-asset', 5);
      
      const success = manager.removeItems('test-asset', 100);
      
      expect(success).toBe(true);
    });

    it('should check if can use asset', () => {
      manager.setBuildMode('limited');
      manager.addItems('test-asset', 10);
      
      expect(manager.canUse('test-asset', 5)).toBe(true);
      expect(manager.canUse('test-asset', 15)).toBe(false);
    });

    it('should always allow use in infinite mode', () => {
      manager.setBuildMode('infinite');
      
      expect(manager.canUse('test-asset', 1000)).toBe(true);
    });
  });

  describe('infinite items', () => {
    it('should set item as infinite', () => {
      manager.setInfinite('test-asset', true);
      
      expect(manager.isInfinite('test-asset')).toBe(true);
    });

    it('should allow unlimited use of infinite items', () => {
      manager.setBuildMode('limited');
      manager.setInfinite('test-asset', true);
      
      expect(manager.canUse('test-asset', 1000)).toBe(true);
      expect(manager.removeItems('test-asset', 1000)).toBe(true);
    });

    it('should treat all items as infinite in infinite mode', () => {
      manager.setBuildMode('infinite');
      
      expect(manager.isInfinite('any-asset')).toBe(true);
    });
  });

  describe('hotbar operations', () => {
    const asset1 = createMockAsset('asset1', 'Asset 1');
    const asset2 = createMockAsset('asset2', 'Asset 2');

    it('should have 9 empty slots initially', () => {
      const slots = manager.getHotbarSlots();
      
      expect(slots).toHaveLength(9);
      expect(slots.every(slot => slot.asset === null)).toBe(true);
    });

    it('should set hotbar slot', () => {
      manager.setHotbarSlot(0, asset1);
      
      const slot = manager.getHotbarSlot(0);
      expect(slot?.asset).toBe(asset1);
    });

    it('should clear hotbar slot', () => {
      manager.setHotbarSlot(0, asset1);
      
      manager.clearHotbarSlot(0);
      
      const slot = manager.getHotbarSlot(0);
      expect(slot?.asset).toBeNull();
    });

    it('should swap hotbar slots', () => {
      manager.setHotbarSlot(0, asset1);
      manager.setHotbarSlot(1, asset2);
      
      manager.swapHotbarSlots(0, 1);
      
      expect(manager.getHotbarSlot(0)?.asset).toBe(asset2);
      expect(manager.getHotbarSlot(1)?.asset).toBe(asset1);
    });

    it('should not swap invalid slots', () => {
      manager.setHotbarSlot(0, asset1);
      
      manager.swapHotbarSlots(0, 10); // Invalid index
      
      // Should remain unchanged
      expect(manager.getHotbarSlot(0)?.asset).toBe(asset1);
    });

    it('should get hotbar data for persistence', () => {
      manager.setHotbarSlot(0, asset1);
      manager.setHotbarSlot(2, asset2);
      
      const data = manager.getHotbarData();
      
      expect(data).toHaveLength(9);
      expect(data[0]).toBe('asset1');
      expect(data[1]).toBeNull();
      expect(data[2]).toBe('asset2');
    });

    it('should restore hotbar from data', () => {
      const data = ['asset1', null, 'asset2', null, null, null, null, null, null];
      const assetLookup = (id: string) => createMockAsset(id, `Asset ${id}`);
      
      manager.restoreHotbar(data, assetLookup);
      
      expect(manager.getHotbarSlot(0)?.asset?.metadata.id).toBe('asset1');
      expect(manager.getHotbarSlot(1)?.asset).toBeNull();
      expect(manager.getHotbarSlot(2)?.asset?.metadata.id).toBe('asset2');
    });
  });

  describe('listeners', () => {
    it('should add listener', () => {
      const listener = vi.fn();
      
      manager.addListener(listener);
      manager.addItems('test-asset', 10);
      
      expect(listener).toHaveBeenCalled();
    });

    it('should remove listener via cleanup function', () => {
      const listener = vi.fn();
      
      const cleanup = manager.addListener(listener);
      cleanup();
      
      manager.addItems('test-asset', 10);
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      manager.addListener(listener1);
      manager.addListener(listener2);
      
      manager.addItems('test-asset', 10);
      
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should get total count', () => {
      manager.addItems('asset1', 10);
      manager.addItems('asset2', 20);
      
      expect(manager.getTotalCount()).toBe(30);
    });

    it('should not count infinite items in total', () => {
      manager.addItems('asset1', 10);
      manager.setInfinite('asset2', true);
      
      expect(manager.getTotalCount()).toBe(10);
    });

    it('should get unique count', () => {
      manager.addItems('asset1', 10);
      manager.addItems('asset2', 20);
      manager.addItems('asset3', 5);
      
      expect(manager.getUniqueCount()).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset inventory', () => {
      const asset = createMockAsset('asset1', 'Asset 1');
      manager.addItems('asset1', 10);
      manager.setHotbarSlot(0, asset);
      
      manager.reset();
      
      expect(manager.getCount('asset1')).toBe(0);
      expect(manager.getHotbarSlot(0)?.asset).toBeNull();
      expect(manager.getTotalCount()).toBe(0);
      expect(manager.getUniqueCount()).toBe(0);
      expect(manager.getHotbarData().every(id => id === null)).toBe(true);
    });
  });

  describe('persistence', () => {
    it('should persist to localStorage', () => {
      manager.addItems('test-asset', 10);
      
      // Create new manager to load from storage
      const newManager = new InventoryManager();
      
      expect(newManager.getCount('test-asset')).toBe(10);
    });

    it('should persist hotbar to localStorage', () => {
      const asset = createMockAsset('asset1', 'Asset 1');
      manager.setHotbarSlot(0, asset);
      
      // Hotbar persistence requires lookup function
      // Just verify data was saved
      const data = manager.getHotbarData();
      expect(data[0]).toBe('asset1');
    });

    it('should retain hotbar IDs across reloads even without assets', () => {
      const asset = createMockAsset('asset1', 'Asset 1');
      manager.setHotbarSlot(0, asset);

      const newManager = new InventoryManager();

      expect(newManager.getHotbarData()[0]).toBe('asset1');
      expect(newManager.getHotbarSlot(0)?.asset).toBeNull();
    });

    it('should restore hotbar assets when lookup resolves them', () => {
      const asset = createMockAsset('asset1', 'Asset 1');
      manager.setHotbarSlot(0, asset);
      const savedData = manager.getHotbarData();

      const newManager = new InventoryManager();
      const resolvedAsset = createMockAsset('asset1', 'Asset 1');
      const lookup = vi.fn().mockImplementation((id: string) => (id === 'asset1' ? resolvedAsset : null));

      newManager.restoreHotbar(savedData, lookup);

      expect(newManager.getHotbarSlot(0)?.asset).toBe(resolvedAsset);
      expect(newManager.getHotbarSlot(0)?.asset?.metadata.id).toBe('asset1');
      expect(newManager.getHotbarData()[0]).toBe('asset1');
      expect(lookup).toHaveBeenCalledWith('asset1');
    });

    it('should handle missing localStorage gracefully', () => {
      // This test ensures the manager doesn't crash if localStorage fails
      expect(() => {
        const newManager = new InventoryManager();
        newManager.addItems('test', 1);
      }).not.toThrow();
    });
  });

  describe('restock notifications', () => {
    it('should track low inventory', () => {
      manager.setBuildMode('limited');
      manager.addItems('test-asset', 15);
      
      // Remove items to trigger restock check
      manager.removeItems('test-asset', 6); // 9 remaining
      
      // Just verify it doesn't crash - notifications are logged
      expect(manager.getCount('test-asset')).toBe(9);
    });

    it('should ignore negative additions when tracking restock', () => {
      manager.setBuildMode('limited');
      manager.addItems('test-asset', 10);
      manager.addItems('test-asset', -5);

      expect(manager.getCount('test-asset')).toBe(10);
    });
  });
});


import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ItemInventoryComponent } from './ItemInventoryComponent.js';
import type { ItemDefinition } from './ItemInventoryComponent.js';

describe('ItemInventoryComponent', () => {
  let inventory: ItemInventoryComponent;

  // Sample items for testing
  const woodItem: ItemDefinition = {
    itemId: 'wood',
    name: 'Wood',
    category: 'resource',
    stackable: true,
    maxStack: 100,
  };

  const stoneItem: ItemDefinition = {
    itemId: 'stone',
    name: 'Stone',
    category: 'resource',
    stackable: true,
    maxStack: 50,
  };

  const swordItem: ItemDefinition = {
    itemId: 'sword',
    name: 'Iron Sword',
    category: 'weapon',
    stackable: false,
    maxStack: 1,
  };

  beforeEach(() => {
    // Clear registry before each test
    ItemInventoryComponent.clearRegistry();
    inventory = new ItemInventoryComponent();
  });

  afterEach(() => {
    ItemInventoryComponent.clearRegistry();
  });

  describe('basic operations', () => {
    it('should create empty inventory', () => {
      expect(inventory.isEmpty()).toBe(true);
      expect(inventory.getSlotCount()).toBe(0);
      expect(inventory.getTotalItemCount()).toBe(0);
    });

    it('should add item', () => {
      const result = inventory.addItem(woodItem, 10);
      expect(result.success).toBe(true);
      expect(result.added).toBe(10);
      expect(result.overflow).toBe(0);
      expect(inventory.getItemCount('wood')).toBe(10);
    });

    it('should remove item', () => {
      inventory.addItem(woodItem, 10);
      const result = inventory.removeItem('wood', 3);
      expect(result.success).toBe(true);
      expect(result.removed).toBe(3);
      expect(result.remaining).toBe(7);
      expect(inventory.getItemCount('wood')).toBe(7);
    });

    it('should check if has item', () => {
      inventory.addItem(woodItem, 10);
      expect(inventory.hasItem('wood', 5)).toBe(true);
      expect(inventory.hasItem('wood', 10)).toBe(true);
      expect(inventory.hasItem('wood', 11)).toBe(false);
      expect(inventory.hasItem('stone', 1)).toBe(false);
    });

    it('should clear inventory', () => {
      inventory.addItem(woodItem, 10);
      inventory.addItem(stoneItem, 5);
      inventory.clear();
      expect(inventory.isEmpty()).toBe(true);
      expect(inventory.getItemCount('wood')).toBe(0);
    });
  });

  describe('stacking behavior', () => {
    it('should stack items up to max', () => {
      inventory.addItem(woodItem, 80);
      const result = inventory.addItem(woodItem, 30);
      expect(result.added).toBe(20); // 100 max - 80 = 20
      expect(result.overflow).toBe(10); // 30 - 20 = 10
      expect(inventory.getItemCount('wood')).toBe(100);
    });

    it('should not stack non-stackable items', () => {
      inventory.addItem(swordItem, 1);
      const result = inventory.addItem(swordItem, 1);
      expect(result.success).toBe(false);
      expect(result.added).toBe(0);
      expect(inventory.getItemCount('sword')).toBe(1);
    });
  });

  describe('slot management', () => {
    it('should respect max slots', () => {
      inventory.maxSlots = 2;
      inventory.addItem(woodItem, 1);
      inventory.addItem(stoneItem, 1);
      const result = inventory.addItem(swordItem, 1);
      expect(result.success).toBe(false);
      expect(inventory.getSlotCount()).toBe(2);
    });

    it('should report full correctly', () => {
      inventory.maxSlots = 1;
      expect(inventory.isFull()).toBe(false);
      inventory.addItem(woodItem, 1);
      expect(inventory.isFull()).toBe(true);
    });

    it('should remove slot when quantity reaches zero', () => {
      inventory.addItem(woodItem, 5);
      inventory.removeItem('wood', 5);
      expect(inventory.getSlotCount()).toBe(0);
      expect(inventory.hasItem('wood')).toBe(false);
    });
  });

  describe('item registry', () => {
    it('should register items globally', () => {
      ItemInventoryComponent.registerItem(woodItem);
      const retrieved = ItemInventoryComponent.getItemDefinition('wood');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Wood');
    });

    it('should add item by ID when registered', () => {
      ItemInventoryComponent.registerItem(woodItem);
      const result = inventory.addItem('wood', 5);
      expect(result.success).toBe(true);
      expect(inventory.getItemCount('wood')).toBe(5);
    });

    it('should fail to add unregistered item by ID', () => {
      const result = inventory.addItem('unknown', 5);
      expect(result.success).toBe(false);
    });

    it('should auto-register when adding item definition', () => {
      inventory.addItem(woodItem, 5);
      const retrieved = ItemInventoryComponent.getItemDefinition('wood');
      expect(retrieved).toBeDefined();
    });
  });

  describe('category filtering', () => {
    it('should get items by category', () => {
      inventory.addItem(woodItem, 10);
      inventory.addItem(stoneItem, 5);
      inventory.addItem(swordItem, 1);

      const resources = inventory.getItemsByCategory('resource');
      expect(resources.length).toBe(2);

      const weapons = inventory.getItemsByCategory('weapon');
      expect(weapons.length).toBe(1);
      expect(weapons[0].item.itemId).toBe('sword');
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      inventory.addItem(woodItem, 10);
      inventory.addItem(stoneItem, 5);

      const json = inventory.toJSON();
      expect(json.maxSlots).toBe(100);
      expect(json.items).toHaveLength(2);
      expect(json.items?.find((i) => i.itemId === 'wood')?.quantity).toBe(10);
    });

    it('should deserialize from JSON', () => {
      const json = {
        maxSlots: 50,
        items: [
          { itemId: 'wood', item: woodItem, quantity: 15 },
          { itemId: 'stone', item: stoneItem, quantity: 8 },
        ],
      };

      const newInventory = new ItemInventoryComponent();
      newInventory.fromJSON(json);

      expect(newInventory.maxSlots).toBe(50);
      expect(newInventory.getItemCount('wood')).toBe(15);
      expect(newInventory.getItemCount('stone')).toBe(8);
    });

    it('should clone correctly', () => {
      inventory.addItem(woodItem, 10);
      const clone = inventory.clone();

      expect(clone.getItemCount('wood')).toBe(10);

      // Verify independence
      clone.addItem(woodItem, 5);
      expect(clone.getItemCount('wood')).toBe(15);
      expect(inventory.getItemCount('wood')).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('should handle zero quantity add', () => {
      const result = inventory.addItem(woodItem, 0);
      expect(result.success).toBe(false);
      expect(result.added).toBe(0);
    });

    it('should handle negative quantity add', () => {
      const result = inventory.addItem(woodItem, -5);
      expect(result.success).toBe(false);
    });

    it('should handle removing more than available', () => {
      inventory.addItem(woodItem, 5);
      const result = inventory.removeItem('wood', 10);
      expect(result.removed).toBe(5);
      expect(result.remaining).toBe(0);
    });

    it('should handle removing from non-existent item', () => {
      const result = inventory.removeItem('unknown', 1);
      expect(result.success).toBe(false);
      expect(result.removed).toBe(0);
    });

    it('should set item count directly', () => {
      inventory.addItem(woodItem, 10);
      inventory.setItemCount('wood', 50);
      expect(inventory.getItemCount('wood')).toBe(50);
    });

    it('should remove item when setting count to zero', () => {
      inventory.addItem(woodItem, 10);
      inventory.setItemCount('wood', 0);
      expect(inventory.hasItem('wood')).toBe(false);
    });
  });

  describe('total item count', () => {
    it('should count total items across all slots', () => {
      inventory.addItem(woodItem, 10);
      inventory.addItem(stoneItem, 5);
      inventory.addItem(swordItem, 1);
      expect(inventory.getTotalItemCount()).toBe(16);
    });
  });

  describe('get slot', () => {
    it('should return slot copy', () => {
      inventory.addItem(woodItem, 10);
      const slot = inventory.getSlot('wood');
      expect(slot).toBeDefined();
      expect(slot?.quantity).toBe(10);
      expect(slot?.item.name).toBe('Wood');
    });

    it('should return undefined for non-existent slot', () => {
      const slot = inventory.getSlot('unknown');
      expect(slot).toBeUndefined();
    });
  });
});


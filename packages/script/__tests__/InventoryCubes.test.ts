/**
 * Tests for Inventory Logic Cubes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Scene, Entity } from '@engine/world';
import { ItemInventoryComponent } from '@engine/world/components/ItemInventoryComponent';
import type { ItemDefinition } from '@engine/world/components/ItemInventoryComponent';
import {
  AddItemAction,
  RemoveItemAction,
  HasItemCondition,
  GetItemCountData,
} from '../src/LogicCubes/cubes/InventoryCubes.js';
import type { LogicSignal, LogicExecutionContext } from '../src/LogicCubes/cubes/types.js';

describe('Inventory Cubes', () => {
  let scene: Scene;
  let entity: Entity;
  let playerEntity: Entity;

  // Sample items
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

  const createSignal = (data?: unknown): LogicSignal => ({
    type: 'trigger',
    sourceEntityId: entity.id,
    timestamp: Date.now(),
    data,
  });

  const createContext = (signal: LogicSignal): LogicExecutionContext => ({
    deltaTime: 0.016,
    gameTime: 0,
    signal,
    triggeringPlayer: playerEntity,
  });

  beforeEach(() => {
    // Clear registry before each test
    ItemInventoryComponent.clearRegistry();

    scene = new Scene('Test Scene');
    entity = new Entity('LogicCubeEntity');
    playerEntity = new Entity('Player');

    // Setup inventory
    const inventoryComponent = new ItemInventoryComponent();
    playerEntity.addComponent(inventoryComponent);

    // Register items and add some initial inventory
    ItemInventoryComponent.registerItem(woodItem);
    ItemInventoryComponent.registerItem(stoneItem);
    inventoryComponent.addItem(woodItem, 50);
    inventoryComponent.addItem(stoneItem, 20);

    scene.addEntity(entity);
    scene.addEntity(playerEntity);
  });

  afterEach(() => {
    ItemInventoryComponent.clearRegistry();
  });

  describe('AddItemAction', () => {
    it('should have correct metadata', () => {
      const cube = new AddItemAction(entity, scene);
      const metadata = cube.getMetadata();

      expect(metadata.type).toBe('addItem');
      expect(metadata.category).toBe('action');
      expect(metadata.outputs.some((o) => o.id === 'success')).toBe(true);
      expect(metadata.outputs.some((o) => o.id === 'failure')).toBe(true);
    });

    it('should add item to inventory', () => {
      const cube = new AddItemAction(entity, scene, {
        itemId: 'wood',
        quantity: 10,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('success')).toBe(true);
      expect(outputs?.get('newCount')?.data).toBe(60);
      expect(outputs?.get('overflow')?.data).toBe(0);

      // Verify inventory
      const inventory = playerEntity.getComponent(ItemInventoryComponent);
      expect(inventory?.getItemCount('wood')).toBe(60);
    });

    it('should handle stack overflow', () => {
      const cube = new AddItemAction(entity, scene, {
        itemId: 'wood',
        quantity: 60, // 50 + 60 = 110 > 100 max
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs?.has('success')).toBe(true);
      expect(outputs?.get('newCount')?.data).toBe(100);
      expect(outputs?.get('overflow')?.data).toBe(10);
    });

    it('should auto-register new items', () => {
      const cube = new AddItemAction(entity, scene, {
        itemId: 'gold',
        quantity: 5,
        targetEntity: 'player',
        autoRegister: true,
        category: 'resource',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs?.has('success')).toBe(true);

      // Verify item was auto-registered
      const itemDef = ItemInventoryComponent.getItemDefinition('gold');
      expect(itemDef).toBeDefined();
      expect(itemDef?.category).toBe('resource');
    });

    it('should fail for unregistered item without auto-register', () => {
      const cube = new AddItemAction(entity, scene, {
        itemId: 'unknown_item',
        quantity: 5,
        targetEntity: 'player',
        autoRegister: false,
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs?.has('failure')).toBe(true);
    });

    it('should accept itemId from signal data', () => {
      const cube = new AddItemAction(entity, scene, {
        itemId: 'wood',
        quantity: 5,
        targetEntity: 'player',
      });

      // Override itemId via signal data
      const signal = createSignal('stone');
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      // Should add stone, not wood
      const inventory = playerEntity.getComponent(ItemInventoryComponent);
      expect(inventory?.getItemCount('stone')).toBe(25); // 20 + 5
    });
  });

  describe('RemoveItemAction', () => {
    it('should remove item from inventory', () => {
      const cube = new RemoveItemAction(entity, scene, {
        itemId: 'wood',
        quantity: 10,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.has('success')).toBe(true);
      expect(outputs?.get('removed')?.data).toBe(10);
      expect(outputs?.get('remaining')?.data).toBe(40);

      // Verify inventory
      const inventory = playerEntity.getComponent(ItemInventoryComponent);
      expect(inventory?.getItemCount('wood')).toBe(40);
    });

    it('should fail when not enough items (requireExact=true)', () => {
      const cube = new RemoveItemAction(entity, scene, {
        itemId: 'wood',
        quantity: 100, // Only have 50
        requireExact: true,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs?.has('failure')).toBe(true);
      expect(outputs?.has('success')).toBe(false);

      // Verify inventory unchanged
      const inventory = playerEntity.getComponent(ItemInventoryComponent);
      expect(inventory?.getItemCount('wood')).toBe(50);
    });

    it('should remove what we can when requireExact=false', () => {
      const cube = new RemoveItemAction(entity, scene, {
        itemId: 'wood',
        quantity: 100, // Only have 50
        requireExact: false,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs?.has('success')).toBe(true);
      expect(outputs?.get('removed')?.data).toBe(50);
      expect(outputs?.get('remaining')?.data).toBe(0);
    });

    it('should fail for non-existent item', () => {
      const cube = new RemoveItemAction(entity, scene, {
        itemId: 'unknown_item',
        quantity: 1,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('trigger', signal, context);

      expect(outputs?.has('failure')).toBe(true);
    });
  });

  describe('HasItemCondition', () => {
    it('should return true when item quantity is sufficient', () => {
      const cube = new HasItemCondition(entity, scene, {
        itemId: 'wood',
        quantity: 30,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('check', signal, context);

      expect(outputs?.has('true')).toBe(true);
      expect(outputs?.has('false')).toBe(false);
      expect(outputs?.get('count')?.data).toBe(50);
    });

    it('should return false when item quantity is insufficient', () => {
      const cube = new HasItemCondition(entity, scene, {
        itemId: 'wood',
        quantity: 100,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('check', signal, context);

      expect(outputs?.has('true')).toBe(false);
      expect(outputs?.has('false')).toBe(true);
    });

    it('should return false for non-existent item', () => {
      const cube = new HasItemCondition(entity, scene, {
        itemId: 'gold',
        quantity: 1,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('check', signal, context);

      expect(outputs?.has('false')).toBe(true);
      expect(outputs?.get('count')?.data).toBe(0);
    });

    it('should accept itemId from signal data', () => {
      const cube = new HasItemCondition(entity, scene, {
        itemId: 'wood',
        quantity: 15,
        targetEntity: 'player',
      });

      // Override itemId to stone via signal
      const signal = createSignal('stone');
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('check', signal, context);

      // Should check stone (20), not wood (50)
      expect(outputs?.has('true')).toBe(true);
      expect(outputs?.get('count')?.data).toBe(20);
    });
  });

  describe('GetItemCountData', () => {
    it('should return item count', () => {
      const cube = new GetItemCountData(entity, scene, {
        itemId: 'wood',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      expect(outputs).not.toBeNull();
      expect(outputs?.get('count')?.data).toBe(50);
      expect(outputs?.has('output')).toBe(true);
    });

    it('should return 0 for non-existent item', () => {
      const cube = new GetItemCountData(entity, scene, {
        itemId: 'gold',
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      expect(outputs?.get('count')?.data).toBe(0);
    });

    it('should accept itemId from signal data', () => {
      const cube = new GetItemCountData(entity, scene, {
        itemId: 'wood',
        targetEntity: 'player',
      });

      // Override to stone via signal
      const signal = createSignal('stone');
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      expect(outputs?.get('count')?.data).toBe(20);
    });
  });

  describe('target entity resolution', () => {
    it('should resolve "self" to cube entity', () => {
      // Add inventory to cube entity
      const selfInventory = new ItemInventoryComponent();
      entity.addComponent(selfInventory);
      selfInventory.addItem(woodItem, 25);

      const cube = new GetItemCountData(entity, scene, {
        itemId: 'wood',
        targetEntity: 'self',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      expect(outputs?.get('count')?.data).toBe(25);
    });

    it('should return null for non-existent target entity', () => {
      const cube = new GetItemCountData(entity, scene, {
        itemId: 'wood',
        targetEntity: 'non_existent_entity',
      });

      const signal = createSignal();
      const context = createContext(signal);

      const outputs = cube.onSignalReceived('get', signal, context);

      // Should return output with 0 count
      expect(outputs?.get('count')?.data).toBe(0);
    });
  });

  describe('inventory events', () => {
    it('should emit item added event', () => {
      let eventReceived = false;
      let eventData: { type: string; payload?: unknown } | null = null;

      scene.events.on('inventory:item:added', (event: unknown) => {
        eventReceived = true;
        eventData = event as { type: string; payload?: unknown };
      });

      const cube = new AddItemAction(entity, scene, {
        itemId: 'wood',
        quantity: 10,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      cube.onSignalReceived('trigger', signal, context);

      expect(eventReceived).toBe(true);
      const payload = eventData?.payload as { itemId: string; quantity: number };
      expect(payload.itemId).toBe('wood');
      expect(payload.quantity).toBe(10);
    });

    it('should emit item removed event', () => {
      let eventReceived = false;
      let eventData: { type: string; payload?: unknown } | null = null;

      scene.events.on('inventory:item:removed', (event: unknown) => {
        eventReceived = true;
        eventData = event as { type: string; payload?: unknown };
      });

      const cube = new RemoveItemAction(entity, scene, {
        itemId: 'wood',
        quantity: 5,
        targetEntity: 'player',
      });

      const signal = createSignal();
      const context = createContext(signal);

      cube.onSignalReceived('trigger', signal, context);

      expect(eventReceived).toBe(true);
      const payload = eventData?.payload as { itemId: string; quantity: number };
      expect(payload.itemId).toBe('wood');
      expect(payload.quantity).toBe(5);
    });
  });
});


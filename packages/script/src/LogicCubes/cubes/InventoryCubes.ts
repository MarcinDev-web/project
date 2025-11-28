/**
 * Inventory Cubes - Logic cubes for item inventory operations
 * Used for Tycoon/Simulator games
 */

import { LogicCube } from './LogicCube.js';
import type { LogicCubeMetadata, LogicSignal, LogicExecutionContext } from './types.js';
import { Logger } from '@engine/core/utils';
import { ItemInventoryComponent } from '@engine/world/components/ItemInventoryComponent';
import { getLogicConnectionManager } from '../../connection/index.js';

/**
 * AddItemAction - Adds an item to inventory
 */
export class AddItemAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'addItem',
      displayName: 'Add Item',
      category: 'action',
      description: 'Adds an item to player inventory',
      icon: 'package-plus',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
        {
          id: 'quantity',
          type: 'data',
          direction: 'input',
          label: 'Quantity',
          description: 'Amount to add (optional)',
          dataType: 'number',
        },
        {
          id: 'itemId',
          type: 'data',
          direction: 'input',
          label: 'Item ID',
          description: 'Item ID to add (optional)',
          dataType: 'string',
        },
      ],
      outputs: [
        {
          id: 'success',
          type: 'trigger',
          direction: 'output',
          label: 'Success',
          description: 'Fires if item was added',
        },
        {
          id: 'failure',
          type: 'trigger',
          direction: 'output',
          label: 'Failure',
          description: 'Fires if inventory is full or item not found',
        },
        {
          id: 'newCount',
          type: 'data',
          direction: 'output',
          label: 'New Count',
          description: 'New quantity of item after adding',
          dataType: 'number',
        },
        {
          id: 'overflow',
          type: 'data',
          direction: 'output',
          label: 'Overflow',
          description: 'Amount that could not be added (stack limit)',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'itemId',
          label: 'Item ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of item to add (must be registered)',
        },
        {
          key: 'quantity',
          label: 'Quantity',
          type: 'number',
          defaultValue: 1,
          min: 1,
          description: 'Amount to add',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity with ItemInventoryComponent',
        },
        {
          key: 'autoRegister',
          label: 'Auto-Register Item',
          type: 'boolean',
          defaultValue: true,
          description: 'Create basic item definition if not registered',
        },
        {
          key: 'category',
          label: 'Item Category',
          type: 'string',
          defaultValue: 'resource',
          description: 'Category for auto-registered items',
        },
      ],
      color: [0.2, 0.8, 0.4], // Green
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    // Get parameters - check signal data first, then config
    let itemId = this.getConfig<string>('itemId', '');
    let quantity = this.getConfig<number>('quantity', 1);

    if (signal.data !== undefined) {
      if (typeof signal.data === 'string') {
        itemId = signal.data;
      } else if (typeof signal.data === 'number') {
        quantity = signal.data;
      }
    }

    if (!itemId) {
      Logger.warn('AddItemAction: No item ID specified');
      return this.createFailureOutput(signal, 0);
    }

    const targetEntityId = this.getConfig<string>('targetEntity', 'player');
    const autoRegister = this.getConfig<boolean>('autoRegister', true);
    const category = this.getConfig<string>('category', 'resource');

    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`AddItemAction: Target entity not found: ${targetEntityId}`);
      return this.createFailureOutput(signal, quantity);
    }

    const inventoryComponent = targetEntity.getComponent(ItemInventoryComponent);
    if (!inventoryComponent) {
      Logger.warn(`AddItemAction: Entity ${targetEntityId} has no ItemInventoryComponent`);
      return this.createFailureOutput(signal, quantity);
    }

    // Check if item is registered
    let itemDef = ItemInventoryComponent.getItemDefinition(itemId);
    if (!itemDef && autoRegister) {
      // Auto-register a basic stackable item
      itemDef = {
        itemId,
        name: itemId,
        category,
        stackable: true,
        maxStack: 9999,
      };
      ItemInventoryComponent.registerItem(itemDef);
      Logger.debug(`AddItemAction: Auto-registered item ${itemId}`);
    }

    if (!itemDef) {
      Logger.warn(`AddItemAction: Item not registered: ${itemId}`);
      return this.createFailureOutput(signal, quantity);
    }

    const result = inventoryComponent.addItem(itemDef, quantity);
    const newCount = inventoryComponent.getItemCount(itemId);

    if (result.success) {
      Logger.debug(`AddItemAction: Added ${result.added} of ${itemId} to ${targetEntityId}`);

      // Emit inventory change event
      this.scene.events.publish({
        type: 'inventory:item:added',
        payload: {
          entityId: targetEntity.id,
          itemId,
          quantity: result.added,
          newCount,
        },
        sender: this.entity,
      });

      const outputs = new Map<string, LogicSignal>();
      outputs.set('success', {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      outputs.set('newCount', {
        type: 'data',
        data: newCount,
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      outputs.set('overflow', {
        type: 'data',
        data: result.overflow,
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      return outputs;
    }

    return this.createFailureOutput(signal, result.overflow);
  }

  private createFailureOutput(signal: LogicSignal, overflow: number): Map<string, LogicSignal> {
    const outputs = new Map<string, LogicSignal>();
    outputs.set('failure', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    outputs.set('overflow', {
      type: 'data',
      data: overflow,
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    return this.scene.findEntityById(targetEntityId);
  }
}

/**
 * RemoveItemAction - Removes an item from inventory
 */
export class RemoveItemAction extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'removeItem',
      displayName: 'Remove Item',
      category: 'action',
      description: 'Removes an item from player inventory',
      icon: 'package-minus',
      inputs: [
        {
          id: 'trigger',
          type: 'trigger',
          direction: 'input',
          label: 'Trigger',
          description: 'Execute this action',
        },
        {
          id: 'quantity',
          type: 'data',
          direction: 'input',
          label: 'Quantity',
          description: 'Amount to remove (optional)',
          dataType: 'number',
        },
        {
          id: 'itemId',
          type: 'data',
          direction: 'input',
          label: 'Item ID',
          description: 'Item ID to remove (optional)',
          dataType: 'string',
        },
      ],
      outputs: [
        {
          id: 'success',
          type: 'trigger',
          direction: 'output',
          label: 'Success',
          description: 'Fires if item was removed',
        },
        {
          id: 'failure',
          type: 'trigger',
          direction: 'output',
          label: 'Failure',
          description: 'Fires if not enough items',
        },
        {
          id: 'removed',
          type: 'data',
          direction: 'output',
          label: 'Removed',
          description: 'Actual quantity removed',
          dataType: 'number',
        },
        {
          id: 'remaining',
          type: 'data',
          direction: 'output',
          label: 'Remaining',
          description: 'Remaining quantity after removal',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'itemId',
          label: 'Item ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of item to remove',
        },
        {
          key: 'quantity',
          label: 'Quantity',
          type: 'number',
          defaultValue: 1,
          min: 1,
          description: 'Amount to remove',
        },
        {
          key: 'requireExact',
          label: 'Require Exact Amount',
          type: 'boolean',
          defaultValue: true,
          description: 'Fail if not enough items (vs. removing what we can)',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity with ItemInventoryComponent',
        },
      ],
      color: [0.9, 0.3, 0.3], // Red
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'trigger') return null;

    let itemId = this.getConfig<string>('itemId', '');
    let quantity = this.getConfig<number>('quantity', 1);

    if (signal.data !== undefined) {
      if (typeof signal.data === 'string') {
        itemId = signal.data;
      } else if (typeof signal.data === 'number') {
        quantity = signal.data;
      }
    }

    if (!itemId) {
      Logger.warn('RemoveItemAction: No item ID specified');
      return this.createFailureOutput(signal, 0, 0);
    }

    const requireExact = this.getConfig<boolean>('requireExact', true);
    const targetEntityId = this.getConfig<string>('targetEntity', 'player');

    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`RemoveItemAction: Target entity not found: ${targetEntityId}`);
      return this.createFailureOutput(signal, 0, 0);
    }

    const inventoryComponent = targetEntity.getComponent(ItemInventoryComponent);
    if (!inventoryComponent) {
      Logger.warn(`RemoveItemAction: Entity ${targetEntityId} has no ItemInventoryComponent`);
      return this.createFailureOutput(signal, 0, 0);
    }

    // Check if we have enough before removing (if requireExact)
    if (requireExact && !inventoryComponent.hasItem(itemId, quantity)) {
      const currentCount = inventoryComponent.getItemCount(itemId);
      Logger.debug(`RemoveItemAction: Not enough ${itemId} (have ${currentCount}, need ${quantity})`);
      return this.createFailureOutput(signal, 0, currentCount);
    }

    const result = inventoryComponent.removeItem(itemId, quantity);

    if (result.success) {
      Logger.debug(`RemoveItemAction: Removed ${result.removed} of ${itemId} from ${targetEntityId}`);

      // Emit inventory change event
      this.scene.events.publish({
        type: 'inventory:item:removed',
        payload: {
          entityId: targetEntity.id,
          itemId,
          quantity: result.removed,
          remaining: result.remaining,
        },
        sender: this.entity,
      });

      const outputs = new Map<string, LogicSignal>();
      outputs.set('success', {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      outputs.set('removed', {
        type: 'data',
        data: result.removed,
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      outputs.set('remaining', {
        type: 'data',
        data: result.remaining,
        sourceEntityId: this.entity.id,
        timestamp: signal.timestamp,
      });
      return outputs;
    }

    return this.createFailureOutput(signal, result.removed, result.remaining);
  }

  private createFailureOutput(
    signal: LogicSignal,
    removed: number,
    remaining: number
  ): Map<string, LogicSignal> {
    const outputs = new Map<string, LogicSignal>();
    outputs.set('failure', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    outputs.set('removed', {
      type: 'data',
      data: removed,
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    outputs.set('remaining', {
      type: 'data',
      data: remaining,
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    return this.scene.findEntityById(targetEntityId);
  }
}

/**
 * HasItemCondition - Checks if inventory has an item
 */
export class HasItemCondition extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'hasItem',
      displayName: 'Has Item?',
      category: 'condition',
      description: 'Checks if player has at least the specified quantity of an item',
      icon: 'package-search',
      inputs: [
        {
          id: 'check',
          type: 'trigger',
          direction: 'input',
          label: 'Check',
          description: 'Trigger to check inventory',
        },
        {
          id: 'quantity',
          type: 'data',
          direction: 'input',
          label: 'Required Qty',
          description: 'Required quantity (optional)',
          dataType: 'number',
        },
        {
          id: 'itemId',
          type: 'data',
          direction: 'input',
          label: 'Item ID',
          description: 'Item ID to check (optional)',
          dataType: 'string',
        },
      ],
      outputs: [
        {
          id: 'true',
          type: 'trigger',
          direction: 'output',
          label: 'True',
          description: 'Fires if player has enough items',
        },
        {
          id: 'false',
          type: 'trigger',
          direction: 'output',
          label: 'False',
          description: 'Fires if player does not have enough items',
        },
        {
          id: 'count',
          type: 'data',
          direction: 'output',
          label: 'Current Count',
          description: 'Current quantity in inventory',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'itemId',
          label: 'Item ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of item to check',
        },
        {
          key: 'quantity',
          label: 'Required Quantity',
          type: 'number',
          defaultValue: 1,
          min: 1,
          description: 'Minimum quantity required',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity with ItemInventoryComponent',
        },
      ],
      color: [0.5, 0.5, 1], // Blue-purple
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'check') return null;

    let itemId = this.getConfig<string>('itemId', '');
    let requiredQuantity = this.getConfig<number>('quantity', 1);

    if (signal.data !== undefined) {
      if (typeof signal.data === 'string') {
        itemId = signal.data;
      } else if (typeof signal.data === 'number') {
        requiredQuantity = signal.data;
      }
    }

    if (!itemId) {
      Logger.warn('HasItemCondition: No item ID specified');
      return this.createOutput(false, 0, signal);
    }

    const targetEntityId = this.getConfig<string>('targetEntity', 'player');

    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`HasItemCondition: Target entity not found: ${targetEntityId}`);
      return this.createOutput(false, 0, signal);
    }

    const inventoryComponent = targetEntity.getComponent(ItemInventoryComponent);
    if (!inventoryComponent) {
      Logger.warn(`HasItemCondition: Entity ${targetEntityId} has no ItemInventoryComponent`);
      return this.createOutput(false, 0, signal);
    }

    const currentCount = inventoryComponent.getItemCount(itemId);
    const hasEnough = currentCount >= requiredQuantity;

    return this.createOutput(hasEnough, currentCount, signal);
  }

  private createOutput(
    result: boolean,
    count: number,
    signal: LogicSignal
  ): Map<string, LogicSignal> {
    const outputs = new Map<string, LogicSignal>();
    outputs.set(result ? 'true' : 'false', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    outputs.set('count', {
      type: 'data',
      data: count,
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    return this.scene.findEntityById(targetEntityId);
  }
}

/**
 * GetItemCountData - Gets the quantity of an item in inventory
 */
export class GetItemCountData extends LogicCube {
  getMetadata(): LogicCubeMetadata {
    return {
      type: 'getItemCount',
      displayName: 'Get Item Count',
      category: 'data',
      description: 'Gets the quantity of an item in inventory',
      icon: 'hash',
      inputs: [
        {
          id: 'get',
          type: 'trigger',
          direction: 'input',
          label: 'Get',
          description: 'Trigger to get item count',
        },
        {
          id: 'itemId',
          type: 'data',
          direction: 'input',
          label: 'Item ID',
          description: 'Item ID to check (optional)',
          dataType: 'string',
        },
      ],
      outputs: [
        {
          id: 'count',
          type: 'data',
          direction: 'output',
          label: 'Count',
          description: 'Current quantity (0 if not found)',
          dataType: 'number',
        },
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'Complete',
          description: 'Fires after getting count',
        },
      ],
      parameters: [
        {
          key: 'itemId',
          label: 'Item ID',
          type: 'string',
          defaultValue: '',
          description: 'ID of item to check',
        },
        {
          key: 'targetEntity',
          label: 'Target Entity',
          type: 'string',
          defaultValue: 'player',
          description: 'Entity with ItemInventoryComponent',
        },
      ],
      color: [0.3, 0.8, 1], // Cyan
    };
  }

  onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    if (portId !== 'get') return null;

    let itemId = this.getConfig<string>('itemId', '');
    if (signal.data !== undefined && typeof signal.data === 'string') {
      itemId = signal.data;
    }

    if (!itemId) {
      Logger.warn('GetItemCountData: No item ID specified');
      return this.createOutput(0, signal);
    }

    const targetEntityId = this.getConfig<string>('targetEntity', 'player');

    const targetEntity = this.resolveTargetEntity(targetEntityId, context);
    if (!targetEntity) {
      Logger.warn(`GetItemCountData: Target entity not found: ${targetEntityId}`);
      return this.createOutput(0, signal);
    }

    const inventoryComponent = targetEntity.getComponent(ItemInventoryComponent);
    if (!inventoryComponent) {
      Logger.warn(`GetItemCountData: Entity ${targetEntityId} has no ItemInventoryComponent`);
      return this.createOutput(0, signal);
    }

    const count = inventoryComponent.getItemCount(itemId);
    return this.createOutput(count, signal);
  }

  private createOutput(count: number, signal: LogicSignal): Map<string, LogicSignal> {
    const outputs = new Map<string, LogicSignal>();
    outputs.set('count', {
      type: 'data',
      data: count,
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    outputs.set('output', {
      type: 'trigger',
      sourceEntityId: this.entity.id,
      timestamp: signal.timestamp,
    });
    return outputs;
  }

  private resolveTargetEntity(targetEntityId: string, context: LogicExecutionContext) {
    if (targetEntityId === 'player' && context.triggeringPlayer) {
      return context.triggeringPlayer;
    }
    if (targetEntityId === 'self') {
      return this.entity;
    }
    return this.scene.findEntityById(targetEntityId);
  }
}

/**
 * OnItemAddedTrigger - Triggers when an item is added to inventory
 */
export class OnItemAddedTrigger extends LogicCube {
  private itemAddedHandler: ((payload: unknown) => void) | null = null;

  getMetadata(): LogicCubeMetadata {
    return {
      type: 'onItemAdded',
      displayName: 'On Item Added',
      category: 'trigger',
      description: 'Triggers when an item is added to inventory',
      icon: 'package-plus',
      inputs: [],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'On Added',
          description: 'Fires when item is added',
        },
        {
          id: 'itemId',
          type: 'data',
          direction: 'output',
          label: 'Item ID',
          description: 'ID of added item',
          dataType: 'string',
        },
        {
          id: 'quantity',
          type: 'data',
          direction: 'output',
          label: 'Quantity Added',
          description: 'Amount that was added',
          dataType: 'number',
        },
        {
          id: 'newCount',
          type: 'data',
          direction: 'output',
          label: 'New Count',
          description: 'Total quantity after adding',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'itemIdFilter',
          label: 'Item ID Filter',
          type: 'string',
          defaultValue: '',
          description: 'Only trigger for this item ID (empty = all items)',
        },
        {
          key: 'entityIdFilter',
          label: 'Entity ID Filter',
          type: 'string',
          defaultValue: '',
          description: 'Only trigger for this entity (empty = all entities)',
        },
      ],
      color: [0.2, 0.9, 0.5], // Bright green
    };
  }

  override onInit(): void {
    super.onInit();
    this.setupHandler();
  }

  override onDestroy(): void {
    super.onDestroy();
    this.removeHandler();
  }

  private setupHandler(): void {
    if (this.itemAddedHandler) return;

    const itemIdFilter = this.getConfig<string>('itemIdFilter', '');
    const entityIdFilter = this.getConfig<string>('entityIdFilter', '');

    this.itemAddedHandler = (payload: unknown) => {
      const event = payload as {
        entityId: string;
        itemId: string;
        quantity: number;
        newCount: number;
      };

      // Apply filters
      if (itemIdFilter && event.itemId !== itemIdFilter) return;
      if (entityIdFilter && event.entityId !== entityIdFilter) return;

      if (!this.enabled || this.isOnCooldown()) return;

      const connectionManager = getLogicConnectionManager(this.scene);
      if (!connectionManager) return;

      // Emit trigger signal
      const triggerSignal: LogicSignal = {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: Date.now(),
      };

      const connections = connectionManager.getConnectionsFromPort(this.entity.id, 'output');
      for (const conn of connections) {
        this.scene.events.publish({
          type: 'logic:signal',
          payload: {
            targetEntityId: conn.targetEntityId,
            targetPort: conn.targetPort,
            signal: triggerSignal,
          },
          sender: this.entity,
        });
      }

      // Emit data signals
      this.emitDataSignal(connectionManager, 'itemId', event.itemId);
      this.emitDataSignal(connectionManager, 'quantity', event.quantity);
      this.emitDataSignal(connectionManager, 'newCount', event.newCount);
    };

    this.scene.events.on('inventory:item:added', this.itemAddedHandler);
  }

  private emitDataSignal(
    connectionManager: ReturnType<typeof getLogicConnectionManager>,
    portId: string,
    data: string | number
  ): void {
    if (!connectionManager) return;

    const signal: LogicSignal = {
      type: 'data',
      data,
      sourceEntityId: this.entity.id,
      timestamp: Date.now(),
    };

    const connections = connectionManager.getConnectionsFromPort(this.entity.id, portId);
    for (const conn of connections) {
      this.scene.events.publish({
        type: 'logic:signal',
        payload: {
          targetEntityId: conn.targetEntityId,
          targetPort: conn.targetPort,
          signal,
        },
        sender: this.entity,
      });
    }
  }

  private removeHandler(): void {
    if (this.itemAddedHandler) {
      this.scene.events.off('inventory:item:added', this.itemAddedHandler);
      this.itemAddedHandler = null;
    }
  }

  onSignalReceived(
    _portId: string,
    _signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    // This cube doesn't receive signals, it generates them on item add
    return null;
  }
}

/**
 * OnItemRemovedTrigger - Triggers when an item is removed from inventory
 */
export class OnItemRemovedTrigger extends LogicCube {
  private itemRemovedHandler: ((payload: unknown) => void) | null = null;

  getMetadata(): LogicCubeMetadata {
    return {
      type: 'onItemRemoved',
      displayName: 'On Item Removed',
      category: 'trigger',
      description: 'Triggers when an item is removed from inventory',
      icon: 'package-minus',
      inputs: [],
      outputs: [
        {
          id: 'output',
          type: 'trigger',
          direction: 'output',
          label: 'On Removed',
          description: 'Fires when item is removed',
        },
        {
          id: 'itemId',
          type: 'data',
          direction: 'output',
          label: 'Item ID',
          description: 'ID of removed item',
          dataType: 'string',
        },
        {
          id: 'quantity',
          type: 'data',
          direction: 'output',
          label: 'Quantity Removed',
          description: 'Amount that was removed',
          dataType: 'number',
        },
        {
          id: 'remaining',
          type: 'data',
          direction: 'output',
          label: 'Remaining',
          description: 'Remaining quantity after removal',
          dataType: 'number',
        },
      ],
      parameters: [
        {
          key: 'itemIdFilter',
          label: 'Item ID Filter',
          type: 'string',
          defaultValue: '',
          description: 'Only trigger for this item ID (empty = all items)',
        },
        {
          key: 'entityIdFilter',
          label: 'Entity ID Filter',
          type: 'string',
          defaultValue: '',
          description: 'Only trigger for this entity (empty = all entities)',
        },
      ],
      color: [0.9, 0.4, 0.4], // Light red
    };
  }

  override onInit(): void {
    super.onInit();
    this.setupHandler();
  }

  override onDestroy(): void {
    super.onDestroy();
    this.removeHandler();
  }

  private setupHandler(): void {
    if (this.itemRemovedHandler) return;

    const itemIdFilter = this.getConfig<string>('itemIdFilter', '');
    const entityIdFilter = this.getConfig<string>('entityIdFilter', '');

    this.itemRemovedHandler = (payload: unknown) => {
      const event = payload as {
        entityId: string;
        itemId: string;
        quantity: number;
        remaining: number;
      };

      // Apply filters
      if (itemIdFilter && event.itemId !== itemIdFilter) return;
      if (entityIdFilter && event.entityId !== entityIdFilter) return;

      if (!this.enabled || this.isOnCooldown()) return;

      const connectionManager = getLogicConnectionManager(this.scene);
      if (!connectionManager) return;

      // Emit trigger signal
      const triggerSignal: LogicSignal = {
        type: 'trigger',
        sourceEntityId: this.entity.id,
        timestamp: Date.now(),
      };

      const connections = connectionManager.getConnectionsFromPort(this.entity.id, 'output');
      for (const conn of connections) {
        this.scene.events.publish({
          type: 'logic:signal',
          payload: {
            targetEntityId: conn.targetEntityId,
            targetPort: conn.targetPort,
            signal: triggerSignal,
          },
          sender: this.entity,
        });
      }

      // Emit data signals
      this.emitDataSignal(connectionManager, 'itemId', event.itemId);
      this.emitDataSignal(connectionManager, 'quantity', event.quantity);
      this.emitDataSignal(connectionManager, 'remaining', event.remaining);
    };

    this.scene.events.on('inventory:item:removed', this.itemRemovedHandler);
  }

  private emitDataSignal(
    connectionManager: ReturnType<typeof getLogicConnectionManager>,
    portId: string,
    data: string | number
  ): void {
    if (!connectionManager) return;

    const signal: LogicSignal = {
      type: 'data',
      data,
      sourceEntityId: this.entity.id,
      timestamp: Date.now(),
    };

    const connections = connectionManager.getConnectionsFromPort(this.entity.id, portId);
    for (const conn of connections) {
      this.scene.events.publish({
        type: 'logic:signal',
        payload: {
          targetEntityId: conn.targetEntityId,
          targetPort: conn.targetPort,
          signal,
        },
        sender: this.entity,
      });
    }
  }

  private removeHandler(): void {
    if (this.itemRemovedHandler) {
      this.scene.events.off('inventory:item:removed', this.itemRemovedHandler);
      this.itemRemovedHandler = null;
    }
  }

  onSignalReceived(
    _portId: string,
    _signal: LogicSignal,
    _context: LogicExecutionContext
  ): Map<string, LogicSignal> | null {
    // This cube doesn't receive signals, it generates them on item remove
    return null;
  }
}


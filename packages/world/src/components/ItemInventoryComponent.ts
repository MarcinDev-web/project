/**
 * ItemInventoryComponent - Generic item inventory system for Tycoon/Simulator games
 */

import { Component } from './Component.js';
import { registerComponent } from './registry.js';

/**
 * Definition of an item that can be stored in inventory
 */
export interface ItemDefinition {
  /** Unique identifier for the item type */
  itemId: string;
  /** Display name */
  name: string;
  /** Category for organization (e.g., 'resource', 'upgrade', 'consumable', 'tool') */
  category: string;
  /** Whether multiple items can stack in one slot */
  stackable: boolean;
  /** Maximum stack size (only relevant if stackable) */
  maxStack: number;
  /** Optional icon URL or identifier */
  icon?: string;
  /** Optional description */
  description?: string;
  /** Custom metadata for game-specific data */
  metadata?: Record<string, unknown>;
}

/**
 * A slot in the inventory containing an item and its quantity
 */
export interface InventorySlot {
  /** The item definition */
  item: ItemDefinition;
  /** Quantity of items in this slot */
  quantity: number;
}

/**
 * Data for serializing/deserializing ItemInventoryComponent
 */
export interface ItemInventoryComponentData {
  /** Maximum number of unique item types */
  maxSlots?: number;
  /** Initial items */
  items?: Array<{ itemId: string; item: ItemDefinition; quantity: number }>;
}

/**
 * Event data for inventory changes
 */
export interface InventoryChangeEvent {
  /** The item that changed */
  item: ItemDefinition;
  /** Previous quantity */
  previousQuantity: number;
  /** New quantity */
  newQuantity: number;
  /** Change amount (positive for add, negative for remove) */
  delta: number;
}

/**
 * ItemInventoryComponent manages a generic item inventory system.
 * Unlike InventoryComponent (weapons only), this handles any item type
 * with support for stacking, categories, and custom metadata.
 */
export class ItemInventoryComponent extends Component {
  static readonly type = 'ItemInventory';

  /** Maximum number of unique item types that can be stored */
  maxSlots: number = 100;

  /** Items stored by itemId */
  private slots: Map<string, InventorySlot> = new Map();

  /** Item definitions registry (shared across instances) */
  private static itemRegistry: Map<string, ItemDefinition> = new Map();

  constructor(data?: ItemInventoryComponentData) {
    super();
    if (data) {
      this.maxSlots = data.maxSlots ?? this.maxSlots;
      if (data.items) {
        for (const entry of data.items) {
          // Register item definition if not already registered
          if (!ItemInventoryComponent.itemRegistry.has(entry.itemId)) {
            ItemInventoryComponent.itemRegistry.set(entry.itemId, entry.item);
          }
          this.slots.set(entry.itemId, {
            item: entry.item,
            quantity: entry.quantity,
          });
        }
      }
    }
  }

  getType(): string {
    return ItemInventoryComponent.type;
  }

  /**
   * Registers an item definition globally.
   * This allows items to be referenced by ID without full definition.
   */
  static registerItem(item: ItemDefinition): void {
    ItemInventoryComponent.itemRegistry.set(item.itemId, item);
  }

  /**
   * Gets a registered item definition by ID.
   */
  static getItemDefinition(itemId: string): ItemDefinition | undefined {
    return ItemInventoryComponent.itemRegistry.get(itemId);
  }

  /**
   * Clears all registered item definitions.
   * Useful for testing or resetting state.
   */
  static clearRegistry(): void {
    ItemInventoryComponent.itemRegistry.clear();
  }

  /**
   * Adds an item to the inventory.
   * @param itemOrId - Item definition or registered item ID
   * @param quantity - Quantity to add (default: 1)
   * @returns Object with success status and actual amount added
   */
  addItem(
    itemOrId: ItemDefinition | string,
    quantity: number = 1
  ): { success: boolean; added: number; overflow: number } {
    if (quantity <= 0) {
      return { success: false, added: 0, overflow: 0 };
    }

    // Resolve item definition
    let item: ItemDefinition;
    if (typeof itemOrId === 'string') {
      const registered = ItemInventoryComponent.itemRegistry.get(itemOrId);
      if (!registered) {
        return { success: false, added: 0, overflow: quantity };
      }
      item = registered;
    } else {
      item = itemOrId;
      // Auto-register if not already registered
      if (!ItemInventoryComponent.itemRegistry.has(item.itemId)) {
        ItemInventoryComponent.itemRegistry.set(item.itemId, item);
      }
    }

    const existingSlot = this.slots.get(item.itemId);

    if (existingSlot) {
      // Item already exists - add to stack
      if (item.stackable) {
        const spaceAvailable = item.maxStack - existingSlot.quantity;
        const toAdd = Math.min(quantity, spaceAvailable);
        existingSlot.quantity += toAdd;
        const overflow = quantity - toAdd;

        return {
          success: toAdd > 0,
          added: toAdd,
          overflow,
        };
      } else {
        // Non-stackable - can't add more
        return { success: false, added: 0, overflow: quantity };
      }
    } else {
      // New item - check slot limit
      if (this.slots.size >= this.maxSlots) {
        return { success: false, added: 0, overflow: quantity };
      }

      // Add new slot
      const maxQuantity = item.stackable ? item.maxStack : 1;
      const toAdd = Math.min(quantity, maxQuantity);
      
      this.slots.set(item.itemId, {
        item,
        quantity: toAdd,
      });

      return {
        success: true,
        added: toAdd,
        overflow: quantity - toAdd,
      };
    }
  }

  /**
   * Removes an item from the inventory.
   * @param itemId - Item ID to remove
   * @param quantity - Quantity to remove (default: 1)
   * @returns Object with success status and actual amount removed
   */
  removeItem(
    itemId: string,
    quantity: number = 1
  ): { success: boolean; removed: number; remaining: number } {
    if (quantity <= 0) {
      return { success: false, removed: 0, remaining: 0 };
    }

    const slot = this.slots.get(itemId);
    if (!slot) {
      return { success: false, removed: 0, remaining: 0 };
    }

    const toRemove = Math.min(quantity, slot.quantity);
    slot.quantity -= toRemove;

    // Remove slot entirely if empty
    if (slot.quantity <= 0) {
      this.slots.delete(itemId);
    }

    return {
      success: toRemove > 0,
      removed: toRemove,
      remaining: slot.quantity,
    };
  }

  /**
   * Checks if the inventory has at least the specified quantity of an item.
   * @param itemId - Item ID to check
   * @param quantity - Minimum quantity required (default: 1)
   */
  hasItem(itemId: string, quantity: number = 1): boolean {
    const slot = this.slots.get(itemId);
    return slot !== undefined && slot.quantity >= quantity;
  }

  /**
   * Gets the quantity of an item in the inventory.
   * @param itemId - Item ID to check
   * @returns Quantity (0 if not found)
   */
  getItemCount(itemId: string): number {
    return this.slots.get(itemId)?.quantity ?? 0;
  }

  /**
   * Gets a specific inventory slot.
   * @param itemId - Item ID
   */
  getSlot(itemId: string): InventorySlot | undefined {
    const slot = this.slots.get(itemId);
    if (!slot) return undefined;
    // Return a copy to prevent external modification
    return { ...slot, item: { ...slot.item } };
  }

  /**
   * Gets all items in the inventory.
   * @returns Array of inventory slots (copies)
   */
  getItems(): InventorySlot[] {
    return Array.from(this.slots.values()).map((slot) => ({
      ...slot,
      item: { ...slot.item },
    }));
  }

  /**
   * Gets items filtered by category.
   * @param category - Category to filter by
   */
  getItemsByCategory(category: string): InventorySlot[] {
    return this.getItems().filter((slot) => slot.item.category === category);
  }

  /**
   * Gets the number of unique item types in the inventory.
   */
  getSlotCount(): number {
    return this.slots.size;
  }

  /**
   * Checks if the inventory is full (no more unique item types can be added).
   */
  isFull(): boolean {
    return this.slots.size >= this.maxSlots;
  }

  /**
   * Checks if the inventory is empty.
   */
  isEmpty(): boolean {
    return this.slots.size === 0;
  }

  /**
   * Gets the total count of all items across all slots.
   */
  getTotalItemCount(): number {
    let total = 0;
    for (const slot of this.slots.values()) {
      total += slot.quantity;
    }
    return total;
  }

  /**
   * Clears all items from the inventory.
   */
  clear(): void {
    this.slots.clear();
  }

  /**
   * Sets the quantity of an item directly.
   * If quantity is 0 or less, removes the item.
   * @param itemOrId - Item definition or registered item ID
   * @param quantity - New quantity
   */
  setItemCount(itemOrId: ItemDefinition | string, quantity: number): boolean {
    if (quantity <= 0) {
      const itemId = typeof itemOrId === 'string' ? itemOrId : itemOrId.itemId;
      this.slots.delete(itemId);
      return true;
    }

    // Resolve item definition
    let item: ItemDefinition;
    if (typeof itemOrId === 'string') {
      const registered = ItemInventoryComponent.itemRegistry.get(itemOrId);
      if (!registered) {
        return false;
      }
      item = registered;
    } else {
      item = itemOrId;
    }

    const existingSlot = this.slots.get(item.itemId);
    const maxQuantity = item.stackable ? item.maxStack : 1;
    const finalQuantity = Math.min(quantity, maxQuantity);

    if (existingSlot) {
      existingSlot.quantity = finalQuantity;
    } else {
      if (this.slots.size >= this.maxSlots) {
        return false;
      }
      this.slots.set(item.itemId, {
        item,
        quantity: finalQuantity,
      });
    }

    return true;
  }

  clone(): ItemInventoryComponent {
    const copy = new ItemInventoryComponent();
    copy.maxSlots = this.maxSlots;
    
    // Deep copy all slots
    for (const [itemId, slot] of this.slots) {
      copy.slots.set(itemId, {
        item: { ...slot.item },
        quantity: slot.quantity,
      });
    }
    
    return copy;
  }

  toJSON(): ItemInventoryComponentData {
    const items: Array<{ itemId: string; item: ItemDefinition; quantity: number }> = [];
    
    for (const [itemId, slot] of this.slots) {
      items.push({
        itemId,
        item: { ...slot.item },
        quantity: slot.quantity,
      });
    }

    return {
      maxSlots: this.maxSlots,
      items,
    };
  }

  fromJSON(data: ItemInventoryComponentData): void {
    if (typeof data.maxSlots === 'number') {
      this.maxSlots = data.maxSlots;
    }

    this.slots.clear();

    if (data.items) {
      for (const entry of data.items) {
        // Register item if not already registered
        if (!ItemInventoryComponent.itemRegistry.has(entry.itemId)) {
          ItemInventoryComponent.itemRegistry.set(entry.itemId, entry.item);
        }
        this.slots.set(entry.itemId, {
          item: entry.item,
          quantity: entry.quantity,
        });
      }
    }
  }
}

registerComponent(ItemInventoryComponent.type, ItemInventoryComponent);


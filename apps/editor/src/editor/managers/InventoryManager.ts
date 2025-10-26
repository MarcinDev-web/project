/**
 * InventoryManager - Manages hotbar inventory and object counts
 * 
 * Features:
 * - Track object counts per asset
 * - Limited vs Infinite build mode
 * - Restock notifications
 * - Persistence
 */

import type { Asset } from '../assets/AssetTypes';
import { storageLoad, storageSave } from '../../utils/storage';
import { Logger } from '../../utils/logger';

const STORAGE_KEY_INVENTORY = 'editor:inventory';
const STORAGE_KEY_HOTBAR = 'editor:hotbar';
const RESTOCK_THRESHOLD = 10;

export interface InventoryCount {
  assetId: string;
  count: number;
  infinite: boolean;
}

export interface HotbarSlot {
  asset: Asset | null;
  count: number;
}

export type BuildMode = 'infinite' | 'limited';

/**
 * Manages inventory and hotbar system
 */
export class InventoryManager {
  private inventory: Map<string, InventoryCount> = new Map();
  private hotbarSlots: HotbarSlot[] = Array(9).fill(null).map(() => ({ asset: null, count: 0 }));
  private hotbarAssetIds: (string | null)[] = Array(9).fill(null);
  private buildMode: BuildMode = 'infinite';
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Gets build mode
   */
  getBuildMode(): BuildMode {
    return this.buildMode;
  }

  /**
   * Sets build mode
   */
  setBuildMode(mode: BuildMode): void {
    this.buildMode = mode;
    this.notifyListeners();
    Logger.debug(`Build mode set to: ${mode}`);
  }

  /**
   * Gets inventory count for asset
   */
  getCount(assetId: string): number {
    const item = this.inventory.get(assetId);
    return item ? item.count : 0;
  }

  /**
   * Checks if asset is infinite
   */
  isInfinite(assetId: string): boolean {
    if (this.buildMode === 'infinite') {
      return true;
    }
    
    const item = this.inventory.get(assetId);
    return item ? item.infinite : false;
  }

  /**
   * Adds items to inventory
   */
  addItems(assetId: string, count: number): void {
    if (count <= 0) {
      if (count < 0) {
        Logger.warn(`Ignoring attempt to add negative count (${count}) for ${assetId}`);
      }
      return;
    }

    const current = this.inventory.get(assetId);
    
    if (current) {
      current.count += count;
    } else {
      this.inventory.set(assetId, {
        assetId,
        count,
        infinite: false,
      });
    }
    
    this.updateHotbarCounts(assetId);
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug(`Added ${count} of ${assetId}`);
  }

  /**
   * Removes items from inventory
   */
  removeItems(assetId: string, count: number): boolean {
    if (count <= 0) return true;
    if (this.isInfinite(assetId)) {
      return true;
    }

    const current = this.inventory.get(assetId);
    if (!current || current.count < count) {
      return false;
    }

    current.count -= count;

    if (current.count <= 0) {
      this.inventory.delete(assetId);
    }

    if (current.count <= RESTOCK_THRESHOLD && current.count + count > RESTOCK_THRESHOLD) {
      this.notifyRestock(assetId, current.count);
    }

    this.updateHotbarCounts(assetId);
    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  /**
   * Checks if can use asset
   */
  canUse(assetId: string, count: number = 1): boolean {
    if (this.isInfinite(assetId)) {
      return true;
    }

    const current = this.getCount(assetId);
    return current >= count;
  }

  /**
   * Sets asset as infinite
   */
  setInfinite(assetId: string, infinite: boolean): void {
    const current = this.inventory.get(assetId);
    
    if (current) {
      current.infinite = infinite;
    } else {
      this.inventory.set(assetId, {
        assetId,
        count: 0,
        infinite,
      });
    }
    
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Gets hotbar slots
   */
  getHotbarSlots(): HotbarSlot[] {
    return this.hotbarSlots;
  }

  /**
   * Gets hotbar slot
   */
  getHotbarSlot(index: number): HotbarSlot | null {
    if (index < 0 || index >= this.hotbarSlots.length) {
      return null;
    }
    return this.hotbarSlots[index]!;
  }

  /**
   * Sets hotbar slot
   */
  setHotbarSlot(index: number, asset: Asset | null): void {
    if (index < 0 || index >= this.hotbarSlots.length) {
      return;
    }

    const slot = this.hotbarSlots[index]!;
    slot.asset = asset;
    slot.count = asset ? this.getCount(asset.metadata.id) : 0;
    this.hotbarAssetIds[index] = asset ? asset.metadata.id : null;
    
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug(`Hotbar slot ${index + 1} set to: ${asset?.metadata.name || 'empty'}`);
  }

  /**
   * Clears hotbar slot
   */
  clearHotbarSlot(index: number): void {
    this.setHotbarSlot(index, null);
  }

  /**
   * Swaps two hotbar slots
   */
  swapHotbarSlots(indexA: number, indexB: number): void {
    if (
      indexA < 0 || indexA >= this.hotbarSlots.length ||
      indexB < 0 || indexB >= this.hotbarSlots.length
    ) {
      return;
    }

    const temp = this.hotbarSlots[indexA]!;
    this.hotbarSlots[indexA] = this.hotbarSlots[indexB]!;
    this.hotbarSlots[indexB] = temp;
    const tempId = this.hotbarAssetIds[indexA] ?? null;
    this.hotbarAssetIds[indexA] = this.hotbarAssetIds[indexB] ?? null;
    this.hotbarAssetIds[indexB] = tempId;
    
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug(`Swapped hotbar slots ${indexA + 1} and ${indexB + 1}`);
  }

  /**
   * Updates hotbar counts for an asset
   */
  private updateHotbarCounts(assetId: string): void {
    const count = this.getCount(assetId);
    
    for (const slot of this.hotbarSlots) {
      if (slot.asset && slot.asset.metadata.id === assetId) {
        slot.count = count;
      }
    }
  }

  /**
   * Notifies about restock needed
   */
  private notifyRestock(assetId: string, remaining: number): void {
    Logger.warn(`Low stock: ${assetId} (${remaining} remaining)`);
    // Could emit event here for UI notification
  }

  /**
   * Adds change listener
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Saves to localStorage
   */
  private saveToStorage(): void {
    try {
      // Save inventory
      const inventoryData = Array.from(this.inventory.values());
      storageSave(STORAGE_KEY_INVENTORY, inventoryData);

      // Save hotbar (only asset IDs)
      storageSave(STORAGE_KEY_HOTBAR, [...this.hotbarAssetIds]);
    } catch (err) {
      Logger.error('Failed to save inventory:', err as Error);
    }
  }

  /**
   * Loads from localStorage
   */
  private loadFromStorage(): void {
    try {
      // Load inventory
      const inventoryData = storageLoad<InventoryCount[]>(STORAGE_KEY_INVENTORY);
      if (inventoryData) {
        for (const item of inventoryData) {
          this.inventory.set(item.assetId, item);
        }
      }

      // Load hotbar (asset IDs only, will be resolved by AssetPalette)
      const hotbarData = storageLoad<(string | null)[]>(STORAGE_KEY_HOTBAR);
      if (hotbarData) {
        this.hotbarAssetIds = this.normalizeHotbarData(hotbarData);
      }

      Logger.debug('Inventory loaded from storage');
    } catch (err) {
      Logger.error('Failed to load inventory:', err as Error);
    }
  }

  /**
   * Gets hotbar data for persistence
   */
  getHotbarData(): (string | null)[] {
    return [...this.hotbarAssetIds];
  }

  /**
   * Restores hotbar from data
   */
  restoreHotbar(assetIds: (string | null)[], assetLookup: (id: string) => Asset | null): void {
    const normalized = this.normalizeHotbarData(assetIds);
    let changed = false;

    for (let i = 0; i < this.hotbarSlots.length; i++) {
      const assetId = normalized[i];
      this.hotbarAssetIds[i] = assetId ?? null;

      const slot = this.hotbarSlots[i]!;
      const asset = assetId ? assetLookup(assetId) : null;
      const previousId = slot.asset?.metadata.id ?? null;

      if (asset && asset.metadata.id !== previousId) {
        slot.asset = asset;
        slot.count = this.getCount(asset.metadata.id);
        changed = true;
      } else if (!asset && previousId !== null) {
        slot.asset = null;
        slot.count = 0;
        changed = true;
      } else if (asset && slot.count !== this.getCount(asset.metadata.id)) {
        slot.count = this.getCount(asset.metadata.id);
        changed = true;
      }
    }

    if (changed) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Resets inventory
   */
  reset(): void {
    this.inventory.clear();
    this.hotbarSlots = Array(9).fill(null).map(() => ({ asset: null, count: 0 }));
    this.hotbarAssetIds = Array(9).fill(null);
    this.saveToStorage();
    this.notifyListeners();
    Logger.debug('Inventory reset');
  }

  /**
   * Gets total item count
   */
  getTotalCount(): number {
    let total = 0;
    for (const item of this.inventory.values()) {
      if (!item.infinite) {
        total += item.count;
      }
    }
    return total;
  }

  /**
   * Gets unique asset count
   */
  getUniqueCount(): number {
    return this.inventory.size;
  }

  private normalizeHotbarData(data: (string | null)[]): (string | null)[] {
    const normalized = Array(9).fill(null) as (string | null)[];
    for (let i = 0; i < Math.min(data.length, normalized.length); i++) {
      normalized[i] = data[i];
    }
    return normalized;
  }
}


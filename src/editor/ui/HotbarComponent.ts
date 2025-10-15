/**
 * HotbarComponent - Standalone hotbar with 9 slots for quick asset access
 * 
 * Features:
 * - 9 slots accessible via keyboard shortcuts (1-9)
 * - Visual feedback for selection
 * - Drag & drop support for reordering
 * - Integration with InventoryManager
 * - Persistent across sessions
 */

import type { Asset } from '../assets/AssetTypes';
import type { InventoryManager } from '../managers/InventoryManager';
import { createIcon } from '../utils/icons';
import { Logger } from '../../logger';

export interface HotbarComponentConfig {
  inventoryManager?: InventoryManager;
  onSlotActivated: (asset: Asset, slotIndex: number) => void;
  onSlotChanged?: (slotIndex: number, asset: Asset | null) => void;
}

export class HotbarComponent {
  private container: HTMLElement | null = null;
  private slots: (Asset | null)[] = Array(9).fill(null);
  private selectedSlot: number = -1;
  private draggedAsset: Asset | null = null;
  private draggedFromSlot: number | null = null;
  private inventoryCleanup: (() => void) | null = null;
  private config: HotbarComponentConfig;

  constructor(config: HotbarComponentConfig) {
    this.config = config;
  }

  /**
   * Mounts the hotbar to a parent element
   */
  mount(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'hotbar-component';

    // Create 9 slots
    for (let i = 0; i < 9; i++) {
      const slot = this.createSlot(i);
      this.container.appendChild(slot);
    }

    parent.appendChild(this.container);

    // Setup inventory integration
    this.setupInventoryIntegration();

    Logger.debug('HotbarComponent: Mounted');
  }

  /**
   * Creates a single hotbar slot
   */
  private createSlot(index: number): HTMLElement {
    const slot = document.createElement('button');
    slot.className = 'hotbar-slot';
    slot.dataset.slot = index.toString();
    slot.setAttribute('aria-label', `Hotbar slot ${index + 1}`);
    slot.setAttribute('draggable', 'false'); // Will be set to true when asset is added

    // Slot number indicator
    const slotNumber = document.createElement('div');
    slotNumber.className = 'hotbar-slot-number';
    slotNumber.textContent = (index + 1).toString();
    slot.appendChild(slotNumber);

    // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'hotbar-slot-icon';
    slot.appendChild(iconContainer);

    // Click handler - activate slot
    slot.addEventListener('click', () => this.activateSlot(index));

    // Right click to clear slot
    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.clearSlot(index);
    });

    // Drag and drop handlers
    this.setupSlotDragDrop(slot, index);

    return slot;
  }

  /**
   * Sets up drag and drop for a slot
   */
  private setupSlotDragDrop(slot: HTMLElement, index: number): void {
    // Drag start - dragging from this slot
    slot.addEventListener('dragstart', (e) => {
      const asset = this.slots[index];
      if (!asset) {
        e.preventDefault();
        return;
      }

      this.draggedAsset = asset;
      this.draggedFromSlot = index;

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-hotbar-asset', asset.metadata.id);
      }

      slot.classList.add('dragging');
    });

    slot.addEventListener('dragend', () => {
      this.draggedAsset = null;
      this.draggedFromSlot = null;
      slot.classList.remove('dragging');
    });

    // Allow dropping on this slot
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      slot.classList.add('drag-over');
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');

      // Check if dragging from another hotbar slot
      if (this.draggedAsset && this.draggedFromSlot !== null) {
        this.swapSlots(this.draggedFromSlot, index);
      }
      // Check if dragging from catalog (external)
      else if (e.dataTransfer?.getData('application/x-catalog-asset')) {
        const assetId = e.dataTransfer.getData('application/x-catalog-asset');
        // This will be handled by the parent component
        Logger.debug(`HotbarComponent: Drop from catalog - ${assetId} to slot ${index}`);
      }
    });
  }

  /**
   * Activates a hotbar slot (user clicked or pressed key)
   */
  activateSlot(index: number): void {
    if (index < 0 || index >= 9) return;

    const asset = this.slots[index];
    if (!asset) {
      Logger.debug(`HotbarComponent: Slot ${index + 1} is empty`);
      return;
    }

    this.selectedSlot = index;
    this.updateSlotVisuals();

    // Notify parent
    this.config.onSlotActivated(asset, index);

    Logger.debug(`HotbarComponent: Activated slot ${index + 1} - ${asset.metadata.name}`);
  }

  /**
   * Sets an asset in a specific slot
   */
  setSlot(index: number, asset: Asset | null): void {
    if (index < 0 || index >= 9) return;

    this.slots[index] = asset;
    this.refreshSlot(index);

    // Update inventory manager if available
    if (this.config.inventoryManager) {
      this.config.inventoryManager.setHotbarSlot(index, asset);
    }

    // Notify parent
    this.config.onSlotChanged?.(index, asset);

    Logger.debug(`HotbarComponent: Set slot ${index + 1} to ${asset?.metadata.name || 'empty'}`);
  }

  /**
   * Clears a slot
   */
  clearSlot(index: number): void {
    this.setSlot(index, null);
  }

  /**
   * Swaps two slots
   */
  swapSlots(indexA: number, indexB: number): void {
    if (indexA < 0 || indexA >= 9 || indexB < 0 || indexB >= 9) return;

    const temp = this.slots[indexA];
    this.slots[indexA] = this.slots[indexB];
    this.slots[indexB] = temp;

    this.refreshSlot(indexA);
    this.refreshSlot(indexB);

    // Update inventory manager
    if (this.config.inventoryManager) {
      this.config.inventoryManager.swapHotbarSlots(indexA, indexB);
    }

    Logger.debug(`HotbarComponent: Swapped slots ${indexA + 1} and ${indexB + 1}`);
  }

  /**
   * Refreshes a slot's visual appearance
   */
  private refreshSlot(index: number): void {
    if (!this.container) return;

    const slot = this.container.querySelector(`[data-slot="${index}"]`) as HTMLElement;
    if (!slot) return;

    const asset = this.slots[index];
    const iconContainer = slot.querySelector('.hotbar-slot-icon') as HTMLElement;
    if (!iconContainer) return;

    // Update icon
    iconContainer.innerHTML = '';
    if (asset) {
      // Show asset color as background
      const colorBox = document.createElement('div');
      colorBox.className = 'hotbar-slot-color';
      const [r, g, b, a] = asset.color;
      colorBox.style.backgroundColor = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      iconContainer.appendChild(colorBox);

      // Make slot draggable
      slot.setAttribute('draggable', 'true');
      slot.classList.add('has-asset');
    } else {
      // Empty slot - show placeholder
      const placeholder = createIcon('plus', 16);
      placeholder.style.opacity = '0.3';
      iconContainer.appendChild(placeholder);

      slot.setAttribute('draggable', 'false');
      slot.classList.remove('has-asset');
    }

    // Update count badge if inventory manager is available
    this.updateSlotCount(index);
  }

  /**
   * Updates the count badge for a slot
   */
  private updateSlotCount(index: number): void {
    if (!this.container || !this.config.inventoryManager) return;

    const slot = this.container.querySelector(`[data-slot="${index}"]`) as HTMLElement;
    if (!slot) return;

    const asset = this.slots[index];
    if (!asset) return;

    const count = this.config.inventoryManager.getCount(asset.metadata.id);
    const buildMode = this.config.inventoryManager.getBuildMode();

    // Update or create count badge
    let badge = slot.querySelector('.hotbar-count-badge') as HTMLElement;
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'hotbar-count-badge';
      slot.appendChild(badge);
    }

    if (buildMode === 'limited') {
      badge.textContent = count.toString();
      badge.style.display = 'block';
      badge.classList.toggle('low', count <= 10);
    } else {
      badge.style.display = 'none';
    }
  }

  /**
   * Updates visual selection state for all slots
   */
  private updateSlotVisuals(): void {
    if (!this.container) return;

    const allSlots = this.container.querySelectorAll('.hotbar-slot');
    allSlots.forEach((slot, index) => {
      slot.classList.toggle('selected', index === this.selectedSlot);
    });
  }

  /**
   * Clears the selection
   */
  clearSelection(): void {
    this.selectedSlot = -1;
    this.updateSlotVisuals();
  }

  /**
   * Gets the asset in a specific slot
   */
  getSlot(index: number): Asset | null {
    if (index < 0 || index >= 9) return null;
    return this.slots[index];
  }

  /**
   * Gets all slots
   */
  getAllSlots(): (Asset | null)[] {
    return [...this.slots];
  }

  /**
   * Checks if a slot is empty
   */
  isSlotEmpty(index: number): boolean {
    return this.getSlot(index) === null;
  }

  /**
   * Finds the first empty slot index
   */
  findEmptySlot(): number {
    return this.slots.findIndex((asset) => asset === null);
  }

  /**
   * Checks if an asset is already in the hotbar
   */
  hasAsset(asset: Asset): boolean {
    return this.slots.some((slot) => slot?.metadata.id === asset.metadata.id);
  }

  /**
   * Setup inventory manager integration
   */
  private setupInventoryIntegration(): void {
    if (!this.config.inventoryManager) return;

    // Listen for inventory changes to update counts
    this.inventoryCleanup = this.config.inventoryManager.addListener(() => {
      this.updateAllCounts();
    });

    // Load hotbar from inventory
    const hotbarSlots = this.config.inventoryManager.getHotbarSlots();
    hotbarSlots.forEach((slot, index) => {
      if (slot.asset) {
        this.slots[index] = slot.asset;
        this.refreshSlot(index);
      }
    });

    this.updateAllCounts();
  }

  /**
   * Updates count badges for all slots
   */
  private updateAllCounts(): void {
    for (let i = 0; i < 9; i++) {
      this.updateSlotCount(i);
    }
  }

  /**
   * Disposes the component
   */
  dispose(): void {
    if (this.inventoryCleanup) {
      this.inventoryCleanup();
      this.inventoryCleanup = null;
    }

    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container = null;
    Logger.debug('HotbarComponent: Disposed');
  }

  /**
   * Gets the container element
   */
  getContainer(): HTMLElement | null {
    return this.container;
  }

  /**
   * Sets visibility
   */
  setVisibility(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'flex' : 'none';
    }
  }
}


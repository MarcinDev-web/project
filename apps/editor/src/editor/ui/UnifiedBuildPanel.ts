/**
 * UnifiedBuildPanel - Combines hotbar for unified Build Mode experience
 * 
 * Features:
 * - Bottom hotbar (Minecraft-style, 1-9 keys)
 * - Coordinated placement with hotbar
 * - Keyboard shortcuts (1-9 for hotbar slots)
 * 
 * Note: Build Menu is handled separately by AssetPalette component
 */

import type { Asset } from '../types/BlockAssetTypes';
import type { Scene } from '@engine/world';
import type { EditorState } from '../core/state';
import type { InventoryManager } from '../managers/InventoryManager';
import { HotbarComponent } from './HotbarComponent';
import { PlacementCoordinator } from './PlacementCoordinator';
import type { PlacementMode } from '../placement/PlacementMode';
import { Logger } from '../../utils/logger';

export interface UnifiedBuildPanelConfig {
  scene: Scene;
  state: EditorState;
  placementMode: PlacementMode;
  inventoryManager?: InventoryManager;
  onAssetSelect?: (asset: Asset, source: 'hotbar' | 'build-menu') => void;
  onPlacementStart?: (asset: Asset) => void;
  onPlacementEnd?: (confirmed: boolean) => void;
  onStatusUpdate?: (message: string) => void;
}

export class UnifiedBuildPanel {
  private container: HTMLElement | null = null;
  private hotbar: HotbarComponent | null = null;
  private coordinator: PlacementCoordinator;
  private config: UnifiedBuildPanelConfig;
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(config: UnifiedBuildPanelConfig) {
    this.config = config;

    // Initialize placement coordinator
    this.coordinator = new PlacementCoordinator({
      placementMode: config.placementMode,
      onPlacementStart: (asset, source) => {
        this.config.onPlacementStart?.(asset);
        this.config.onAssetSelect?.(asset, source || 'build-menu');
      },
      onPlacementEnd: (confirmed) => {
        this.config.onPlacementEnd?.(confirmed);
      },
      onStatusUpdate: (message) => {
        this.config.onStatusUpdate?.(message);
      },
    });
  }

  /**
   * Mounts the unified panel
   */
  mount(): void {
    if (this.container) {
      Logger.warn('UnifiedBuildPanel: Already mounted');
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'unified-build-panel';

    // Create hotbar
    const hotbarContainer = document.createElement('div');
    hotbarContainer.className = 'unified-build-hotbar-container';
    this.container.appendChild(hotbarContainer);

    this.hotbar = new HotbarComponent({
      ...(this.config.inventoryManager && { inventoryManager: this.config.inventoryManager }),
      onSlotActivated: (asset, slotIndex) => this.handleHotbarActivate(asset, slotIndex),
      onSlotChanged: () => {
        // Slot changed - could notify build menu if needed
      },
    });
    this.hotbar.mount(hotbarContainer);

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Mount to document
    document.body.appendChild(this.container);

    Logger.debug('UnifiedBuildPanel: Mounted');
  }


  /**
   * Handles hotbar slot activation
   */
  private handleHotbarActivate(asset: Asset, slotIndex: number): void {
    Logger.debug(`UnifiedBuildPanel: Hotbar activated slot ${slotIndex + 1} - ${asset.name}`);

    // Start placement via coordinator
    this.coordinator.startPlacement(asset, 'hotbar');
  }


  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    this.keyboardHandler = (e: KeyboardEvent) => {
      // Don't handle if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // 1-9 keys for hotbar slots
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const slotIndex = parseInt(e.key, 10) - 1;
        const asset = this.hotbar?.getSlot(slotIndex);
        if (asset) {
          this.handleHotbarActivate(asset, slotIndex);
        }
        e.preventDefault();
        return;
      }

      // Q/E for rotation during placement
      if (this.coordinator.isPlacementActive()) {
        if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          void this.coordinator.rotatePreview(-1);
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          void this.coordinator.rotatePreview(1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.coordinator.confirmPlacement();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.coordinator.cancelPlacement();
        }
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Removes keyboard shortcuts
   */
  private removeKeyboardShortcuts(): void {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
  }

  /**
   * Sets visibility of the panel
   */
  setVisibility(visible: boolean): void {
    if (!this.container) return;

    this.container.style.display = visible ? 'flex' : 'none';

    // Also update child components
    this.hotbar?.setVisibility(visible);

    Logger.debug(`UnifiedBuildPanel: Visibility set to ${visible}`);
  }

  /**
   * Checks if currently visible
   */
  isVisible(): boolean {
    if (!this.container) return false;
    return this.container.style.display !== 'none';
  }

  /**
   * Gets the placement coordinator
   */
  getCoordinator(): PlacementCoordinator {
    return this.coordinator;
  }

  /**
   * Gets the hotbar component
   */
  getHotbar(): HotbarComponent | null {
    return this.hotbar;
  }


  /**
   * Adds an asset to the first empty hotbar slot
   */
  addToHotbar(asset: Asset): boolean {
    if (!this.hotbar) return false;

    const emptySlot = this.hotbar.findEmptySlot();
    if (emptySlot === -1) {
      this.config.onStatusUpdate?.('Hotbar is full');
      return false;
    }

    this.hotbar.setSlot(emptySlot, asset);
    const assetName = asset.name || 'asset';
    this.config.onStatusUpdate?.(`Added ${assetName} to hotbar slot ${emptySlot + 1}`);
    return true;
  }

  /**
   * Refreshes hotbar
   */
  refresh(): void {
    if (this.hotbar) {
      // Refresh all slots
      for (let i = 0; i < 9; i++) {
        const slot = this.hotbar.getSlot(i);
        if (slot !== null) {
          this.hotbar.setSlot(i, slot);
        }
      }
    }
  }

  /**
   * Disposes the panel
   */
  dispose(): void {
    // Cancel any active placement before disposing
    if (this.coordinator.isPlacementActive()) {
      this.coordinator.cancelPlacement();
    }

    // Remove keyboard shortcuts
    this.removeKeyboardShortcuts();

    // Dispose child components
    this.hotbar?.dispose();

    // Remove from DOM
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container = null;
    this.hotbar = null;

    Logger.debug('UnifiedBuildPanel: Disposed');
  }
}


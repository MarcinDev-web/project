/**
 * UnifiedBuildPanel - Combines hotbar and catalog for unified Build Mode experience
 * 
 * Features:
 * - Bottom hotbar (Minecraft-style, 1-9 keys)
 * - Side catalog panel (browse full library)
 * - Coordinated placement between both
 * - Drag from catalog to hotbar
 * - Keyboard shortcuts (1-9, Ctrl+K for search)
 */

import type { Asset, AssetVariant } from '@engine/assets';
import type { Scene } from '@engine/world';
import type { EditorState } from '../core/state';
import type { InventoryManager } from '../managers/InventoryManager';
import { HotbarComponent } from './HotbarComponent';
import { CatalogPanel } from './CatalogPanel';
import { PlacementCoordinator } from './PlacementCoordinator';
import type { PlacementMode } from '../placement/PlacementMode';
import { assetRegistry } from '../assets/AssetRegistry';
import { Logger } from '../../utils/logger';

export interface UnifiedBuildPanelConfig {
  scene: Scene;
  state: EditorState;
  placementMode: PlacementMode;
  inventoryManager?: InventoryManager;
  onAssetSelect?: (asset: Asset, variant?: AssetVariant, source: 'hotbar' | 'catalog') => void;
  onPlacementStart?: (asset: Asset, variant?: AssetVariant) => void;
  onPlacementEnd?: (confirmed: boolean) => void;
  onStatusUpdate?: (message: string) => void;
}

export class UnifiedBuildPanel {
  private container: HTMLElement | null = null;
  private hotbar: HotbarComponent | null = null;
  private catalog: CatalogPanel | null = null;
  private coordinator: PlacementCoordinator;
  private config: UnifiedBuildPanelConfig;
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
  private draggedAsset: Asset | null = null;

  constructor(config: UnifiedBuildPanelConfig) {
    this.config = config;

    // Initialize placement coordinator
    this.coordinator = new PlacementCoordinator({
      placementMode: config.placementMode,
      onPlacementStart: (asset, variant, source) => {
        this.config.onPlacementStart?.(asset, variant);
        this.config.onAssetSelect?.(asset, variant, source || 'catalog');
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

    // Get catalog position from preferences
    const catalogPosition = this.config.state.uiPreferences.value.catalogPosition || 'left';
    this.container.classList.add(`catalog-${catalogPosition}`);

    // Create catalog panel
    const catalogContainer = document.createElement('div');
    catalogContainer.className = 'unified-build-catalog-container';
    this.container.appendChild(catalogContainer);

    this.catalog = new CatalogPanel({
      onAssetSelect: (asset, variant) => this.handleCatalogSelect(asset, variant),
      onDragStart: (asset) => this.handleDragStart(asset),
      onDragEnd: () => this.handleDragEnd(),
      isAssetInHotbar: (asset) => this.hotbar?.hasAsset(asset) || false,
    });
    this.catalog.mount(catalogContainer);

    // Create hotbar
    const hotbarContainer = document.createElement('div');
    hotbarContainer.className = 'unified-build-hotbar-container';
    this.container.appendChild(hotbarContainer);

    this.hotbar = new HotbarComponent({
      inventoryManager: this.config.inventoryManager,
      onSlotActivated: (asset, slotIndex) => this.handleHotbarActivate(asset, slotIndex),
      onSlotChanged: (slotIndex, asset) => {
        // Refresh catalog to update "in hotbar" indicators
        this.catalog?.refresh();
      },
    });
    this.hotbar.mount(hotbarContainer);

    // Setup drag and drop between catalog and hotbar
    this.setupCatalogToHotbarDrop();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Mount to document
    document.body.appendChild(this.container);

    Logger.debug('UnifiedBuildPanel: Mounted');
  }

  /**
   * Handles asset selection from catalog
   */
  private handleCatalogSelect(asset: Asset, variant?: AssetVariant): void {
    Logger.debug(`UnifiedBuildPanel: Catalog selected ${asset.metadata.name}`);
    
    // Start placement via coordinator
    this.coordinator.startPlacement(asset, variant, 'catalog');
  }

  /**
   * Handles hotbar slot activation
   */
  private handleHotbarActivate(asset: Asset, slotIndex: number): void {
    Logger.debug(`UnifiedBuildPanel: Hotbar activated slot ${slotIndex + 1} - ${asset.metadata.name}`);

    // Start placement via coordinator
    this.coordinator.startPlacement(asset, undefined, 'hotbar');
  }

  /**
   * Handles drag start from catalog
   */
  private handleDragStart(asset: Asset): void {
    this.draggedAsset = asset;
    Logger.debug(`UnifiedBuildPanel: Drag started - ${asset.metadata.name}`);
  }

  /**
   * Handles drag end
   */
  private handleDragEnd(): void {
    this.draggedAsset = null;
    Logger.debug('UnifiedBuildPanel: Drag ended');
  }

  /**
   * Setup drag and drop from catalog to hotbar
   */
  private setupCatalogToHotbarDrop(): void {
    if (!this.hotbar) return;

    const hotbarContainer = this.hotbar.getContainer();
    if (!hotbarContainer) return;

    // Allow dropping on the entire hotbar container
    hotbarContainer.addEventListener('dragover', (e) => {
      // Check if dragging from catalog
      if (this.draggedAsset && e.dataTransfer?.types.includes('application/x-catalog-asset')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    hotbarContainer.addEventListener('drop', (e) => {
      if (!this.draggedAsset) return;

      e.preventDefault();

      // Find which slot was dropped on
      const target = e.target as HTMLElement;
      const slot = target.closest('.hotbar-slot') as HTMLElement;
      
      if (slot && slot.dataset.slot) {
        const slotIndex = parseInt(slot.dataset.slot, 10);
        
        // Add asset to hotbar
        this.hotbar!.setSlot(slotIndex, this.draggedAsset);
        
        Logger.debug(`UnifiedBuildPanel: Dropped ${this.draggedAsset.metadata.name} to slot ${slotIndex + 1}`);
        
        // Show status message
        this.config.onStatusUpdate?.(
          `Added ${this.draggedAsset.metadata.name} to hotbar slot ${slotIndex + 1}`
        );
      }

      this.draggedAsset = null;
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    this.keyboardHandler = (e: KeyboardEvent) => {
      // Don't handle if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Exception: Ctrl+K for search even in inputs
        if (e.ctrlKey && e.key === 'k') {
          e.preventDefault();
          this.catalog?.focusSearch();
        }
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

      // Ctrl+K to focus catalog search
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this.catalog?.focusSearch();
        return;
      }

      // Q/E for rotation during placement
      if (this.coordinator.isPlacementActive()) {
        if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          this.coordinator.rotatePreview(-1);
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          this.coordinator.rotatePreview(1);
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
    this.catalog?.setVisibility(visible);

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
   * Gets the catalog component
   */
  getCatalog(): CatalogPanel | null {
    return this.catalog;
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
    this.config.onStatusUpdate?.(`Added ${asset.metadata.name} to hotbar slot ${emptySlot + 1}`);
    return true;
  }

  /**
   * Refreshes both hotbar and catalog
   */
  refresh(): void {
    this.hotbar?.refresh?.();
    this.catalog?.refresh();
  }

  /**
   * Disposes the panel
   */
  dispose(): void {
    // Remove keyboard shortcuts
    this.removeKeyboardShortcuts();

    // Dispose child components
    this.hotbar?.dispose();
    this.catalog?.dispose();

    // Remove from DOM
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container = null;
    this.hotbar = null;
    this.catalog = null;

    Logger.debug('UnifiedBuildPanel: Disposed');
  }
}


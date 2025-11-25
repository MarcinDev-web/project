/**
 * AssetPalette - Simplified Build Menu (Creative Style)
 * 
 * Features:
 * - Bottom hotbar (1-9 keys for quick access)
 * - Green button to expand build menu
 * - Build menu shows all 10 blocks in a simple grid
 * - No categories, search, or filters - just blocks
 */

import type { Scene } from '@engine/world';
import type { EditorState } from '../../core/state';
import { BLOCK_LIBRARY } from '@engine/blocks';
import type { BlockAsset, AssetPreset } from '../../types/BlockAssetTypes';
import { blockToAsset } from '../../types/BlockAssetTypes';
import type { VegetationPresetManager } from '../../managers/VegetationPresetManager';
import type { NpcPresetManager } from '../../managers/NpcPresetManager';
import type { MarketplaceAssetManager } from '../../managers/MarketplaceAssetManager';

export interface AssetPaletteConfig {
  scene: Scene;
  state: EditorState;
  onAssetSelect: (asset: BlockAsset) => void;
  onStartPlacement: (asset: BlockAsset) => void;
  onStartPlacementPreset?: (preset: AssetPreset) => void;
  vegetationPresetManager?: VegetationPresetManager | null;
  npcPresetManager?: NpcPresetManager | null;
  marketplaceAssetManager?: MarketplaceAssetManager | null;
  onMarketplaceAssetSelect?: (asset: { id: string; title: string; thumbnailUrl?: string; fileUrl: string }) => void;
}

export class AssetPalette {
  private container: HTMLElement | null = null;
  private hotbar: HTMLElement | null = null;
  private buildMenu: HTMLElement | null = null;
  private isExpanded = false;
  private hotbarSlots: (BlockAsset | null)[] = new Array(9).fill(null);
  private allBlocks: BlockAsset[] = [];
  private vegetationAssets: BlockAsset[] = [];
  private npcAssets: BlockAsset[] = [];
  private marketplaceAssets: Array<{ id: string; title: string; thumbnailUrl?: string; fileUrl: string }> = [];
  private keyboardCleanup: (() => void) | null = null;
  private vegetationPresetManagerListener: (() => void) | null = null;
  private npcPresetManagerListener: (() => void) | null = null;
  private marketplaceAssetManagerListener: (() => void) | null = null;

  constructor(private readonly config: AssetPaletteConfig) {
    // Convert all blocks to assets
    this.allBlocks = Object.values(BLOCK_LIBRARY).map(blockToAsset);
    
    // Load vegetation presets
    this.loadVegetationPresets();
    
    // Load NPC presets
    this.loadNpcPresets();
    
    // Load marketplace assets
    void this.loadMarketplaceAssets();

    // Initialize hotbar with first 9 blocks
    this.hotbarSlots = this.allBlocks.slice(0, 9);

    // Listen for vegetation preset changes
    if (this.config.vegetationPresetManager) {
      this.vegetationPresetManagerListener = this.config.vegetationPresetManager.addListener(() => {
        this.loadVegetationPresets();
        this.refresh();
      });
    }

    // Listen for NPC preset changes
    if (this.config.npcPresetManager) {
      this.npcPresetManagerListener = this.config.npcPresetManager.addListener(() => {
        this.loadNpcPresets();
        this.refresh();
      });
    }

    // Listen for marketplace asset changes
    if (this.config.marketplaceAssetManager) {
      this.marketplaceAssetManagerListener = this.config.marketplaceAssetManager.addListener(() => {
        void this.loadMarketplaceAssets();
        this.refresh();
      });
    }
  }

  /**
   * Mounts the asset palette to the document.
   */
  public mount(): void {
    if (this.container) {
      console.warn('AssetPalette: Already mounted');
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'asset-palette-container';

    // Create hotbar (always visible at bottom)
    this.hotbar = this.createHotbar();
    this.container.appendChild(this.hotbar);

    // Create expandable build menu
    this.buildMenu = this.createBuildMenu();
    this.container.appendChild(this.buildMenu);

    document.body.appendChild(this.container);

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Creates the hotbar with 9 slots + expand button
   */
  private createHotbar(): HTMLElement {
    const hotbar = document.createElement('div');
    hotbar.className = 'hotbar';

    // Create 9 slots
    for (let i = 0; i < 9; i++) {
      const slot = this.createHotbarSlot(i);
      hotbar.appendChild(slot);
    }

    // Create expand/collapse button (green button)
    const expandBtn = document.createElement('button');
    expandBtn.className = 'hotbar-expand-button';
    expandBtn.title = 'Toggle Build Menu (B)';
    expandBtn.innerHTML = '🔨'; // Hammer emoji or use icon
    expandBtn.addEventListener('click', () => this.toggleBuildMenu());
    hotbar.appendChild(expandBtn);

    return hotbar;
  }

  /**
   * Creates a single hotbar slot
   */
  private createHotbarSlot(index: number): HTMLElement {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot';
    slot.dataset.slot = index.toString();

    // Slot number
    const number = document.createElement('div');
    number.className = 'hotbar-slot-number';
    number.textContent = (index + 1).toString();
    slot.appendChild(number);

    // Block preview
    const preview = document.createElement('div');
    preview.className = 'hotbar-slot-preview';
    
    const asset = this.hotbarSlots[index];
    if (asset) {
      preview.style.backgroundColor = this.rgbaToString(asset.color);
      preview.title = asset.name;
    }
    
    slot.appendChild(preview);

    // Click to activate
    slot.addEventListener('click', () => {
      if (asset) {
        this.config.onStartPlacement(asset);
      }
    });

    return slot;
  }

  /**
   * Creates the build menu with all blocks and vegetation presets
   */
  private createBuildMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'build-menu';
    menu.style.display = 'none'; // Hidden by default

    const header = document.createElement('div');
    header.className = 'build-menu-header';
    header.textContent = 'Build Menu';
    menu.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'build-menu-grid';

    // Add all blocks to grid
    for (const asset of this.allBlocks) {
      const item = this.createBlockItem(asset);
      grid.appendChild(item);
    }

    // Add vegetation presets to grid
    for (const asset of this.vegetationAssets) {
      const item = this.createVegetationItem(asset);
      grid.appendChild(item);
    }

    // Add NPC presets to grid
    for (const asset of this.npcAssets) {
      const item = this.createNpcItem(asset);
      grid.appendChild(item);
    }

    // Add marketplace assets to grid
    if (this.marketplaceAssets.length > 0) {
      // Add separator
      const separator = document.createElement('div');
      separator.className = 'build-menu-separator';
      separator.textContent = 'Marketplace';
      grid.appendChild(separator);

      for (const asset of this.marketplaceAssets) {
        const item = this.createMarketplaceItem(asset);
        grid.appendChild(item);
      }
    }

    menu.appendChild(grid);
    return menu;
  }

  /**
   * Creates a block item for the grid
   */
  private createBlockItem(asset: BlockAsset): HTMLElement {
    const item = document.createElement('div');
    item.className = 'build-menu-item';
    item.title = asset.name;

    const preview = document.createElement('div');
    preview.className = 'build-menu-item-preview';
    preview.style.backgroundColor = this.rgbaToString(asset.color);
    item.appendChild(preview);

    const name = document.createElement('div');
    name.className = 'build-menu-item-name';
    name.textContent = asset.name;
    item.appendChild(name);

    // Click to place
    item.addEventListener('click', () => {
      this.config.onStartPlacement(asset);
      this.toggleBuildMenu(); // Close menu after selection
    });

    return item;
  }

  /**
   * Creates a vegetation preset item for the grid
   */
  private createVegetationItem(asset: BlockAsset): HTMLElement {
    const item = document.createElement('div');
    item.className = 'build-menu-item build-menu-item-vegetation';
    item.title = asset.name;

    const preview = document.createElement('div');
    preview.className = 'build-menu-item-preview';
    preview.style.backgroundColor = this.rgbaToString(asset.color);
    // Add vegetation icon indicator
    preview.style.position = 'relative';
    const icon = document.createElement('div');
    icon.textContent = '🌿';
    icon.style.position = 'absolute';
    icon.style.top = '2px';
    icon.style.right = '2px';
    icon.style.fontSize = '12px';
    preview.appendChild(icon);
    item.appendChild(preview);

    const name = document.createElement('div');
    name.className = 'build-menu-item-name';
    name.textContent = asset.name;
    item.appendChild(name);

    // Click to place vegetation preset
    item.addEventListener('click', () => {
      if (this.config.vegetationPresetManager && this.config.onStartPlacementPreset) {
        // Find the preset by asset ID
        const presetId = asset.id.replace('vegetation-', '');
        const preset = this.config.vegetationPresetManager.getPreset(presetId);
        if (preset) {
          this.config.onStartPlacementPreset(preset);
          this.toggleBuildMenu(); // Close menu after selection
        }
      }
    });

    return item;
  }

  /**
   * Creates an NPC preset item for the grid
   */
  private createNpcItem(asset: BlockAsset): HTMLElement {
    const item = document.createElement('div');
    item.className = 'build-menu-item build-menu-item-npc';
    item.title = asset.name;

    const preview = document.createElement('div');
    preview.className = 'build-menu-item-preview';
    preview.style.backgroundColor = this.rgbaToString(asset.color);
    // Add NPC icon indicator
    preview.style.position = 'relative';
    const icon = document.createElement('div');
    icon.textContent = '👤';
    icon.style.position = 'absolute';
    icon.style.top = '2px';
    icon.style.right = '2px';
    icon.style.fontSize = '12px';
    preview.appendChild(icon);
    item.appendChild(preview);

    const name = document.createElement('div');
    name.className = 'build-menu-item-name';
    name.textContent = asset.name;
    item.appendChild(name);

    // Click to place NPC preset
    item.addEventListener('click', () => {
      if (this.config.npcPresetManager && this.config.onStartPlacementPreset) {
        // Find the preset by asset ID
        const presetId = asset.id.replace('npc-', '');
        const preset = this.config.npcPresetManager.getPreset(presetId);
        if (preset) {
          this.config.onStartPlacementPreset(preset);
          this.toggleBuildMenu(); // Close menu after selection
        }
      }
    });

    return item;
  }

  /**
   * Loads vegetation presets as assets
   */
  private loadVegetationPresets(): void {
    if (!this.config.vegetationPresetManager) {
      this.vegetationAssets = [];
      return;
    }

    this.vegetationAssets = this.config.vegetationPresetManager.getAllPresetsAsAssets();
  }

  /**
   * Loads NPC presets as assets
   */
  private loadNpcPresets(): void {
    if (!this.config.npcPresetManager) {
      this.npcAssets = [];
      return;
    }

    this.npcAssets = this.config.npcPresetManager.getAllPresetsAsAssets();
  }

  /**
   * Loads marketplace assets
   */
  private async loadMarketplaceAssets(): Promise<void> {
    if (!this.config.marketplaceAssetManager) {
      this.marketplaceAssets = [];
      return;
    }

    try {
      const assets = await this.config.marketplaceAssetManager.listAssets({ type: 'avatar' });
      this.marketplaceAssets = assets.map(asset => ({
        id: asset.itemId,
        title: asset.title,
        thumbnailUrl: asset.thumbnailUrl,
        fileUrl: asset.fileUrl,
      }));
    } catch (error) {
      console.error('Failed to load marketplace assets:', error);
      this.marketplaceAssets = [];
    }
  }

  /**
   * Creates a marketplace item for the grid
   */
  private createMarketplaceItem(asset: { id: string; title: string; thumbnailUrl?: string; fileUrl: string }): HTMLElement {
    const item = document.createElement('div');
    item.className = 'build-menu-item build-menu-item-marketplace';
    item.title = asset.title;

    const preview = document.createElement('div');
    preview.className = 'build-menu-item-preview';
    
    if (asset.thumbnailUrl) {
      const img = document.createElement('img');
      img.src = asset.thumbnailUrl;
      img.alt = asset.title;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.onerror = () => {
        preview.textContent = '📦';
        preview.style.display = 'flex';
        preview.style.alignItems = 'center';
        preview.style.justifyContent = 'center';
        preview.style.fontSize = '1.5rem';
      };
      preview.appendChild(img);
    } else {
      preview.textContent = '📦';
      preview.style.display = 'flex';
      preview.style.alignItems = 'center';
      preview.style.justifyContent = 'center';
      preview.style.fontSize = '1.5rem';
    }
    
    // Add marketplace icon indicator
    preview.style.position = 'relative';
    const icon = document.createElement('div');
    icon.textContent = '🛒';
    icon.style.position = 'absolute';
    icon.style.top = '2px';
    icon.style.right = '2px';
    icon.style.fontSize = '12px';
    preview.appendChild(icon);
    item.appendChild(preview);

    const name = document.createElement('div');
    name.className = 'build-menu-item-name';
    name.textContent = asset.title;
    item.appendChild(name);

    // Click handler - hand off to consumer for placement/integration
    item.addEventListener('click', () => {
      if (this.config.onMarketplaceAssetSelect) {
        this.config.onMarketplaceAssetSelect(asset);
      } else {
        console.log('Marketplace asset clicked:', asset.title);
      }
      this.toggleBuildMenu(); // Close menu after selection
    });

    return item;
  }

  /**
   * Toggles build menu visibility
   */
  private toggleBuildMenu(): void {
    if (!this.buildMenu) return;
    
    this.isExpanded = !this.isExpanded;
    this.buildMenu.style.display = this.isExpanded ? 'block' : 'none';
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    const handler = (e: KeyboardEvent) => {
      // Don't handle if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // 1-9 keys for hotbar slots
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const slotIndex = parseInt(e.key, 10) - 1;
        const asset = this.hotbarSlots[slotIndex];
        if (asset) {
          this.config.onStartPlacement(asset);
        }
        e.preventDefault();
        return;
      }

      // B key to toggle build menu
      if (e.key === 'b' || e.key === 'B') {
        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          this.toggleBuildMenu();
          e.preventDefault();
        }
      }

      // Escape to close build menu
      if (e.key === 'Escape' && this.isExpanded) {
        this.toggleBuildMenu();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handler);
    this.keyboardCleanup = () => document.removeEventListener('keydown', handler);
  }

  /**
   * Convert RGBA color to CSS string
   */
  private rgbaToString(color: [number, number, number, number]): string {
    const [r, g, b, a] = color;
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  }

  /**
   * Refreshes the palette (for external updates)
   */
  public refresh(): void {
    // Reload vegetation presets
    this.loadVegetationPresets();
    
    // Reload NPC presets
    this.loadNpcPresets();

    // Re-render hotbar if needed
    if (this.hotbar) {
      const newHotbar = this.createHotbar();
      this.hotbar.replaceWith(newHotbar);
      this.hotbar = newHotbar;
    }

    // Re-render build menu if needed
    if (this.buildMenu) {
      const newBuildMenu = this.createBuildMenu();
      this.buildMenu.replaceWith(newBuildMenu);
      this.buildMenu = newBuildMenu;
    }
  }

  /**
   * Disposes the palette
   */
  public dispose(): void {
    if (this.keyboardCleanup) {
      this.keyboardCleanup();
      this.keyboardCleanup = null;
    }

    if (this.vegetationPresetManagerListener) {
      this.vegetationPresetManagerListener();
      this.vegetationPresetManagerListener = null;
    }

    if (this.npcPresetManagerListener) {
      this.npcPresetManagerListener();
      this.npcPresetManagerListener = null;
    }

    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container = null;
    this.hotbar = null;
    this.buildMenu = null;
  }
}

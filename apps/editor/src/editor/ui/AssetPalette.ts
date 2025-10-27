/**
 * AssetPalette - Simplified Build Menu (Minecraft Creative Style)
 * 
 * Features:
 * - Bottom hotbar (1-9 keys for quick access)
 * - Green button to expand build menu
 * - Build menu shows all 10 blocks in a simple grid
 * - No categories, search, or filters - just blocks
 */

import type { Scene } from '@engine/world';
import type { EditorState } from '../core/state';
import { BLOCK_LIBRARY, type BlockDefinition } from '@engine/gfx-webgpu/blocks/BlockLibrary';
import { createIcon } from '../utils/icons';
import type { BlockAsset } from '../types/BlockAssetTypes';
import { blockToAsset } from '../types/BlockAssetTypes';

export interface AssetPaletteConfig {
  scene: Scene;
  state: EditorState;
  onAssetSelect: (asset: BlockAsset) => void;
  onStartPlacement: (asset: BlockAsset) => void;
}

export class AssetPalette {
  private container: HTMLElement | null = null;
  private hotbar: HTMLElement | null = null;
  private buildMenu: HTMLElement | null = null;
  private isExpanded = false;
  private hotbarSlots: (BlockAsset | null)[] = new Array(9).fill(null);
  private allBlocks: BlockAsset[] = [];
  private keyboardCleanup: (() => void) | null = null;

  constructor(private readonly config: AssetPaletteConfig) {
    // Convert all blocks to assets
    this.allBlocks = Object.values(BLOCK_LIBRARY).map(blockToAsset);
    
    // Initialize hotbar with first 9 blocks
    this.hotbarSlots = this.allBlocks.slice(0, 9);
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
   * Creates the build menu with all blocks
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
    // Re-render hotbar if needed
    if (this.hotbar) {
      const newHotbar = this.createHotbar();
      this.hotbar.replaceWith(newHotbar);
      this.hotbar = newHotbar;
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

    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container = null;
    this.hotbar = null;
    this.buildMenu = null;
  }
}

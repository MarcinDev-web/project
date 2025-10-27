/**
 * QuickAccessMenu - Radial selection menu for quick asset access
 * 
 * Features:
 * - Hold R: Recent assets
 * - Hold F: Favorite assets
 * - Hold H: Quick hotbar assignment
 * - Mouse movement to select
 * - Release to activate
 */

import type { Asset } from '../types/BlockAssetTypes';
import { createIcon } from '../utils/icons';
import { Logger } from '../../utils/logger';

export type QuickAccessMode = 'recent' | 'favorites' | 'hotbar';

export interface QuickAccessMenuConfig {
  onAssetSelect: (asset: Asset, mode: QuickAccessMode, slotIndex?: number) => void;
  getRecentAssets: () => Asset[];
  getFavoriteAssets: () => Asset[];
  getHotbarAssets: () => (Asset | null)[];
}

interface RadialItem {
  asset: Asset | null;
  angle: number;
  label: string;
  index?: number;
}

export class QuickAccessMenu {
  private container: HTMLElement | null = null;
  private isActive = false;
  private currentMode: QuickAccessMode | null = null;
  private items: RadialItem[] = [];
  private selectedIndex: number = -1;
  private centerX = 0;
  private centerY = 0;
  private keyboardCleanup: (() => void) | null = null;
  private mouseMoveCleanup: (() => void) | null = null;
  private mouseX = 0;
  private mouseY = 0;

  private readonly RADIUS = 150; // Radial menu radius
  private readonly DEAD_ZONE = 30; // Center dead zone
  private readonly KEY_HOLD_THRESHOLD = 100; // ms to distinguish from quick tap

  constructor(private readonly config: QuickAccessMenuConfig) {}

  /**
   * Initializes the quick access menu.
   */
  initialize(): () => void {
    this.setupKeyboardListeners();

    return () => {
      this.dispose();
    };
  }

  /**
   * Sets up keyboard event listeners for R, F, H keys.
   */
  private setupKeyboardListeners(): void {
    let keyDownTime = 0;
    let currentKey: string | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if not in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ignore if modifier keys are pressed
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'r' && !this.isActive) {
        event.preventDefault();
        keyDownTime = performance.now();
        currentKey = 'r';
        this.show('recent', this.mouseX || window.innerWidth / 2, this.mouseY || window.innerHeight / 2);
      } else if (key === 'f' && !this.isActive) {
        event.preventDefault();
        keyDownTime = performance.now();
        currentKey = 'f';
        this.show('favorites', this.mouseX || window.innerWidth / 2, this.mouseY || window.innerHeight / 2);
      } else if (key === 'h' && !this.isActive) {
        event.preventDefault();
        keyDownTime = performance.now();
        currentKey = 'h';
        this.show('hotbar', this.mouseX || window.innerWidth / 2, this.mouseY || window.innerHeight / 2);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const holdDuration = performance.now() - keyDownTime;

      if (key === currentKey && this.isActive) {
        event.preventDefault();

        if (holdDuration > this.KEY_HOLD_THRESHOLD) {
          // Long hold - activate selected item
          this.activateSelected();
        }

        this.hide();
        currentKey = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    this.keyboardCleanup = () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }

  /**
   * Shows the radial menu.
   */
  private show(mode: QuickAccessMode, x: number, y: number): void {
    if (this.isActive) return;

    this.isActive = true;
    this.currentMode = mode;
    this.centerX = x;
    this.centerY = y;
    this.mouseX = x;
    this.mouseY = y;

    // Load items for this mode
    this.loadItems(mode);

    // Create UI
    this.createUI();

    // Setup mouse tracking
    this.setupMouseTracking();

    Logger.debug(`QuickAccessMenu: Showing ${mode} mode at (${x}, ${y})`);
  }

  /**
   * Hides the radial menu.
   */
  private hide(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.currentMode = null;
    this.items = [];
    this.selectedIndex = -1;

    if (this.container) {
      this.container.classList.add('closing');
      setTimeout(() => {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
      }, 200);
    }

    if (this.mouseMoveCleanup) {
      this.mouseMoveCleanup();
      this.mouseMoveCleanup = null;
    }

    Logger.debug('QuickAccessMenu: Hidden');
  }

  /**
   * Loads items based on mode.
   */
  private loadItems(mode: QuickAccessMode): void {
    this.items = [];

    switch (mode) {
      case 'recent': {
        const recent = this.config.getRecentAssets().slice(0, 8);
        recent.forEach((asset, index) => {
          const angle = (index / recent.length) * Math.PI * 2 - Math.PI / 2;
          this.items.push({
            asset,
            angle,
            label: asset.metadata.name,
          });
        });
        break;
      }
      case 'favorites': {
        const favorites = this.config.getFavoriteAssets().slice(0, 8);
        favorites.forEach((asset, index) => {
          const angle = (index / favorites.length) * Math.PI * 2 - Math.PI / 2;
          this.items.push({
            asset,
            angle,
            label: asset.metadata.name,
          });
        });
        break;
      }
      case 'hotbar': {
        const hotbar = this.config.getHotbarAssets();
        hotbar.forEach((asset, index) => {
          const angle = (index / hotbar.length) * Math.PI * 2 - Math.PI / 2;
          this.items.push({
            asset,
            angle,
            label: asset ? asset.metadata.name : `Slot ${index + 1}`,
            index,
          });
        });
        break;
      }
    }
  }

  /**
   * Creates the radial UI.
   */
  private createUI(): void {
    this.container = document.createElement('div');
    this.container.className = 'quick-access-menu';
    this.container.style.left = `${this.centerX}px`;
    this.container.style.top = `${this.centerY}px`;

    // Center indicator
    const center = document.createElement('div');
    center.className = 'quick-access-center';
    this.container.appendChild(center);

    // Mode label
    const modeLabel = document.createElement('div');
    modeLabel.className = 'quick-access-mode-label';
    modeLabel.textContent = this.getModeLabel();
    center.appendChild(modeLabel);

    // Create items
    this.items.forEach((item, index) => {
      const itemEl = this.createItemElement(item, index);
      this.container!.appendChild(itemEl);
    });

    document.body.appendChild(this.container);
  }

  /**
   * Creates a single item element.
   */
  private createItemElement(item: RadialItem, index: number): HTMLElement {
    const element = document.createElement('div');
    element.className = 'quick-access-item';
    element.dataset.index = index.toString();

    const x = Math.cos(item.angle) * this.RADIUS;
    const y = Math.sin(item.angle) * this.RADIUS;
    element.style.transform = `translate(${x}px, ${y}px)`;

    // Icon
    const icon = document.createElement('div');
    icon.className = 'quick-access-item-icon';
    
    if (item.asset?.thumbnail) {
      const img = document.createElement('img');
      img.src = item.asset.thumbnail;
      img.alt = item.label;
      icon.appendChild(img);
    } else if (item.asset) {
      icon.appendChild(createIcon('cube', 24));
    } else {
      icon.appendChild(createIcon('plus', 24));
    }
    
    element.appendChild(icon);

    // Label
    const label = document.createElement('div');
    label.className = 'quick-access-item-label';
    label.textContent = item.label;
    element.appendChild(label);

    // Number badge for hotbar mode
    if (this.currentMode === 'hotbar' && item.index !== undefined) {
      const badge = document.createElement('div');
      badge.className = 'quick-access-item-badge';
      badge.textContent = (item.index + 1).toString();
      element.appendChild(badge);
    }

    return element;
  }

  /**
   * Sets up mouse movement tracking.
   */
  private setupMouseTracking(): void {
    const handleMouseMove = (event: MouseEvent) => {
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
      this.updateSelection();
    };

    window.addEventListener('mousemove', handleMouseMove);

    this.mouseMoveCleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }

  /**
   * Updates the selected item based on mouse position.
   */
  private updateSelection(): void {
    if (!this.container) return;

    const dx = this.mouseX - this.centerX;
    const dy = this.mouseY - this.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if in dead zone
    if (distance < this.DEAD_ZONE) {
      this.setSelectedIndex(-1);
      return;
    }

    // Calculate angle
    const angle = Math.atan2(dy, dx);
    
    // Find closest item
    let closestIndex = -1;
    let closestDiff = Infinity;

    this.items.forEach((item, index) => {
      let angleDiff = Math.abs(angle - item.angle);
      
      // Normalize angle difference to [-PI, PI]
      if (angleDiff > Math.PI) {
        angleDiff = Math.PI * 2 - angleDiff;
      }

      if (angleDiff < closestDiff) {
        closestDiff = angleDiff;
        closestIndex = index;
      }
    });

    this.setSelectedIndex(closestIndex);
  }

  /**
   * Sets the selected item index.
   */
  private setSelectedIndex(index: number): void {
    if (this.selectedIndex === index) return;

    this.selectedIndex = index;

    if (!this.container) return;

    // Update UI
    const items = this.container.querySelectorAll('.quick-access-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
  }

  /**
   * Activates the currently selected item.
   */
  private activateSelected(): void {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.items.length) {
      return;
    }

    const item = this.items[this.selectedIndex];
    if (!item || !item.asset) {
      return;
    }

    if (!this.currentMode) {
      return;
    }

    this.config.onAssetSelect(item.asset, this.currentMode, item.index);
    
    Logger.debug(`QuickAccessMenu: Activated ${item.asset.metadata.name} in ${this.currentMode} mode`);
  }

  /**
   * Gets the mode label text.
   */
  private getModeLabel(): string {
    switch (this.currentMode) {
      case 'recent': return 'Recent';
      case 'favorites': return 'Favorites';
      case 'hotbar': return 'Hotbar';
      default: return '';
    }
  }

  /**
   * Disposes the quick access menu.
   */
  dispose(): void {
    if (this.keyboardCleanup) {
      this.keyboardCleanup();
      this.keyboardCleanup = null;
    }

    if (this.mouseMoveCleanup) {
      this.mouseMoveCleanup();
      this.mouseMoveCleanup = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.isActive = false;
  }
}


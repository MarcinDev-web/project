/**
 * AssetsDropdown - Dropdown panel for Asset Browser
 * 
 * Features:
 * - Slides down from top when opened
 * - Contains Asset Browser V2
 * - Overlay backdrop
 * - ESC key and click-outside to close
 */

import type { Scene } from '../../engine/scene';
import type { EditorState } from '../core/state';
import type { Asset, AssetVariant } from '../assets/AssetTypes';
import { AssetBrowserV2 } from '../assets/AssetBrowser';
import { createIcon } from '../utils/icons';

export interface AssetsDropdownConfig {
  scene: Scene;
  state: EditorState;
  onAssetSelect: (asset: Asset, variant?: AssetVariant) => void;
}

export class AssetsDropdown {
  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private assetBrowser: AssetBrowserV2 | null = null;
  private isOpen = false;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly config: AssetsDropdownConfig) {}

  /**
   * Creates and mounts the dropdown to the document.
   */
  mount(): void {
    if (this.container) {
      console.warn('AssetsDropdown: Already mounted');
      return;
    }

    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'assets-dropdown-container';
    this.container.style.display = 'none';

    // Create overlay backdrop
    this.overlay = document.createElement('div');
    this.overlay.className = 'assets-dropdown-overlay';
    this.overlay.addEventListener('click', () => this.close());

    // Create dropdown panel
    this.panel = document.createElement('div');
    this.panel.className = 'assets-dropdown-panel';

    // Panel header
    const header = document.createElement('div');
    header.className = 'assets-dropdown-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'assets-dropdown-title-group';

    const icon = createIcon('package', 20);
    const title = document.createElement('h2');
    title.textContent = 'Asset Library';

    titleGroup.appendChild(icon);
    titleGroup.appendChild(title);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'assets-dropdown-close';
    closeBtn.setAttribute('aria-label', 'Close Asset Library');
    closeBtn.title = 'Close (Esc)';
    closeBtn.appendChild(createIcon('close', 20));
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(titleGroup);
    header.appendChild(closeBtn);

    // Panel content (Asset Browser will mount here)
    const content = document.createElement('div');
    content.className = 'assets-dropdown-content';

    this.panel.appendChild(header);
    this.panel.appendChild(content);

    this.container.appendChild(this.overlay);
    this.container.appendChild(this.panel);

    // Mount to body
    document.body.appendChild(this.container);

    // Initialize Asset Browser
    this.assetBrowser = new AssetBrowserV2(
      this.config.scene,
      (asset, variant) => {
        this.config.onAssetSelect(asset, variant);
        // Optionally close after selection
        // this.close();
      },
      this.config.state,
      { defaultViewMode: 'grid', showCollections: true }
    );
    this.assetBrowser.mount(content);

    // Setup keyboard handler
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.close();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Opens the dropdown panel.
   */
  open(): void {
    if (!this.container || this.isOpen) return;

    this.isOpen = true;
    this.container.style.display = 'block';
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.container?.classList.add('open');
    });

    // Disable body scroll
    document.body.style.overflow = 'hidden';

    // Focus search input
    requestAnimationFrame(() => {
      this.assetBrowser?.focusSearch();
    });
  }

  /**
   * Closes the dropdown panel.
   */
  close(): void {
    if (!this.container || !this.isOpen) return;

    this.isOpen = false;
    this.container.classList.remove('open');

    // Wait for animation to complete
    setTimeout(() => {
      if (this.container) {
        this.container.style.display = 'none';
      }
    }, 300);

    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Toggles the dropdown panel.
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Returns whether the dropdown is open.
   */
  isOpenState(): boolean {
    return this.isOpen;
  }

  /**
   * Refreshes the asset browser.
   */
  refresh(): void {
    this.assetBrowser?.refresh();
  }

  /**
   * Disposes the dropdown.
   */
  dispose(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.assetBrowser) {
      this.assetBrowser.dispose();
      this.assetBrowser = null;
    }

    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container = null;
    this.overlay = null;
    this.panel = null;
    this.isOpen = false;

    // Restore body scroll in case it was left disabled
    document.body.style.overflow = '';
  }
}


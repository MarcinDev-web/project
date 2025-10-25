/**
 * AssetPalette - Game-like Asset Browser
 * 
 * Inspired by:
 * - Minecraft: Hotbar + Creative inventory with tabs
 * - Kogama: Category-based build menu
 * - The Sims: Build mode with categorized objects
 * 
 * Features:
 * - Bottom hotbar (1-9 keys for quick access)
 * - Floating expandable palette with categories
 * - Grid view with large icons
 * - Category tabs (like Minecraft creative menu)
 * - Drag-to-place or click-to-activate
 */

import type { Scene } from '../../engine/scene';
import type { EditorState } from '../core/state';
import type { Asset, AssetMainCategory, AssetVariant, AssetSortBy } from '../assets/AssetTypes';
import { assetRegistry } from '../assets/AssetRegistry';
import { createIcon, iconHTML } from '../utils/icons';
import type { IconName } from '../utils/icons';
import type { InventoryManager } from '../managers/InventoryManager';
import { FavoritesManager } from '../managers/FavoritesManager';
import { RecentAssetsTracker } from '../managers/RecentAssetsTracker';

export interface AssetPaletteConfig {
  scene: Scene;
  state: EditorState;
  inventoryManager?: InventoryManager;
  onAssetSelect: (asset: Asset, variant?: AssetVariant) => void;
  onStartPlacement: (asset: Asset, variant?: AssetVariant) => void;
}

// Special category types for Favorites and Recent
type SpecialCategory = 'Favorites' | 'Recent';
type CategoryType = AssetMainCategory | SpecialCategory;

export class AssetPalette {
  private container: HTMLElement | null = null;
  private hotbar: HTMLElement | null = null;
  private palettePanel: HTMLElement | null = null;
  private isExpanded = false;
  private hotbarSlots: Asset[] = new Array(9).fill(null);
  private selectedCategory: CategoryType = 'Building';
  private selectedSubcategory: string | null = null;
  private keyboardCleanup: (() => void) | null = null;
  private draggedAsset: Asset | null = null;
  private draggedFromSlot: number | null = null;
  private inventoryCleanup: (() => void) | null = null;
  private searchQuery = '';
  private searchTimeout: number | null = null;
  private currentSortBy: AssetSortBy = 'name';
  
  // New managers
  private favoritesManager = new FavoritesManager();
  private recentTracker = new RecentAssetsTracker();
  private favoritesCleanup: (() => void) | null = null;
  private recentCleanup: (() => void) | null = null;
  
  // Performance optimizations
  private lastRenderTime = 0;
  private renderDebounceTimeout: number | null = null;
  private readonly RENDER_DEBOUNCE_MS = 100;
  private readonly MIN_RENDER_INTERVAL = 16; // ~60fps

  constructor(private readonly config: AssetPaletteConfig) {}

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

    // Create expandable palette panel
    this.palettePanel = this.createPalettePanel();
    this.container.appendChild(this.palettePanel);

    document.body.appendChild(this.container);

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Setup inventory integration
    this.setupInventoryIntegration();

    // Load hotbar from inventory or defaults
    this.loadHotbarFromInventory();

    // Setup favorites and recent listeners
    this.setupManagerListeners();
  }

  /**
   * Sets up favorites and recent managers listeners.
   */
  private setupManagerListeners(): void {
    this.favoritesCleanup = this.favoritesManager.addListener(() => {
      this.debouncedRefreshAssetGrid();
      this.updateCategoryBadges();
    });

    this.recentCleanup = this.recentTracker.addListener(() => {
      this.debouncedRefreshAssetGrid();
      this.updateCategoryBadges();
    });
  }

  /**
   * Sets up inventory manager integration.
   */
  private setupInventoryIntegration(): void {
    if (!this.config.inventoryManager) return;

    // Listen for inventory changes to update hotbar counts
    this.inventoryCleanup = this.config.inventoryManager.addListener(() => {
      this.updateHotbarCounts();
    });

    // Restore hotbar from inventory
    const hotbarData = this.config.inventoryManager.getHotbarData();
    this.config.inventoryManager.restoreHotbar(hotbarData, (id: string) => {
      return assetRegistry.get(id) || null;
    });

    // Sync with inventory hotbar slots
    const slots = this.config.inventoryManager.getHotbarSlots();
    slots.forEach((slot, index) => {
      if (slot.asset) {
        this.hotbarSlots[index] = slot.asset;
      }
    });
  }

  /**
   * Updates hotbar count indicators.
   */
  private updateHotbarCounts(): void {
    if (!this.config.inventoryManager) return;

    for (let i = 0; i < this.hotbarSlots.length; i++) {
      const asset = this.hotbarSlots[i];
      if (!asset) continue;

      const count = this.config.inventoryManager.getCount(asset.metadata.id);
      const slot = this.hotbar?.querySelector(`[data-slot="${i}"]`);
      if (!slot) continue;

      // Update or create count badge
      let badge = slot.querySelector('.hotbar-count-badge') as HTMLElement;
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'hotbar-count-badge';
        slot.appendChild(badge);
      }

      if (this.config.inventoryManager.getBuildMode() === 'limited') {
        badge.textContent = count.toString();
        badge.style.display = 'block';
        badge.classList.toggle('low', count <= 10);
      } else {
        badge.style.display = 'none';
      }
    }
  }

  /**
   * Loads hotbar from inventory or defaults.
   */
  private loadHotbarFromInventory(): void {
    if (this.config.inventoryManager) {
      const slots = this.config.inventoryManager.getHotbarSlots();
      let hasAnyAssets = false;

      slots.forEach((slot, index) => {
        if (slot.asset) {
          this.hotbarSlots[index] = slot.asset;
          this.refreshHotbarSlot(index);
          hasAnyAssets = true;
        }
      });

      if (!hasAnyAssets) {
        // Load defaults if inventory is empty
        this.loadDefaultHotbar();
      } else {
        // Refresh all slots
        for (let i = 0; i < 9; i++) {
          this.refreshHotbarSlot(i);
        }
      }

      this.updateHotbarCounts();
    } else {
      // No inventory manager, just load defaults
      this.loadDefaultHotbar();
    }
  }

  /**
   * Public refresh used by tests via EditorPanelManager.getAssetBrowser().
   */
  public refresh(): void {
    try {
      // Refresh hotbar labels/icons and palette content if open
      for (let i = 0; i < this.hotbarSlots.length; i++) {
        this.refreshHotbarSlot(i);
      }
      if (this.isExpanded) {
        this.refreshAssetGrid();
      }
    } catch {
      // no-op
    }
  }

  /**
   * Creates the hotbar (bottom toolbar with 9 slots).
   */
  private createHotbar(): HTMLElement {
    const hotbar = document.createElement('div');
    hotbar.className = 'asset-hotbar';

    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('button');
      slot.className = 'hotbar-slot';
      slot.dataset.slot = i.toString();
      slot.setAttribute('role', 'button');
      slot.setAttribute('aria-label', `Hotbar slot ${i + 1}. Press ${i + 1} to activate.`);
      slot.tabIndex = 0;
      
      // Slot number indicator
      const slotNumber = document.createElement('div');
      slotNumber.className = 'hotbar-slot-number';
      slotNumber.textContent = (i + 1).toString();
      slotNumber.setAttribute('aria-hidden', 'true');
      slot.appendChild(slotNumber);

      // Icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'hotbar-slot-icon';
    iconContainer.setAttribute('aria-hidden', 'true');
    slot.appendChild(iconContainer);

      // Click handler
      slot.addEventListener('click', () => this.selectHotbarSlot(i));
      
      // Keyboard support for slots
      slot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectHotbarSlot(i);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          this.clearHotbarSlot(i);
        }
      });

      // Right click to clear slot
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.clearHotbarSlot(i);
      });

      // Drag and drop handlers
      this.setupHotbarSlotDragDrop(slot, i);

      hotbar.appendChild(slot);
    }

    // Add expand button
    const expandBtn = document.createElement('button');
    expandBtn.className = 'hotbar-expand-btn';
    expandBtn.setAttribute('aria-label', 'Open Build Menu');
    expandBtn.setAttribute('aria-keyshortcuts', 'B');
    expandBtn.setAttribute('aria-expanded', 'false');
    expandBtn.appendChild(createIcon('grid', 20));
    expandBtn.title = 'Open Build Menu (B)';
    expandBtn.addEventListener('click', () => this.togglePalette());
    hotbar.appendChild(expandBtn);

    return hotbar;
  }

  /**
   * Sets up drag and drop handlers for a hotbar slot.
   */
  private setupHotbarSlotDragDrop(slot: HTMLElement, index: number): void {
    // Make slot draggable if it has an asset
    slot.addEventListener('dragstart', (e) => {
      const asset = this.hotbarSlots[index];
      if (!asset) {
        e.preventDefault();
        return;
      }

      this.draggedAsset = asset;
      this.draggedFromSlot = index;
      
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', asset.metadata.id);
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
      if (this.draggedAsset) {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        slot.classList.add('drag-over');
      }
    });

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');

      if (!this.draggedAsset) return;

      if (this.draggedFromSlot !== null) {
        // Dragging from another hotbar slot - swap
        this.swapHotbarSlots(this.draggedFromSlot, index);
      } else {
        // Dragging from asset palette - assign
        this.assignToHotbarSlot(index, this.draggedAsset);
      }

      this.draggedAsset = null;
      this.draggedFromSlot = null;
    });

    // Make the slot itself draggable if it has content
    const updateDraggable = () => {
      slot.draggable = !!this.hotbarSlots[index];
    };
    updateDraggable();
    
    // Update draggable state when slot changes
    const observer = new MutationObserver(updateDraggable);
    observer.observe(slot, { childList: true, subtree: true });
  }

  /**
   * Swaps two hotbar slots.
   */
  private swapHotbarSlots(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;

    const temp = this.hotbarSlots[fromIndex];
    this.hotbarSlots[fromIndex] = this.hotbarSlots[toIndex] ?? null as any;
    this.hotbarSlots[toIndex] = temp ?? null as any;

    this.refreshHotbarSlot(fromIndex);
    this.refreshHotbarSlot(toIndex);

    // Sync with inventory manager
    if (this.config.inventoryManager) {
      this.config.inventoryManager.swapHotbarSlots(fromIndex, toIndex);
    }

    // Show feedback
    this.showFeedback(`Swapped slots ${fromIndex + 1} and ${toIndex + 1}`);
  }

  /**
   * Assigns an asset to a hotbar slot.
   */
  private assignToHotbarSlot(index: number, asset: Asset): void {
    this.hotbarSlots[index] = asset;
    this.refreshHotbarSlot(index);

    // Sync with inventory manager
    if (this.config.inventoryManager) {
      this.config.inventoryManager.setHotbarSlot(index, asset);
    }

    this.showFeedback(`Assigned to slot ${index + 1}`);
  }

  /**
   * Shows a temporary feedback message.
   */
  private showFeedback(message: string, duration = 1500): void {
    if (!this.hotbar) return;

    const feedback = document.createElement('div');
    feedback.className = 'hotbar-feedback';
    feedback.textContent = message;
    this.hotbar.appendChild(feedback);
    
    setTimeout(() => {
      feedback.remove();
    }, duration);
  }

  /**
   * Creates the expandable palette panel.
   */
  private createPalettePanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'asset-palette-panel';

    // Header with title, sort, and close button
    const header = document.createElement('div');
    header.className = 'palette-header';

    const title = document.createElement('h2');
    title.textContent = 'Build Menu';
    header.appendChild(title);

    const headerControls = document.createElement('div');
    headerControls.className = 'palette-header-controls';

    // Sort dropdown
    const sortDropdown = this.createSortDropdown();
    headerControls.appendChild(sortDropdown);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'palette-close-btn';
    closeBtn.appendChild(createIcon('close', 18));
    closeBtn.addEventListener('click', () => this.togglePalette());
    headerControls.appendChild(closeBtn);

    header.appendChild(headerControls);
    panel.appendChild(header);

    // Search bar
    const searchBar = this.createSearchBar();
    panel.appendChild(searchBar);

    // Category tabs (Minecraft style)
    const categoryTabs = this.createCategoryTabs();
    panel.appendChild(categoryTabs);

    // Subcategory bar (initially hidden)
    const subcategoryBar = document.createElement('div');
    subcategoryBar.className = 'palette-subcategory-bar';
    subcategoryBar.style.display = 'none';
    panel.appendChild(subcategoryBar);

    // Asset grid
    const assetGrid = document.createElement('div');
    assetGrid.className = 'palette-asset-grid';
    panel.appendChild(assetGrid);

    return panel;
  }

  /**
   * Creates search bar for filtering assets.
   */
  private createSearchBar(): HTMLElement {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'palette-search-bar';

    const searchIcon = document.createElement('div');
    searchIcon.className = 'search-icon';
    searchIcon.appendChild(createIcon('search', 16));
    searchContainer.appendChild(searchIcon);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search assets...';
    searchInput.className = 'search-input';
    searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      this.handleSearch(query);
    });
    searchContainer.appendChild(searchInput);

    const clearBtn = document.createElement('button');
    clearBtn.className = 'search-clear-btn';
    clearBtn.appendChild(createIcon('close', 14));
    clearBtn.style.display = 'none';
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.handleSearch('');
      clearBtn.style.display = 'none';
    });
    searchContainer.appendChild(clearBtn);

    // Show/hide clear button based on input
    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'flex' : 'none';
    });

    return searchContainer;
  }

  /**
   * Creates sort dropdown.
   */
  private createSortDropdown(): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'palette-sort-dropdown';

    const button = document.createElement('button');
    button.className = 'sort-dropdown-btn';
    button.innerHTML = `${iconHTML('sliders')} <span>Sort</span>`;
    dropdown.appendChild(button);

    const menu = document.createElement('div');
    menu.className = 'sort-dropdown-menu';
    menu.style.display = 'none';

    const sortOptions: Array<{ value: AssetSortBy; label: string }> = [
      { value: 'name', label: 'Alphabetical' },
      { value: 'recent', label: 'Recently Added' },
      { value: 'usage', label: 'Most Used' },
      { value: 'date', label: 'Date Created' },
    ];

    sortOptions.forEach(option => {
      const item = document.createElement('button');
      item.className = 'sort-dropdown-item';
      item.textContent = option.label;
      if (option.value === this.currentSortBy) {
        item.classList.add('active');
      }
      item.addEventListener('click', () => {
        this.currentSortBy = option.value;
        // Update active state
        menu.querySelectorAll('.sort-dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.debouncedRefreshAssetGrid();
        menu.style.display = 'none';
      });
      menu.appendChild(item);
    });

    dropdown.appendChild(menu);

    // Toggle dropdown
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = menu.style.display === 'block';
      menu.style.display = isVisible ? 'none' : 'block';
    });

    // Close on outside click
    document.addEventListener('click', () => {
      menu.style.display = 'none';
    });

    return dropdown;
  }

  /**
   * Creates category tabs for the palette.
   */
  private createCategoryTabs(): HTMLElement {
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'palette-category-tabs';

    const categories: Array<{
      id: CategoryType;
      label: string;
      icon: IconName;
    }> = [
      { id: 'Favorites', label: 'Favorites', icon: 'star' },
      { id: 'Recent', label: 'Recent', icon: 'rotate-ccw' },
      { id: 'Building', label: 'Building', icon: 'cube' },
      { id: 'Decoration', label: 'Decoration', icon: 'palette' },
      { id: 'Nature', label: 'Nature', icon: 'sun' },
      { id: 'Furniture', label: 'Furniture', icon: 'box' },
      { id: 'Architecture', label: 'Architecture', icon: 'layers' },
      { id: 'Gameplay', label: 'Gameplay', icon: 'sparkle' },
    ];

    categories.forEach((category) => {
      const tab = document.createElement('button');
      tab.className = 'palette-category-tab';
      tab.dataset.category = category.id;
      
      // Special styling for Favorites and Recent
      if (category.id === 'Favorites') {
        tab.classList.add('special-category', 'favorites-tab');
      } else if (category.id === 'Recent') {
        tab.classList.add('special-category', 'recent-tab');
      }
      
      if (category.id === this.selectedCategory) {
        tab.classList.add('active');
      }

      const icon = document.createElement('div');
      icon.className = 'category-tab-icon';
      icon.appendChild(createIcon(category.icon));
      tab.appendChild(icon);

      const labelContainer = document.createElement('div');
      labelContainer.className = 'category-tab-label-container';

      const label = document.createElement('div');
      label.className = 'category-tab-label';
      label.textContent = category.label;
      labelContainer.appendChild(label);

      const badge = document.createElement('div');
      badge.className = 'category-tab-badge';
      badge.style.display = 'none';
      labelContainer.appendChild(badge);

      tab.appendChild(labelContainer);

      tab.addEventListener('click', () => {
        this.selectCategory(category.id);
      });

      tabsContainer.appendChild(tab);
    });

    return tabsContainer;
  }

  /**
   * Toggles the palette panel visibility.
   */
  private togglePalette(): void {
    if (!this.palettePanel) return;

    this.isExpanded = !this.isExpanded;
    this.palettePanel.classList.toggle('expanded', this.isExpanded);
    
    // Update ARIA
    const expandBtn = this.hotbar?.querySelector('.hotbar-expand-btn');
    if (expandBtn) {
      expandBtn.setAttribute('aria-expanded', String(this.isExpanded));
    }

    if (this.isExpanded) {
      this.refreshAssetGrid();
      
      // Focus search input when opening
      const searchInput = this.palettePanel.querySelector<HTMLInputElement>('.search-input');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    }
  }

  /**
   * Handles search input with debouncing.
   */
  private handleSearch(query: string): void {
    if (this.searchTimeout !== null) {
      window.clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = window.setTimeout(() => {
      this.searchQuery = query.trim();
      this.debouncedRefreshAssetGrid();
    }, 250); // Reduced from 300ms for snappier feel
  }

  /**
   * Selects a category and refreshes the asset grid.
   */
  private selectCategory(category: CategoryType): void {
    this.selectedCategory = category;
    this.selectedSubcategory = null;

    // Update active tab
    const tabs = this.palettePanel?.querySelectorAll('.palette-category-tab');
    tabs?.forEach((tab) => {
      const isActive = tab.getAttribute('data-category') === category;
      tab.classList.toggle('active', isActive);
    });

    // Show/hide subcategory bar
    this.updateSubcategoryBar();

    this.debouncedRefreshAssetGrid();
  }

  /**
   * Updates subcategory bar based on selected category.
   */
  private updateSubcategoryBar(): void {
    const subcategoryBar = this.palettePanel?.querySelector('.palette-subcategory-bar') as HTMLElement;
    if (!subcategoryBar) return;

    // Only show for main categories (not Favorites or Recent)
    const isMainCategory = this.selectedCategory !== 'Favorites' && this.selectedCategory !== 'Recent';
    
    if (!isMainCategory) {
      subcategoryBar.style.display = 'none';
      return;
    }

    // Get subcategories for this category
    const subcategories = this.getSubcategoriesForCategory(this.selectedCategory as AssetMainCategory);
    
    if (subcategories.length === 0) {
      subcategoryBar.style.display = 'none';
      return;
    }

    // Show and populate
    subcategoryBar.style.display = 'flex';
    subcategoryBar.innerHTML = '';

    // Add "All" option
    const allBtn = document.createElement('button');
    allBtn.className = 'subcategory-chip';
    allBtn.textContent = 'All';
    if (this.selectedSubcategory === null) {
      allBtn.classList.add('active');
    }
    allBtn.addEventListener('click', () => {
      this.selectedSubcategory = null;
      this.updateSubcategoryBar();
      this.debouncedRefreshAssetGrid();
    });
    subcategoryBar.appendChild(allBtn);

    // Add subcategory chips
    subcategories.forEach(sub => {
      const chip = document.createElement('button');
      chip.className = 'subcategory-chip';
      chip.textContent = sub;
      if (this.selectedSubcategory === sub) {
        chip.classList.add('active');
      }
      chip.addEventListener('click', () => {
        this.selectedSubcategory = sub;
        this.updateSubcategoryBar();
        this.debouncedRefreshAssetGrid();
      });
      subcategoryBar.appendChild(chip);
    });
  }

  /**
   * Gets available subcategories for a main category.
   */
  private getSubcategoriesForCategory(category: AssetMainCategory): string[] {
    const assets = assetRegistry.getByCategory(category);
    const subcategories = new Set<string>();
    
    assets.forEach(asset => {
      if (asset.subcategory) {
        subcategories.add(asset.subcategory);
      }
    });

    return Array.from(subcategories).sort();
  }

  /**
   * Updates category badge counts.
   */
  private updateCategoryBadges(): void {
    const tabs = this.palettePanel?.querySelectorAll('.palette-category-tab');
    if (!tabs) return;

    tabs.forEach(tab => {
      const category = tab.getAttribute('data-category') as CategoryType;
      const badge = tab.querySelector('.category-tab-badge') as HTMLElement;
      if (!badge) return;

      let count = 0;
      if (category === 'Favorites') {
        count = this.favoritesManager.getCount();
      } else if (category === 'Recent') {
        count = this.recentTracker.getCount();
      } else {
        count = assetRegistry.getByCategory(category as AssetMainCategory).length;
      }

      if (count > 0) {
        badge.textContent = count.toString();
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    });
  }

  /**
   * Refreshes the asset grid based on selected category (with throttling).
   */
  private refreshAssetGrid(): void {
    const now = Date.now();
    
    // Throttle rapid refreshes
    if (now - this.lastRenderTime < this.MIN_RENDER_INTERVAL) {
      return;
    }
    
    this.lastRenderTime = now;
    
    const grid = this.palettePanel?.querySelector('.palette-asset-grid');
    if (!grid) return;

    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
      grid.innerHTML = '';

      // Get assets based on selected category
      let assets: Asset[] = [];
      
      if (this.selectedCategory === 'Favorites') {
        assets = this.favoritesManager.getFavoriteAssets((id) => assetRegistry.get(id));
      } else if (this.selectedCategory === 'Recent') {
        assets = this.recentTracker.getRecentAssets((id) => assetRegistry.get(id));
      } else {
        // Regular category
        if (this.selectedSubcategory) {
          assets = assetRegistry.getBySubcategory(this.selectedCategory as AssetMainCategory, this.selectedSubcategory);
        } else {
          assets = assetRegistry.getByCategory(this.selectedCategory as AssetMainCategory);
        }
      }

      // Apply search filter
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        assets = assets.filter(asset => {
          return (
            asset.metadata.name.toLowerCase().includes(query) ||
            asset.metadata.description?.toLowerCase().includes(query) ||
            asset.tags?.some(tag => tag.toLowerCase().includes(query)) ||
            asset.keywords?.some(kw => kw.toLowerCase().includes(query))
          );
        });
      }

      // Apply sorting
      assets = this.sortAssets(assets);

      // Create asset cards with batching for better performance
      this.createAssetCardsBatched(grid, assets);

      // Update category badges
      this.updateCategoryBadges();
    });
  }
  
  /**
   * Debounced version of refreshAssetGrid
   */
  private debouncedRefreshAssetGrid(): void {
    if (this.renderDebounceTimeout !== null) {
      window.clearTimeout(this.renderDebounceTimeout);
    }
    
    this.renderDebounceTimeout = window.setTimeout(() => {
      this.refreshAssetGrid();
      this.renderDebounceTimeout = null;
    }, this.RENDER_DEBOUNCE_MS);
  }
  
  /**
   * Create asset cards in batches for better performance
   */
  private createAssetCardsBatched(grid: Element, assets: Asset[]): void {
    if (assets.length === 0) {
      this.showEmptyState(grid);
      return;
    }
    
    const BATCH_SIZE = 20;
    let index = 0;
    
    const createBatch = () => {
      const fragment = document.createDocumentFragment();
      const end = Math.min(index + BATCH_SIZE, assets.length);
      
      for (let i = index; i < end; i++) {
        const asset = assets[i];
        if (asset) {
          const card = this.createAssetCard(asset);
          fragment.appendChild(card);
        }
      }
      
      grid.appendChild(fragment);
      index = end;
      
      if (index < assets.length) {
        requestAnimationFrame(createBatch);
      }
    };
    
    createBatch();
  }
  
  /**
   * Show empty state in grid
   */
  private showEmptyState(grid: Element): void {
    const emptyState = document.createElement('div');
    emptyState.className = 'palette-empty-state';
    
    let message = 'No assets found';
    let icon = 'box';
    
    if (this.searchQuery) {
      message = `No results for "${this.searchQuery}"`;
      icon = 'search';
    } else if (this.selectedCategory === 'Favorites') {
      message = 'No favorites yet. Click the star on any asset to add it here!';
      icon = 'star';
    } else if (this.selectedCategory === 'Recent') {
      message = 'No recent assets. Start placing assets to see them here!';
      icon = 'rotate-ccw';
    }
    
    emptyState.innerHTML = `
      <div class="empty-state-icon">${iconHTML(icon as IconName)}</div>
      <div class="empty-state-text">${message}</div>
    `;
    grid.appendChild(emptyState);
  }

  /**
   * Sorts assets based on current sort option.
   */
  private sortAssets(assets: Asset[]): Asset[] {
    const sorted = [...assets];

    switch (this.currentSortBy) {
      case 'name':
        sorted.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
        break;
      case 'recent':
      case 'date':
        sorted.sort((a, b) => {
          const dateA = a.metadata.createdAt || new Date(0);
          const dateB = b.metadata.createdAt || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        break;
      case 'usage':
        sorted.sort((a, b) => {
          const usageA = a.metadata.usageCount || 0;
          const usageB = b.metadata.usageCount || 0;
          return usageB - usageA;
        });
        break;
    }

    // Favorites first (optional enhancement)
    if (this.selectedCategory !== 'Favorites') {
      sorted.sort((a, b) => {
        const aFav = this.favoritesManager.isFavorite(a.metadata.id);
        const bFav = this.favoritesManager.isFavorite(b.metadata.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return 0;
      });
    }

    return sorted;
  }

  /**
   * Creates an asset card for the grid.
   */
  private createAssetCard(asset: Asset): HTMLElement {
    const card = document.createElement('button');
    card.className = 'palette-asset-card';
    card.dataset.assetId = asset.metadata.id;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${asset.metadata.name}. ${asset.metadata.description || ''} Double-click to add to hotbar.`);
    card.tabIndex = 0;

    // Favorite star button
    const favBtn = document.createElement('button');
    favBtn.className = 'asset-card-favorite';
    favBtn.setAttribute('aria-label', 'Toggle favorite');
    favBtn.tabIndex = -1; // Prevent tab navigation to nested button
    const isFavorite = this.favoritesManager.isFavorite(asset.metadata.id);
    favBtn.classList.toggle('active', isFavorite);
    favBtn.innerHTML = iconHTML('star');
    favBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newState = this.favoritesManager.toggleFavorite(asset.metadata.id);
      favBtn.classList.toggle('active', newState);
      favBtn.title = newState ? 'Remove from favorites' : 'Add to favorites';
      favBtn.setAttribute('aria-pressed', String(newState));
      
      // Visual feedback
      favBtn.style.transform = 'scale(1.3)';
      setTimeout(() => {
        favBtn.style.transform = '';
      }, 200);
    });
    card.appendChild(favBtn);

    // Icon/thumbnail
    const icon = document.createElement('div');
    icon.className = 'asset-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (asset.thumbnail) {
      const img = document.createElement('img');
      img.src = asset.thumbnail;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      
      // Add loading placeholder
      img.style.opacity = '0';
      img.onload = () => {
        img.style.transition = 'opacity 0.2s ease';
        img.style.opacity = '1';
      };
      
      icon.appendChild(img);
    } else {
      icon.innerHTML = iconHTML('cube');
    }
    card.appendChild(icon);

    // Name
    const name = document.createElement('div');
    name.className = 'asset-card-name';
    name.textContent = asset.metadata.name;
    card.appendChild(name);

    // Click to activate/place
    card.addEventListener('click', () => {
      this.activateAsset(asset);
    });
    
    // Keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.activateAsset(asset);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.favoritesManager.toggleFavorite(asset.metadata.id);
        favBtn.classList.toggle('active');
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.addToNextFreeHotbarSlot(asset);
      }
    });

    // Double-click to add to hotbar
    card.addEventListener('dblclick', () => {
      this.addToNextFreeHotbarSlot(asset);
    });

    // Right-click for variants
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (asset.variants && asset.variants.length > 0) {
        this.showVariantPicker(asset, card);
      }
    });

    // Make card draggable
    this.setupAssetCardDragDrop(card, asset);

    return card;
  }

  /**
   * Sets up drag and drop handlers for an asset card.
   */
  private setupAssetCardDragDrop(card: HTMLElement, asset: Asset): void {
    card.draggable = true;

    card.addEventListener('dragstart', (e) => {
      this.draggedAsset = asset;
      this.draggedFromSlot = null; // Not from a slot
      
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', asset.metadata.id);
      }

      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      this.draggedAsset = null;
      card.classList.remove('dragging');
    });
  }

  /**
   * Activates an asset for placement.
   */
  private activateAsset(asset: Asset, variant?: AssetVariant): void {
    this.config.onStartPlacement(asset, variant);
    
    // Track usage
    this.recentTracker.recordUsage(asset.metadata.id);
    assetRegistry.incrementUsageCount(asset.metadata.id);
    
    this.showFeedback(`Selected: ${asset.metadata.name}`, 2000);
  }

  /**
   * Selects a hotbar slot.
   */
  private selectHotbarSlot(index: number): void {
    const asset = this.hotbarSlots[index];
    if (!asset) return;

    // Deselect all slots
    this.hotbar?.querySelectorAll('.hotbar-slot').forEach((slot) => {
      slot.classList.remove('active');
    });

    // Select this slot
    const slot = this.hotbar?.querySelector(`[data-slot="${index}"]`);
    slot?.classList.add('active');

    // Activate asset
    this.activateAsset(asset);
  }

  /**
   * Clears a hotbar slot.
   */
  private clearHotbarSlot(index: number): void {
    this.hotbarSlots[index] = null as any;
    this.refreshHotbarSlot(index);
  }

  /**
   * Adds an asset to the next free hotbar slot.
   */
  private addToNextFreeHotbarSlot(asset: Asset): void {
    const freeIndex = this.hotbarSlots.findIndex((slot) => !slot);
    if (freeIndex === -1) {
      // No free slots, use first slot
      this.hotbarSlots[0] = asset;
      this.refreshHotbarSlot(0);
      return;
    }

    this.hotbarSlots[freeIndex] = asset;
    this.refreshHotbarSlot(freeIndex);
    this.showFeedback(`Added to slot ${freeIndex + 1}`);
  }

  /**
   * Refreshes a hotbar slot display.
   */
  private refreshHotbarSlot(index: number): void {
    const slot = this.hotbar?.querySelector(`[data-slot="${index}"]`) as HTMLElement;
    if (!slot) return;

    const iconContainer = slot.querySelector('.hotbar-slot-icon');
    if (!iconContainer) return;

    const asset = this.hotbarSlots[index];
    if (asset) {
      iconContainer.innerHTML = '';
      if (asset.thumbnail) {
        const img = document.createElement('img');
        img.src = asset.thumbnail;
        img.alt = '';
        img.loading = 'eager';
        img.decoding = 'async';
        iconContainer.appendChild(img);
      } else {
        iconContainer.innerHTML = iconHTML('cube');
      }
      slot.setAttribute('title', asset.metadata.name);
      slot.setAttribute('aria-label', `Hotbar slot ${index + 1}: ${asset.metadata.name}. Press ${index + 1} to activate.`);
    } else {
      iconContainer.innerHTML = '';
      slot.setAttribute('title', `Empty slot (${index + 1})`);
      slot.setAttribute('aria-label', `Hotbar slot ${index + 1}: Empty. Press ${index + 1} to activate.`);
    }
  }

  /**
   * Shows variant picker for an asset.
   */
  private showVariantPicker(asset: Asset, anchorElement: HTMLElement): void {
    // TODO: Implement variant picker (Minecraft-style swatches)
    console.log('Variant picker for', asset.metadata.name, anchorElement);
  }

  /**
   * Loads default hotbar items.
   */
  private loadDefaultHotbar(): void {
    const defaultAssets = assetRegistry.getByCategory('Building').slice(0, 9);
    defaultAssets.forEach((asset, index) => {
      this.hotbarSlots[index] = asset;
      this.refreshHotbarSlot(index);
    });
  }

  /**
   * Sets up keyboard shortcuts.
   */
  private setupKeyboardShortcuts(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if typing in input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Number keys 1-9 for hotbar slots
      if (event.key >= '1' && event.key <= '9' && !event.ctrlKey && !event.metaKey) {
        const index = parseInt(event.key) - 1;
        this.selectHotbarSlot(index);
        event.preventDefault();
      }

      // B key to toggle palette
      if (event.key === 'b' && !event.ctrlKey && !event.metaKey) {
        this.togglePalette();
        event.preventDefault();
      }

      // F key to open favorites (when palette is open)
      if (event.key === 'f' && !event.ctrlKey && !event.metaKey && this.isExpanded) {
        this.selectCategory('Favorites');
        event.preventDefault();
      }

      // R key to open recent (when palette is open)
      if (event.key === 'r' && !event.ctrlKey && !event.metaKey && this.isExpanded) {
        this.selectCategory('Recent');
        event.preventDefault();
      }

      // Escape to close palette
      if (event.key === 'Escape' && this.isExpanded) {
        this.togglePalette();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    this.keyboardCleanup = () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Disposes the asset palette.
   */
  public dispose(): void {
    if (this.keyboardCleanup) {
      this.keyboardCleanup();
      this.keyboardCleanup = null;
    }

    if (this.inventoryCleanup) {
      this.inventoryCleanup();
      this.inventoryCleanup = null;
    }

    if (this.favoritesCleanup) {
      this.favoritesCleanup();
      this.favoritesCleanup = null;
    }

    if (this.recentCleanup) {
      this.recentCleanup();
      this.recentCleanup = null;
    }

    if (this.searchTimeout !== null) {
      window.clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    
    if (this.renderDebounceTimeout !== null) {
      window.clearTimeout(this.renderDebounceTimeout);
      this.renderDebounceTimeout = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.container = null;
    this.hotbar = null;
    this.palettePanel = null;
  }
}


/**
 * CatalogPanel - Streamlined asset catalog for Build Mode
 * 
 * Optimized for side panel display with:
 * - Hierarchical categories
 * - Search with live filtering
 * - Grid view with variants
 * - Favorites and recent sections
 * - Drag support for adding to hotbar
 */

import type { Asset, AssetVariant, AssetMainCategory, AssetFilter } from '@engine/assets';
import { assetRegistry } from '@engine/assets';
import { createIcon } from '../utils/icons';
import { FavoritesManager } from '../managers/FavoritesManager';
import { RecentAssetsTracker } from '@engine/assets';
import { Logger } from '../../utils/logger';

export interface CatalogPanelConfig {
  onAssetSelect: (asset: Asset, variant?: AssetVariant) => void;
  onDragStart?: (asset: Asset, variant?: AssetVariant) => void;
  onDragEnd?: () => void;
  isAssetInHotbar?: (asset: Asset) => boolean;
}

export class CatalogPanel {
  private container: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private categoryList: HTMLElement | null = null;
  private assetGrid: HTMLElement | null = null;
  private selectedCategory: AssetMainCategory | null = null;
  private currentFilter: AssetFilter = {};
  private favoritesManager = new FavoritesManager();
  private recentTracker = new RecentAssetsTracker();
  private config: CatalogPanelConfig;

  constructor(config: CatalogPanelConfig) {
    this.config = config;
  }

  /**
   * Mounts the catalog panel to a parent element
   */
  mount(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'catalog-panel';

    // Header with search
    const header = this.createHeader();
    this.container.appendChild(header);

    // Main content area
    const content = document.createElement('div');
    content.className = 'catalog-content';

    // Category list
    this.categoryList = this.createCategoryList();
    content.appendChild(this.categoryList);

    // Asset grid
    this.assetGrid = document.createElement('div');
    this.assetGrid.className = 'catalog-asset-grid custom-scrollbar';
    content.appendChild(this.assetGrid);

    this.container.appendChild(content);

    parent.appendChild(this.container);

    // Initial render
    this.renderAssets();

    Logger.debug('CatalogPanel: Mounted');
  }

  /**
   * Creates the header with search
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'catalog-header';

    const title = document.createElement('h3');
    title.className = 'catalog-title';
    title.textContent = 'Asset Catalog';
    header.appendChild(title);

    // Search box
    const searchBox = document.createElement('div');
    searchBox.className = 'catalog-search';

    const searchIcon = createIcon('search', 16);
    searchIcon.classList.add('search-icon');

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.className = 'catalog-search-input';
    this.searchInput.placeholder = 'Search assets...';
    this.searchInput.addEventListener('input', () => this.handleSearch());

    searchBox.appendChild(searchIcon);
    searchBox.appendChild(this.searchInput);
    header.appendChild(searchBox);

    return header;
  }

  /**
   * Creates the category list
   */
  private createCategoryList(): HTMLElement {
    const list = document.createElement('div');
    list.className = 'catalog-categories';

    const categories: Array<{ id: AssetMainCategory | 'all' | 'favorites' | 'recent'; label: string; icon: string }> = [
      { id: 'all', label: 'All Assets', icon: 'grid' },
      { id: 'favorites', label: 'Favorites', icon: 'star' },
      { id: 'recent', label: 'Recent', icon: 'clock' },
      { id: 'Building', label: 'Building', icon: 'box' },
      { id: 'Architecture', label: 'Architecture', icon: 'home' },
      { id: 'Furniture', label: 'Furniture', icon: 'armchair' },
      { id: 'Decoration', label: 'Decoration', icon: 'flower' },
      { id: 'Lighting', label: 'Lighting', icon: 'lightbulb' },
      { id: 'Nature', label: 'Nature', icon: 'tree' },
      { id: 'Gameplay', label: 'Gameplay', icon: 'gamepad' },
    ];

    categories.forEach((cat) => {
      const button = document.createElement('button');
      button.className = 'catalog-category-btn';
      button.dataset.category = cat.id;

      const icon = createIcon(cat.icon as Parameters<typeof createIcon>[0], 16);
      const label = document.createElement('span');
      label.textContent = cat.label;

      button.appendChild(icon);
      button.appendChild(label);

      button.addEventListener('click', () => this.selectCategory(cat.id));

      list.appendChild(button);
    });

    // Select "All Assets" by default
    this.updateCategorySelection();

    return list;
  }

  /**
   * Handles category selection
   */
  private selectCategory(categoryId: AssetMainCategory | 'all' | 'favorites' | 'recent'): void {
    // Update filter based on category
    if (categoryId === 'all') {
      delete this.currentFilter.category;
      this.selectedCategory = null;
    } else if (categoryId === 'favorites') {
      this.selectedCategory = null;
      // Will be handled in renderAssets
    } else if (categoryId === 'recent') {
      this.selectedCategory = null;
      // Will be handled in renderAssets
    } else {
      this.currentFilter.category = categoryId;
      this.selectedCategory = categoryId;
    }

    this.updateCategorySelection();
    this.renderAssets();
  }

  /**
   * Updates visual selection of categories
   */
  private updateCategorySelection(): void {
    if (!this.categoryList) return;

    const buttons = this.categoryList.querySelectorAll('.catalog-category-btn');
    buttons.forEach((btn) => {
      const category = (btn as HTMLElement).dataset.category;
      const isSelected = 
        (category === 'all' && !this.selectedCategory) ||
        (category === this.selectedCategory);
      btn.classList.toggle('active', isSelected);
    });
  }

  /**
   * Handles search input
   */
  private handleSearch(): void {
    if (!this.searchInput) return;

    const searchTerm = this.searchInput.value.trim();
    if (searchTerm) {
      this.currentFilter.search = searchTerm;
    } else {
      delete this.currentFilter.search;
    }

    this.renderAssets();
  }

  /**
   * Renders the asset grid
   */
  private renderAssets(): void {
    if (!this.assetGrid) return;

    this.assetGrid.innerHTML = '';

    // Get assets based on current filter/category
    let assets: Asset[] = [];

    const activeCategory = this.categoryList?.querySelector('.catalog-category-btn.active')?.getAttribute('data-category');

    if (activeCategory === 'favorites') {
      const favoriteIds = this.favoritesManager.getFavorites();
      assets = favoriteIds
        .map((id) => assetRegistry.get(id))
        .filter((asset): asset is Asset => asset !== undefined);
    } else if (activeCategory === 'recent') {
      const recentIds = this.recentTracker.getRecent();
      assets = recentIds
        .map((id) => assetRegistry.get(id))
        .filter((asset): asset is Asset => asset !== undefined);
    } else {
      assets = assetRegistry.query(this.currentFilter, {
        sortBy: 'name',
        ascending: true,
      });
    }

    if (assets.length === 0) {
      this.renderEmpty();
      return;
    }

    // Create asset cards
    assets.forEach((asset) => {
      const card = this.createAssetCard(asset);
      this.assetGrid!.appendChild(card);
    });

    Logger.debug(`CatalogPanel: Rendered ${assets.length} assets`);
  }

  /**
   * Creates an asset card
   */
  private createAssetCard(asset: Asset): HTMLElement {
    const card = document.createElement('div');
    card.className = 'catalog-asset-card';
    card.setAttribute('draggable', 'true');

    // Thumbnail with color
    const thumbnail = document.createElement('div');
    thumbnail.className = 'catalog-asset-thumbnail';
    const [r, g, b, a] = asset.color;
    thumbnail.style.backgroundColor = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
    card.appendChild(thumbnail);

    // Info
    const info = document.createElement('div');
    info.className = 'catalog-asset-info';

    const name = document.createElement('div');
    name.className = 'catalog-asset-name';
    name.textContent = asset.metadata.name;
    name.title = asset.metadata.name;

    info.appendChild(name);
    card.appendChild(info);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'catalog-asset-actions';

    // Favorite button
    const isFavorite = this.favoritesManager.isFavorite(asset.metadata.id);
    const favBtn = document.createElement('button');
    favBtn.className = 'catalog-action-btn';
    favBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
    favBtn.appendChild(createIcon(isFavorite ? 'star-filled' : 'star', 14));
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFavorite(asset);
    });
    actions.appendChild(favBtn);

    // Hotbar indicator
    if (this.config.isAssetInHotbar?.(asset)) {
      const hotbarBadge = document.createElement('div');
      hotbarBadge.className = 'catalog-hotbar-badge';
      hotbarBadge.title = 'In hotbar';
      hotbarBadge.appendChild(createIcon('check', 14));
      actions.appendChild(hotbarBadge);
    }

    card.appendChild(actions);

    // Variants (if any)
    if (asset.variants && asset.variants.length > 0) {
      const variants = this.createVariantSelector(asset);
      card.appendChild(variants);
    }

    // Click to place
    card.addEventListener('click', () => {
      this.selectAsset(asset);
    });

    // Drag handlers
    this.setupCardDragHandlers(card, asset);

    return card;
  }

  /**
   * Creates variant selector swatches
   */
  private createVariantSelector(asset: Asset): HTMLElement {
    const container = document.createElement('div');
    container.className = 'catalog-variant-swatches';

    asset.variants!.forEach((variant) => {
      const swatch = document.createElement('button');
      swatch.className = 'catalog-variant-swatch';
      swatch.title = variant.name;

      if (variant.color) {
        const [r, g, b, a] = variant.color;
        swatch.style.backgroundColor = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      }

      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectAsset(asset, variant);
      });

      container.appendChild(swatch);
    });

    return container;
  }

  /**
   * Setup drag handlers for an asset card
   */
  private setupCardDragHandlers(card: HTMLElement, asset: Asset): void {
    card.addEventListener('dragstart', (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('application/x-catalog-asset', asset.metadata.id);
      }

      card.classList.add('dragging');
      this.config.onDragStart?.(asset);

      Logger.debug(`CatalogPanel: Started dragging ${asset.metadata.name}`);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.config.onDragEnd?.();

      Logger.debug(`CatalogPanel: Ended dragging`);
    });
  }

  /**
   * Selects an asset (click to place)
   */
  private selectAsset(asset: Asset, variant?: AssetVariant): void {
    // Track as recent
    this.recentTracker.addRecent(asset.metadata.id);

    // Notify parent
    this.config.onAssetSelect(asset, variant);

    Logger.debug(`CatalogPanel: Selected ${asset.metadata.name}${variant ? ` (${variant.name})` : ''}`);
  }

  /**
   * Toggles favorite status of an asset
   */
  private toggleFavorite(asset: Asset): void {
    this.favoritesManager.toggleFavorite(asset.metadata.id);
    this.renderAssets(); // Re-render to update star icons
  }

  /**
   * Renders empty state
   */
  private renderEmpty(): void {
    if (!this.assetGrid) return;

    const empty = document.createElement('div');
    empty.className = 'catalog-empty';

    const icon = createIcon('search', 48);
    icon.style.opacity = '0.3';

    const text = document.createElement('p');
    text.textContent = 'No assets found';
    text.style.opacity = '0.6';

    empty.appendChild(icon);
    empty.appendChild(text);
    this.assetGrid.appendChild(empty);
  }

  /**
   * Focuses the search input
   */
  focusSearch(): void {
    this.searchInput?.focus();
  }

  /**
   * Clears the search
   */
  clearSearch(): void {
    if (this.searchInput) {
      this.searchInput.value = '';
      delete this.currentFilter.search;
      this.renderAssets();
    }
  }

  /**
   * Refreshes the asset grid
   */
  refresh(): void {
    this.renderAssets();
  }

  /**
   * Sets visibility
   */
  setVisibility(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'flex' : 'none';
    }
  }

  /**
   * Gets the container element
   */
  getContainer(): HTMLElement | null {
    return this.container;
  }

  /**
   * Disposes the component
   */
  dispose(): void {
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }

    this.container = null;
    Logger.debug('CatalogPanel: Disposed');
  }
}


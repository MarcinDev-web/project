/**
 * Asset Browser V2 - Advanced Asset Management UI
 * 
 * Features:
 * - Hierarchical category navigation (Sims style)
 * - Multi-filter system (type, style, material, tags)
 * - Sorting options
 * - Collection view
 * - Variant selector (Minecraft swatches)
 * - Asset detail preview
 * - Search with suggestions
 * - Card and list view modes
 */

import type { Scene } from '@engine/world';
import type { EditorState } from '../core/state';
import type {
  Asset,
  AssetFilter,
  AssetMainCategory,
  AssetSubcategory,
  AssetType,
  AssetStyle,
  AssetMaterial,
  AssetSortBy,
  AssetVariant,
  AssetCollection,
} from './AssetTypes';
import { assetRegistry } from './AssetRegistry';
import { Logger } from '../../utils/logger';
import { createIcon } from '../utils/icons';
import { ThumbnailRenderer } from '@engine/gfx-webgpu/renderers/ThumbnailRenderer';

export interface AssetBrowserV2Options {
  /** Custom placement validation */
  canPlace?: (asset: Asset) => boolean;
  /** Resource budget info */
  getResourceInfo?: (asset: Asset) => { remaining: number; budget: number } | null;
  /** View mode */
  defaultViewMode?: 'grid' | 'list';
  /** Show collections tab */
  showCollections?: boolean;
}

type ViewTab = 'assets' | 'collections' | 'favorites';
type ViewMode = 'grid' | 'list';
type TagFilterKey = 'type' | 'style' | 'material';
type TagFilterValue = AssetType | AssetStyle | AssetMaterial;

interface TagFilterGroupState {
  active: Set<string>;
  chips: Map<string, HTMLButtonElement>;
}

export class AssetBrowserV2 {
  private container: HTMLElement | null = null;
  private contentArea: HTMLElement | null = null;
  private currentFilter: AssetFilter = {};
  private currentSort: AssetSortBy = 'name';
  private currentTab: ViewTab = 'assets';
  private viewMode: ViewMode = 'grid';
  private selectedCategory: AssetMainCategory | undefined = undefined;
  private selectedSubcategory: AssetSubcategory | undefined = undefined;
  private sidebar: HTMLElement | null = null;
  private mainArea: HTMLElement | null = null;
  private headerSearchInput: HTMLInputElement | null = null;
  private searchSuggestions: HTMLUListElement | null = null;
  private searchSuggestionIndex: number = -1;
  private searchHistory: string[] = [];
  private quickFilterBar: HTMLElement | null = null;
  private categoryList: HTMLElement | null = null;
  private subcategoryList: HTMLElement | null = null;
  private resultSummary: HTMLElement | null = null;
  private quickFilterState: Record<'featured' | 'placeable' | 'builtIn', boolean> = {
    featured: false,
    placeable: false,
    builtIn: false,
  };
  private favorites = new Set<string>();
  private thumbnailRenderer: ThumbnailRenderer | null = null;
  private options: AssetBrowserV2Options;
  private tagFilterGroups: Partial<Record<TagFilterKey, TagFilterGroupState>> = {};

  constructor(
    private readonly _scene: Scene,
    private readonly onAssetSelect: (asset: Asset, variant?: AssetVariant) => void,
    private readonly _state?: EditorState,
    options?: AssetBrowserV2Options
  ) {
    this.options = {
      defaultViewMode: 'grid',
      showCollections: true,
      ...options,
    };
    this.viewMode = this.options.defaultViewMode!;
    void this._scene;
    void this._state;
    this.loadFavorites();
    this.loadSearchHistory();
  }

  /**
   * Mount the browser to a parent element
   */
  public mount(parent: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.className = 'asset-browser-v2';
    this.buildLayout();

    parent.appendChild(this.container);

    // Initialize thumbnail renderer
    this.thumbnailRenderer = new ThumbnailRenderer();
    void this.thumbnailRenderer.initialize();

    // Initial render
    this.render();
  }

  public focusSearch(): void {
    if (!this.headerSearchInput) {
      const search = this.sidebar?.querySelector<HTMLInputElement>('.search-input');
      if (search) {
        this.headerSearchInput = search;
      }
    }
    this.headerSearchInput?.focus();
  }

  public refresh(): void {
    this.render();
  }

  public setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    this.updateViewModeButtons();
    this.render();
  }

  public clearFilters(): void {
    this.currentFilter = {};
    this.selectedCategory = undefined;
    this.selectedSubcategory = undefined;
    Object.keys(this.quickFilterState).forEach((key) => {
      this.quickFilterState[key as keyof typeof this.quickFilterState] = false;
    });
    this.updateQuickFilterState();
    this.resetTagFilterGroups();
    if (this.headerSearchInput) {
      this.headerSearchInput.value = '';
    }
    this.render();
  }

  // ============================================================================
  // UI CREATION
  // ============================================================================

  private buildLayout(): void {
    this.container!.innerHTML = '';

    const layout = document.createElement('div');
    layout.className = 'asset-browser-layout';

    this.sidebar = document.createElement('aside');
    this.sidebar.className = 'asset-browser-sidebar custom-scrollbar';

    this.mainArea = document.createElement('section');
    this.mainArea.className = 'asset-browser-main';

    this.createHeader();
    this.createQuickFilters();
    this.createCategoryNavigation();
    this.createAdvancedFilters();

    this.createTabs();
    this.createActionBar();
    this.createResultSummary();

    this.contentArea = document.createElement('div');
    this.contentArea.className = 'asset-browser-content custom-scrollbar';
    this.mainArea.appendChild(this.contentArea);

    layout.appendChild(this.sidebar);
    layout.appendChild(this.mainArea);
    this.container!.appendChild(layout);

    this.updateViewModeButtons();
    this.updateTabButtons();
  }

  private createHeader(): void {
    const header = document.createElement('div');
    header.className = 'asset-browser-header';

    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    const titleGroup = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Asset Library';
    const subtitle = document.createElement('p');
    subtitle.className = 'panel-subtitle';
    subtitle.textContent = 'Browse and place assets';
    titleGroup.appendChild(title);
    titleGroup.appendChild(subtitle);

    const viewModeGroup = document.createElement('div');
    viewModeGroup.className = 'view-mode-toggle';
    viewModeGroup.setAttribute('role', 'radiogroup');
    viewModeGroup.setAttribute('aria-label', 'View mode');

    const gridBtn = this.createIconButton('grid', 'Grid view', () => {
      this.viewMode = 'grid';
      this.updateViewModeButtons();
      this.render();
    });
    gridBtn.dataset.mode = 'grid';
    gridBtn.setAttribute('role', 'radio');
    gridBtn.setAttribute('aria-checked', String(this.viewMode === 'grid'));

    const listBtn = this.createIconButton('list', 'List view', () => {
      this.viewMode = 'list';
      this.updateViewModeButtons();
      this.render();
    });
    listBtn.dataset.mode = 'list';
    listBtn.setAttribute('role', 'radio');
    listBtn.setAttribute('aria-checked', String(this.viewMode === 'list'));

    viewModeGroup.appendChild(gridBtn);
    viewModeGroup.appendChild(listBtn);

    const searchBox = document.createElement('div');
    searchBox.className = 'asset-browser-search';

    const searchIcon = createIcon('search', 16, 'search-icon');
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'search-input';
    input.placeholder = 'Search assets, tags, or creators...';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-haspopup', 'listbox');
    input.addEventListener('input', () => {
      this.currentFilter.search = input.value;
      this.render();
      this.showSearchSuggestions(input.value);
    });
    input.addEventListener('focus', () => {
      this.showSearchSuggestions(input.value);
    });
    input.addEventListener('blur', () => {
      // Delay to allow click on suggestion
      setTimeout(() => this.hideSearchSuggestions(), 120);
    });
    input.addEventListener('keydown', (e) => {
      if (!this.searchSuggestions) return;
      const items = Array.from(this.searchSuggestions.querySelectorAll<HTMLElement>('[role="option"]'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length === 0) return;
        this.searchSuggestionIndex = (this.searchSuggestionIndex + 1) % items.length;
        this.updateSuggestionActive(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length === 0) return;
        this.searchSuggestionIndex = (this.searchSuggestionIndex - 1 + items.length) % items.length;
        this.updateSuggestionActive(items);
      } else if (e.key === 'Enter') {
        if (this.searchSuggestionIndex >= 0 && this.searchSuggestionIndex < items.length) {
          const selected = items[this.searchSuggestionIndex];
          if (selected) {
            const value = selected.dataset.value;
            if (value) {
              this.commitSearch(value);
              return;
            }
          }
        }
        this.commitSearch(input.value);
      } else if (e.key === 'Escape') {
        this.hideSearchSuggestions();
      }
    });
    this.headerSearchInput = input;

    searchBox.appendChild(searchIcon);
    searchBox.appendChild(input);
    // Suggestions list
    const suggestions = document.createElement('ul');
    suggestions.className = 'asset-browser-search-suggestions';
    suggestions.setAttribute('role', 'listbox');
    suggestions.id = 'asset-browser-search-suggestions';
    suggestions.hidden = true;
    input.setAttribute('aria-controls', suggestions.id);
    this.searchSuggestions = suggestions;
    searchBox.appendChild(suggestions);

    titleRow.appendChild(titleGroup);
    titleRow.appendChild(searchBox);
    titleRow.appendChild(viewModeGroup);
    header.appendChild(titleRow);

    this.sidebar!.appendChild(header);
    this.updateViewModeButtons();
  }

  private createQuickFilters(): void {
    const quickFilters = document.createElement('div');
    quickFilters.className = 'asset-browser-quick-filters';

    const filters: Array<{ id: 'featured' | 'placeable' | 'builtIn'; label: string; icon: string; hint: string }> = [
      { id: 'featured', label: 'Featured', icon: 'sparkle', hint: 'Show featured assets' },
      { id: 'placeable', label: 'Placeable', icon: 'mouse-pointer', hint: 'Only assets you can place' },
      { id: 'builtIn', label: 'Built-in', icon: 'shield-check', hint: 'Hide custom assets' },
    ];

    filters.forEach((filter) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-filter-chip';
      button.dataset.filter = filter.id;
      button.title = filter.hint;
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', `${filter.label} (Off)`);

      const icon = createIcon(filter.icon as Parameters<typeof createIcon>[0], 16);
      const label = document.createElement('span');
      label.textContent = filter.label;
      label.className = 'chip-label';
      const state = document.createElement('span');
      state.className = 'chip-state';
      state.textContent = '';

      button.appendChild(icon);
      button.appendChild(label);
      button.appendChild(state);

      button.addEventListener('click', () => {
        this.quickFilterState[filter.id] = !this.quickFilterState[filter.id];
        this.updateQuickFilterState();
        this.applyQuickFilters();
        this.render();
      });

      quickFilters.appendChild(button);
    });

    this.quickFilterBar = quickFilters;
    this.sidebar!.appendChild(quickFilters);
    this.updateQuickFilterState();
  }

  private createCategoryNavigation(): void {
    const section = document.createElement('div');
    section.className = 'asset-browser-section';

    const header = document.createElement('div');
    header.className = 'asset-browser-section-header';
    header.textContent = 'Categories';

    const wrapper = document.createElement('div');
    wrapper.className = 'category-navigation';

    const categoryList = document.createElement('ul');
    categoryList.className = 'category-list';
    categoryList.setAttribute('role', 'listbox');
    categoryList.setAttribute('aria-label', 'Categories');
    categoryList.setAttribute('aria-multiselectable', 'false');

    const categories: Array<{ id?: AssetMainCategory; label: string }> = [
      { label: 'All Assets' },
      { id: 'Building', label: 'Building' },
      { id: 'Architecture', label: 'Architecture' },
      { id: 'Furniture', label: 'Furniture' },
      { id: 'Decoration', label: 'Decoration' },
      { id: 'Lighting', label: 'Lighting' },
      { id: 'Nature', label: 'Nature' },
      { id: 'Gameplay', label: 'Gameplay' },
      { id: 'Materials', label: 'Materials' },
      { id: 'Custom', label: 'My Assets' },
    ];

    categories.forEach((category) => {
      const item = document.createElement('li');
      item.className = 'category-item';
      item.dataset.category = category.id ?? 'all';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category.label;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', 'false');

      button.addEventListener('click', () => {
        if (!category.id) {
          this.selectedCategory = undefined;
          delete this.currentFilter.category;
        } else {
          this.selectedCategory = category.id;
          this.currentFilter.category = category.id;
        }
        this.selectedSubcategory = undefined;
        delete this.currentFilter.subcategory;
        this.updateCategoryList();
        this.updateSubcategoryList();
        this.render();
      });

      item.appendChild(button);
      categoryList.appendChild(item);
    });

    const subcategoryList = document.createElement('ul');
    subcategoryList.className = 'subcategory-list';
    subcategoryList.setAttribute('role', 'listbox');
    subcategoryList.setAttribute('aria-label', 'Subcategories');
    subcategoryList.setAttribute('aria-multiselectable', 'false');

    this.categoryList = categoryList;
    this.subcategoryList = subcategoryList;

    wrapper.appendChild(categoryList);
    wrapper.appendChild(subcategoryList);

    section.appendChild(header);
    section.appendChild(wrapper);

    this.sidebar!.appendChild(section);
    this.updateCategoryList();
    this.updateSubcategoryList();
  }

  private createAdvancedFilters(): void {
    const section = document.createElement('div');
    section.className = 'asset-browser-section';

    const header = document.createElement('div');
    header.className = 'asset-browser-section-header';
    header.textContent = 'Advanced Filters';

    const typeGroup = this.createTagFilterGroup('type', 'Type', ['block', 'model', 'primitive', 'prefab'] as AssetType[], (value) => {
      if (value.length === 0) {
        delete this.currentFilter.type;
      } else {
        this.currentFilter.type = value;
      }
      this.syncTagFilterGroupState('type', value);
      this.render();
    });

    const styleGroup = this.createTagFilterGroup(
      'style',
      'Style',
      ['Modern', 'Contemporary', 'Traditional', 'Rustic', 'Industrial', 'Minimalist', 'Futuristic', 'Cartoon'] as AssetStyle[],
      (value) => {
        if (value.length === 0) {
          delete this.currentFilter.style;
        } else {
          this.currentFilter.style = value;
        }
        this.syncTagFilterGroupState('style', value);
        this.render();
      }
    );

    const materialGroup = this.createTagFilterGroup(
      'material',
      'Material',
      ['Wood', 'Stone', 'Metal', 'Glass', 'Plastic', 'Fabric', 'Concrete', 'Organic'] as AssetMaterial[],
      (value) => {
        if (value.length === 0) {
          delete this.currentFilter.material;
        } else {
          this.currentFilter.material = value;
        }
        this.syncTagFilterGroupState('material', value);
        this.render();
      }
    );

    section.appendChild(header);
    section.appendChild(typeGroup.element);
    section.appendChild(styleGroup.element);
    section.appendChild(materialGroup.element);

    this.sidebar!.appendChild(section);
  }

  private createTabs(): void {
    const tabBar = document.createElement('div');
    tabBar.className = 'asset-browser-tabs';

    const tabs: Array<{ id: ViewTab; label: string; icon: string }> = [
      { id: 'assets', label: 'Assets', icon: 'box' },
      { id: 'collections', label: 'Collections', icon: 'folder' },
      { id: 'favorites', label: 'Favorites', icon: 'star' },
    ];

    tabs.forEach((tab) => {
      if (tab.id === 'collections' && !this.options.showCollections) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab-button';
      btn.dataset.tab = tab.id;

      const icon = createIcon(tab.icon as Parameters<typeof createIcon>[0], 16);
      const label = document.createElement('span');
      label.textContent = tab.label;

      btn.appendChild(icon);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        this.currentTab = tab.id;
        this.updateTabButtons();
        this.render();
      });

      tabBar.appendChild(btn);
    });

    this.mainArea!.appendChild(tabBar);
  }

  private createActionBar(): void {
    const actionBar = document.createElement('div');
    actionBar.className = 'asset-browser-actions';

    const leftGroup = document.createElement('div');
    leftGroup.className = 'asset-browser-actions-left';

    const refreshBtn = this.createIconButton('rotate-ccw', 'Refresh assets', (e) => {
      e.stopPropagation();
      this.refresh();
    });

    leftGroup.appendChild(refreshBtn);

    const sortGroup = document.createElement('div');
    sortGroup.className = 'asset-browser-sort';

    const sortLabel = document.createElement('span');
    sortLabel.textContent = 'Sort by';

    const select = document.createElement('select');
    select.className = 'select select-sm';

    const sortOptions: Array<{ value: AssetSortBy; label: string }> = [
      { value: 'name', label: 'Name (A-Z)' },
      { value: 'recent', label: 'Recently Added' },
      { value: 'usage', label: 'Most Used' },
      { value: 'cost', label: 'Cost' },
    ];

    sortOptions.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      this.currentSort = select.value as AssetSortBy;
      this.render();
    });


    sortGroup.appendChild(sortLabel);
    sortGroup.appendChild(select);

    actionBar.appendChild(leftGroup);
    actionBar.appendChild(sortGroup);

    this.mainArea!.appendChild(actionBar);
  }

  private createResultSummary(): void {
    const summary = document.createElement('div');
    summary.className = 'asset-browser-summary';

    const text = document.createElement('span');
    text.className = 'asset-browser-summary-text';

    const filters = document.createElement('div');
    filters.className = 'asset-browser-active-filters';

    summary.appendChild(text);
    summary.appendChild(filters);

    this.resultSummary = summary;
    this.mainArea!.appendChild(summary);
  }

  private createTagFilterGroup<T extends AssetType | AssetStyle | AssetMaterial>(
    key: TagFilterKey,
    label: string,
    values: T[],
    onChange: (active: T[]) => void
  ): { element: HTMLElement; group: HTMLElement } {
    const container = document.createElement('div');
    container.className = 'filter-tag-group';

    const header = document.createElement('div');
    header.className = 'filter-tag-group-header';
    header.textContent = label;

    const body = document.createElement('div');
    body.className = 'filter-tag-group-body';

    const groupState: TagFilterGroupState = {
      active: new Set<string>(),
      chips: new Map<string, HTMLButtonElement>(),
    };
    this.tagFilterGroups[key] = groupState;

    values.forEach((value) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'filter-chip';
      chip.textContent = value;
      const valueKey = String(value);
      groupState.chips.set(valueKey, chip);

      if (this.isFilterValueActive(key, valueKey)) {
        groupState.active.add(valueKey);
        chip.classList.add('active');
      }

      chip.addEventListener('click', () => {
        if (groupState.active.has(valueKey)) {
          groupState.active.delete(valueKey);
          chip.classList.remove('active');
        } else {
          groupState.active.add(valueKey);
          chip.classList.add('active');
        }
        onChange(Array.from(groupState.active) as unknown as T[]);
        this.updateActiveFilters();
      });

      body.appendChild(chip);
    });

    container.appendChild(header);
    container.appendChild(body);

    return { element: container, group: body };
  }

  private isFilterValueActive(key: TagFilterKey, value: string): boolean {
    const current = this.currentFilter[key];
    if (!current) return false;
    const array = Array.isArray(current) ? current : [current];
    return array.some((item) => String(item) === value);
  }

  private getTagFilterValues(key: TagFilterKey): TagFilterValue[] | undefined {
    const value = this.currentFilter[key];
    if (!value) return undefined;
    return Array.isArray(value) ? (value as TagFilterValue[]) : ([value] as TagFilterValue[]);
  }

  private syncTagFilterGroupState(key: TagFilterKey, values?: TagFilterValue[]): void {
    const group = this.tagFilterGroups[key];
    if (!group) return;
    const activeValues = values ?? [];
    group.active = new Set(activeValues.map((value) => String(value)));
    group.chips.forEach((chip, valueKey) => {
      chip.classList.toggle('active', group.active.has(valueKey));
    });
  }

  private resetTagFilterGroups(): void {
    (Object.keys(this.tagFilterGroups) as TagFilterKey[]).forEach((key) => {
      const group = this.tagFilterGroups[key];
      if (!group) return;
      group.active.clear();
      group.chips.forEach((chip) => chip.classList.remove('active'));
    });
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  private render(): void {
    if (!this.contentArea) return;

    this.updateActiveFilters();

    this.contentArea.innerHTML = '';

    switch (this.currentTab) {
      case 'assets':
        this.renderAssets();
        break;
      case 'collections':
        this.renderCollections();
        break;
      case 'favorites':
        this.renderFavorites();
        break;
    }
  }

  private renderAssets(): void {
    const assets = assetRegistry.query(this.currentFilter, {
      sortBy: this.currentSort,
      ascending: true,
    });

    Logger.debug(`AssetBrowserV2: Found ${assets.length} assets for filter:`, this.currentFilter);

    if (assets.length === 0) {
      // Check if registry is empty
      const totalAssets = assetRegistry.getAll().length;
      Logger.warn(`AssetBrowserV2: No assets match filter. Total in registry: ${totalAssets}`);
      this.renderEmpty('No assets found', 'Try adjusting your filters');
      return;
    }

    const grid = document.createElement('div');
    grid.className = this.viewMode === 'grid' ? 'asset-grid' : 'asset-list';

    assets.forEach((asset) => {
      const card = this.createAssetCard(asset);
      grid.appendChild(card);
    });

    this.contentArea!.appendChild(grid);
    Logger.debug(`AssetBrowserV2: Rendered ${assets.length} asset cards`);
  }

  private renderCollections(): void {
    const collections = assetRegistry.getAllCollections();

    if (collections.length === 0) {
      this.renderEmpty('No collections', 'Collections group related assets together');
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'collection-grid';

    collections.forEach((collection) => {
      const card = this.createCollectionCard(collection);
      grid.appendChild(card);
    });

    this.contentArea!.appendChild(grid);
  }

  private renderFavorites(): void {
    if (this.favorites.size === 0) {
      this.renderEmpty('No favorites yet', 'Click the star icon on assets to add them here');
      return;
    }

    const assets = Array.from(this.favorites)
      .map((id) => assetRegistry.get(id))
      .filter((a): a is Asset => a !== undefined);

    const grid = document.createElement('div');
    grid.className = this.viewMode === 'grid' ? 'asset-grid' : 'asset-list';

    assets.forEach((asset) => {
      const card = this.createAssetCard(asset);
      grid.appendChild(card);
    });

    this.contentArea!.appendChild(grid);
  }

  private renderEmpty(title: string, subtitle: string): void {
    const empty = document.createElement('div');
    empty.className = 'inspector-empty';
    empty.innerHTML = `
      <div class="inspector-empty-icon">${createIcon('search', 48).outerHTML}</div>
      <span>${title}</span>
      <span class="text-xs text-3">${subtitle}</span>
    `;
    this.contentArea!.appendChild(empty);
  }

  // ============================================================================
  // CARD CREATION
  // ============================================================================

  private createAssetCard(asset: Asset): HTMLElement {
    const canPlace = this.options.canPlace ? this.options.canPlace(asset) : true;
    const isFavorite = this.favorites.has(asset.metadata.id);

    const card = document.createElement('div');
    card.className = `asset-card ${this.viewMode === 'list' ? 'asset-card-list' : ''}`;
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    if (!canPlace) card.classList.add('asset-card-disabled');

    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'asset-card-thumbnail';
    thumbnail.style.backgroundColor = `rgba(${asset.color[0] * 255}, ${asset.color[1] * 255}, ${asset.color[2] * 255}, ${asset.color[3]})`;
    card.appendChild(thumbnail);

    // Info section
    const info = document.createElement('div');
    info.className = 'asset-card-info';

    const name = document.createElement('div');
    name.className = 'asset-card-name';
    name.textContent = asset.metadata.name;

    const meta = document.createElement('div');
    meta.className = 'asset-card-meta';
    meta.textContent = `${asset.category} · ${asset.type}`;

    info.appendChild(name);
    info.appendChild(meta);
    card.appendChild(info);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'asset-card-actions';

    // Favorite button
    const favBtn = this.createIconButton(
      isFavorite ? 'star-filled' : 'star',
      isFavorite ? 'Remove from favorites' : 'Add to favorites',
      (e) => {
        e.stopPropagation();
        this.toggleFavorite(asset.metadata.id);
      }
    );
    actions.appendChild(favBtn);

    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Asset actions');
    card.appendChild(actions);

    // Variants (if any)
    if (asset.variants && asset.variants.length > 0) {
      const variants = this.createVariantSelector(asset);
      card.appendChild(variants);
    }

    // Click handler
    card.addEventListener('click', () => {
      if (canPlace) {
        this.onAssetSelect(asset);
      }
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (canPlace) {
          this.onAssetSelect(asset);
        }
      }
    });

    return card;
  }

  private createCollectionCard(collection: AssetCollection): HTMLElement {
    const card = document.createElement('div');
    card.className = 'collection-card';

    const header = document.createElement('div');
    header.className = 'collection-card-header';
    
    const icon = createIcon('folder', 24);
    const name = document.createElement('h3');
    name.textContent = collection.name;
    
    header.appendChild(icon);
    header.appendChild(name);
    card.appendChild(header);

    const description = document.createElement('p');
    description.className = 'collection-card-description';
    description.textContent = collection.description;
    card.appendChild(description);

    const footer = document.createElement('div');
    footer.className = 'collection-card-footer';
    footer.textContent = `${collection.assetIds.length} items`;
    card.appendChild(footer);

    card.addEventListener('click', () => {
      this.showCollectionDetail(collection);
    });

    return card;
  }

  private createVariantSelector(asset: Asset): HTMLElement {
    const container = document.createElement('div');
    container.className = 'variant-selector';
    container.style.cssText = `
      display: flex;
      gap: 0.25rem;
      padding: 0.5rem;
      flex-wrap: wrap;
    `;

    asset.variants!.forEach((variant) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'variant-swatch';
      swatch.title = variant.name;
      swatch.setAttribute('aria-label', `Select variant: ${variant.name}`);
      
      if (variant.color) {
        const [r, g, b, a] = variant.color;
        swatch.style.backgroundColor = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a})`;
      }

      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAssetSelect(asset, variant);
      });

      container.appendChild(swatch);
    });

    return container;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private createIconButton(
    icon: string,
    title: string,
    onClick: (e: MouseEvent) => void
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-button';
    btn.title = title;
    btn.appendChild(createIcon(icon as Parameters<typeof createIcon>[0], 16));
    btn.setAttribute('aria-label', title);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = title;
    btn.appendChild(sr);
    btn.addEventListener('click', onClick);
    return btn;
  }

  private updateViewModeButtons(): void {
    const buttons = this.container!.querySelectorAll('[data-mode]');
    buttons.forEach((btn) => {
      if (btn instanceof HTMLElement) {
        btn.classList.toggle('active', btn.dataset.mode === this.viewMode);
        if (btn.getAttribute('role') === 'radio') {
          btn.setAttribute('aria-checked', String(btn.dataset.mode === this.viewMode));
        }
      }
    });
  }

  private updateTabButtons(): void {
    const buttons = this.container!.querySelectorAll('[data-tab]');
    buttons.forEach((btn) => {
      if (btn instanceof HTMLElement) {
        btn.classList.toggle('active', btn.dataset.tab === this.currentTab);
      }
    });
  }

  private toggleFavorite(assetId: string): void {
    if (this.favorites.has(assetId)) {
      this.favorites.delete(assetId);
    } else {
      this.favorites.add(assetId);
    }
    this.saveFavorites();
    this.render();
  }

  private loadFavorites(): void {
    try {
      const data = localStorage.getItem('assetFavorites');
      if (data) {
        const ids = JSON.parse(data) as string[];
        this.favorites = new Set(ids);
      }
    } catch (error) {
      Logger.warn('Failed to load favorites:', error as Error);
    }
  }

  private saveFavorites(): void {
    try {
      const ids = Array.from(this.favorites);
      localStorage.setItem('assetFavorites', JSON.stringify(ids));
    } catch (error) {
      Logger.warn('Failed to save favorites:', error as Error);
    }
  }

  private showCollectionDetail(collection: AssetCollection): void {
    // Switch to assets tab and filter by collection
    this.currentTab = 'assets';
    this.currentFilter.collectionId = collection.id;
    this.updateTabButtons();
    this.render();
  }

  private updateQuickFilterState(): void {
    if (!this.quickFilterBar) return;

    this.quickFilterBar.querySelectorAll('.quick-filter-chip').forEach((chip) => {
      if (!(chip instanceof HTMLElement)) return;
      const id = chip.dataset.filter as keyof typeof this.quickFilterState | undefined;
      if (!id) return;
      const isActive = this.quickFilterState[id];
      chip.classList.toggle('active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
      chip.setAttribute('aria-label', `${(chip.querySelector('.chip-label') as HTMLElement | null)?.textContent ?? 'Filter'} (${isActive ? 'On' : 'Off'})`);
      const stateEl = chip.querySelector('.chip-state') as HTMLElement | null;
      if (stateEl) {
        stateEl.textContent = isActive ? 'On' : '';
      }
    });
  }

  private applyQuickFilters(): void {
    if (this.quickFilterState.featured) {
      this.currentFilter.featured = true;
    } else {
      delete this.currentFilter.featured;
    }
    if (this.quickFilterState.placeable) {
      this.currentFilter.placeable = true;
    } else {
      delete this.currentFilter.placeable;
    }
    if (this.quickFilterState.builtIn) {
      this.currentFilter.builtIn = true;
    } else {
      delete this.currentFilter.builtIn;
    }
  }

  private updateCategoryList(): void {
    if (!this.categoryList) return;
    const active = this.selectedCategory ?? 'all';

    this.categoryList.querySelectorAll('.category-item').forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      const isActive = item.dataset.category === active;
      item.classList.toggle('active', isActive);
      const btn = item.querySelector('button');
      if (btn) btn.setAttribute('aria-selected', String(isActive));
    });
  }

  private updateSubcategoryList(): void {
    if (!this.subcategoryList) return;

    this.subcategoryList.innerHTML = '';

    if (!this.selectedCategory) return;

    const subcategories = this.getSubcategoriesForCategory(this.selectedCategory);
    if (subcategories.length === 0) return;

    subcategories.forEach((subcategory) => {
      const item = document.createElement('li');
      item.className = 'subcategory-item';
      item.dataset.subcategory = subcategory;

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = subcategory;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(this.selectedSubcategory === subcategory));

      button.addEventListener('click', () => {
        const willSelect = this.selectedSubcategory !== subcategory;
        if (willSelect) {
          this.selectedSubcategory = subcategory;
          this.currentFilter.subcategory = subcategory;
        } else {
          this.selectedSubcategory = undefined;
          delete this.currentFilter.subcategory;
        }
        // Immediate ARIA/state update for current DOM node before re-render (stabilizes tests)
        button.setAttribute('aria-selected', String(willSelect));
        if (willSelect) item.classList.add('active');
        else item.classList.remove('active');
        this.updateSubcategoryList();
        this.render();
      });

      if (this.selectedSubcategory === subcategory) {
        item.classList.add('active');
      }

      item.appendChild(button);
      this.subcategoryList!.appendChild(item);
    });
  }

  private getSubcategoriesForCategory(category: AssetMainCategory): AssetSubcategory[] {
    const map: Partial<Record<AssetMainCategory, AssetSubcategory[]>> = {
      Building: ['Walls', 'Floors', 'Roofs', 'Foundations', 'Fences', 'Other'],
      Architecture: ['Doors', 'Windows', 'Stairs', 'Columns', 'Arches', 'Other'],
      Furniture: ['Seating', 'Tables', 'Beds', 'Storage', 'Surfaces', 'Other'],
      Decoration: ['WallDecor', 'Sculptures', 'Plants', 'Rugs', 'Curtains', 'Other'],
      Nature: ['Trees', 'Bushes', 'Flowers', 'Rocks', 'Grass', 'Other'],
      Lighting: ['CeilingLights', 'WallLights', 'FloorLamps', 'TableLamps', 'Outdoor', 'Other'],
      Gameplay: ['Spawns', 'Triggers', 'Zones', 'Collectibles', 'Interactive', 'Other'],
      Materials: ['Other'],
      Custom: ['Other'],
    };

    return map[category] ?? [];
  }

  private updateActiveFilters(): void {
    if (!this.resultSummary) return;

    const text = this.resultSummary.querySelector('.asset-browser-summary-text');
    const filters = this.resultSummary.querySelector('.asset-browser-active-filters');
    if (!(text instanceof HTMLElement) || !(filters instanceof HTMLElement)) return;

    const assets = assetRegistry.getAll();
    const visibleAssets = assetRegistry.query(this.currentFilter, {
      sortBy: this.currentSort,
      ascending: true,
    });

    text.textContent = `${visibleAssets.length} / ${assets.length} assets`;

    filters.innerHTML = '';

    const activeFilters: Array<{ label: string; clear: () => void }> = [];

    if (this.currentFilter.category) {
      activeFilters.push({
        label: `Category: ${this.currentFilter.category}`,
        clear: () => {
          delete this.currentFilter.category;
          this.selectedCategory = undefined;
          this.updateCategoryList();
          this.updateSubcategoryList();
          this.render();
        },
      });
    }

    if (this.currentFilter.subcategory) {
      activeFilters.push({
        label: `Subcategory: ${this.currentFilter.subcategory}`,
        clear: () => {
          delete this.currentFilter.subcategory;
          this.selectedSubcategory = undefined;
          this.updateSubcategoryList();
          this.render();
        },
      });
    }

    const addMultiFilterChips = <T extends AssetType | AssetStyle | AssetMaterial>(values?: T | T[], prefix?: string) => {
      if (!values) return;
      const array = Array.isArray(values) ? values : [values];
      array.forEach((value) => {
        activeFilters.push({
          label: prefix ? `${prefix}: ${value}` : String(value),
          clear: () => {
            if (!Array.isArray(values)) {
              if (prefix === 'Type') {
                delete this.currentFilter.type;
                this.syncTagFilterGroupState('type');
              }
              if (prefix === 'Style') {
                delete this.currentFilter.style;
                this.syncTagFilterGroupState('style');
              }
              if (prefix === 'Material') {
                delete this.currentFilter.material;
                this.syncTagFilterGroupState('material');
              }
            } else {
              const updated = values.filter((item) => item !== value);
              if (prefix === 'Type') {
                if (updated.length) this.currentFilter.type = updated as AssetType[];
                else delete this.currentFilter.type;
                this.syncTagFilterGroupState('type', this.getTagFilterValues('type'));
              }
              if (prefix === 'Style') {
                if (updated.length) this.currentFilter.style = updated as AssetStyle[];
                else delete this.currentFilter.style;
                this.syncTagFilterGroupState('style', this.getTagFilterValues('style'));
              }
              if (prefix === 'Material') {
                if (updated.length) this.currentFilter.material = updated as AssetMaterial[];
                else delete this.currentFilter.material;
                this.syncTagFilterGroupState('material', this.getTagFilterValues('material'));
              }
            }
            this.render();
          },
        });
      });
    };

    addMultiFilterChips(this.currentFilter.type, 'Type');
    addMultiFilterChips(this.currentFilter.style, 'Style');
    addMultiFilterChips(this.currentFilter.material, 'Material');

    if (this.currentFilter.search) {
      activeFilters.push({
        label: `Search: ${this.currentFilter.search}`,
        clear: () => {
          delete this.currentFilter.search;
          if (this.headerSearchInput) this.headerSearchInput.value = '';
          this.render();
        },
      });
    }

    if (this.currentFilter.featured) {
      activeFilters.push({
        label: 'Featured',
        clear: () => {
          delete this.currentFilter.featured;
          this.quickFilterState.featured = false;
          this.updateQuickFilterState();
          this.render();
        },
      });
    }

    if (this.currentFilter.placeable) {
      activeFilters.push({
        label: 'Placeable',
        clear: () => {
          delete this.currentFilter.placeable;
          this.quickFilterState.placeable = false;
          this.updateQuickFilterState();
          this.render();
        },
      });
    }

    if (this.currentFilter.builtIn) {
      activeFilters.push({
        label: 'Built-in',
        clear: () => {
          delete this.currentFilter.builtIn;
          this.quickFilterState.builtIn = false;
          this.updateQuickFilterState();
          this.render();
        },
      });
    }

    if (this.currentFilter.collectionId) {
      const collection = assetRegistry.getCollection(this.currentFilter.collectionId);
      const label = collection ? `Collection: ${collection.name}` : 'Collection filter';
      activeFilters.push({
        label,
        clear: () => {
          delete this.currentFilter.collectionId;
          this.render();
        },
      });
    }

    if (activeFilters.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'text-xs text-3';
      empty.textContent = 'No active filters';
      filters.appendChild(empty);
      return;
    }

    activeFilters.forEach((filter) => {
      const chip = document.createElement('span');
      chip.className = 'active-filter-chip';
      chip.textContent = filter.label;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.title = 'Remove filter';
      removeBtn.appendChild(createIcon('close', 12));
      removeBtn.addEventListener('click', () => {
        filter.clear();
        this.updateActiveFilters();
      });

      chip.appendChild(removeBtn);
      filters.appendChild(chip);
    });
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.thumbnailRenderer = null;
  }

  // ==========================================================================
  // SEARCH HISTORY / SUGGESTIONS
  // ==========================================================================

  private loadSearchHistory(): void {
    try {
      const raw = localStorage.getItem('assetSearchHistory');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
          this.searchHistory = parsed as string[];
        }
      }
    } catch {
      this.searchHistory = [];
    }
  }

  private saveSearchHistory(): void {
    try {
      localStorage.setItem('assetSearchHistory', JSON.stringify(this.searchHistory.slice(0, 10)));
    } catch {
      // ignore
    }
  }

  private addSearchHistory(query: string): void {
    const normalized = query.trim();
    if (!normalized) return;
    this.searchHistory = [normalized, ...this.searchHistory.filter((q) => q.toLowerCase() !== normalized.toLowerCase())].slice(0, 10);
    this.saveSearchHistory();
  }

  private commitSearch(query: string): void {
    const normalized = query.trim();
    if (this.headerSearchInput) {
      this.headerSearchInput.value = normalized;
    }
    if (normalized.length === 0) {
      delete this.currentFilter.search;
    } else {
      this.currentFilter.search = normalized;
      this.addSearchHistory(normalized);
    }
    this.hideSearchSuggestions();
    this.render();
  }

  private showSearchSuggestions(filterText?: string): void {
    if (!this.searchSuggestions || !this.headerSearchInput) return;
    const query = (filterText ?? '').trim().toLowerCase();
    const base = this.searchHistory;
    const list = query ? base.filter((q) => q.toLowerCase().includes(query)).slice(0, 8) : base.slice(0, 8);
    this.searchSuggestions.innerHTML = '';
    if (list.length === 0) {
      this.searchSuggestions.hidden = true;
      this.headerSearchInput.setAttribute('aria-expanded', 'false');
      return;
    }
    list.forEach((q, idx) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.setAttribute('role', 'option');
      li.dataset.value = q;
      li.setAttribute('aria-selected', String(idx === 0));
      li.textContent = q;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.commitSearch(q);
      });
      this.searchSuggestions!.appendChild(li);
    });
    this.searchSuggestionIndex = 0;
    this.searchSuggestions.hidden = false;
    this.headerSearchInput.setAttribute('aria-expanded', 'true');
  }

  private hideSearchSuggestions(): void {
    if (!this.searchSuggestions || !this.headerSearchInput) return;
    this.searchSuggestions.hidden = true;
    this.headerSearchInput.setAttribute('aria-expanded', 'false');
    this.searchSuggestionIndex = -1;
  }

  private updateSuggestionActive(items: HTMLElement[]): void {
    items.forEach((el, i) => el.setAttribute('aria-selected', String(i === this.searchSuggestionIndex)));
  }
}


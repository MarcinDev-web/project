/**
 * MarketplacePanel - Browse and purchase marketplace items in editor
 * 
 * Features:
 * - Browse builds and avatars from marketplace
 * - Filter by type, tags, sort order
 * - Search functionality
 * - Purchase/download items
 * - Import builds directly into editor
 */

import type { MarketplaceFilterOptions, MarketplaceItem } from '../../../utils/marketplaceApi';
import { MarketplaceApiClient } from '../../../utils/marketplaceApi';
import { MarketplaceAssetManager } from '../../managers/MarketplaceAssetManager';
import { Logger } from '../../../utils/logger';

export type MarketplaceItemType = 'build' | 'avatar';
export type MarketplaceSortOption = 'newest' | 'popular' | 'downloads' | 'likes';

export interface MarketplacePanelConfig {
  onImportBuild?: (itemId: string) => Promise<void>;
  onAssetPurchased?: (itemId: string) => void;
}

export class MarketplacePanel {
  public readonly element: HTMLElement;
  private readonly marketplaceClient: MarketplaceApiClient;
  private readonly assetManager: MarketplaceAssetManager;
  private readonly config: MarketplacePanelConfig;
  
  private items: MarketplaceItem[] = [];
  private loading = false;
  private error: string | null = null;
  
  private currentType: MarketplaceItemType = 'build';
  private currentSort: MarketplaceSortOption = 'newest';
  private currentSearch = '';
  private currentTags: string[] = [];
  private currentPage = 1;
  private pageSize = 20;
  private totalItems = 0;
  
  private searchInput!: HTMLInputElement;
  private itemsContainer!: HTMLElement;
  private paginationContainer!: HTMLElement;

  constructor(config: MarketplacePanelConfig = {}) {
    this.config = config;
    this.assetManager = new MarketplaceAssetManager();
    this.marketplaceClient = this.assetManager.getMarketplaceClient();
    
    this.element = document.createElement('div');
    this.element.className = 'marketplace-panel';
    
    this.createHeader();
    this.createFilters();
    this.createItemsContainer();
    this.createPagination();
    
    void this.loadItems();
  }

  private createHeader(): void {
    const header = document.createElement('div');
    header.className = 'panel-header';
    
    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = 'Marketplace';
    header.appendChild(title);
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'panel-button panel-button-secondary';
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', () => void this.loadItems());
    header.appendChild(refreshBtn);
    
    this.element.appendChild(header);
  }

  private createFilters(): void {
    const filters = document.createElement('div');
    filters.className = 'marketplace-filters';
    
    // Type selector
    const typeContainer = document.createElement('div');
    typeContainer.className = 'filter-group';
    
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type:';
    typeContainer.appendChild(typeLabel);
    
    const typeSelect = document.createElement('select');
    typeSelect.className = 'filter-select';
    typeSelect.innerHTML = `
      <option value="build">Builds</option>
      <option value="avatar">Avatars</option>
    `;
    typeSelect.value = this.currentType;
    typeSelect.addEventListener('change', () => {
      this.currentType = typeSelect.value as MarketplaceItemType;
      this.currentPage = 1;
      void this.loadItems();
    });
    typeContainer.appendChild(typeSelect);
    filters.appendChild(typeContainer);
    
    // Sort selector
    const sortContainer = document.createElement('div');
    sortContainer.className = 'filter-group';
    
    const sortLabel = document.createElement('label');
    sortLabel.textContent = 'Sort:';
    sortContainer.appendChild(sortLabel);
    
    const sortSelect = document.createElement('select');
    sortSelect.className = 'filter-select';
    sortSelect.innerHTML = `
      <option value="newest">Newest</option>
      <option value="popular">Popular</option>
      <option value="downloads">Downloads</option>
      <option value="likes">Likes</option>
    `;
    sortSelect.value = this.currentSort;
    sortSelect.addEventListener('change', () => {
      this.currentSort = sortSelect.value as MarketplaceSortOption;
      this.currentPage = 1;
      void this.loadItems();
    });
    sortContainer.appendChild(sortSelect);
    filters.appendChild(sortContainer);
    
    // Search input
    const searchContainer = document.createElement('div');
    searchContainer.className = 'filter-group filter-group-full';
    
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'filter-input';
    this.searchInput.placeholder = 'Search marketplace...';
    this.searchInput.value = this.currentSearch;
    let searchTimeout: number | null = null;
    this.searchInput.addEventListener('input', () => {
      if (searchTimeout !== null) clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => {
        this.currentSearch = this.searchInput.value.trim();
        this.currentPage = 1;
        void this.loadItems();
      }, 500);
    });
    searchContainer.appendChild(this.searchInput);
    filters.appendChild(searchContainer);
    
    this.element.appendChild(filters);
  }

  private createItemsContainer(): void {
    this.itemsContainer = document.createElement('div');
    this.itemsContainer.className = 'marketplace-items-grid';
    this.element.appendChild(this.itemsContainer);
  }

  private createPagination(): void {
    this.paginationContainer = document.createElement('div');
    this.paginationContainer.className = 'marketplace-pagination';
    this.element.appendChild(this.paginationContainer);
  }

  private buildFilterOptions(offset: number): MarketplaceFilterOptions {
    const options: MarketplaceFilterOptions = {
      limit: this.pageSize,
      offset,
      sortBy: this.currentSort,
    };

    if (this.currentTags.length > 0) {
      options.tags = this.currentTags;
    }

    return options;
  }

  private async loadItems(): Promise<void> {
    if (this.loading) return;
    
    this.loading = true;
    this.error = null;
    this.render();
    
    try {
      const offset = (this.currentPage - 1) * this.pageSize;
      const filters = this.buildFilterOptions(offset);
      let response;
      
      if (this.currentSearch.trim()) {
        response = await this.marketplaceClient.search(this.currentSearch, {
          ...filters,
          type: this.currentType,
        });
      } else {
        response = this.currentType === 'build'
          ? await this.marketplaceClient.getBuilds(filters)
          : await this.marketplaceClient.getAvatars(filters);
      }
      
      this.items = response.items;
      this.totalItems = response.total;
      this.currentPage = response.page;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load marketplace items';
      Logger.error('Failed to load marketplace items:', err as Error);
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    // Clear items container
    this.itemsContainer.innerHTML = '';
    
    if (this.loading) {
      const loadingMsg = document.createElement('div');
      loadingMsg.className = 'marketplace-message';
      loadingMsg.textContent = 'Loading...';
      this.itemsContainer.appendChild(loadingMsg);
      return;
    }
    
    if (this.error) {
      const errorMsg = document.createElement('div');
      errorMsg.className = 'marketplace-message marketplace-error';
      errorMsg.textContent = `Error: ${this.error}`;
      this.itemsContainer.appendChild(errorMsg);
      return;
    }
    
    if (this.items.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'marketplace-message';
      emptyMsg.textContent = 'No items found';
      this.itemsContainer.appendChild(emptyMsg);
      return;
    }
    
    // Render items
    for (const item of this.items) {
      this.itemsContainer.appendChild(this.renderItem(item));
    }
    
    // Render pagination
    this.renderPagination();
  }

  private renderItem(item: MarketplaceItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'marketplace-item-card';
    
    // Thumbnail
    const thumbnail = document.createElement('div');
    thumbnail.className = 'marketplace-item-thumbnail';
    if (item.thumbnailUrl) {
      const img = document.createElement('img');
      img.src = item.thumbnailUrl;
      img.alt = item.title;
      img.onerror = () => {
        thumbnail.textContent = '📦';
        thumbnail.style.display = 'flex';
        thumbnail.style.alignItems = 'center';
        thumbnail.style.justifyContent = 'center';
        thumbnail.style.fontSize = '2rem';
      };
      thumbnail.appendChild(img);
    } else {
      thumbnail.textContent = '📦';
      thumbnail.style.display = 'flex';
      thumbnail.style.alignItems = 'center';
      thumbnail.style.justifyContent = 'center';
      thumbnail.style.fontSize = '2rem';
    }
    card.appendChild(thumbnail);
    
    // Content
    const content = document.createElement('div');
    content.className = 'marketplace-item-content';
    
    const title = document.createElement('div');
    title.className = 'marketplace-item-title';
    title.textContent = item.title;
    content.appendChild(title);
    
    if (item.description) {
      const desc = document.createElement('div');
      desc.className = 'marketplace-item-description';
      desc.textContent = item.description.length > 100 
        ? `${item.description.substring(0, 100)}...` 
        : item.description;
      content.appendChild(desc);
    }
    
    // Meta info
    const meta = document.createElement('div');
    meta.className = 'marketplace-item-meta';
    
    if (item.authorName) {
      const author = document.createElement('span');
      author.className = 'marketplace-item-author';
      author.textContent = `by ${item.authorName}`;
      meta.appendChild(author);
    }
    
    const stats = document.createElement('span');
    stats.className = 'marketplace-item-stats';
    stats.textContent = `⬇️ ${item.downloads} ❤️ ${item.likes}`;
    meta.appendChild(stats);
    
    content.appendChild(meta);
    
    // Tags
    if (item.tags && item.tags.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'marketplace-item-tags';
      for (const tag of item.tags.slice(0, 3)) {
        const tagEl = document.createElement('span');
        tagEl.className = 'marketplace-tag';
        tagEl.textContent = tag;
        tags.appendChild(tagEl);
      }
      content.appendChild(tags);
    }
    
    card.appendChild(content);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'marketplace-item-actions';
    
    if (item.type === 'build') {
      const importBtn = document.createElement('button');
      importBtn.className = 'marketplace-action-btn marketplace-action-primary';
      importBtn.textContent = 'Import';
      importBtn.addEventListener('click', () => void this.handleImportBuild(item));
      actions.appendChild(importBtn);
    }
    
    const price = item.price && item.price.amount > 0 
      ? `${item.price.amount} ${item.price.currency}`
      : 'Free';
    
    const actionBtn = document.createElement('button');
    actionBtn.className = item.price && item.price.amount > 0
      ? 'marketplace-action-btn marketplace-action-purchase'
      : 'marketplace-action-btn marketplace-action-download';
    actionBtn.textContent = item.price && item.price.amount > 0 ? `Buy ${price}` : 'Download';
    actionBtn.addEventListener('click', () => void this.handlePurchaseOrDownload(item));
    actions.appendChild(actionBtn);
    
    card.appendChild(actions);
    
    return card;
  }

  private async handleImportBuild(item: MarketplaceItem): Promise<void> {
    try {
      if (this.config.onImportBuild) {
        await this.config.onImportBuild(item.id);
      } else {
        Logger.warn('onImportBuild callback not provided');
      }
    } catch (err) {
      Logger.error('Failed to import build:', err as Error);
      alert(`Failed to import build: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async handlePurchaseOrDownload(item: MarketplaceItem): Promise<void> {
    try {
      // Check if already purchased
      const hasAsset = await this.assetManager.hasAsset(item.id);
      if (hasAsset) {
        alert('You already own this item!');
        return;
      }
      
      // For paid items, show confirmation
      if (item.price && item.price.amount > 0) {
        const confirmed = confirm(
          `Purchase "${item.title}" for ${item.price.amount} ${item.price.currency}?`
        );
        if (!confirmed) return;
      }
      
      // Purchase/download
      await this.assetManager.purchaseAsset(item.id);
      
      if (this.config.onAssetPurchased) {
        this.config.onAssetPurchased(item.id);
      }
      
      alert(`Successfully ${item.price && item.price.amount > 0 ? 'purchased' : 'downloaded'} "${item.title}"!`);
      
      // Refresh to show updated state
      void this.loadItems();
    } catch (err) {
      Logger.error('Failed to purchase/download item:', err as Error);
      alert(`Failed to ${item.price && item.price.amount > 0 ? 'purchase' : 'download'}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private renderPagination(): void {
    this.paginationContainer.innerHTML = '';
    
    const totalPages = Math.ceil(this.totalItems / this.pageSize);
    if (totalPages <= 1) return;
    
    const pagination = document.createElement('div');
    pagination.className = 'pagination-controls';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = this.currentPage <= 1;
    prevBtn.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        void this.loadItems();
      }
    });
    pagination.appendChild(prevBtn);
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    pagination.appendChild(pageInfo);
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = this.currentPage >= totalPages;
    nextBtn.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        void this.loadItems();
      }
    });
    pagination.appendChild(nextBtn);
    
    this.paginationContainer.appendChild(pagination);
  }

  /**
   * Refresh the marketplace panel
   */
  refresh(): void {
    void this.loadItems();
  }

  /**
   * Get asset manager instance
   */
  getAssetManager(): MarketplaceAssetManager {
    return this.assetManager;
  }
}


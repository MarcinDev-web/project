/**
 * ItemGallery - Bottom panel displaying customization items
 */

import { memo, useState, useCallback, useMemo } from 'react';
import type { GalleryItem, GalleryFilters } from './types';
import { DEFAULT_GALLERY_FILTERS } from './types';

export interface ItemGalleryProps {
  items: GalleryItem[];
  selectedItemId: string | null;
  onItemSelect: (item: GalleryItem) => void;
  onItemHover?: (item: GalleryItem | null) => void;
  categoryLabel?: string;
}

/**
 * Item gallery component with search and filters
 */
export const ItemGallery = memo(function ItemGallery({
  items,
  selectedItemId,
  onItemSelect,
  onItemHover,
  categoryLabel = 'Items',
}: ItemGalleryProps) {
  const [filters, setFilters] = useState<GalleryFilters>(DEFAULT_GALLERY_FILTERS);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  }, []);

  const handleFilterChange = useCallback((status: GalleryFilters['status']) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((item) =>
        item.name.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      if (filters.status === 'new') {
        result = result.filter((item) => item.isNew);
      } else {
        result = result.filter((item) => item.status === filters.status);
      }
    }

    // Sort
    switch (filters.sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case 'rarity':
        const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
        result.sort((a, b) => 
          (rarityOrder[b.rarity ?? 'common'] ?? 0) - (rarityOrder[a.rarity ?? 'common'] ?? 0)
        );
        break;
      case 'price':
        result.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        break;
    }

    return result;
  }, [items, filters]);

  return (
    <div className="item-gallery">
      <div className="item-gallery__header">
        <div className="item-gallery__search">
          <span className="item-gallery__search-icon">🔍</span>
          <input
            type="text"
            className="item-gallery__search-input"
            placeholder={`Search ${categoryLabel.toLowerCase()}...`}
            value={filters.search}
            onChange={handleSearchChange}
          />
        </div>
        
        <div className="item-gallery__filters">
          <FilterButton
            label="All"
            isActive={filters.status === 'all'}
            onClick={() => handleFilterChange('all')}
          />
          <FilterButton
            label="Owned"
            isActive={filters.status === 'owned'}
            onClick={() => handleFilterChange('owned')}
          />
          <FilterButton
            label="Shop"
            isActive={filters.status === 'shop'}
            onClick={() => handleFilterChange('shop')}
          />
          <FilterButton
            label="New"
            isActive={filters.status === 'new'}
            onClick={() => handleFilterChange('new')}
          />
        </div>
      </div>

      <div className="item-gallery__content">
        {filteredItems.length === 0 ? (
          <div className="forge-empty">
            <span className="forge-empty__icon">📦</span>
            <h3 className="forge-empty__title">No items found</h3>
            <p className="forge-empty__description">
              {filters.search
                ? 'Try a different search term'
                : 'No items available in this category'}
            </p>
          </div>
        ) : (
          <div className="item-gallery__grid">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onClick={() => onItemSelect(item)}
                onMouseEnter={() => onItemHover?.(item)}
                onMouseLeave={() => onItemHover?.(null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

interface FilterButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const FilterButton = memo(function FilterButton({
  label,
  isActive,
  onClick,
}: FilterButtonProps) {
  return (
    <button
      className={`item-gallery__filter-btn ${isActive ? 'item-gallery__filter-btn--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
});

interface ItemCardProps {
  item: GalleryItem;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const ItemCard = memo(function ItemCard({
  item,
  isSelected,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: ItemCardProps) {
  const badgeClass = getBadgeClass(item.status);
  const badgeLabel = getBadgeLabel(item.status, item.price);

  return (
    <button
      className={`item-card ${isSelected ? 'item-card--selected' : ''} ${
        item.status === 'locked' ? 'item-card--locked' : ''
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={item.status === 'locked'}
      aria-pressed={isSelected}
      title={item.name}
    >
      <div className="item-card__preview">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            className="item-card__preview-img"
            loading="lazy"
          />
        ) : (
          <span className="item-card__preview-placeholder">
            {item.previewEmoji ?? '🎭'}
          </span>
        )}
        
        {badgeLabel && (
          <span className={`item-card__badge ${badgeClass}`}>
            {badgeLabel}
          </span>
        )}
      </div>
      
      <div className="item-card__info">
        <h4 className="item-card__name">{item.name}</h4>
        {item.rarity && item.rarity !== 'common' && (
          <span className="item-card__meta">{item.rarity}</span>
        )}
      </div>
    </button>
  );
});

function getBadgeClass(status: GalleryItem['status']): string {
  switch (status) {
    case 'owned':
      return 'item-card__badge--owned';
    case 'locked':
      return 'item-card__badge--locked';
    case 'shop':
      return 'item-card__badge--shop';
    case 'premium':
      return 'item-card__badge--premium';
    default:
      return '';
  }
}

function getBadgeLabel(status: GalleryItem['status'], price?: number): string | null {
  switch (status) {
    case 'owned':
      return '✓';
    case 'locked':
      return '🔒';
    case 'shop':
      return price ? `$${price}` : 'Shop';
    case 'premium':
      return '⭐';
    default:
      return null;
  }
}


/**
 * StoreToolbar Component
 * Unified toolbar with search, type tabs, price filter, and sort options
 */

import { useState, useRef, useEffect } from 'react';

export type ItemFilter =
  | 'all'
  | 'build'
  | 'avatar'
  | 'material'
  | 'model'
  | 'texture'
  | 'script'
  | 'consumable'
  | 'cosmetic'
  | 'upgrade'
  | 'collectible';

export type PriceFilter = 'all' | 'free' | 'platform';
export type SortOption = 'featured' | 'newest';

interface FilterOption {
  key: ItemFilter;
  label: string;
  count: number;
}

interface StoreToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  itemFilter: ItemFilter;
  onItemFilterChange: (filter: ItemFilter) => void;
  priceFilter: PriceFilter;
  onPriceFilterChange: (filter: PriceFilter) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  filterOptions: FilterOption[];
  totalCount: number;
}

const PRICE_OPTIONS: Array<{ key: PriceFilter; label: string }> = [
  { key: 'all', label: 'All prices' },
  { key: 'free', label: 'Free only' },
  { key: 'platform', label: 'Credits only' },
];

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: 'featured', label: 'Featured' },
  { key: 'newest', label: 'Newest' },
];

interface DropdownProps {
  label: string;
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (key: string) => void;
}

function Dropdown({ label, value, options, onChange }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.key === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="store-dropdown" ref={dropdownRef}>
      <button
        className="store-dropdown__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="store-dropdown__label">{label}:</span>
        <span className="store-dropdown__value">{selectedOption?.label}</span>
        <span className={`store-dropdown__chevron ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="store-dropdown__menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.key}
              className={`store-dropdown__option ${value === option.key ? 'active' : ''}`}
              onClick={() => {
                onChange(option.key);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={value === option.key}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StoreToolbar({
  searchTerm,
  onSearchChange,
  itemFilter,
  onItemFilterChange,
  priceFilter,
  onPriceFilterChange,
  sortBy,
  onSortChange,
  filterOptions,
  totalCount,
}: StoreToolbarProps) {
  // Only show first 5 type filters as tabs, rest in "More" dropdown if needed
  const visibleFilters = filterOptions.slice(0, 6);
  const hasMoreFilters = filterOptions.length > 6;

  return (
    <div className="store-toolbar">
      <div className="store-toolbar__search">
        <span className="store-toolbar__search-icon">🔍</span>
        <input
          type="search"
          placeholder="Search assets, builds, avatars..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="store-toolbar__search-input"
        />
        {searchTerm && (
          <button
            className="store-toolbar__search-clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="store-toolbar__filters">
        <div className="store-toolbar__tabs" role="tablist">
          {visibleFilters.map((filter) => (
            <button
              key={filter.key}
              className={`store-toolbar__tab ${itemFilter === filter.key ? 'active' : ''}`}
              onClick={() => onItemFilterChange(filter.key)}
              role="tab"
              aria-selected={itemFilter === filter.key}
            >
              {filter.label}
              <span className="store-toolbar__tab-count">{filter.count}</span>
            </button>
          ))}
          {hasMoreFilters && (
            <Dropdown
              label="More"
              value={
                filterOptions.slice(6).some((f) => f.key === itemFilter)
                  ? itemFilter
                  : ''
              }
              options={filterOptions.slice(6).map((f) => ({
                key: f.key,
                label: `${f.label} (${f.count})`,
              }))}
              onChange={(key) => onItemFilterChange(key as ItemFilter)}
            />
          )}
        </div>

        <div className="store-toolbar__options">
          <Dropdown
            label="Price"
            value={priceFilter}
            options={PRICE_OPTIONS}
            onChange={(key) => onPriceFilterChange(key as PriceFilter)}
          />
          <Dropdown
            label="Sort"
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={(key) => onSortChange(key as SortOption)}
          />
        </div>
      </div>

      <div className="store-toolbar__results">
        {totalCount} {totalCount === 1 ? 'item' : 'items'}
      </div>
    </div>
  );
}


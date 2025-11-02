import { Button } from '../shared/Button';

export type SortOption = 'newest' | 'popular' | 'downloads' | 'likes';

export interface MarketplaceFiltersProps {
  tags: string[];
  selectedTags: string[];
  sortBy: SortOption;
  onTagsChange: (tags: string[]) => void;
  onSortChange: (sort: SortOption) => void;
}

export function MarketplaceFilters({
  tags,
  selectedTags,
  sortBy,
  onTagsChange,
  onSortChange,
}: MarketplaceFiltersProps) {
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearFilters = () => {
    onTagsChange([]);
    onSortChange('newest');
  };

  const hasActiveFilters = selectedTags.length > 0 || sortBy !== 'newest';

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--spacing-3)',
        alignItems: 'center',
        marginBottom: 'var(--spacing-6)',
        padding: 'var(--spacing-4)',
        background: 'var(--bg-button)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
      }}
    >
      {/* Sort dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
        <label
          htmlFor="sort-select"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}
        >
          Sort by:
        </label>
        <select
          id="sort-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          style={{
            padding: 'var(--spacing-2) var(--spacing-3)',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-1)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
        >
          <option value="newest">Newest First</option>
          <option value="popular">Most Popular</option>
          <option value="downloads">Most Downloaded</option>
          <option value="likes">Most Liked</option>
        </select>
      </div>

      {/* Tag filters */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            Tags:
          </span>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              style={{
                padding: 'var(--spacing-1) var(--spacing-3)',
                background: selectedTags.includes(tag)
                  ? 'var(--bg-button-primary)'
                  : 'var(--bg-button)',
                border: `1px solid ${selectedTags.includes(tag) ? 'var(--color-accent-400)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-full)',
                color: selectedTags.includes(tag) ? 'white' : 'var(--text-1)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button
          variant="secondary"
          onClick={clearFilters}
          style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)' }}
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}


/**
 * CommunityPresetsPanel - Browse and apply avatar presets from other users
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { marketplaceApi, type MarketplaceItem } from '../../api/marketplace';
import type { AvatarLoadout } from '@engine/avatar';

export interface CommunityPresetsPanelProps {
  /** Currently active loadout for preview comparison */
  currentLoadout: AvatarLoadout;
  /** Called when user applies a community preset */
  onApplyPreset: (loadout: AvatarLoadout) => void;
  /** Called when hovering over a preset for preview */
  onHoverPreset?: (loadout: AvatarLoadout | null) => void;
  /** Called to close the panel */
  onClose?: () => void;
}

type SortOption = 'newest' | 'popular' | 'downloads' | 'likes';

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'newest', label: 'Newest', icon: '🆕' },
  { value: 'popular', label: 'Popular', icon: '🔥' },
  { value: 'downloads', label: 'Downloads', icon: '⬇️' },
  { value: 'likes', label: 'Likes', icon: '❤️' },
];

/**
 * Community presets browser panel
 */
export const CommunityPresetsPanel = memo(function CommunityPresetsPanel({
  currentLoadout,
  onApplyPreset,
  onHoverPreset,
  onClose,
}: CommunityPresetsPanelProps) {
  const [presets, setPresets] = useState<MarketplaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const PAGE_SIZE = 12;

  // Load presets
  const loadPresets = useCallback(async (reset = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const currentPage = reset ? 1 : page;
      
      let response;
      if (searchQuery.trim()) {
        response = await marketplaceApi.search(searchQuery, {
          type: 'avatar',
          sortBy,
          limit: PAGE_SIZE,
          offset: (currentPage - 1) * PAGE_SIZE,
        });
      } else {
        response = await marketplaceApi.getAvatars({
          sortBy,
          limit: PAGE_SIZE,
          offset: (currentPage - 1) * PAGE_SIZE,
        });
      }

      if (reset) {
        setPresets(response.items);
        setPage(1);
      } else {
        setPresets((prev) => [...prev, ...response.items]);
      }

      setTotal(response.total);
      setHasMore(response.items.length === PAGE_SIZE && currentPage * PAGE_SIZE < response.total);
    } catch (err) {
      setError('Failed to load community presets');
      console.error('Failed to load community presets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, searchQuery]);

  // Initial load
  useEffect(() => {
    loadPresets(true);
  }, [sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search handler with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPresets(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle preset apply
  const handleApplyPreset = useCallback(async (preset: MarketplaceItem) => {
    try {
      // Fetch the full preset data (includes the actual loadout)
      const fullItem = await marketplaceApi.getItem(preset.id);
      
      // Parse loadout from fileUrl (assuming it contains JSON loadout data)
      // In a real implementation, this would download and parse the file
      // For now, we'll simulate with current loadout
      const loadoutData = await fetchLoadoutFromUrl(fullItem.fileUrl);
      
      if (loadoutData) {
        onApplyPreset(loadoutData);
      }
    } catch (err) {
      console.error('Failed to apply preset:', err);
    }
  }, [onApplyPreset]);

  // Handle hover preview
  const handleHoverPreset = useCallback(async (preset: MarketplaceItem | null) => {
    if (!preset || !onHoverPreset) {
      onHoverPreset?.(null);
      return;
    }

    try {
      // Quick fetch for preview (could be cached)
      const loadoutData = await fetchLoadoutFromUrl(preset.fileUrl);
      onHoverPreset(loadoutData);
    } catch {
      onHoverPreset(null);
    }
  }, [onHoverPreset]);

  // Handle like
  const handleLikePreset = useCallback(async (preset: MarketplaceItem) => {
    try {
      const result = await marketplaceApi.likeItem(preset.id);
      setPresets((prev) =>
        prev.map((p) =>
          p.id === preset.id
            ? { ...p, liked: result.liked, likes: result.likes }
            : p
        )
      );
    } catch (err) {
      console.error('Failed to like preset:', err);
    }
  }, []);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (page > 1) {
      loadPresets(false);
    }
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="community-presets-panel">
      {/* Header */}
      <div className="community-presets-panel__header">
        <h3 className="community-presets-panel__title">
          🌍 Community Presets
        </h3>
        {onClose && (
          <button
            className="community-presets-panel__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search and filters */}
      <div className="community-presets-panel__controls">
        <div className="community-presets-panel__search">
          <span className="community-presets-panel__search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search presets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="community-presets-panel__search-input"
          />
        </div>

        <div className="community-presets-panel__sort">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`community-presets-panel__sort-btn ${
                sortBy === option.value ? 'community-presets-panel__sort-btn--active' : ''
              }`}
              onClick={() => setSortBy(option.value)}
              title={option.label}
            >
              {option.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="community-presets-panel__stats">
        {total > 0 && (
          <span>{total} presets found</span>
        )}
      </div>

      {/* Content */}
      <div className="community-presets-panel__content">
        {error && (
          <div className="community-presets-panel__error">
            <span>❌</span>
            <p>{error}</p>
            <button onClick={() => loadPresets(true)}>Retry</button>
          </div>
        )}

        {!error && presets.length === 0 && !isLoading && (
          <div className="community-presets-panel__empty">
            <span className="community-presets-panel__empty-icon">🎭</span>
            <h4>No presets found</h4>
            <p>Be the first to share your avatar!</p>
          </div>
        )}

        {presets.length > 0 && (
          <div className="community-presets-panel__grid">
            {presets.map((preset) => (
              <CommunityPresetCard
                key={preset.id}
                preset={preset}
                onApply={() => handleApplyPreset(preset)}
                onHover={(isHovering) => handleHoverPreset(isHovering ? preset : null)}
                onLike={() => handleLikePreset(preset)}
              />
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="community-presets-panel__loading">
            <div className="community-presets-panel__spinner" />
            <span>Loading presets...</span>
          </div>
        )}

        {/* Load more button */}
        {hasMore && !isLoading && (
          <button
            className="community-presets-panel__load-more"
            onClick={handleLoadMore}
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
});

interface CommunityPresetCardProps {
  preset: MarketplaceItem;
  onApply: () => void;
  onHover: (isHovering: boolean) => void;
  onLike: () => void;
}

const CommunityPresetCard = memo(function CommunityPresetCard({
  preset,
  onApply,
  onHover,
  onLike,
}: CommunityPresetCardProps) {
  const isPaid = preset.price && preset.price.amount > 0;

  return (
    <div
      className="community-preset-card"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="community-preset-card__preview">
        {preset.thumbnailUrl ? (
          <img
            src={preset.thumbnailUrl}
            alt={preset.title}
            className="community-preset-card__thumbnail"
            loading="lazy"
          />
        ) : (
          <div className="community-preset-card__placeholder">
            <span>🎭</span>
          </div>
        )}

        {/* Overlay with actions */}
        <div className="community-preset-card__overlay">
          <button
            className="community-preset-card__apply-btn"
            onClick={onApply}
          >
            {isPaid ? `Buy ${preset.price?.currency}${preset.price?.amount}` : 'Apply'}
          </button>
        </div>

        {/* Price badge */}
        {isPaid && (
          <span className="community-preset-card__price-badge">
            💰 {preset.price?.currency}{preset.price?.amount}
          </span>
        )}
      </div>

      <div className="community-preset-card__info">
        <h4 className="community-preset-card__title">{preset.title}</h4>
        <p className="community-preset-card__author">by {preset.authorName || 'Anonymous'}</p>

        <div className="community-preset-card__stats">
          <button
            className={`community-preset-card__like-btn ${preset.liked ? 'community-preset-card__like-btn--liked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
          >
            {preset.liked ? '❤️' : '🤍'} {preset.likes}
          </button>
          <span className="community-preset-card__downloads">
            ⬇️ {preset.downloads}
          </span>
        </div>
      </div>
    </div>
  );
});

/**
 * Fetch avatar loadout from URL
 * In a real implementation, this would download and parse the JSON file
 */
async function fetchLoadoutFromUrl(url: string): Promise<AvatarLoadout | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch loadout');
    }
    const data = await response.json();
    
    // Validate it's an AvatarLoadout
    if (data && typeof data === 'object' && 'parts' in data) {
      return data as AvatarLoadout;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch loadout from URL:', error);
    return null;
  }
}


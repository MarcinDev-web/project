import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { Pagination } from '../components/shared/Pagination';
import { MarketplaceFilters, type SortOption } from '../components/marketplace/MarketplaceFilters';
import { MarketplaceCardSkeleton } from '../components/shared/SkeletonLoader';
import { PublishToMarketplaceModal } from '../components/marketplace/PublishToMarketplaceModal';
import { marketplaceApi, type MarketplaceItem } from '../api/marketplace';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { getTokens } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';

export function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const [showPublishModal, setShowPublishModal] = useState<'build' | 'avatar' | null>(null);
  const type = (searchParams.get('type') as 'build' | 'avatar') || 'build';
  const search = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20;
  const sortBy = (searchParams.get('sortBy') as SortOption) || 'newest';
  const selectedTagsParam = searchParams.get('tags') || '';
  const selectedTags = selectedTagsParam ? selectedTagsParam.split(',') : [];

  // Extract unique tags from items
  const allTags = Array.from(new Set(items.flatMap(item => item.tags || []))).sort();

  useEffect(() => {
    void loadItems();
  }, [type, search, page, sortBy, selectedTags.join(',')]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      let response;
      
      if (search.trim()) {
        // Use backend search if search query exists
        response = await marketplaceApi.search(search, {
          type,
          ...(selectedTags.length > 0 && { tags: selectedTags }),
          limit: pageSize,
          offset,
          sortBy,
        });
      } else {
        // Otherwise use regular list endpoint
        const options = {
          ...(selectedTags.length > 0 && { tags: selectedTags }),
          limit: pageSize,
          offset,
          sortBy,
        };
        response = type === 'build'
          ? await marketplaceApi.getBuilds(options)
          : await marketplaceApi.getAvatars(options);
      }
      setItems(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load marketplace items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (newType: 'build' | 'avatar') => {
    const params = new URLSearchParams(searchParams);
    params.set('type', newType);
    params.delete('page'); // Reset to page 1
    setSearchParams(params);
  };

  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value.trim()) {
      params.set('q', value);
    } else {
      params.delete('q');
    }
    params.delete('page'); // Reset to page 1
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (newSort: SortOption) => {
    const params = new URLSearchParams(searchParams);
    params.set('sortBy', newSort);
    params.delete('page'); // Reset to page 1
    setSearchParams(params);
  };

  const handleTagsChange = (tags: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (tags.length > 0) {
      params.set('tags', tags.join(','));
    } else {
      params.delete('tags');
    }
    params.delete('page'); // Reset to page 1
    setSearchParams(params);
  };

  // Remove client-side filtering since we use backend search now
  const filteredItems = items;

  return (
    <Layout>
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
          <h1 style={{ marginBottom: 0 }}>Marketplace</h1>
          {isAuthenticated && (
            <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
              <Button 
                variant="primary" 
                onClick={() => setShowPublishModal('build')}
              >
                + Dodaj Build
              </Button>
              <Button 
                variant="primary" 
                onClick={() => setShowPublishModal('avatar')}
              >
                + Dodaj Avatar
              </Button>
            </div>
          )}
        </div>

        {/* Type selector */}
        <div 
          role="tablist"
          aria-label="Marketplace item type"
          className="marketplace-tabs"
          style={{ 
            display: 'flex', 
            gap: 'var(--spacing-4)', 
            marginBottom: 'var(--spacing-6)',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <button
            role="tab"
            aria-selected={type === 'build'}
            aria-controls="marketplace-items"
            onClick={() => handleTypeChange('build')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              background: type === 'build' ? 'var(--bg-button-primary)' : 'transparent',
              border: 'none',
              borderBottom: type === 'build' ? '2px solid var(--color-accent-400)' : '2px solid transparent',
              color: 'var(--text-1)',
              cursor: 'pointer',
            }}
          >
            Builds
          </button>
          <button
            role="tab"
            aria-selected={type === 'avatar'}
            aria-controls="marketplace-items"
            onClick={() => handleTypeChange('avatar')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              background: type === 'avatar' ? 'var(--bg-button-primary)' : 'transparent',
              border: 'none',
              borderBottom: type === 'avatar' ? '2px solid var(--color-accent-400)' : '2px solid transparent',
              color: 'var(--text-1)',
              cursor: 'pointer',
            }}
          >
            Avatars
          </button>
        </div>

        {/* Search */}
        <label htmlFor="marketplace-search" className="sr-only">Search marketplace items</label>
        <input
          id="marketplace-search"
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          aria-label="Search marketplace items"
          className="marketplace-search"
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: 'var(--spacing-2) var(--spacing-4)',
            marginBottom: 'var(--spacing-6)',
            background: 'var(--bg-button)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-1)',
          }}
        />

        {/* Filters */}
        <MarketplaceFilters
          tags={allTags}
          selectedTags={selectedTags}
          sortBy={sortBy}
          onTagsChange={handleTagsChange}
          onSortChange={handleSortChange}
        />

        <div 
          id="marketplace-items"
          role="tabpanel"
          aria-label={`${type === 'build' ? 'Builds' : 'Avatars'} grid`}
          className="marketplace-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'var(--spacing-4)',
          }}
        >
          {loading ? (
            <MarketplaceCardSkeleton count={pageSize} />
          ) : (
            <>
            {filteredItems.map(item => (
              <Card key={item.id}>
                {item.thumbnailUrl && (
                  <div className="marketplace-card-thumbnail">
                    <img
                      src={item.thumbnailUrl.startsWith('http') || item.thumbnailUrl.startsWith('/api') ? item.thumbnailUrl : `/api${item.thumbnailUrl}`}
                      alt={item.title}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <h3 className="marketplace-card-title">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="marketplace-card-description">
                    {item.description}
                  </p>
                )}
                <div className="marketplace-card-footer">
                  <div className="marketplace-card-meta">
                    <div className="marketplace-card-author">by {item.authorName ?? 'Unknown'}</div>
                    <div className="marketplace-card-likes">
                      <span>{item.likes ?? 0} ❤️</span>
                    </div>
                  </div>
                  <div className="marketplace-card-actions">
                    <button
                      onClick={async () => {
                        // Check if user is logged in
                        const { token } = getTokens();
                        if (!token) {
                          showToast('Musisz być zalogowany, aby polubić item', 'error');
                          return;
                        }

                        try {
                          const result = await marketplaceApi.likeItem(item.id);
                          
                          // Update local state instead of reloading all items
                          setItems(items.map(i => 
                            i.id === item.id 
                              ? { ...i, liked: result.liked, likes: result.likes }
                              : i
                          ));
                          
                          showToast(
                            result.liked 
                              ? `Polubiono "${item.title}"` 
                              : `Usunięto polubienie "${item.title}"`,
                            'success'
                          );
                        } catch (error) {
                          console.error('Failed to like item:', error);
                          const errorMessage = error instanceof Error ? error.message : 'Nie udało się polubić itemu';
                          showToast(errorMessage, 'error');
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: item.liked ? 'var(--color-error)' : 'var(--text-2)',
                        padding: 'var(--spacing-1)',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      aria-label={item.liked ? `Unlike ${item.title}` : `Like ${item.title}`}
                      title={item.liked ? 'Unlike' : 'Like'}
                    >
                      <span aria-hidden="true">{item.liked ? '❤️' : '🤍'}</span>
                    </button>
                    <Link to={`/marketplace/${item.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
            </>
          )}
        </div>

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-12)', color: 'var(--text-2)' }}>
            No items found
          </div>
        )}

        {/* Pagination */}
        {!loading && total > pageSize && (
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(total / pageSize)}
            pageSize={pageSize}
            total={total}
            onPageChange={handlePageChange}
          />
        )}
      </div>
      
      {showPublishModal && (
        <PublishToMarketplaceModal
          type={showPublishModal}
          onClose={() => setShowPublishModal(null)}
          onPublished={() => {
            void loadItems(); // Reload marketplace items
          }}
        />
      )}
    </Layout>
  );
}


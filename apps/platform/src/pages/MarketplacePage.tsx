import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { Pagination } from '../components/shared/Pagination';
import { MarketplaceFilters, type SortOption } from '../components/marketplace/MarketplaceFilters';
import { marketplaceApi, type MarketplaceItem } from '../api/marketplace';
import { Link } from 'react-router-dom';

export function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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
        <h1 style={{ marginBottom: 'var(--spacing-6)' }}>Marketplace</h1>

        {/* Type selector */}
        <div style={{ 
          display: 'flex', 
          gap: 'var(--spacing-4)', 
          marginBottom: 'var(--spacing-6)',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <button
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
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
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

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'var(--spacing-4)',
          }}>
            {filteredItems.map(item => (
              <Card key={item.id}>
                {item.thumbnailUrl && (
                  <div style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    marginBottom: 'var(--spacing-4)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    background: 'var(--color-base-200)',
                  }}>
                    <img
                      src={item.thumbnailUrl.startsWith('http') || item.thumbnailUrl.startsWith('/api') ? item.thumbnailUrl : `/api${item.thumbnailUrl}`}
                      alt={item.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-2)' }}>
                  {item.title}
                </h3>
                {item.description && (
                  <p style={{ 
                    color: 'var(--text-2)', 
                    fontSize: 'var(--text-sm)',
                    marginBottom: 'var(--spacing-4)',
                  }}>
                    {item.description}
                  </p>
                )}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 'var(--spacing-4)',
                }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                    <div>by {item.authorName ?? 'Unknown'}</div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', marginTop: 'var(--spacing-1)' }}>
                      <span>{item.likes ?? 0} ❤️</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                    <button
                      onClick={async () => {
                        try {
                          await marketplaceApi.likeItem(item.id);
                          void loadItems(); // Reload items
                        } catch (error) {
                          console.error('Failed to like item:', error);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: item.liked ? 'var(--color-error)' : 'var(--text-2)',
                        padding: 'var(--spacing-1)',
                      }}
                      title={item.liked ? 'Unlike' : 'Like'}
                    >
                      {item.liked ? '❤️' : '🤍'}
                    </button>
                    <Link to={`/marketplace/${item.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

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
    </Layout>
  );
}


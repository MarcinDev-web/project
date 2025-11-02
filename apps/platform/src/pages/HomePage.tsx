import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { marketplaceApi, type MarketplaceItem } from '../api/marketplace';
import { useAuth } from '../contexts/AuthContext';

type SortOption = 'newest' | 'popular' | 'trending';

export function HomePage() {
  const { isAuthenticated } = useAuth();
  const [builds, setBuilds] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    loadBuilds();
  }, [sortBy]);

  // Poll for online player count updates (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      void loadBuilds(true); // Silent refresh to get updated player counts
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBuilds = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await marketplaceApi.getBuilds({ limit: 50 });
      let sortedBuilds = [...response.items];

      // Apply sorting
      if (sortBy === 'newest') {
        sortedBuilds.sort((a, b) => b.createdAt - a.createdAt);
      } else if (sortBy === 'popular') {
        sortedBuilds.sort((a, b) => (b.downloads + b.likes) - (a.downloads + a.likes));
      } else if (sortBy === 'trending') {
        // Trending: recent activity (downloads in last week, weighted by recency)
        const now = Date.now();
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
        sortedBuilds.sort((a, b) => {
          const aRecent = a.createdAt > weekAgo ? (a.downloads * 2 + a.likes) : (a.downloads + a.likes);
          const bRecent = b.createdAt > weekAgo ? (b.downloads * 2 + b.likes) : (b.downloads + b.likes);
          return bRecent - aRecent;
        });
      }

      setBuilds(sortedBuilds);
    } catch (error) {
      console.error('Failed to load builds:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const filteredBuilds = builds.filter(build =>
    build.title.toLowerCase().includes(search.toLowerCase()) ||
    build.description?.toLowerCase().includes(search.toLowerCase()) ||
    build.authorName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--spacing-6)' }}>
        {/* Search and Sort Bar */}
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-6)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              minWidth: '300px',
              padding: 'var(--spacing-2) var(--spacing-4)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-1)',
              fontSize: 'var(--text-base)',
            }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              background: 'var(--bg-button)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-1)',
              fontSize: 'var(--text-base)',
              cursor: 'pointer',
            }}
          >
            <option value="newest">Newest</option>
            <option value="popular">Popular</option>
            <option value="trending">Trending</option>
          </select>
        </div>

        {/* Game Feed */}
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--spacing-16)',
            color: 'var(--text-2)',
          }}>
            Loading games...
          </div>
        ) : filteredBuilds.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--spacing-16)',
            color: 'var(--text-2)',
          }}>
            {search ? 'No games found matching your search' : 'No games available yet'}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 'var(--spacing-4)',
          }}>
            {filteredBuilds.map(build => (
              <Link
                key={build.id}
                to={`/marketplace/${build.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'var(--transition-base)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-panel)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    background: 'var(--color-base-200)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-3)',
                    fontSize: '3rem',
                  }}>
                    {build.thumbnailUrl ? (
                      <img
                        src={build.thumbnailUrl.startsWith('http') || build.thumbnailUrl.startsWith('/api') ? build.thumbnailUrl : `/api${build.thumbnailUrl}`}
                        alt={build.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          // Fallback to emoji if image fails to load
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            parent.textContent = '🎮';
                            parent.style.fontSize = '3rem';
                          }
                        }}
                      />
                    ) : (
                      '🎮'
                    )}
                  </div>

                  {/* Info */}
                  <div style={{
                    padding: 'var(--spacing-4)',
                  }}>
                    <h3 style={{
                      marginTop: 0,
                      marginBottom: 'var(--spacing-2)',
                      fontSize: 'var(--text-lg)',
                      fontWeight: 'var(--font-medium)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {build.title}
                    </h3>
                    <p style={{
                      margin: 0,
                      marginBottom: 'var(--spacing-3)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      minHeight: '2.5em',
                    }}>
                      {build.description || 'No description'}
                    </p>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-3)',
                    }}>
                      <span>{build.authorName || 'Unknown'}</span>
                      <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                        {(build.playersOnline ?? 0) > 0 && (
                          <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-medium)' }}>
                            🟢 {build.playersOnline} online
                          </span>
                        )}
                        <span>👁 {build.downloads}</span>
                        <span>❤️ {build.likes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

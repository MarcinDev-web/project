import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { gamesApi, type GameSummary, type GamesSortOption } from '../api/games';

type SortOption = GamesSortOption;

// Helper functions for game visuals
const getGameEmoji = (tags: string[]): string => {
  const tag = tags[0]?.toLowerCase() || '';
  const emojiMap: Record<string, string> = {
    adventure: '🏰',
    racing: '🏎️',
    puzzle: '🧩',
    strategy: '🚀',
    roguelike: '⚔️',
    simulation: '🌾',
    'battle-royale': '🎯',
    'tower-defense': '🗼',
    rpg: '🎮',
    action: '⚡',
    multiplayer: '👥',
    casual: '🎨',
    default: '🎮',
  };
  return emojiMap[tag] ?? '🎮';
};

const getGameGradient = (id: string): string => {
  const gradients = [
    'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
    'linear-gradient(135deg, rgba(234, 102, 126, 0.3) 0%, rgba(162, 75, 118, 0.3) 100%)',
    'linear-gradient(135deg, rgba(126, 234, 102, 0.3) 0%, rgba(75, 162, 118, 0.3) 100%)',
    'linear-gradient(135deg, rgba(234, 178, 102, 0.3) 0%, rgba(162, 118, 75, 0.3) 100%)',
    'linear-gradient(135deg, rgba(102, 234, 178, 0.3) 0%, rgba(75, 118, 162, 0.3) 100%)',
    'linear-gradient(135deg, rgba(178, 102, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
  ];
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length]!;
};

export function HomePage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    void loadGames();
  }, [sortBy]);

  // Poll for online player count updates (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      void loadGames(true); // Silent refresh to get updated player counts
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGames = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const trimmedSearch = search.trim();
      const response = await gamesApi.list({
        limit: 60,
        sortBy,
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
      });

      const fetchedGames = response.items ?? [];
      setGames(fetchedGames);
    } catch (error) {
      console.error('Failed to load games:', error);
      setGames([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const filteredGames = games.filter(game =>
    game.title.toLowerCase().includes(search.toLowerCase()) ||
    game.description?.toLowerCase().includes(search.toLowerCase()) ||
    game.authorName?.toLowerCase().includes(search.toLowerCase())
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
            <option value="updated">Recently Updated</option>
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
        ) : filteredGames.length === 0 ? (
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
            {filteredGames.map((game) => {
              return (
                <>
                  <div
                  key={game.id}
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    transition: 'var(--transition-base)',
                    display: 'flex',
                    flexDirection: 'column',
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
                <Link
                  to={`/marketplace/${game.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: '100%',
                    aspectRatio: '16/9',
                    background: getGameGradient(game.id),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-3)',
                    fontSize: '3rem',
                  }}>
                    {game.thumbnailUrl ? (
                      <img
                        src={game.thumbnailUrl.startsWith('http') || game.thumbnailUrl.startsWith('/api') ? game.thumbnailUrl : `/api${game.thumbnailUrl}`}
                        alt={game.title}
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
                            parent.textContent = getGameEmoji(game.tags);
                            parent.style.fontSize = '3rem';
                          }
                        }}
                      />
                    ) : (
                      getGameEmoji(game.tags)
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
                      {game.title}
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
                      {game.description || 'No description'}
                    </p>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-3)',
                    }}>
                      <span>{game.authorName || 'Unknown'}</span>
                      <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                        {(game.playersOnline ?? 0) > 0 && (
                          <span style={{ color: 'var(--color-success)', fontWeight: 'var(--font-medium)' }}>
                            🟢 {game.playersOnline} online
                          </span>
                        )}
                        <span>👁 {game.downloads}</span>
                        <span>❤️ {game.likes}</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <div style={{
                  padding: '0 var(--spacing-4) var(--spacing-4)',
                }}>
                  <Link
                    to={`/player/${game.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 'var(--spacing-2) var(--spacing-4)',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 'var(--font-semibold)',
                    }}
                  >
                    Play
                  </Link>
                </div>
                  </div>
                </>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

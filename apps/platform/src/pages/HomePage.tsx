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
  // Forge World industrial gradients
  const gradients = [
    'linear-gradient(135deg, rgba(78, 84, 96, 0.4) 0%, rgba(58, 63, 71, 0.5) 100%)',
    'linear-gradient(135deg, rgba(107, 114, 128, 0.3) 0%, rgba(61, 65, 72, 0.5) 100%)',
    'linear-gradient(135deg, rgba(138, 90, 45, 0.3) 0%, rgba(107, 89, 64, 0.4) 100%)',
    'linear-gradient(135deg, rgba(230, 126, 34, 0.2) 0%, rgba(212, 137, 61, 0.3) 100%)',
    'linear-gradient(135deg, rgba(84, 89, 100, 0.3) 0%, rgba(45, 48, 56, 0.5) 100%)',
    'linear-gradient(135deg, rgba(107, 89, 64, 0.3) 0%, rgba(78, 84, 96, 0.4) 100%)',
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
        <div className="homepage-header">
          <div className="homepage-search">
            <span className="homepage-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="homepage-search-input"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="homepage-sort-select"
          >
            <option value="newest">Newest</option>
            <option value="popular">Popular</option>
            <option value="trending">Trending</option>
            <option value="updated">Recently Updated</option>
          </select>
        </div>

        {/* Game Feed */}
        {loading ? (
          <div className="homepage-loading">
            Loading games...
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="homepage-empty">
            {search ? 'No games found matching your search' : 'No games available yet'}
          </div>
        ) : (
          <div className="games-grid">
            {filteredGames.map((game) => {
              return (
                <div key={game.id} className="game-card">
                  <Link
                    to={`/marketplace/${game.id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {/* Thumbnail */}
                    <div className="game-card__thumbnail" style={{ background: getGameGradient(game.id) }}>
                      {game.thumbnailUrl ? (
                        <img
                          src={game.thumbnailUrl.startsWith('http') || game.thumbnailUrl.startsWith('/api') ? game.thumbnailUrl : `/api${game.thumbnailUrl}`}
                          alt={game.title}
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
                    <div className="game-card__content">
                      <h3 className="game-card__title">
                        {game.title}
                      </h3>
                      <p className="game-card__description">
                        {game.description || 'No description'}
                      </p>
                      <div className="game-card__meta">
                        <span className="game-card__author">{game.authorName || 'Unknown'}</span>
                        <div className="game-card__stats">
                          {(game.playersOnline ?? 0) > 0 && (
                            <span className="game-card__stat game-card__stat--online">
                              🟢 {game.playersOnline} online
                            </span>
                          )}
                          <span className="game-card__stat">👁 {game.downloads}</span>
                          <span className="game-card__stat">❤️ {game.likes}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="game-card__actions">
                    <Link
                      to={`/player/${game.id}`}
                      className="game-card__play-button"
                    >
                      Play
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import {
  gamesApi,
  type GameSummary,
  type GamesSortOption,
  type GamesDiscoverResponse,
  type DiscoverCategorySection,
  type DiscoverCuratedPick,
  type FairnessSlot,
} from '../api/games';

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
  const [discover, setDiscover] = useState<GamesDiscoverResponse | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    void loadGames();
  }, [sortBy, activeTags]);

  // Poll for online player count updates (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      void loadGames(true); // Silent refresh to get updated player counts
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadDiscover();
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
        ...(activeTags.length > 0 ? { tags: activeTags } : {}),
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

  const loadDiscover = async () => {
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const payload = await gamesApi.discover();
      setDiscover(payload);
    } catch (error) {
      console.error('Failed to load discovery feed:', error);
      setDiscover(null);
      setDiscoverError('Could not load discovery feed. Please try again later.');
    } finally {
      setDiscoverLoading(false);
    }
  };

  const normalizedSearch = search.toLowerCase();
  const normalizedActiveTags = activeTags.map((tag) => tag.toLowerCase());
  const filteredGames = games.filter((game) => {
    const matchesSearch =
      game.title.toLowerCase().includes(normalizedSearch) ||
      game.description?.toLowerCase().includes(normalizedSearch) ||
      game.authorName?.toLowerCase().includes(normalizedSearch);
    const matchesTags =
      normalizedActiveTags.length === 0 ||
      game.tags.some((tag) => normalizedActiveTags.includes(tag.toLowerCase()));
    return matchesSearch && matchesTags;
  });

  const handleCategorySelect = (category: DiscoverCategorySection) => {
    setActiveCategory({ id: category.id, title: category.title });
    setActiveTags(category.tags);
    setSearch('');
  };

  const clearCategoryFilter = () => {
    setActiveCategory(null);
    setActiveTags([]);
  };

  const formatHoursAgo = (hours: number): string => {
    if (hours < 24) {
      return `${Math.max(1, Math.round(hours))}h ago`;
    }
    const days = Math.max(1, Math.round(hours / 24));
    return `${days}d ago`;
  };

  return (
    <Layout>
      <div className="page-container" style={{ paddingTop: 'var(--spacing-6)' }}>
        {/* Featured GTA Demo Banner */}
        <Link to="/player/gta-demo" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#2d3748',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s ease',
            border: '2px solid rgba(255,255,255,0.5)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
          >
            <div>
              <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 800 }}>🏙️ GTA Style City Demo</h2>
              <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: '500px' }}>
                Experience high-speed movement, stunts, and procedural city generation in this tech demo.
              </p>
              <div style={{ 
                marginTop: '1rem', 
                display: 'inline-block', 
                background: '#fff', 
                color: '#000', 
                padding: '0.5rem 1rem', 
                borderRadius: '8px',
                fontWeight: 'bold'
              }}>
                Play Now →
              </div>
            </div>
            <div style={{ fontSize: '4rem' }}>🏎️💨</div>
          </div>
        </Link>

        <section className="discover-stack">
          {discoverLoading ? (
            <div className="discover-loading">Loading discovery feed...</div>
          ) : discoverError ? (
            <div className="discover-error">{discoverError}</div>
          ) : discover ? (
            <>
              {discover.featured.length > 0 && (
                <section className="discover-hero">
                  <div className="discover-hero__intro">
                    <p>Discover new player-made worlds</p>
                    <span>{discover.totalGames} published experiences</span>
                  </div>
                  <div className="discover-hero__cards">
                    {discover.featured.slice(0, 3).map((game) => (
                      <Link key={game.id} to={`/marketplace/${game.id}`} className="discover-hero-card">
                        <div
                          className="discover-hero-card__thumb"
                          style={{ background: getGameGradient(game.id) }}
                        >
                          {game.thumbnailUrl ? (
                            <img
                              src={
                                game.thumbnailUrl.startsWith('http') || game.thumbnailUrl.startsWith('/api')
                                  ? game.thumbnailUrl
                                  : `/api${game.thumbnailUrl}`
                              }
                              alt={game.title}
                            />
                          ) : (
                            <span>{getGameEmoji(game.tags)}</span>
                          )}
                        </div>
                        <div className="discover-hero-card__meta">
                          <h3>{game.title}</h3>
                          <p>{game.authorName || 'Unknown creator'}</p>
                          <div className="discover-hero-card__stats">
                            <span>❤️ {game.likes}</span>
                            <span>👁 {game.downloads}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {discover.categories.length > 0 && (
                <section className="discover-section">
                  <div className="discover-section__header">
                    <h2>Browse by category</h2>
                    <span>Tap a card to filter the catalog</span>
                  </div>
                  <div className="discover-category-grid">
                    {discover.categories.map((category) => (
                      <article key={category.id} className="discover-category-card">
                        <div className="discover-category-card__header">
                          <span className="discover-category-card__icon">{category.icon}</span>
                          <div>
                            <h3>{category.title}</h3>
                            <p>{category.tagline}</p>
                          </div>
                        </div>
                        <div className="discover-category-card__games">
                          {category.games.slice(0, 3).map((game) => (
                            <button
                              key={game.id}
                              type="button"
                              className="discover-chip"
                              onClick={() => handleCategorySelect(category)}
                            >
                              {game.title}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="discover-category-card__action"
                          onClick={() => handleCategorySelect(category)}
                        >
                          Explore {category.title}
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {discover.fresh.games.length > 0 && (
                <section className="discover-section">
                  <div className="discover-section__header">
                    <h2>Fresh drops</h2>
                    <span>Last {discover.fresh.windowDays} days</span>
                  </div>
                  <div className="discover-fresh-grid">
                    {discover.fresh.games.slice(0, 8).map((game) => (
                      <Link key={game.id} to={`/marketplace/${game.id}`} className="discover-fresh-card">
                        <div className="discover-fresh-card__meta">
                          <span>{formatHoursAgo(game.publishedHoursAgo)}</span>
                          <span>⚡ Momentum {Math.round(game.freshnessScore)}</span>
                        </div>
                        <h3>{game.title}</h3>
                        <p>{game.description || 'No description'}</p>
                        <div className="discover-fresh-card__stats">
                          <span>❤️ {game.likes}</span>
                          <span>👁 {game.downloads}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}


              {discover.fairness.slots.length > 0 && (
                <section className="discover-section">
                  <div className="discover-section__header">
                    <h2>Long-tail spotlight</h2>
                    <span>{discover.fairness.strategy}</span>
                  </div>
                  <div className="discover-longtail-grid">
                    {discover.fairness.slots.slice(0, 5).map((slot: FairnessSlot) => (
                      <Link key={slot.game.id} to={`/marketplace/${slot.game.id}`} className="discover-longtail-card">
                        <div className="discover-longtail-card__rank">#{slot.slot}</div>
                        <div className="discover-longtail-card__body">
                          <strong>{slot.game.title}</strong>
                          <span>{slot.reason}</span>
                        </div>
                        <div className="discover-longtail-card__boost">{slot.boostMultiplier.toFixed(2)}x</div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : null}
        </section>

        <div className="homepage-divider" />

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

        {activeCategory && (
          <div className="discover-active-filter">
            <span>Filtering by {activeCategory.title}</span>
            <button type="button" onClick={clearCategoryFilter}>
              Clear filter
            </button>
          </div>
        )}

        {loading ? (
          <div className="homepage-loading">Loading games...</div>
        ) : filteredGames.length === 0 ? (
          <div className="homepage-empty">
            <div className="homepage-empty__icon">⚡</div>
            <h3 className="homepage-empty__title">
              {search || activeTags.length > 0
                ? 'No matches found'
                : 'Start Your Journey'}
            </h3>
            <p className="homepage-empty__text">
              {search || activeTags.length > 0
                ? "We couldn't find any games matching your filters. Try adjusting your search or keywords."
                : 'Be the first to create a world in Forge. Your imagination is the only limit.'}
            </p>
            {!(search || activeTags.length > 0) && (
              <Link to="/editor" className="homepage-empty__cta">
                <span>🔨</span> Create New Game
              </Link>
            )}
          </div>
        ) : (
          <div className="games-grid">
            {filteredGames.map((game) => (
              <div key={game.id} className="game-card">
                <Link to={`/marketplace/${game.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="game-card__thumbnail" style={{ background: getGameGradient(game.id) }}>
                    {game.thumbnailUrl ? (
                      <img
                        src={
                          game.thumbnailUrl.startsWith('http') || game.thumbnailUrl.startsWith('/api')
                            ? game.thumbnailUrl
                            : `/api${game.thumbnailUrl}`
                        }
                        alt={game.title}
                        onError={(e) => {
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

                  <div className="game-card__content">
                    <h3 className="game-card__title">{game.title}</h3>
                    <p className="game-card__description">{game.description || 'No description'}</p>
                    <div className="game-card__meta">
                      <span className="game-card__author">{game.authorName || 'Unknown'}</span>
                      <div className="game-card__stats">
                        {(game.playersOnline ?? 0) > 0 && (
                          <span className="game-card__stat game-card__stat--online">🟢 {game.playersOnline} online</span>
                        )}
                        <span className="game-card__stat">👁 {game.downloads}</span>
                        <span className="game-card__stat">❤️ {game.likes}</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="game-card__actions">
                  <Link to={`/player/${game.id}`} className="game-card__play-button">
                    Play
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

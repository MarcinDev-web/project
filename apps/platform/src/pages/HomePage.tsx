import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { marketplaceApi, type MarketplaceItem } from '../api/marketplace';
import { useAuth } from '../contexts/AuthContext';

type SortOption = 'newest' | 'popular' | 'trending';

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
  return emojiMap[tag] || emojiMap.default;
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
  return gradients[hash % gradients.length];
};

// Mock games dla development/demo
const MOCK_GAMES: MarketplaceItem[] = [
  {
    id: 'mock-1',
    type: 'build',
    title: 'Sky Fortress Adventure',
    description: 'Epic adventure in floating castles. Explore, fight monsters, and discover ancient secrets high above the clouds.',
    authorId: 'demo-user-1',
    authorName: 'DragonMaster',
    thumbnailUrl: '',
    fileUrl: '',
    tags: ['adventure', 'action', 'singleplayer'],
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    downloads: 1247,
    likes: 342,
    public: true,
    playersOnline: 12,
  },
  {
    id: 'mock-2',
    type: 'build',
    title: 'Neon Racing Circuit',
    description: 'High-speed racing in cyberpunk city. Customize your vehicle and compete in underground races.',
    authorId: 'demo-user-2',
    authorName: 'SpeedDemon',
    thumbnailUrl: '',
    fileUrl: '',
    tags: ['racing', 'multiplayer', 'competitive'],
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    downloads: 2893,
    likes: 567,
    public: true,
    playersOnline: 28,
  },
  {
    id: 'mock-3',
    type: 'build',
    title: 'Crystal Puzzle Mines',
    description: 'Mind-bending puzzles in mysterious crystal caves. Solve intricate challenges to unlock deeper levels.',
    authorId: 'demo-user-3',
    authorName: 'PuzzleGenius',
    thumbnailUrl: '',
    fileUrl: '',
    tags: ['puzzle', 'logic', 'singleplayer'],
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    downloads: 856,
    likes: 234,
    public: true,
    playersOnline: 5,
  },
  {
    id: 'mock-4',
    type: 'build',
    title: 'Space Colony Builder',
    description: 'Build and manage your own space station. Balance resources, defend against pirates, and expand your colony.',
    authorId: 'demo-user-4',
    authorName: 'CosmicArchitect',
    thumbnailUrl: '',
    fileUrl: '',
    tags: ['strategy', 'builder', 'simulation'],
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    downloads: 3421,
    likes: 891,
    public: true,
    playersOnline: 34,
  },
  {
    id: 'mock-5',
    type: 'build',
    title: 'Dungeon Crawler Legends',
    description: 'Classic roguelike dungeon crawler. Procedurally generated levels, permadeath, and epic loot.',
    authorId: 'demo-user-5',
    authorName: 'LootHunter',
    thumbnailUrl: '',
    fileUrl: '',
    tags: ['roguelike', 'rpg', 'hardcore'],
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    downloads: 1678,
    likes: 445,
    public: true,
    playersOnline: 18,
  },
  {
    id: 'mock-6',
    type: 'build',
    title: 'Peaceful Farm Valley',
    description: 'Relaxing farming simulation. Grow crops, raise animals, and build your dream farm in a cozy valley.',
    authorId: 'demo-user-6',
    authorName: 'FarmerJoe',
    thumbnailUrl: '',
    fileUrl: '',
    tags: ['simulation', 'casual', 'relaxing'],
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    downloads: 4567,
    likes: 1203,
    public: true,
    playersOnline: 42,
  },
  {
    id: 'mock-7',
    type: 'build',
    title: 'Battle Royale Arena',
    description: '100 players, one survivor. Fast-paced battle royale with destructible environments and unique weapons.',
    authorId: 'demo-user-7',
    authorName: 'WarriorKing',
    thumbnailUrl: '',
    fileUrl: '',
    tags: ['battle-royale', 'multiplayer', 'pvp'],
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    downloads: 5234,
    likes: 1456,
    public: true,
    playersOnline: 87,
  },
  {
    id: 'mock-8',
    type: 'build',
    title: 'Mystic Tower Defense',
    description: 'Defend your realm with magical towers. Combine elements and upgrade defenses against endless waves.',
    authorId: 'demo-user-8',
    authorName: 'MageDefender',
    thumbnailUrl: '',
    fileUrl: '',
    tags: ['tower-defense', 'strategy', 'magic'],
    createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    downloads: 2134,
    likes: 678,
    public: true,
    playersOnline: 23,
  },
];

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

      // Fallback to mock data if no real builds available
      if (sortedBuilds.length === 0) {
        sortedBuilds = [...MOCK_GAMES];
      }

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
      // Use mock data on error
      setBuilds([...MOCK_GAMES]);
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
                    background: getGameGradient(build.id),
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
                            parent.textContent = getGameEmoji(build.tags);
                            parent.style.fontSize = '3rem';
                          }
                        }}
                      />
                    ) : (
                      getGameEmoji(build.tags)
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

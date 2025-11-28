import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket, type WebSocketMessage } from '../../hooks/useWebSocket';

interface TrendingThread {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  authorName: string;
  authorAvatar?: string;
  viewCount: number;
  postCount: number;
  score: number;
  isHot: boolean;
  isTrending: boolean;
  createdAt: number;
  thumbnail?: string;
  tags: string[];
}

interface TrendingTopicsProps {
  limit?: number;
}

// Mock data - replace with API call
const mockTrending: TrendingThread[] = [
  { 
    id: '1', 
    title: 'Check out my new cyberpunk city build! 🌃', 
    categoryId: 'showcase', 
    categoryName: 'Showcase', 
    categoryColor: '#ffaa00',
    authorName: 'CyberBuilder',
    viewCount: 2453,
    postCount: 87,
    score: 342,
    isHot: true,
    isTrending: true,
    createdAt: Date.now() - 3600000,
    tags: ['showcase', 'cyberpunk', 'city'],
  },
  { 
    id: '2', 
    title: 'Tutorial: Advanced particle effects in your games', 
    categoryId: 'help', 
    categoryName: 'Help & Support', 
    categoryColor: '#00ff88',
    authorName: 'TechWizard',
    viewCount: 1823,
    postCount: 45,
    score: 256,
    isHot: true,
    isTrending: false,
    createdAt: Date.now() - 7200000,
    tags: ['tutorial', 'particles', 'effects'],
  },
  { 
    id: '3', 
    title: '🎮 Weekend Game Jam Results - Amazing submissions!', 
    categoryId: 'announcements', 
    categoryName: 'Announcements', 
    categoryColor: '#ff073a',
    authorName: 'ForgeTeam',
    viewCount: 3241,
    postCount: 123,
    score: 521,
    isHot: false,
    isTrending: true,
    createdAt: Date.now() - 14400000,
    tags: ['event', 'game-jam', 'community'],
  },
  { 
    id: '4', 
    title: 'Feature Request: Custom avatar animations', 
    categoryId: 'feedback', 
    categoryName: 'Feature Requests', 
    categoryColor: '#b026ff',
    authorName: 'AnimationFan',
    viewCount: 892,
    postCount: 34,
    score: 167,
    isHot: false,
    isTrending: false,
    createdAt: Date.now() - 28800000,
    tags: ['feature', 'avatar', 'animation'],
  },
];

export function TrendingTopics({ limit = 4 }: TrendingTopicsProps) {
  const [threads, setThreads] = useState<TrendingThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      setThreads(mockTrending.slice(0, limit));
      setLoading(false);
    }, 300);
  }, [limit]);

  // Listen for updates to trending threads
  const handleMessage = (message: WebSocketMessage) => {
    if (message.type === 'forum:vote:changed') {
      const { threadId, score } = message as any;
      setThreads(prev => prev.map(t => 
        t.id === threadId ? { ...t, score } : t
      ));
    }
  };

  useWebSocket(handleMessage, true);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatTimeAgo = (timestamp: number) => {
    const hours = Math.floor((Date.now() - timestamp) / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="forum-trending">
        <div className="forum-section-header">
          <span className="forum-section-header__icon">🔥</span>
          <h2 className="forum-section-header__title">Trending Now</h2>
        </div>
        <div className="forum-trending__loading">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="forum-trending__skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="forum-trending">
      <div className="forum-section-header">
        <span className="forum-section-header__icon forum-trending__fire-icon">🔥</span>
        <h2 className="forum-section-header__title">Trending Now</h2>
        <span className="forum-section-header__badge">HOT</span>
      </div>

      <div className="forum-trending__grid">
        {threads.map((thread, index) => (
          <Link
            key={thread.id}
            to={`/community/thread/${thread.id}`}
            className={`forum-trending__card ${thread.isHot ? 'forum-trending__card--hot' : ''}`}
            style={{ 
              '--category-color': thread.categoryColor,
              '--item-index': index,
            } as React.CSSProperties}
          >
            {/* Hot/Trending badge */}
            {(thread.isHot || thread.isTrending) && (
              <div className="forum-trending__badges">
                {thread.isHot && (
                  <span className="forum-trending__badge forum-trending__badge--hot">
                    <span className="forum-trending__badge-fire">🔥</span>
                    HOT
                  </span>
                )}
                {thread.isTrending && (
                  <span className="forum-trending__badge forum-trending__badge--trending">
                    📈 TRENDING
                  </span>
                )}
              </div>
            )}

            {/* Category pill */}
            <div className="forum-trending__category">
              <span 
                className="forum-trending__category-dot" 
                style={{ background: thread.categoryColor }}
              />
              {thread.categoryName}
            </div>

            {/* Title */}
            <h3 className="forum-trending__title">{thread.title}</h3>

            {/* Tags */}
            {thread.tags.length > 0 && (
              <div className="forum-trending__tags">
                {thread.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="forum-trending__tag">#{tag}</span>
                ))}
              </div>
            )}

            {/* Footer with stats */}
            <div className="forum-trending__footer">
              <div className="forum-trending__author">
                <span className="forum-trending__author-avatar">
                  {thread.authorAvatar ? (
                    <img src={thread.authorAvatar} alt="" />
                  ) : (
                    thread.authorName.charAt(0)
                  )}
                </span>
                <span className="forum-trending__author-name">{thread.authorName}</span>
                <span className="forum-trending__time">{formatTimeAgo(thread.createdAt)}</span>
              </div>

              <div className="forum-trending__stats">
                <span className="forum-trending__stat forum-trending__stat--score">
                  <span className="forum-trending__stat-icon">⬆</span>
                  {formatNumber(thread.score)}
                </span>
                <span className="forum-trending__stat">
                  <span className="forum-trending__stat-icon">👁</span>
                  {formatNumber(thread.viewCount)}
                </span>
                <span className="forum-trending__stat">
                  <span className="forum-trending__stat-icon">💬</span>
                  {thread.postCount}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


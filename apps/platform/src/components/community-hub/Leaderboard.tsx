import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface LeaderboardUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  xp: number;
  level: number;
  rank: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'legend';
  threadCount: number;
  postCount: number;
  karmaScore: number;
}

interface LeaderboardProps {
  limit?: number;
}

// Mock data - replace with API call
const mockLeaderboard: LeaderboardUser[] = [
  { id: '1', username: 'ProGamer99', displayName: 'Pro Gamer', xp: 15420, level: 42, rank: 'diamond', threadCount: 156, postCount: 1203, karmaScore: 4521 },
  { id: '2', username: 'BuildMaster', displayName: 'Build Master', xp: 12800, level: 38, rank: 'platinum', threadCount: 89, postCount: 987, karmaScore: 3245 },
  { id: '3', username: 'CreativeKing', displayName: 'Creative King', xp: 9500, level: 32, rank: 'gold', threadCount: 67, postCount: 654, karmaScore: 2187 },
  { id: '4', username: 'HelperHero', displayName: 'Helper Hero', xp: 7200, level: 28, rank: 'gold', threadCount: 45, postCount: 823, karmaScore: 1956 },
  { id: '5', username: 'NewBuilder', displayName: 'New Builder', xp: 3400, level: 18, rank: 'silver', threadCount: 23, postCount: 156, karmaScore: 432 },
];

export function Leaderboard({ limit = 5 }: LeaderboardProps) {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      setUsers(mockLeaderboard.slice(0, limit));
      setLoading(false);
    }, 500);
  }, [limit, timeRange]);

  const getRankIcon = (rank: LeaderboardUser['rank']) => {
    switch (rank) {
      case 'legend': return '🌟';
      case 'master': return '💎';
      case 'diamond': return '💠';
      case 'platinum': return '🏆';
      case 'gold': return '🥇';
      case 'silver': return '🥈';
      case 'bronze': return '🥉';
      default: return '⭐';
    }
  };

  const getXpToNextLevel = (xp: number, level: number) => {
    const baseXp = level * 500;
    const currentLevelXp = xp % baseXp;
    return { current: currentLevelXp, needed: baseXp, percentage: (currentLevelXp / baseXp) * 100 };
  };

  const getPositionStyle = (position: number) => {
    if (position === 1) return { color: 'var(--forum-neon-gold)', textShadow: '0 0 10px var(--forum-neon-gold)' };
    if (position === 2) return { color: 'var(--forum-rank-silver)' };
    if (position === 3) return { color: 'var(--forum-rank-bronze)' };
    return { color: 'var(--text-2)' };
  };

  return (
    <div className="forum-gaming-panel forum-leaderboard">
      <div className="forum-gaming-panel__header">
        <span className="forum-gaming-panel__icon">🏆</span>
        <h3 className="forum-gaming-panel__title">Top Contributors</h3>
      </div>

      {/* Time range tabs */}
      <div className="forum-leaderboard__tabs">
        {(['week', 'month', 'all'] as const).map((range) => (
          <button
            key={range}
            className={`forum-leaderboard__tab ${timeRange === range ? 'forum-leaderboard__tab--active' : ''}`}
            onClick={() => setTimeRange(range)}
          >
            {range === 'week' ? 'Week' : range === 'month' ? 'Month' : 'All Time'}
          </button>
        ))}
      </div>

      <div className="forum-gaming-panel__content">
        {loading ? (
          <div className="forum-leaderboard__loading">
            <div className="forum-leaderboard__loading-spinner" />
            <span>Loading rankings...</span>
          </div>
        ) : (
          <div className="forum-leaderboard__list">
            {users.map((user, index) => {
              const xpProgress = getXpToNextLevel(user.xp, user.level);
              const position = index + 1;

              return (
                <Link
                  key={user.id}
                  to={`/profile/${user.username}`}
                  className={`forum-leaderboard__item forum-leaderboard__item--rank-${user.rank}`}
                  style={{ '--item-index': index } as React.CSSProperties}
                >
                  {/* Position */}
                  <div className="forum-leaderboard__position" style={getPositionStyle(position)}>
                    {position <= 3 ? (
                      <span className="forum-leaderboard__position-crown">
                        {position === 1 ? '👑' : position === 2 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span className="forum-leaderboard__position-number">#{position}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="forum-leaderboard__avatar">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.displayName} />
                    ) : (
                      <span>{user.displayName.charAt(0).toUpperCase()}</span>
                    )}
                    <div className={`forum-leaderboard__avatar-rank forum-leaderboard__avatar-rank--${user.rank}`}>
                      {getRankIcon(user.rank)}
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="forum-leaderboard__info">
                    <div className="forum-leaderboard__name-row">
                      <span className="forum-leaderboard__name">{user.displayName}</span>
                      <span className="forum-leaderboard__level">Lv.{user.level}</span>
                    </div>

                    {/* XP Bar */}
                    <div className="forum-leaderboard__xp-bar">
                      <div 
                        className="forum-leaderboard__xp-fill"
                        style={{ width: `${xpProgress.percentage}%` }}
                      />
                    </div>

                    <div className="forum-leaderboard__stats">
                      <span className="forum-leaderboard__stat">
                        <span className="forum-leaderboard__stat-icon">🔥</span>
                        {formatNumber(user.karmaScore)}
                      </span>
                      <span className="forum-leaderboard__stat">
                        <span className="forum-leaderboard__stat-icon">📝</span>
                        {user.threadCount}
                      </span>
                      <span className="forum-leaderboard__stat">
                        <span className="forum-leaderboard__stat-icon">💬</span>
                        {user.postCount}
                      </span>
                    </div>
                  </div>

                  {/* XP Badge */}
                  <div className="forum-leaderboard__xp-badge">
                    <span className="forum-leaderboard__xp-value">{formatNumber(user.xp)}</span>
                    <span className="forum-leaderboard__xp-label">XP</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="forum-gaming-panel__footer">
        <Link to="/community/leaderboard" className="forum-gaming-panel__link">
          View Full Leaderboard →
        </Link>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}


import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import type { ProfileSocialStats } from '../../api/profiles';

interface ProfileStatsProps {
  socialStats: ProfileSocialStats | null;
  userId: string;
  loading?: boolean;
}

/**
 * ProfileStats - wyświetla statystyki społecznościowe użytkownika
 * 
 * Pokazuje:
 * - Liczba znajomych
 * - Liczba wątków na forum
 * - Liczba postów na forum
 * - Liczba buildów na marketplace
 * - Liczba polubień
 * - Liczba pobrań
 */
export const ProfileStats = memo(function ProfileStats({
  socialStats,
  userId,
  loading = false,
}: ProfileStatsProps) {
  if (loading || !socialStats) {
    return (
      <Card hoverable={false}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 'var(--spacing-4)',
        }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ 
                height: '24px', 
                background: 'var(--bg-button)', 
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--spacing-2)',
              }} />
              <div style={{ 
                height: '16px', 
                background: 'var(--bg-button)', 
                borderRadius: 'var(--radius-sm)',
                width: '60%',
                margin: '0 auto',
              }} />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const stats = [
    {
      label: 'Znajomi',
      value: socialStats.friendsCount,
      link: `/profile/${userId}/friends`,
      icon: '👥',
    },
    {
      label: 'Wątki',
      value: socialStats.forumThreadsCount,
      link: `/community-hub?tab=community&author=${userId}`,
      icon: '💬',
    },
    {
      label: 'Posty',
      value: socialStats.forumPostsCount,
      link: `/community-hub?tab=community&author=${userId}`,
      icon: '📝',
    },
    {
      label: 'Buildy',
      value: socialStats.marketplaceBuildsCount,
      link: `/profile/${userId}#builds`,
      icon: '🏗️',
    },
    {
      label: 'Polubienia',
      value: socialStats.marketplaceLikesCount,
      link: `/profile/${userId}#builds`,
      icon: '❤️',
    },
    {
      label: 'Pobrania',
      value: socialStats.marketplaceDownloadsCount,
      link: `/profile/${userId}#builds`,
      icon: '⬇️',
    },
  ];

  return (
    <Card hoverable={false}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 'var(--spacing-4)',
      }}>
        {stats.map((stat) => {
          const content = (
            <div 
              key={stat.label}
              style={{ 
                textAlign: 'center',
                cursor: stat.link ? 'pointer' : 'default',
              }}
            >
              <div style={{ 
                fontSize: 'var(--text-2xl)',
                marginBottom: 'var(--spacing-2)',
              }}>
                {stat.icon}
              </div>
              <div style={{ 
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--font-bold)',
                color: 'var(--text-1)',
                marginBottom: 'var(--spacing-1)',
              }}>
                {stat.value.toLocaleString('pl-PL')}
              </div>
              <div style={{ 
                fontSize: 'var(--text-sm)',
                color: 'var(--text-2)',
              }}>
                {stat.label}
              </div>
            </div>
          );

          if (stat.link && stat.value > 0) {
            return (
              <Link 
                key={stat.label}
                to={stat.link}
                style={{ textDecoration: 'none' }}
              >
                {content}
              </Link>
            );
          }

          return content;
        })}
      </div>
    </Card>
  );
});

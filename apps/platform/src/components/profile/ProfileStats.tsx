import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../shared/Card';
import type { ProfileSocialStats } from '../../api/profiles';

interface ProfileStatsProps {
  socialStats: ProfileSocialStats | null;
  userId: string;
  loading?: boolean;
  isOwnProfile?: boolean;
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
  isOwnProfile = false,
}: ProfileStatsProps) {
  if (loading) {
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

  if (!socialStats) {
    return null;
  }

  const renderStatCard = (
    label: string,
    value: number,
    icon: string,
    link?: string
  ) => {
    const content = (
      <div 
        style={{ 
          textAlign: 'center',
          cursor: link ? 'pointer' : 'default',
        }}
      >
        <div style={{ 
          fontSize: 'var(--text-2xl)',
          marginBottom: 'var(--spacing-2)',
        }}>
          {icon}
        </div>
        <div style={{ 
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--font-bold)',
          color: 'var(--text-1)',
          marginBottom: 'var(--spacing-1)',
        }}>
          {value.toLocaleString('pl-PL')}
        </div>
        <div style={{ 
          fontSize: 'var(--text-sm)',
          color: 'var(--text-2)',
        }}>
          {label}
        </div>
      </div>
    );

    if (link && value > 0) {
      return (
        <Link 
          key={label}
          to={link}
          style={{ textDecoration: 'none' }}
        >
          {content}
        </Link>
      );
    }

    return <div key={label}>{content}</div>;
  };

  const basicStats = [
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
    <div>
      {/* Basic Stats */}
      <Card hoverable={false} style={{ marginBottom: isOwnProfile ? 'var(--spacing-6)' : 0 }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 'var(--spacing-4)',
        }}>
          {basicStats.map((stat) => renderStatCard(stat.label, stat.value, stat.icon, stat.link))}
        </div>
      </Card>

      {/* Extended Stats - Only for own profile */}
      {isOwnProfile && (
        <>
          {/* Marketplace Detailed Stats */}
          <Card hoverable={false} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ 
              marginTop: 0,
              marginBottom: 'var(--spacing-4)',
              color: 'var(--text-1)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-semibold)',
            }}>
              Marketplace - Szczegóły
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--spacing-4)',
            }}>
              {renderStatCard('Buildy', socialStats?.marketplaceStats?.buildsCount ?? 0, '🏗️', `/marketplace?type=build&author=${userId}`)}
              {renderStatCard('Avatary', socialStats?.marketplaceStats?.avatarsCount ?? 0, '👤', `/marketplace?type=avatar&author=${userId}`)}
              {renderStatCard('Polubienia buildów', socialStats?.marketplaceStats?.buildsLikes ?? 0, '❤️')}
              {renderStatCard('Pobrania buildów', socialStats?.marketplaceStats?.buildsDownloads ?? 0, '⬇️')}
              {renderStatCard('Polubienia avatarów', socialStats?.marketplaceStats?.avatarsLikes ?? 0, '❤️')}
              {renderStatCard('Pobrania avatarów', socialStats?.marketplaceStats?.avatarsDownloads ?? 0, '⬇️')}
            </div>
          </Card>

          {/* Blocks Stats */}
          <Card hoverable={false} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ 
              marginTop: 0,
              marginBottom: 'var(--spacing-4)',
              color: 'var(--text-1)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-semibold)',
            }}>
              Bloki/Modele
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--spacing-4)',
            }}>
              {renderStatCard('Zapisane', socialStats?.blocksStats?.saved ?? 0, '📦', '/studio')}
              {renderStatCard('Opublikowane', socialStats?.blocksStats?.published ?? 0, '🌐')}
              {renderStatCard('Użycia', socialStats?.blocksStats?.totalUses ?? 0, '🔄')}
            </div>
          </Card>

          {/* Avatars Stats */}
          <Card hoverable={false} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 style={{ 
              marginTop: 0,
              marginBottom: 'var(--spacing-4)',
              color: 'var(--text-1)',
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--font-semibold)',
            }}>
              Avatary
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--spacing-4)',
            }}>
              {renderStatCard('Zapisane presety', socialStats?.avatarsStats?.savedPresets ?? 0, '💾', '/studio')}
              {renderStatCard('Opublikowane', socialStats?.avatarsStats?.published ?? 0, '🌐', `/marketplace?type=avatar&author=${userId}`)}
              {renderStatCard('Pobrania', socialStats?.avatarsStats?.totalDownloads ?? 0, '⬇️')}
              {renderStatCard('Polubienia', socialStats?.avatarsStats?.totalLikes ?? 0, '❤️')}
            </div>
          </Card>
        </>
      )}
    </div>
  );
});

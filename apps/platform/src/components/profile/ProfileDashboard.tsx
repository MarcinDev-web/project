import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import type { ProfileSocialStats } from '../../api/profiles';
import type { StudioStats } from '../../api/studio';

interface ProfileDashboardProps {
  socialStats: ProfileSocialStats | null;
  studioStats: StudioStats | null;
  userId: string;
  isOwnProfile: boolean;
  loading?: boolean;
}

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  variant?: 'orange' | 'blue' | 'green' | 'purple' | 'pink' | 'cyan';
  link?: string;
}

const StatCard = memo(function StatCard({ icon, label, value, variant = 'orange', link }: StatCardProps) {
  const content = (
    <div className={`profile-stat-card profile-stat-card--${variant}`}>
      <div className="profile-stat-card__header">
        <div className="profile-stat-card__icon">{icon}</div>
        <span className="profile-stat-card__label">{label}</span>
      </div>
      <div className="profile-stat-card__value">
        {value.toLocaleString('pl-PL')}
      </div>
    </div>
  );

  if (link && value > 0) {
    return (
      <Link to={link} style={{ textDecoration: 'none' }}>
        {content}
      </Link>
    );
  }

  return content;
});

/**
 * ProfileDashboard - Unified stats dashboard for profile page
 * 
 * Consolidates all profile statistics into a clean, visual dashboard
 */
export const ProfileDashboard = memo(function ProfileDashboard({
  socialStats,
  studioStats,
  userId,
  isOwnProfile,
  loading = false,
}: ProfileDashboardProps) {
  if (loading) {
    return (
      <div className="profile-stats-grid">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="profile-skeleton profile-skeleton--card" />
        ))}
      </div>
    );
  }

  return (
    <div className="profile-main">
      {/* Studio Highlight Card - Only for own profile with studio stats */}
      {isOwnProfile && studioStats && (
        <div className="profile-studio-card">
          <div className="profile-studio-card__info">
            <div className="profile-studio-card__icon">🎮</div>
            <div className="profile-studio-card__text">
              <h3 className="profile-studio-card__title">Twoje Studio</h3>
              <p className="profile-studio-card__subtitle">Zarządzaj projektami i śledź statystyki</p>
            </div>
          </div>
          
          <div className="profile-studio-card__stats">
            <div className="profile-studio-stat">
              <span className="profile-studio-stat__value">{studioStats.totalProjects}</span>
              <span className="profile-studio-stat__label">Projekty</span>
            </div>
            <div className="profile-studio-stat">
              <span className="profile-studio-stat__value">{studioStats.publishedProjects}</span>
              <span className="profile-studio-stat__label">Opublikowane</span>
            </div>
            <div className="profile-studio-stat">
              <span className="profile-studio-stat__value">{studioStats.totalViews.toLocaleString('pl-PL')}</span>
              <span className="profile-studio-stat__label">Wyświetlenia</span>
            </div>
          </div>
          
          <div className="profile-studio-card__action">
            <Link to="/studio">
              <Button variant="primary" size="medium">
                Otwórz Studio →
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      {socialStats && (
        <div className="profile-stats-grid">
          <StatCard
            icon="👥"
            label="Znajomi"
            value={socialStats.friendsCount}
            variant="blue"
            link={`/profile/${userId}/friends`}
          />
          <StatCard
            icon="💬"
            label="Wątki na forum"
            value={socialStats.forumThreadsCount}
            variant="purple"
            link={`/community-hub?tab=community&author=${userId}`}
          />
          <StatCard
            icon="📝"
            label="Posty"
            value={socialStats.forumPostsCount}
            variant="cyan"
            link={`/community-hub?tab=community&author=${userId}`}
          />
          <StatCard
            icon="🏗️"
            label="Buildy"
            value={socialStats.marketplaceBuildsCount}
            variant="green"
            link={`/marketplace?author=${userId}`}
          />
          <StatCard
            icon="❤️"
            label="Polubienia"
            value={socialStats.marketplaceLikesCount}
            variant="pink"
          />
          <StatCard
            icon="⬇️"
            label="Pobrania"
            value={socialStats.marketplaceDownloadsCount}
            variant="orange"
          />
        </div>
      )}

      {/* Extended Stats for own profile */}
      {isOwnProfile && socialStats && (
        <>
          {/* Marketplace Details */}
          {(socialStats.marketplaceStats?.buildsCount ?? 0) > 0 || 
           (socialStats.marketplaceStats?.avatarsCount ?? 0) > 0 ? (
            <div className="profile-section">
              <div className="profile-section__header">
                <h3 className="profile-section__title">
                  <span className="profile-section__title-icon">🏪</span>
                  Marketplace
                </h3>
                <Link to="/marketplace" className="profile-link-btn">
                  Zobacz wszystko →
                </Link>
              </div>
              <div className="profile-section__content">
                <div className="profile-stats-grid">
                  <StatCard
                    icon="🎮"
                    label="Buildy"
                    value={socialStats.marketplaceStats?.buildsCount ?? 0}
                    variant="green"
                    link={`/marketplace?type=build&author=${userId}`}
                  />
                  <StatCard
                    icon="👤"
                    label="Avatary"
                    value={socialStats.marketplaceStats?.avatarsCount ?? 0}
                    variant="purple"
                    link={`/marketplace?type=avatar&author=${userId}`}
                  />
                  <StatCard
                    icon="❤️"
                    label="Polubienia buildów"
                    value={socialStats.marketplaceStats?.buildsLikes ?? 0}
                    variant="pink"
                  />
                  <StatCard
                    icon="⬇️"
                    label="Pobrania buildów"
                    value={socialStats.marketplaceStats?.buildsDownloads ?? 0}
                    variant="orange"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Blocks/Models Stats */}
          {(socialStats.blocksStats?.saved ?? 0) > 0 || 
           (socialStats.blocksStats?.published ?? 0) > 0 ? (
            <div className="profile-section">
              <div className="profile-section__header">
                <h3 className="profile-section__title">
                  <span className="profile-section__title-icon">📦</span>
                  Bloki i Modele
                </h3>
              </div>
              <div className="profile-section__content">
                <div className="profile-stats-grid">
                  <StatCard
                    icon="💾"
                    label="Zapisane"
                    value={socialStats.blocksStats?.saved ?? 0}
                    variant="blue"
                    link="/studio"
                  />
                  <StatCard
                    icon="🌐"
                    label="Opublikowane"
                    value={socialStats.blocksStats?.published ?? 0}
                    variant="green"
                  />
                  <StatCard
                    icon="🔄"
                    label="Użycia"
                    value={socialStats.blocksStats?.totalUses ?? 0}
                    variant="cyan"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Avatar Stats */}
          {(socialStats.avatarsStats?.savedPresets ?? 0) > 0 || 
           (socialStats.avatarsStats?.published ?? 0) > 0 ? (
            <div className="profile-section">
              <div className="profile-section__header">
                <h3 className="profile-section__title">
                  <span className="profile-section__title-icon">👤</span>
                  Avatary
                </h3>
              </div>
              <div className="profile-section__content">
                <div className="profile-stats-grid">
                  <StatCard
                    icon="💾"
                    label="Zapisane presety"
                    value={socialStats.avatarsStats?.savedPresets ?? 0}
                    variant="purple"
                    link="/studio"
                  />
                  <StatCard
                    icon="🌐"
                    label="Opublikowane"
                    value={socialStats.avatarsStats?.published ?? 0}
                    variant="green"
                    link={`/marketplace?type=avatar&author=${userId}`}
                  />
                  <StatCard
                    icon="⬇️"
                    label="Pobrania"
                    value={socialStats.avatarsStats?.totalDownloads ?? 0}
                    variant="orange"
                  />
                  <StatCard
                    icon="❤️"
                    label="Polubienia"
                    value={socialStats.avatarsStats?.totalLikes ?? 0}
                    variant="pink"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Empty state for no stats */}
      {!socialStats && !loading && (
        <div className="profile-empty-state">
          <div className="profile-empty-state__illustration">
            <div className="profile-empty-state__icon">📊</div>
          </div>
          <h3 className="profile-empty-state__title">Brak statystyk</h3>
          <p className="profile-empty-state__description">
            Statystyki pojawią się gdy użytkownik rozpocznie aktywność na platformie
          </p>
        </div>
      )}
    </div>
  );
});


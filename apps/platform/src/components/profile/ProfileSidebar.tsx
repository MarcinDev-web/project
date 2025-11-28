import { memo } from 'react';
import { Link } from 'react-router-dom';
import type { ProfileSocialStats } from '../../api/profiles';
import type { StudioStats } from '../../api/studio';

interface ProfileSidebarProps {
  socialStats: ProfileSocialStats | null;
  studioStats: StudioStats | null;
  userId: string;
  isOwnProfile: boolean;
  loading?: boolean;
}

interface QuickStatProps {
  icon: string;
  label: string;
  value: number;
  link?: string;
}

const QuickStat = memo(function QuickStat({ icon, label, value, link }: QuickStatProps) {
  const content = (
    <div className={`profile-quick-stat ${link ? 'profile-quick-stat--link' : ''}`}>
      <span className="profile-quick-stat__icon">{icon}</span>
      <span className="profile-quick-stat__value">{value.toLocaleString('pl-PL')}</span>
      <span className="profile-quick-stat__label">{label}</span>
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
 * ProfileSidebar - Quick overview stats and links for profile
 */
export const ProfileSidebar = memo(function ProfileSidebar({
  socialStats,
  studioStats,
  userId,
  isOwnProfile,
  loading = false,
}: ProfileSidebarProps) {
  if (loading) {
    return (
      <div className="profile-sidebar">
        <div className="profile-sidebar__card">
          <div className="profile-quick-stats">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="profile-skeleton" style={{ height: '80px' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-sidebar">
      {/* Quick Stats Card */}
      <div className="profile-sidebar__card">
        <div className="profile-sidebar__card-header">
          <h3 className="profile-sidebar__card-title">Statystyki</h3>
          <span className="profile-sidebar__card-icon">📊</span>
        </div>
        
        <div className="profile-quick-stats">
          <QuickStat
            icon="👥"
            label="Znajomi"
            value={socialStats?.friendsCount ?? 0}
            link={`/profile/${userId}/friends`}
          />
          <QuickStat
            icon="💬"
            label="Wątki"
            value={socialStats?.forumThreadsCount ?? 0}
            link={`/community-hub?tab=community&author=${userId}`}
          />
          <QuickStat
            icon="🏗️"
            label="Buildy"
            value={socialStats?.marketplaceBuildsCount ?? 0}
            link={`/marketplace?author=${userId}`}
          />
          <QuickStat
            icon="❤️"
            label="Polubienia"
            value={socialStats?.marketplaceLikesCount ?? 0}
          />
        </div>
      </div>

      {/* Studio Card - Only for own profile */}
      {isOwnProfile && studioStats && (
        <div className="profile-sidebar__card">
          <div className="profile-sidebar__card-header">
            <h3 className="profile-sidebar__card-title">Studio</h3>
            <span className="profile-sidebar__card-icon">🎮</span>
          </div>
          
          <div className="profile-quick-stats">
            <QuickStat
              icon="📁"
              label="Projekty"
              value={studioStats.totalProjects}
              link="/studio"
            />
            <QuickStat
              icon="🌐"
              label="Publiczne"
              value={studioStats.publishedProjects}
            />
            <QuickStat
              icon="👁️"
              label="Wyświetlenia"
              value={studioStats.totalViews}
            />
            {studioStats.totalLikes !== undefined && (
              <QuickStat
                icon="❤️"
                label="Polubienia"
                value={studioStats.totalLikes}
              />
            )}
          </div>
          
          <Link 
            to="/studio" 
            className="profile-link-btn profile-link-btn--primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--spacing-4)' }}
          >
            Otwórz Studio
          </Link>
        </div>
      )}

      {/* Marketplace Card - Only for own profile with marketplace stats */}
      {isOwnProfile && socialStats?.marketplaceStats && (
        (socialStats.marketplaceStats.buildsCount > 0 || socialStats.marketplaceStats.avatarsCount > 0) && (
          <div className="profile-sidebar__card">
            <div className="profile-sidebar__card-header">
              <h3 className="profile-sidebar__card-title">Marketplace</h3>
              <span className="profile-sidebar__card-icon">🏪</span>
            </div>
            
            <div className="profile-quick-stats">
              <QuickStat
                icon="🎮"
                label="Buildy"
                value={socialStats.marketplaceStats.buildsCount}
                link={`/marketplace?type=build&author=${userId}`}
              />
              <QuickStat
                icon="👤"
                label="Avatary"
                value={socialStats.marketplaceStats.avatarsCount}
                link={`/marketplace?type=avatar&author=${userId}`}
              />
              <QuickStat
                icon="⬇️"
                label="Pobrania"
                value={socialStats.marketplaceStats.buildsDownloads + socialStats.marketplaceStats.avatarsDownloads}
              />
              <QuickStat
                icon="❤️"
                label="Polubienia"
                value={socialStats.marketplaceStats.buildsLikes + socialStats.marketplaceStats.avatarsLikes}
              />
            </div>
          </div>
        )
      )}

      {/* Quick Links */}
      {isOwnProfile && (
        <div className="profile-sidebar__card">
          <div className="profile-sidebar__card-header">
            <h3 className="profile-sidebar__card-title">Szybkie linki</h3>
            <span className="profile-sidebar__card-icon">🔗</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            <Link to="/settings" className="profile-link-btn" style={{ width: '100%', justifyContent: 'flex-start' }}>
              ⚙️ Ustawienia konta
            </Link>
            <Link to="/community-hub?tab=messages" className="profile-link-btn" style={{ width: '100%', justifyContent: 'flex-start' }}>
              ✉️ Wiadomości
            </Link>
            <Link to="/community-hub?tab=friends" className="profile-link-btn" style={{ width: '100%', justifyContent: 'flex-start' }}>
              👥 Znajomi
            </Link>
            <Link to="/editor" className="profile-link-btn" style={{ width: '100%', justifyContent: 'flex-start' }}>
              🎨 Edytor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
});


import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../shared/Button';
import type { UserProfile } from '../../api/profiles';
import type { BlockedStatus } from '../../api/users';
import { ProfileSocialActions } from './ProfileSocialActions';
import type { ProfileSocialStats } from '../../api/profiles';

interface ProfileHeroProps {
  profile: UserProfile;
  isOwnProfile: boolean;
  blockedStatus: BlockedStatus | null;
  currentUser: unknown;
  onToggleBlock: () => Promise<void>;
  socialStats: ProfileSocialStats | null;
  onFriendshipChanged: () => void;
}

/**
 * ProfileHero - Modern hero header for user profile
 * 
 * Features:
 * - Dynamic gradient banner
 * - Large avatar with status indicator
 * - User info and bio
 * - Quick action buttons
 */
export const ProfileHero = memo(function ProfileHero({
  profile,
  isOwnProfile,
  blockedStatus,
  currentUser,
  onToggleBlock,
  socialStats,
  onFriendshipChanged,
}: ProfileHeroProps) {
  const displayName = profile.displayName ?? profile.username ?? profile.email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();
  
  const memberSince = new Date(profile.createdAt).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="profile-hero">
      {/* Gradient Banner */}
      <div className="profile-hero__banner" />
      
      {/* Content */}
      <div className="profile-hero__content">
        {/* Avatar */}
        <div className="profile-hero__avatar-wrapper">
          {profile.avatarUrl ? (
            <img 
              src={profile.avatarUrl} 
              alt={`${displayName} avatar`}
              className="profile-hero__avatar"
            />
          ) : (
            <div className="profile-hero__avatar-placeholder">
              {initials}
            </div>
          )}
          {/* Online status badge - could be made dynamic */}
          {/* <div className="profile-hero__status-badge" /> */}
        </div>
        
        {/* User Info */}
        <div className="profile-hero__info">
          <h1 className="profile-hero__name">{displayName}</h1>
          
          {profile.bio && (
            <p className="profile-hero__bio">{profile.bio}</p>
          )}
          
          <div className="profile-hero__meta">
            <span className="profile-hero__meta-item">
              <span className="profile-hero__meta-icon">📅</span>
              Dołączył(a) {memberSince}
            </span>
            
            {socialStats && socialStats.friendsCount > 0 && (
              <span className="profile-hero__meta-item">
                <span className="profile-hero__meta-icon">👥</span>
                {socialStats.friendsCount} {socialStats.friendsCount === 1 ? 'znajomy' : 'znajomych'}
              </span>
            )}
            
            {socialStats && socialStats.marketplaceBuildsCount > 0 && (
              <span className="profile-hero__meta-item">
                <span className="profile-hero__meta-icon">🎮</span>
                {socialStats.marketplaceBuildsCount} {socialStats.marketplaceBuildsCount === 1 ? 'build' : 'buildów'}
              </span>
            )}
          </div>

          {/* Block status message */}
          {!isOwnProfile && currentUser && blockedStatus?.isBlockedBy && (
            <div style={{ 
              marginTop: 'var(--spacing-3)',
              padding: 'var(--spacing-3) var(--spacing-4)',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}>
              <span style={{ 
                color: 'var(--color-error)', 
                fontSize: 'var(--text-sm)',
              }}>
                🚫 Ten użytkownik Cię zablokował
              </span>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="profile-hero__actions">
          {isOwnProfile ? (
            <Link to="/settings">
              <Button variant="secondary" size="medium">
                ⚙️ Edytuj profil
              </Button>
            </Link>
          ) : (
            <>
              {!blockedStatus?.isBlocked && !blockedStatus?.isBlockedBy && (
                <ProfileSocialActions
                  userId={profile.id}
                  displayName={displayName}
                  socialStats={socialStats}
                  isOwnProfile={isOwnProfile}
                  onFriendshipChanged={onFriendshipChanged}
                />
              )}
              
              {currentUser && blockedStatus && !blockedStatus.isBlockedBy && (
                <Button
                  variant={blockedStatus.isBlocked ? 'secondary' : 'danger'}
                  size="medium"
                  onClick={onToggleBlock}
                  aria-label={blockedStatus.isBlocked ? 'Odblokuj użytkownika' : 'Zablokuj użytkownika'}
                >
                  {blockedStatus.isBlocked ? '🔓 Odblokuj' : '🚫 Zablokuj'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});


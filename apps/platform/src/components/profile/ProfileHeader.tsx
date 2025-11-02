import { memo } from 'react';
import { Card } from '../shared/Card';
import { Button } from '../shared/Button';
import type { UserProfile } from '../../api/profiles';
import type { BlockedStatus } from '../../api/users';
import { ProfileSocialActions } from './ProfileSocialActions';
import type { ProfileSocialStats } from '../../api/profiles';

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwnProfile: boolean;
  blockedStatus: BlockedStatus | null;
  currentUser: unknown;
  onToggleBlock: () => Promise<void>;
  socialStats: ProfileSocialStats | null;
  onFriendshipChanged: () => void;
}

export const ProfileHeader = memo(function ProfileHeader({
  profile,
  isOwnProfile,
  blockedStatus,
  currentUser,
  onToggleBlock,
  socialStats,
  onFriendshipChanged,
}: ProfileHeaderProps) {
  const displayName = profile.displayName ?? profile.email;
  const memberSince = new Date(profile.createdAt).toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card style={{ marginBottom: 'var(--spacing-6)' }} hoverable={false}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
        {profile.avatarUrl && (
          <img 
            src={profile.avatarUrl} 
            alt={`${displayName} avatar`}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-full)',
              objectFit: 'cover',
              border: '2px solid var(--border-default)',
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 
            style={{ 
              marginTop: 0, 
              marginBottom: 'var(--spacing-2)',
              color: 'var(--text-1)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--font-bold)',
            }}
          >
            {displayName}
          </h1>
          
          {profile.bio && (
            <p 
              style={{ 
                color: 'var(--text-2)', 
                margin: 0,
                marginBottom: 'var(--spacing-2)',
                lineHeight: 1.5,
              }}
            >
              {profile.bio}
            </p>
          )}
          
          <p 
            style={{ 
              color: 'var(--text-3)', 
              fontSize: 'var(--text-sm)', 
              margin: 0,
            }}
          >
            <span aria-label="Member since">Członek od {memberSince}</span>
          </p>

          {!isOwnProfile && currentUser && blockedStatus && (
            <div style={{ marginTop: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-2)' }}>
              {blockedStatus.isBlockedBy ? (
                <span 
                  style={{ 
                    color: 'var(--text-2)', 
                    fontSize: 'var(--text-sm)',
                    fontStyle: 'italic',
                  }}
                >
                  Ten użytkownik Cię zablokował
                </span>
              ) : (
                <Button
                  variant={blockedStatus.isBlocked ? 'secondary' : 'danger'}
                  size="small"
                  onClick={onToggleBlock}
                  aria-label={blockedStatus.isBlocked ? 'Odblokuj użytkownika' : 'Zablokuj użytkownika'}
                >
                  {blockedStatus.isBlocked ? 'Odblokuj' : 'Zablokuj użytkownika'}
                </Button>
              )}
            </div>
          )}

          {/* Social Actions */}
          {!blockedStatus?.isBlocked && !blockedStatus?.isBlockedBy && (
            <div style={{ marginTop: 'var(--spacing-4)' }}>
              <ProfileSocialActions
                userId={profile.id}
                displayName={displayName}
                socialStats={socialStats}
                isOwnProfile={isOwnProfile}
                onFriendshipChanged={onFriendshipChanged}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});


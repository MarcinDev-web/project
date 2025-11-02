import { useState, useEffect, useCallback } from 'react';
import { profilesApi, type UserProfile, type ProfileSocialStats, type UserForumActivity } from '../api/profiles';
import { type MarketplaceItem } from '../api/marketplace';
import { usersApi, type BlockedStatus } from '../api/users';
import { useAuth } from '../contexts/AuthContext';

interface UseProfileOptions {
  userId: string | undefined;
  isOwnProfile: boolean;
}

interface UseProfileReturn {
  profile: UserProfile | null;
  builds: MarketplaceItem[];
  blockedStatus: BlockedStatus | null;
  socialStats: ProfileSocialStats | null;
  forumActivity: UserForumActivity | null;
  loading: boolean;
  error: string | null;
  loadProfile: () => Promise<void>;
  toggleBlock: () => Promise<void>;
  refreshSocialData: () => Promise<void>;
}

export function useProfile({ userId, isOwnProfile }: UseProfileOptions): UseProfileReturn {
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [builds, setBuilds] = useState<MarketplaceItem[]>([]);
  const [blockedStatus, setBlockedStatus] = useState<BlockedStatus | null>(null);
  const [socialStats, setSocialStats] = useState<ProfileSocialStats | null>(null);
  const [forumActivity, setForumActivity] = useState<UserForumActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setError('User ID is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const actualUserId = userId === 'me' ? currentUser?.id : userId;
      if (!actualUserId) {
        setError('User ID is required');
        return;
      }

      const [profileData, buildsData, statusData, socialStatsData, forumActivityData] = await Promise.all([
        profilesApi.getProfile(actualUserId),
        profilesApi.getUserBuilds(actualUserId),
        !isOwnProfile && currentUser 
          ? usersApi.getBlockedStatus(actualUserId).catch(() => null) 
          : Promise.resolve(null),
        // Load social stats (even for own profile, to show stats)
        profilesApi.getSocialStats(actualUserId).catch(() => null),
        // Load forum activity (optional, can fail if no activity)
        profilesApi.getUserForumActivity(actualUserId, 10).catch(() => null),
      ]);

      setProfile(profileData);
      setBuilds(buildsData);
      setBlockedStatus(statusData);
      setSocialStats(socialStatsData);
      setForumActivity(forumActivityData);
    } catch (err) {
      console.error('Failed to load profile:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('not found')) {
          setError('Profile not found');
        } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          setError('You need to be logged in to view this profile');
        } else {
          setError(`Failed to load profile: ${err.message}`);
        }
      } else {
        setError('Failed to load profile. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [userId, currentUser, isOwnProfile]);

  const refreshSocialData = useCallback(async () => {
    if (!userId) return;

    try {
      const actualUserId = userId === 'me' ? currentUser?.id : userId;
      if (!actualUserId) return;

      const [socialStatsData, forumActivityData] = await Promise.all([
        profilesApi.getSocialStats(actualUserId).catch(() => null),
        profilesApi.getUserForumActivity(actualUserId, 10).catch(() => null),
      ]);

      setSocialStats(socialStatsData);
      setForumActivity(forumActivityData);
    } catch (err) {
      console.error('Failed to refresh social data:', err);
    }
  }, [userId, currentUser]);

  const toggleBlock = useCallback(async () => {
    if (!userId || userId === 'me' || !blockedStatus) return;

    try {
      if (blockedStatus.isBlocked) {
        await usersApi.unblockUser(userId);
        setBlockedStatus({ ...blockedStatus, isBlocked: false });
      } else {
        await usersApi.blockUser(userId);
        setBlockedStatus({ ...blockedStatus, isBlocked: true });
      }
    } catch (err) {
      console.error('Failed to toggle block:', err);
      throw err; // Re-throw to handle in component
    }
  }, [userId, blockedStatus]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profile,
    builds,
    blockedStatus,
    socialStats,
    forumActivity,
    loading,
    error,
    loadProfile,
    toggleBlock,
    refreshSocialData,
  };
}


import { useParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ProfileHero } from '../components/profile/ProfileHero';
import { ProfileSidebar } from '../components/profile/ProfileSidebar';
import { ProfileDashboard } from '../components/profile/ProfileDashboard';
import { ProfileActivityFeed } from '../components/profile/ProfileActivityFeed';
import { ProfileBuildsSection } from '../components/profile/ProfileBuildsSection';
import { ProfileLoadingSkeleton } from '../components/profile/LoadingSkeleton';
import { ErrorState } from '../components/profile/ErrorState';
import { useProfile } from '../hooks/useProfile';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { studioApi, type StudioStats as StudioStatsType } from '../api/studio';
import { useState, useEffect } from 'react';

// Import profile styles
import '../styles/profile.css';

/**
 * ProfilePage - Modern user profile dashboard
 * 
 * Features:
 * - Hero banner with user info
 * - Two-column layout on desktop
 * - Unified stats dashboard
 * - Activity feed
 * - Published builds grid
 */
export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  
  const isOwnProfile = id === 'me' || id === currentUser?.id;
  const [studioStats, setStudioStats] = useState<StudioStatsType | null>(null);
  const profileUserId = id === 'me' ? currentUser?.id : id;
  
  const {
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
  } = useProfile({ userId: id, isOwnProfile });

  useEffect(() => {
    if (profileUserId && isOwnProfile) {
      void loadStudioStats();
    }
  }, [profileUserId, isOwnProfile]);

  const loadStudioStats = async () => {
    if (!isOwnProfile) return;
    try {
      const stats = await studioApi.getStats();
      setStudioStats(stats);
    } catch (error) {
      // Studio might not exist yet, ignore
      console.debug('Studio stats not available:', error);
    }
  };

  const handleToggleBlock = async () => {
    try {
      await toggleBlock();
      const message = blockedStatus?.isBlocked 
        ? 'Użytkownik został odblokowany' 
        : 'Użytkownik został zablokowany';
      showToast(message, 'success');
    } catch (err) {
      console.error('Failed to toggle block:', err);
      showToast('Nie udało się zmienić statusu blokady', 'error');
    }
  };

  if (loading) {
    return (
      <Layout>
        <ProfileLoadingSkeleton />
      </Layout>
    );
  }

  if (error || !profile) {
    return (
      <Layout>
        <ErrorState 
          error={error || 'Profil nie został znaleziony'} 
          onRetry={loadProfile} 
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <div className="profile-layout">
          {/* Hero Header - Full Width */}
          <ProfileHero
            profile={profile}
            isOwnProfile={isOwnProfile}
            blockedStatus={blockedStatus}
            currentUser={currentUser}
            onToggleBlock={handleToggleBlock}
            socialStats={socialStats}
            onFriendshipChanged={refreshSocialData}
          />

          {/* Sidebar - Left Column on Desktop */}
          <ProfileSidebar
            socialStats={socialStats}
            studioStats={studioStats}
            userId={profile.id}
            isOwnProfile={isOwnProfile}
            loading={loading}
          />

          {/* Main Content - Right Column on Desktop */}
          <div className="profile-main">
            {/* Stats Dashboard */}
            <ProfileDashboard
              socialStats={socialStats}
              studioStats={studioStats}
              userId={profile.id}
              isOwnProfile={isOwnProfile}
              loading={loading}
            />

            {/* Forum Activity */}
            <ProfileActivityFeed
              activity={forumActivity}
              loading={loading}
              userId={profile.id}
            />

            {/* User Builds */}
            <ProfileBuildsSection
              builds={builds}
              userId={profile.id}
              isOwnProfile={isOwnProfile}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

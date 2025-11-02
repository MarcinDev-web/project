import { useParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { BuildsGrid } from '../components/profile/BuildsGrid';
import { ProfileStats } from '../components/profile/ProfileStats';
import { ProfileActivitySection } from '../components/profile/ProfileActivitySection';
import { ProfileLoadingSkeleton } from '../components/profile/LoadingSkeleton';
import { ErrorState } from '../components/profile/ErrorState';
import { useProfile } from '../hooks/useProfile';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { studioApi, type StudioStats as StudioStatsType } from '../api/studio';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * ProfilePage - wyświetla stronę profilu użytkownika
 * 
 * Obsługuje:
 * - Wyświetlanie profilu własnego (/profile/me) i innych użytkowników (/profile/:id)
 * - Ładowanie danych profilu i buildów
 * - Blokowanie/odblokowywanie użytkowników
 * - Obsługę błędów i stanów ładowania
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
        <ProfileHeader
          profile={profile}
          isOwnProfile={isOwnProfile}
          blockedStatus={blockedStatus}
          currentUser={currentUser}
          onToggleBlock={handleToggleBlock}
          socialStats={socialStats}
          onFriendshipChanged={refreshSocialData}
        />

        {/* Social Stats */}
        <ProfileStats 
          socialStats={socialStats}
          userId={profile.id}
          loading={loading}
        />

        {/* Studio Stats - only for own profile */}
        {isOwnProfile && studioStats && (
          <div style={{ marginBottom: 'var(--spacing-6)' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 'var(--spacing-4)',
            }}>
              <h2 style={{ margin: 0 }}>Statystyki Studia</h2>
              <Link to="/studio">
                <button style={{
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}>
                  Zarządzaj Studiem →
                </button>
              </Link>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 'var(--spacing-4)',
            }}>
              <div style={{ textAlign: 'center', padding: 'var(--spacing-4)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)' }}>
                  {studioStats.totalProjects}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>Projekty</div>
              </div>
              <div style={{ textAlign: 'center', padding: 'var(--spacing-4)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)' }}>
                  {studioStats.publishedProjects}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>Opublikowane</div>
              </div>
              <div style={{ textAlign: 'center', padding: 'var(--spacing-4)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)' }}>
                  {studioStats.totalViews.toLocaleString()}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>Wyświetlenia</div>
              </div>
            </div>
          </div>
        )}

        {/* Forum Activity */}
        <ProfileActivitySection
          activity={forumActivity}
          loading={loading}
          userId={profile.id}
        />

        {/* User Builds */}
        <BuildsGrid builds={builds} />
      </div>
    </Layout>
  );
}

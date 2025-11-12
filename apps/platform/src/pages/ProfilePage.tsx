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
import { Card } from '../components/shared/Card';

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
          isOwnProfile={isOwnProfile}
        />

        {/* Studio Stats - only for own profile */}
        {isOwnProfile && studioStats && (
          <div style={{ marginBottom: 'var(--spacing-6)' }}>
            <Card hoverable={false} style={{
              background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark) 100%)',
              border: '2px solid var(--primary-color)',
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 'var(--spacing-6)',
              }}>
                <div>
                  <h2 style={{ 
                    margin: 0,
                    color: 'white',
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 'var(--font-bold)',
                  }}>
                    🎮 Studio
                  </h2>
                  <p style={{
                    margin: 'var(--spacing-2) 0 0 0',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    Zarządzaj swoimi projektami i śledź statystyki
                  </p>
                </div>
                <Link to="/studio">
                  <button style={{
                    padding: 'var(--spacing-3) var(--spacing-5)',
                    background: 'white',
                    color: 'var(--primary-color)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  >
                    Zarządzaj Studiem →
                  </button>
                </Link>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 'var(--spacing-4)',
              }}>
                <div style={{ 
                  textAlign: 'center', 
                  padding: 'var(--spacing-4)', 
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}>
                  <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--spacing-2)' }}>📁</div>
                  <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)', color: 'white' }}>
                    {studioStats.totalProjects}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255, 255, 255, 0.9)' }}>Projekty</div>
                </div>
                <div style={{ 
                  textAlign: 'center', 
                  padding: 'var(--spacing-4)', 
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}>
                  <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--spacing-2)' }}>🌐</div>
                  <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)', color: 'white' }}>
                    {studioStats.publishedProjects}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255, 255, 255, 0.9)' }}>Opublikowane</div>
                </div>
                <div style={{ 
                  textAlign: 'center', 
                  padding: 'var(--spacing-4)', 
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}>
                  <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--spacing-2)' }}>👁️</div>
                  <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)', color: 'white' }}>
                    {studioStats.totalViews.toLocaleString('pl-PL')}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255, 255, 255, 0.9)' }}>Wyświetlenia</div>
                </div>
                {studioStats.totalDownloads !== undefined && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: 'var(--spacing-4)', 
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}>
                    <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--spacing-2)' }}>⬇️</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)', color: 'white' }}>
                      {studioStats.totalDownloads.toLocaleString('pl-PL')}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255, 255, 255, 0.9)' }}>Pobrania</div>
                  </div>
                )}
                {studioStats.totalLikes !== undefined && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: 'var(--spacing-4)', 
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}>
                    <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--spacing-2)' }}>❤️</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)', color: 'white' }}>
                      {studioStats.totalLikes.toLocaleString('pl-PL')}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255, 255, 255, 0.9)' }}>Polubienia</div>
                  </div>
                )}
                {studioStats.studioRank !== undefined && studioStats.studioRank > 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: 'var(--spacing-4)', 
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}>
                    <div style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--spacing-2)' }}>🏆</div>
                    <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', marginBottom: 'var(--spacing-1)', color: 'white' }}>
                      #{studioStats.studioRank}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255, 255, 255, 0.9)' }}>Ranking</div>
                  </div>
                )}
              </div>
            </Card>
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

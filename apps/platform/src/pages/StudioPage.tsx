import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { studioApi, type StudioProject, type StudioStats as StudioStatsType, type AvatarPreset } from '../api/studio';
import { useToast } from '../contexts/ToastContext';
import { ProjectsList } from '../components/studio/ProjectsList';
import { AvatarsList } from '../components/studio/AvatarsList';
import { StudioLeaderboard } from '../components/studio/StudioLeaderboard';
import { TeamManagement } from '../components/studio/TeamManagement';
import { PublishModal } from '../components/studio/PublishModal';
import '../styles/studio.css';

export function StudioPage() {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [avatars, setAvatars] = useState<AvatarPreset[]>([]);
  const [stats, setStats] = useState<StudioStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'avatars' | 'leaderboard' | 'team'>('projects');
  const [publishModalProject, setPublishModalProject] = useState<StudioProject | null>(null);
  const [publishModalAvatar, setPublishModalAvatar] = useState<AvatarPreset | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsResponse, statsResponse, avatarsResponse] = await Promise.all([
        studioApi.getProjects(),
        studioApi.getStats(),
        studioApi.getAvatarPresets().catch(() => ({ presets: [] })), // Gracefully handle if API not available
      ]);
      setProjects(projectsResponse.projects);
      setStats(statsResponse);
      setAvatars(avatarsResponse.presets);
    } catch (error) {
      console.error('Failed to load studio data:', error);
      showToast('Nie udało się załadować danych studia', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten projekt?')) {
      return;
    }

    try {
      await studioApi.deleteProject(id);
      setProjects(projects.filter((p) => p.id !== id));
      showToast('Projekt usunięty', 'success');
      void loadData(); // Refresh stats
    } catch (error) {
      console.error('Failed to delete project:', error);
      showToast('Nie udało się usunąć projektu', 'error');
    }
  };

  const handlePublishProject = async (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    
    // Show modal instead of prompt
    setPublishModalProject(project);
  };

  const handlePublishSubmit = async (data: { title: string; description?: string; tags?: string[] }) => {
    if (publishModalProject) {
      try {
        await studioApi.publishProject(publishModalProject.id, data);
        showToast('Projekt opublikowany!', 'success');
        setPublishModalProject(null);
        void loadData(); // Refresh projects and stats
      } catch (error) {
        console.error('Failed to publish project:', error);
        const errorMessage = error instanceof Error ? error.message : 'Nie udało się opublikować projektu';
        showToast(errorMessage, 'error');
        throw error; // Re-throw so modal can handle it
      }
    } else if (publishModalAvatar) {
      try {
        await studioApi.publishAvatarPreset(publishModalAvatar.id, data);
        showToast('Avatar opublikowany!', 'success');
        setPublishModalAvatar(null);
        void loadData(); // Refresh avatars
      } catch (error) {
        console.error('Failed to publish avatar:', error);
        const errorMessage = error instanceof Error ? error.message : 'Nie udało się opublikować avatar';
        showToast(errorMessage, 'error');
        throw error; // Re-throw so modal can handle it
      }
    }
  };

  const handlePublishAvatar = async (preset: AvatarPreset) => {
    setPublishModalAvatar(preset);
  };

  const handleDeleteAvatar = async (id: string) => {
    setAvatars(avatars.filter((a) => a.id !== id));
  };

  if (loading) {
    return (
      <Layout>
        <div className="page-container">
          <div className="studio-loading">
            <p>Ładowanie studia...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container">
        <div className="studio-header">
          <div className="studio-header-content">
            <h1 className="studio-title">Moje Studio Gier</h1>
            <p className="studio-subtitle">Zarządzaj swoimi projektami i śledź statystyki</p>
          </div>
          <Link to="/editor">
            <Button variant="primary">Nowy Projekt</Button>
          </Link>
        </div>

        {stats && (
          <div className="studio-stats-overview">
            <Card>
              <div className="stat-item">
                <div className="stat-value">{stats.totalProjects}</div>
                <div className="stat-label">Wszystkie Projekty</div>
              </div>
            </Card>
            <Card>
              <div className="stat-item">
                <div className="stat-value">{stats.publishedProjects}</div>
                <div className="stat-label">Opublikowane</div>
              </div>
            </Card>
            <Card>
              <div className="stat-item">
                <div className="stat-value">{stats.totalViews.toLocaleString()}</div>
                <div className="stat-label">Wyświetlenia</div>
              </div>
            </Card>
            <Card>
              <div className="stat-item">
                <div className="stat-value">{stats.totalDownloads.toLocaleString()}</div>
                <div className="stat-label">Pobrania</div>
              </div>
            </Card>
            <Card>
              <div className="stat-item">
                <div className="stat-value">{stats.totalLikes.toLocaleString()}</div>
                <div className="stat-label">Polubienia</div>
              </div>
            </Card>
          </div>
        )}

        <div className="studio-tabs">
          <button
            className={`studio-tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projekty
          </button>
          <button
            className={`studio-tab ${activeTab === 'avatars' ? 'active' : ''}`}
            onClick={() => setActiveTab('avatars')}
          >
            Avatary
          </button>
          <button
            className={`studio-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Ranking
          </button>
          <button
            className={`studio-tab ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            Ekipa
          </button>
        </div>

        <div className="studio-content">
          {activeTab === 'projects' && (
            <div className="studio-projects-section">
              <ProjectsList
                projects={projects}
                onDelete={handleDeleteProject}
                onPublish={handlePublishProject}
                loading={loading}
              />
            </div>
          )}

          {activeTab === 'avatars' && (
            <div className="studio-avatars-section">
              <AvatarsList
                presets={avatars}
                onDelete={handleDeleteAvatar}
                onPublish={handlePublishAvatar}
                loading={loading}
              />
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="studio-leaderboard-section">
              <StudioLeaderboard />
            </div>
          )}

          {activeTab === 'team' && (
            <div className="studio-team-section">
              <TeamManagement />
            </div>
          )}
        </div>
      </div>
      
      {publishModalProject && (
        <PublishModal
          title="Opublikuj Projekt"
          defaultTitle={publishModalProject.name}
          defaultDescription={publishModalProject.description}
          defaultTags={publishModalProject.tags}
          onPublish={handlePublishSubmit}
          onCancel={() => setPublishModalProject(null)}
        />
      )}
      {publishModalAvatar && (
        <PublishModal
          title="Opublikuj Avatar"
          defaultTitle={publishModalAvatar.name}
          defaultDescription={publishModalAvatar.description}
          defaultTags={publishModalAvatar.tags}
          onPublish={handlePublishSubmit}
          onCancel={() => setPublishModalAvatar(null)}
        />
      )}
    </Layout>
  );
}


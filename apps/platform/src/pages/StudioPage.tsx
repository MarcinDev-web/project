import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { Button } from '../components/shared/Button';
import { studioApi, type StudioProject, type StudioStats as StudioStatsType } from '../api/studio';
import { useToast } from '../contexts/ToastContext';
import { ProjectsList } from '../components/studio/ProjectsList';
import { StudioStats } from '../components/studio/StudioStats';
import { StudioLeaderboard } from '../components/studio/StudioLeaderboard';
import { TeamManagement } from '../components/studio/TeamManagement';
import { StudioHealthCard } from '../components/studio/StudioHealthCard';
import { RevenueCard } from '../components/studio/RevenueCard';
import { StudioFocusGoals } from '../components/studio/StudioFocusGoals';
import { InsightsList } from '../components/studio/InsightsList';
import '../styles/studio.css';

export function StudioPage() {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [stats, setStats] = useState<StudioStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'stats' | 'leaderboard' | 'team'>('projects');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsResponse, statsResponse] = await Promise.all([
        studioApi.getProjects(),
        studioApi.getStats(),
      ]);
      setProjects(projectsResponse.projects);
      setStats(statsResponse);
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

    const title = window.prompt('Podaj tytuł dla publikacji:', project.name);
    if (!title || !title.trim()) {
      return;
    }

    const description = window.prompt('Opis (opcjonalnie):', project.description || '');
    const tagsInput = window.prompt('Tagi (oddzielone przecinkami):', (project.tags || []).join(', '));

    try {
      const trimmedDescription = description?.trim();
      const publishData: { title: string; description?: string; tags?: string[] } = {
        title: title.trim(),
      };
      
      if (trimmedDescription && trimmedDescription.length > 0) {
        publishData.description = trimmedDescription;
      }
      
      if (tagsInput) {
        const parsedTags = tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        if (parsedTags.length > 0) {
          publishData.tags = parsedTags;
        }
      }

      await studioApi.publishProject(id, publishData);
      showToast('Projekt opublikowany!', 'success');
      void loadData(); // Refresh projects and stats
    } catch (error) {
      console.error('Failed to publish project:', error);
      showToast('Nie udało się opublikować projektu', 'error');
    }
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
            className={`studio-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statystyki
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

          {activeTab === 'stats' && (
            <div className="studio-stats-section">
              <div className="stats-grid" style={{ display: 'grid', gap: '1rem' }}>
                <StudioHealthCard />
                <RevenueCard />
                <StudioFocusGoals />
                <StudioStats stats={stats} loading={loading} />
                <InsightsList />
              </div>
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
    </Layout>
  );
}


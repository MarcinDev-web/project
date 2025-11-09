import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi, type MarketplaceItem } from '../api/marketplace';
import '../styles/dashboard.css';

export function DashboardPage() {
  const { user } = useAuth();
  const [myBuilds, setMyBuilds] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyBuilds();
  }, [user]);

  const loadMyBuilds = async () => {
    if (!user) return;
    try {
      const response = await marketplaceApi.getBuilds({ limit: 100 });
      const userBuilds = response.items.filter(b => b.authorId === user.id);
      setMyBuilds(userBuilds);
    } catch (error) {
      console.error('Failed to load builds:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalViews = myBuilds.reduce((sum, b) => sum + (b.downloads || 0), 0);
  const totalLikes = myBuilds.reduce((sum, b) => sum + (b.likes || 0), 0);

  const actions = [
    {
      title: 'Launch Editor',
      description: 'Create and edit 3D scenes',
      link: '/editor',
      variant: 'primary' as const,
      icon: '🎨',
    },
    {
      title: 'Explore Marketplace',
      description: 'Browse community creations',
      link: '/marketplace',
      variant: 'secondary' as const,
      icon: '🛒',
    },
    {
      title: 'My Profile',
      description: 'View your published builds',
      link: '/profile/me',
      variant: 'secondary' as const,
      icon: '👤',
    },
  ];

  const stats = [
    { label: 'Projects', value: myBuilds.length.toString(), icon: '📁' },
    { label: 'Published', value: myBuilds.filter(b => b.public).length.toString(), icon: '🚀' },
    { label: 'Total Views', value: totalViews.toString(), icon: '👁️' },
    { label: 'Total Likes', value: totalLikes.toString(), icon: '❤️' },
  ];

  return (
    <Layout>
      <div className="page-container">
        {/* Hero Section with Stats */}
        <div className="dashboard-hero">
        <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">
                Welcome back, <span className="gradient-text">{user?.email?.split('@')[0] || 'Creator'}</span>
              </h1>
              <p className="dashboard-subtitle">
                Ready to build something amazing? Let's continue your journey.
              </p>
        </div>
        {user && (
              <div className="dashboard-meta">
                <span className="meta-badge">
                  <span className="badge-icon">✨</span>
                    Member since {new Date(user.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                      year: 'numeric'
                    })}
                </span>
              </div>
            )}
          </div>

          {/* Stats Grid - Premium Design */}
          <div className="stats-grid-modern">
            {stats.map((stat, index) => (
              <div 
                key={stat.label} 
                className="stat-card-modern"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="stat-card-inner">
                  <div className="stat-icon-wrapper">
                    <span className="stat-icon-modern">{stat.icon}</span>
                  </div>
                  <div className="stat-details">
                    <div className="stat-value-modern">{stat.value}</div>
                    <div className="stat-label-modern">{stat.label.toUpperCase()}</div>
                  </div>
                </div>
                <div className="stat-card-glow"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions - Card Grid */}
        <section className="dashboard-section">
          <h2 className="section-title">
            <span className="title-icon">⚡</span>
            Quick Actions
          </h2>
          <div className="actions-grid-modern">
            {actions.map((action, index) => (
              <Link 
                key={action.title} 
                to={action.link} 
                className={`action-card-modern ${action.variant === 'primary' ? 'action-card-primary' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="action-card-background"></div>
                <div className="action-card-content">
                  <div className="action-icon-modern">{action.icon}</div>
                  <h3 className="action-title-modern">{action.title}</h3>
                  <p className="action-description-modern">{action.description}</p>
                  <span className="action-arrow-modern">
                    <span>→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* My Projects */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="title-icon">📁</span>
              My Projects
            </h2>
            <Link to="/editor" className="new-project-button">
              <span className="button-icon">➕</span>
              <span>New Project</span>
            </Link>
          </div>
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading your projects...</p>
            </div>
          ) : myBuilds.length === 0 ? (
            <Card>
              <div className="empty-state-modern">
                <div className="empty-icon-modern">🎨</div>
                <h3 className="empty-title">No projects yet</h3>
                <p className="empty-description">
                  Start creating your first 3D scene and bring your ideas to life
                </p>
                <Link to="/editor" className="empty-cta-button">
                  <span>🚀</span>
                  <span>Launch Editor</span>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="projects-grid-modern">
              {myBuilds.slice(0, 6).map((build, index) => (
                <Link
                  key={build.id}
                  to={`/marketplace/${build.id}`}
                  className="project-card-modern"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="project-thumbnail">
                      {build.thumbnailUrl ? (
                      <img 
                        src={build.thumbnailUrl} 
                        alt={build.title}
                        className="project-image"
                      />
                    ) : (
                      <div className="project-placeholder">🎮</div>
                    )}
                    <div className="project-overlay">
                      <span className="overlay-text">View Project</span>
                    </div>
                  </div>
                  <div className="project-info">
                    <h3 className="project-title">{build.title}</h3>
                    <div className="project-meta">
                      <span className="meta-item">
                        <span className="meta-icon">👁️</span>
                        {build.downloads || 0}
                      </span>
                      <span className="meta-item">
                        <span className="meta-icon">❤️</span>
                        {build.likes || 0}
                      </span>
                      <span className={`status-badge ${build.public ? 'status-published' : 'status-draft'}`}>
                        {build.public ? '🟢 Published' : '🟡 Draft'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}



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
        <div className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Welcome back to Forge World</p>
        </div>

        {user && (
          <div className="dashboard-welcome">
            <Card>
              <div className="welcome-content">
                <div className="welcome-avatar">
                  <span className="avatar-icon">👤</span>
                </div>
                <div className="welcome-info">
                  <h2 className="welcome-name">Welcome, {user.email}!</h2>
                  <p className="welcome-meta">
                    Member since {new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Stats Grid */}
        <section className="dashboard-section">
          <h2 className="section-title">Your Stats</h2>
          <div className="stats-grid">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <div className="stat-card">
                  <span className="stat-icon">{stat.icon}</span>
                  <div className="stat-content">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="dashboard-section">
          <h2 className="section-title">Quick Actions</h2>
          <div className="actions-list">
            {actions.map((action) => (
              <Link 
                key={action.title} 
                to={action.link} 
                className={`action-item ${action.variant === 'primary' ? 'action-primary' : ''}`}
              >
                <span style={{ fontSize: '2rem' }}>{action.icon}</span>
                <div className="action-content">
                  <h3 className="action-title">{action.title}</h3>
                  <p className="action-description">{action.description}</p>
                </div>
                <span className="action-arrow">→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* My Projects */}
        <section className="dashboard-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
            <h2 className="section-title">My Projects</h2>
            <Link to="/editor" style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-semibold)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
            }}>
              <span>➕</span>
              <span>New Project</span>
            </Link>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-10)', color: 'var(--text-2)' }}>
              Loading projects...
            </div>
          ) : myBuilds.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: 'var(--spacing-10)' }}>
                <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-4)' }}>🎨</div>
                <h3 style={{ marginBottom: 'var(--spacing-2)', color: 'var(--text-1)' }}>No projects yet</h3>
                <p style={{ color: 'var(--text-2)', marginBottom: 'var(--spacing-6)' }}>
                  Start creating your first 3D scene
                </p>
                <Link
                  to="/editor"
                  style={{
                    padding: 'var(--spacing-3) var(--spacing-6)',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-semibold)',
                    display: 'inline-block',
                  }}
                >
                  Launch Editor
                </Link>
              </div>
            </Card>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--spacing-4)',
            }}>
              {myBuilds.slice(0, 6).map((build) => (
                <Link
                  key={build.id}
                  to={`/marketplace/${build.id}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Card>
                    <div style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '3rem',
                      marginBottom: 'var(--spacing-3)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      {build.thumbnailUrl ? (
                        <img src={build.thumbnailUrl} alt={build.title} style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-md)',
                        }} />
                      ) : '🎮'}
                    </div>
                    <h3 style={{
                      fontSize: 'var(--text-base)',
                      fontWeight: 'var(--font-semibold)',
                      marginBottom: 'var(--spacing-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {build.title}
                    </h3>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-3)',
                    }}>
                      <span>👁️ {build.downloads || 0}</span>
                      <span>❤️ {build.likes || 0}</span>
                      <span>{build.public ? '🟢 Published' : '🟡 Draft'}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}


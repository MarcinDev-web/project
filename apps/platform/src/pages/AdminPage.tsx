import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { useAuth } from '../contexts/AuthContext';

export function AdminPage() {
  const { user } = useAuth();

  const sections = [
    {
      title: 'User Management',
      description: 'Manage users, roles, and account status',
      link: '/admin/users',
      icon: '👥',
    },
    {
      title: 'System Statistics',
      description: 'View system-wide statistics and metrics',
      link: '/admin/stats',
      icon: '📊',
    },
    {
      title: 'Marketplace Moderation',
      description: 'Moderate marketplace items and content',
      link: '/admin/marketplace',
      icon: '🛍️',
    },
    {
      title: 'Shop Management',
      description: 'Manage shop items, assets, and marketplace prices',
      link: '/admin/shop',
      icon: '🛒',
    },
    {
      title: 'Project Management',
      description: 'Manage shared projects and user content',
      link: '/admin/projects',
      icon: '📁',
    },
    {
      title: 'Forum Management',
      description: 'Manage forum categories, threads, and posts',
      link: '/admin/forum',
      icon: '💬',
    },
    {
      title: 'News Management',
      description: 'Create and manage news articles',
      link: '/admin/news',
      icon: '📰',
    },
    {
      title: 'Support Management',
      description: 'Manage support tickets and FAQ',
      link: '/admin/support',
      icon: '🎫',
    },
  ];

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Admin Panel</h1>
          <p style={{ color: 'var(--text-secondary, #666)' }}>
            Welcome, {user?.username || user?.email}. Manage the platform from here.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {sections.map((section) => (
            <Link
              key={section.title}
              to={section.link}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <Card hoverable>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '2rem' }}>{section.icon}</span>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{section.title}</h2>
                </div>
                <p style={{ color: 'var(--text-secondary, #666)', margin: 0 }}>
                  {section.description}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}


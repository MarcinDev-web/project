import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card } from '../components/shared/Card';
import { useAuth } from '../contexts/AuthContext';

export function ModeratorPage() {
  const { user } = useAuth();

  const sections = [
    {
      title: 'Marketplace Moderation',
      description: 'Review and moderate marketplace items',
      link: '/moderator/marketplace',
      icon: '🛍️',
    },
    {
      title: 'User Moderation',
      description: 'Moderate users, handle reports, and warnings',
      link: '/moderator/users',
      icon: '👥',
    },
    {
      title: 'Message Review',
      description: 'Review user messages for reports',
      link: '/moderator/messages',
      icon: '💬',
    },
    {
      title: 'Forum Moderation',
      description: 'Moderate forum threads and posts',
      link: '/moderator/forum',
      icon: '📋',
    },
  ];

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Moderator Panel</h1>
          <p style={{ color: 'var(--text-secondary, #666)' }}>
            Welcome, {user?.username || user?.email}. Moderate platform content from here.
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


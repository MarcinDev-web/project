import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';

export function NotFoundPage() {
  return (
    <Layout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: 'var(--spacing-6)',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '4rem', marginBottom: 'var(--spacing-4)', fontWeight: 'bold' }}>
          404
        </h1>
        <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-2)' }}>
          Page Not Found
        </h2>
        <p style={{ marginBottom: 'var(--spacing-6)', color: 'var(--color-text-secondary)' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
          <Link
            to="/"
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              textDecoration: 'none',
              borderRadius: 'var(--radius-md)',
            }}
          >
            Go Home
          </Link>
          <Link
            to="/games"
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
            }}
          >
            Browse Games
          </Link>
        </div>
      </div>
    </Layout>
  );
}


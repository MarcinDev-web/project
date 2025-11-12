import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Layout } from '../layout/Layout';

export function RouteErrorElement() {
  const error = useRouteError();

  let errorMessage = 'An unexpected error occurred';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || `Error ${error.status}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

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
          {errorStatus}
        </h1>
        <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--spacing-2)' }}>
          {errorStatus === 404 ? 'Page Not Found' : 'Something went wrong'}
        </h2>
        <p style={{ marginBottom: 'var(--spacing-6)', color: 'var(--color-text-secondary)' }}>
          {errorMessage}
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
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </Layout>
  );
}


/**
 * Editor Page - redirects to editor app or embeds it
 */

import { useEffect } from 'react';

export function EditorPage() {
  useEffect(() => {
    // Redirect to editor app (separate app on port 5173)
    // In production, this could be a different domain or subdomain
    window.location.href = 'http://localhost:5173';
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-canvas)',
      color: 'var(--text-1)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1>Redirecting to Editor...</h1>
        <p style={{ color: 'var(--text-2)' }}>
          If you are not redirected automatically,{' '}
          <a href="http://localhost:5173" style={{ color: 'var(--color-accent-400)' }}>
            click here
          </a>
        </p>
      </div>
    </div>
  );
}


/**
 * Editor Page - redirects to editor app or embeds it
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function EditorPage() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Redirect to editor app (separate app on port 5173)
    // In production, this could be a different domain or subdomain
    // Tokeny są już w localStorage przez AuthContext, więc Editor automatycznie je wykryje
    const editorUrl = `http://localhost:5173${isAuthenticated ? '?authenticated=true' : ''}`;
    window.location.href = editorUrl;
  }, [isAuthenticated]);

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


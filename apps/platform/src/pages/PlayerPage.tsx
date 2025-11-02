/**
 * Player Page - redirects to player app
 */

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

export function PlayerPage() {
  const { buildId } = useParams<{ buildId: string }>();
  
  useEffect(() => {
    if (!buildId) {
      // No buildId, redirect to marketplace
      window.location.href = '/marketplace';
      return;
    }
    
    // Redirect to player app with buildId in query string
    // In production, this could be a different domain or subdomain
    const playerUrl = `http://localhost:5174?buildId=${encodeURIComponent(buildId)}`;
    window.location.href = playerUrl;
  }, [buildId]);

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
        <h1>Loading Game...</h1>
        <p style={{ color: 'var(--text-2)' }}>
          If you are not redirected automatically,{' '}
          <a href={`http://localhost:5174?buildId=${buildId}`} style={{ color: 'var(--color-accent-400)' }}>
            click here
          </a>
        </p>
      </div>
    </div>
  );
}


/**
 * Player Page - redirects to player app
 */

import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

const PLAYER_APP_URL = import.meta.env.VITE_PLAYER_URL ?? 'http://localhost:5175';

const buildPlayerUrl = (baseUrl: string, buildId: string): string => {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}buildId=${encodeURIComponent(buildId)}`;
};

export function PlayerPage() {
  const { buildId } = useParams<{ buildId: string }>();
  const playerUrl = useMemo(
    () => (buildId ? buildPlayerUrl(PLAYER_APP_URL, buildId) : ''),
    [buildId]
  );
  
  useEffect(() => {
    if (!buildId) {
      window.location.href = '/marketplace';
      return;
    }
    if (playerUrl) {
      window.location.replace(playerUrl);
    }
  }, [buildId, playerUrl]);

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
          <a href={playerUrl || '#'} style={{ color: 'var(--color-accent-400)' }}>
            click here
          </a>
        </p>
      </div>
    </div>
  );
}


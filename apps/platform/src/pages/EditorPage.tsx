/**
 * Editor Page - redirects to editor app or embeds it
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTokens } from '../utils/storage';

export function EditorPage() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (isLoading) {
      console.log('[Platform] Waiting for auth to load...');
      return;
    }
    // Redirect to editor app (separate app on port 5173)
    // In production, this could be a different domain or subdomain
    // Pass token via URL so editor can read it and store in localStorage
    // Always check token from localStorage directly, don't rely on isAuthenticated (timing issues)
    const { token, refreshToken } = getTokens();
    console.log('[Platform] Redirecting to editor - isAuthenticated:', isAuthenticated, 'token:', token ? 'present' : 'missing', 'refreshToken:', refreshToken ? 'present' : 'missing');
    console.log('[Platform] Token value:', token ? `${token.substring(0, 20)}...` : 'null');
    
    const params = new URLSearchParams();
    // Always pass token if it exists in localStorage, regardless of isAuthenticated state
    if (token) {
      params.set('token', token);
      if (refreshToken) {
        params.set('refreshToken', refreshToken);
      }
      console.log('[Platform] Token will be passed in URL');
    } else {
      console.warn('[Platform] No token available to pass to editor');
      console.warn('[Platform] localStorage keys:', Object.keys(localStorage));
    }
    const queryString = params.toString();
    const editorUrl = `http://localhost:5173${queryString ? `?${queryString}` : ''}`;
    console.log('[Platform] Redirecting to:', editorUrl.replace(/token=[^&]+/, 'token=***').replace(/refreshToken=[^&]+/, 'refreshToken=***'));
    console.log('[Platform] Full URL (for debugging):', editorUrl);
    window.location.href = editorUrl;
  }, [isAuthenticated, isLoading]);

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


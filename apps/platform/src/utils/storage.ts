/**
 * Local storage utilities for token management
 */

const TOKEN_KEY = 'forge_token';
const REFRESH_TOKEN_KEY = 'forge_refresh_token';

export interface TokenStorage {
  token: string | null;
  refreshToken: string | null;
}

export function getTokens(): TokenStorage {
  if (typeof window === 'undefined') {
    return { token: null, refreshToken: null };
  }

  return {
    token: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function setTokens(token: string, refreshToken: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}


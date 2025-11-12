/**
 * Authentication utilities for editor
 * Uses the same API as platform app
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface PublicUser {
  id: string;
  email: string;
  username?: string;
  createdAt: number;
  role?: 'user' | 'moderator' | 'admin' | 'root';
}

export interface Session {
  token: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

export interface LoginResponse {
  user: PublicUser;
  session: Session;
}

export interface RegisterResponse {
  user: PublicUser;
  session: Session;
}

const TOKEN_KEY = 'forge_token';
const REFRESH_TOKEN_KEY = 'forge_refresh_token';

/**
 * Get stored authentication tokens
 */
export function getTokens(): { token: string | null; refreshToken: string | null } {
  if (typeof window === 'undefined') {
    return { token: null, refreshToken: null };
  }
  return {
    token: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

/**
 * Store authentication tokens
 */
export function setTokens(token: string, refreshToken: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Clear authentication tokens
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const { token } = getTokens();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearTokens();
      }
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<PublicUser> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let errorMessage = 'Login failed';
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data: LoginResponse = await response.json();
  setTokens(data.session.token, data.session.refreshToken);
  return data.user;
}

/**
 * Register a new user
 */
export async function register(email: string, username: string, password: string): Promise<PublicUser> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, username, password }),
  });

  if (!response.ok) {
    let errorMessage = 'Registration failed';
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || errorMessage;
      // Handle validation errors
      if (response.status === 400 && 'errors' in error) {
        const validationErrors = (error as { errors?: Record<string, string[]> }).errors;
        if (validationErrors) {
          const firstError = Object.values(validationErrors)[0]?.[0];
          if (firstError) {
            errorMessage = firstError;
          }
        }
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data: RegisterResponse = await response.json();
  setTokens(data.session.token, data.session.refreshToken);
  return data.user;
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  const { token } = getTokens();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
    } catch {
      // Ignore errors on logout
    }
  }
  clearTokens();
}


/**
 * Authentication Context for managing user state
 */

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import { getTokens, setTokens, clearTokens } from '../utils/storage';
import type { PublicUser } from '../types/auth';

interface AuthContextType {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    const { token } = getTokens();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch {
      // Token might be invalid, clear it
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setTokens(response.session.token, response.session.refreshToken);
    setUser(response.user);
  };

  const register = async (email: string, username: string, password: string) => {
    const response = await authApi.register({ email, username, password });
    setTokens(response.session.token, response.session.refreshToken);
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if logout fails on server, clear local state
    }
    clearTokens();
    setUser(null);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isAdmin: user?.role === 'admin' || user?.role === 'root',
    isModerator: user?.role === 'moderator' || user?.role === 'admin' || user?.role === 'root',
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


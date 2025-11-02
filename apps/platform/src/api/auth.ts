/**
 * Authentication API calls
 */

import { apiClient } from './client';
import type { LoginRequest, RegisterRequest } from '@shared/types/auth';
import type { LoginResponse, RegisterResponse } from '../types/api';
import type { PublicUser } from '../types/auth';

export const authApi = {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>('/auth/register', data);
  },

  /**
   * Login with email and password
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', data);
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<PublicUser> {
    return apiClient.get<PublicUser>('/auth/me');
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};


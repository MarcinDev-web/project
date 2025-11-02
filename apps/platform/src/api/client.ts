/**
 * HTTP API Client with authentication handling
 */

import { getTokens, setTokens, clearTokens } from '../utils/storage';
import type { ApiError } from '../types/api';

const API_BASE_URL = '/api';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const { token } = getTokens();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      let error: ApiError;
      try {
        error = await response.json();
      } catch {
        error = {
          error: 'Request failed',
          message: response.statusText,
        };
      }

      // Handle 401 - unauthorized, clear tokens
      if (response.status === 401) {
        clearTokens();
        // Could redirect to login here if needed
      }

      // Preserve validation errors structure if present
      if (response.status === 400 && 'errors' in error) {
        const validationError = new Error(error.message || error.error || 'Validation failed');
        (validationError as unknown as { errors: unknown }).errors = error.errors;
        throw validationError;
      }

      throw new Error(error.message || error.error || 'Request failed');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const options: RequestInit = { method: 'POST' };
    if (data !== undefined) {
      options.body = JSON.stringify(data);
    }
    return this.request<T>(endpoint, options);
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const options: RequestInit = { method: 'PUT' };
    if (data !== undefined) {
      options.body = JSON.stringify(data);
    }
    return this.request<T>(endpoint, options);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    const { refreshToken } = getTokens();
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await this.post<{ session: { token: string; refreshToken: string } }>(
        '/auth/refresh',
        { refreshToken },
      );

      setTokens(response.session.token, response.session.refreshToken);
      return true;
    } catch {
      clearTokens();
      return false;
    }
  }
}

export const apiClient = new ApiClient();


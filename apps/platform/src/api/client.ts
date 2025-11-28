/**
 * HTTP API Client with authentication handling
 */

import { getTokens, setTokens, clearTokens } from '../utils/storage';
import type { ApiError } from '../types/api';

// Use environment variable if set (for production backend URL),
// otherwise use relative path (for same-origin requests or proxy)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const { token } = getTokens();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> | undefined),
    };

    // Only set Content-Type if there's a body
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

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

      // Create error with status code for better error handling
      const errorMessage = error.message || error.error || 'Request failed';
      const apiError = new Error(errorMessage) as Error & { status?: number; apiError?: ApiError };
      apiError.status = response.status;
      apiError.apiError = error;

      // Preserve validation errors structure if present
      if (response.status === 400 && 'errors' in error) {
        const validationError = apiError as Error & { errors: unknown };
        validationError.errors = error.errors;
        throw validationError;
      }

      throw apiError;
    }

    return response.json();
  }

  // Overload signatures for type safety
  async get<T>(endpoint: string, options?: { allow404?: false }): Promise<T>;
  async get<T>(endpoint: string, options: { allow404: true }): Promise<T | null>;
  async get<T>(endpoint: string, options?: { allow404?: boolean }): Promise<T | null> {
    try {
      return await this.request<T>(endpoint, { method: 'GET' });
    } catch (error) {
      // For optional resources (allow404=true), return null instead of throwing on 404
      if (options?.allow404) {
        const status = (error as Error & { status?: number })?.status;
        if (status === 404) {
          return null;
        }
      }
      throw error;
    }
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

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const options: RequestInit = { method: 'PATCH' };
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


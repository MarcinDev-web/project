/**
 * API response types matching net-server
 */

import type { PublicUser, Session } from './auth';

export interface ApiError {
  error: string;
  message?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// Auth responses
export interface LoginResponse {
  user: PublicUser;
  session: Session;
}

export interface RegisterResponse {
  user: PublicUser;
  session: Session;
}

export type { PublicUser, Session } from './auth';

// Generic pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


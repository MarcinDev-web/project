/**
 * Authentication types.
 */

/**
 * User role type.
 */
export type UserRole = 'user' | 'moderator' | 'admin';

/**
 * User account data.
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string; // bcrypt hash
  createdAt: number;
  updatedAt: number;
  active?: boolean; // User account status (default: true)
  role?: UserRole; // User role (default: 'user')
}

/**
 * User data without sensitive information.
 */
export interface PublicUser {
  id: string;
  email: string;
  createdAt: number;
  role?: UserRole;
}

/**
 * User registration request.
 */
export interface RegisterRequest {
  email: string;
  password: string;
}

/**
 * User login request.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Authentication session with JWT token.
 */
export interface Session {
  token: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

/**
 * JWT payload structure.
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role?: UserRole; // User role for quick verification
  jti?: string; // JWT ID for token revocation
  iat?: number;
  exp?: number;
}

/**
 * Authentication response.
 */
export interface AuthResponse {
  user: PublicUser;
  session: Session;
}

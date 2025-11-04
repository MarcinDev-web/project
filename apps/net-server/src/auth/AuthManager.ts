import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { UserStorage } from './UserStorage';
import { TokenBlacklistService } from './TokenBlacklistService';
import { securityLogger } from '../logging/SecurityLogger';
import type { User, PublicUser, Session, JWTPayload, AuthResponse } from '../types/auth';
import type { PrismaClient } from '../../node_modules/.prisma/net-client';

// Validate JWT_SECRET in production
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + '-refresh';

if (isProduction && (!process.env.JWT_SECRET || JWT_SECRET === 'change-me-in-production')) {
  throw new Error('JWT_SECRET must be set in production environment');
}

if (!isProduction && JWT_SECRET === 'change-me-in-production') {
  console.warn(
    '⚠️  WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable for production.'
  );
}

// Short-lived access tokens for better security (15 minutes)
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
// Increased bcrypt rounds for production security (12-14 is recommended, using 12 for balance)
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * Manages user authentication and sessions.
 */
export class AuthManager {
  private readonly userStorage: UserStorage;
  private readonly tokenBlacklist: TokenBlacklistService;
  private readonly failedLoginAttempts = new Map<
    string,
    { count: number; lockoutUntil?: number }
  >(); // email -> attempts
  private readonly ACCOUNT_LOCKOUT_THRESHOLD = 5; // Lock after 5 failed attempts
  private readonly ACCOUNT_LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(dataDir = './data', dbPool: PrismaClient | null = null) {
    this.userStorage = new UserStorage(dataDir);
    this.tokenBlacklist = new TokenBlacklistService(dataDir, dbPool);
  }

  /**
   * Initialize the auth manager (load user storage and token blacklist).
   */
  async initialize(): Promise<void> {
    await this.userStorage.initialize();
    await this.tokenBlacklist.initialize();
  }

  /**
   * Register a new user account.
   */
  async register(email: string, password: string): Promise<AuthResponse> {
    // Validate input
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new Error('Invalid email address');
    }

    // Validate password strength
    const passwordValidation = this.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.error);
    }

    // Check if email already exists
    if (await this.userStorage.emailExists(email)) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const user = await this.userStorage.saveUser(email, passwordHash);

    // Create session
    const session = await this.createSession(user);

    return {
      user: this.toPublicUser(user),
      session,
    };
  }

  /**
   * Login with email and password.
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const emailLower = email.toLowerCase();

    // Check for account lockout
    const attempts = this.failedLoginAttempts.get(emailLower);
    if (attempts?.lockoutUntil && attempts.lockoutUntil > Date.now()) {
      const remainingMinutes = Math.ceil((attempts.lockoutUntil - Date.now()) / 60000);
      throw new Error(`Account temporarily locked. Try again in ${remainingMinutes} minute(s).`);
    }

    // Find user
    const user = await this.userStorage.findUserByEmail(emailLower);
    if (!user) {
      // Record failed attempt
      this.recordFailedLogin(emailLower);
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // Record failed attempt
      this.recordFailedLogin(emailLower);
      throw new Error('Invalid email or password');
    }

    // Clear failed attempts on successful login
    this.failedLoginAttempts.delete(emailLower);

    // Log successful authentication
    // Note: IP and user agent should be passed from server.ts
    securityLogger.logAuthSuccess(user.id, user.email);

    // Create session
    const session = await this.createSession(user);

    return {
      user: this.toPublicUser(user),
      session,
    };
  }

  /**
   * Record a failed login attempt and lock account if threshold exceeded.
   */
  private recordFailedLogin(email: string): void {
    const attempts = this.failedLoginAttempts.get(email) ?? { count: 0 };
    attempts.count += 1;

    const isLocked = attempts.count >= this.ACCOUNT_LOCKOUT_THRESHOLD;
    if (isLocked) {
      attempts.lockoutUntil = Date.now() + this.ACCOUNT_LOCKOUT_DURATION;
      securityLogger.logAuthLockout(email);
    }

    this.failedLoginAttempts.set(email, attempts);
  }

  /**
   * Verify JWT token and return user.
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

      // Check token blacklist (persistent)
      if (payload.jti && this.tokenBlacklist.isBlacklisted(payload.jti)) {
        return null;
      }

      const user = await this.userStorage.findUserById(payload.userId);

      // Check if user exists and is active
      if (!user || user.active === false) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh a session using refresh token.
   * Implements token rotation - old refresh token is revoked, new tokens issued.
   */
  async refreshSession(refreshToken: string): Promise<Session | null> {
    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JWTPayload;

      // Check token blacklist (persistent)
      if (payload.jti && this.tokenBlacklist.isBlacklisted(payload.jti)) {
        return null;
      }

      const user = await this.userStorage.findUserById(payload.userId);

      // Check if user exists and is active
      if (!user || user.active === false) {
        return null;
      }

      // Token rotation: revoke old refresh token
      if (payload.jti) {
        const decoded = jwt.decode(refreshToken) as JWTPayload | null;
        if (decoded?.exp) {
          // Add old token to blacklist
          await this.tokenBlacklist.addToken(payload.jti, decoded.exp * 1000);
          securityLogger.logTokenRevoked(user.id, payload.jti, 'token_refresh_rotation');
        }
      }

      // Log token refresh
      securityLogger.logTokenRefresh(user.id);

      // Create new session (with new tokens)
      return await this.createSession(user);
    } catch (error) {
      return null;
    }
  }

  /**
   * Revoke a token by adding its jti to the persistent blacklist.
   */
  async revokeToken(token: string, userId?: string): Promise<boolean> {
    try {
      // Decode without verification to get jti and expiration
      const decoded = jwt.decode(token) as JWTPayload | null;
      if (decoded?.jti) {
        const expiresAt = decoded.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000; // Default 7 days
        await this.tokenBlacklist.addToken(decoded.jti, expiresAt);
        if (userId || decoded.userId) {
          securityLogger.logTokenRevoked(
            userId || decoded.userId,
            decoded.jti,
            'manual_revocation'
          );
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Verify token and return expiration time (for WebSocket re-verification).
   */
  async verifyTokenWithExpiration(
    token: string
  ): Promise<{ user: User | null; expiresAt: number | null }> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

      // Check token blacklist (persistent)
      if (payload.jti && this.tokenBlacklist.isBlacklisted(payload.jti)) {
        return { user: null, expiresAt: null };
      }

      const user = await this.userStorage.findUserById(payload.userId);

      // Check if user exists and is active
      if (!user || user.active === false) {
        return { user: null, expiresAt: null };
      }

      return {
        user,
        expiresAt: payload.exp ? payload.exp * 1000 : null, // Convert to milliseconds
      };
    } catch (error) {
      return { user: null, expiresAt: null };
    }
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    this.tokenBlacklist.dispose();
  }

  /**
   * Get user by ID.
   */
  async getUserById(userId: string): Promise<PublicUser | null> {
    const user = await this.userStorage.findUserById(userId);
    return user ? this.toPublicUser(user) : null;
  }

  /**
   * Create a new session for a user.
   */
  private async createSession(user: User): Promise<Session> {
    // Generate unique JWT IDs for token revocation
    const accessJti = randomBytes(16).toString('hex');
    const refreshJti = randomBytes(16).toString('hex');

    const accessPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role ?? 'user',
      jti: accessJti,
    };

    const refreshPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role ?? 'user',
      jti: refreshJti,
    };

    const token = jwt.sign(accessPayload as object, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(refreshPayload as object, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);

    // Calculate expiration time based on token expiry
    const decodedAccess = jwt.decode(token) as JWTPayload | null;
    const expiresAt = decodedAccess?.exp ? decodedAccess.exp * 1000 : Date.now() + 15 * 60 * 1000; // Default 15 minutes

    return {
      token,
      refreshToken,
      expiresAt,
      userId: user.id,
    };
  }

  /**
   * Validate password strength.
   */
  private validatePasswordStrength(password: string): { valid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }

    // Check for digit
    if (!/\d/.test(password)) {
      return { valid: false, error: 'Password must contain at least one digit' };
    }

    // Optional: warn about special characters (but don't require)
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      // Just a warning, not an error
    }

    return { valid: true };
  }

  /**
   * Convert User to PublicUser (remove sensitive data).
   */
  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      role: user.role ?? 'user',
    };
  }
}

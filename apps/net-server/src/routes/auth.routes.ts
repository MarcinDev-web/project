import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { RouteDependencies } from './index';
import type { AuthRequest } from '../auth/middleware';
import { validateBody } from '../validation/middleware';
import { registerSchema, loginSchema, refreshTokenSchema, logoutSchema } from '../validation/schemas/auth';
import { bodySizeLimit, BodySizeLimits } from '../middleware/bodySizeLimit';

/**
 * Create auth routes
 */
export function createAuthRoutes(deps: RouteDependencies): Router {
  const router = Router();
  const {
    authManager,
    authMiddleware,
    profileStorage,
    authLimiter,
    isProduction,
    securityLogger,
  } = deps;

  /**
   * POST /api/auth/register
   * Register a new user account.
   */
  router.post('/register',
    bodySizeLimit(BodySizeLimits.AUTH),
    authLimiter,
    validateBody(registerSchema),
    async (req: Request, res: Response) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      try {
        const body = req.body as z.infer<typeof registerSchema>;

        const result = await authManager.register(body.email, body.password);

        // Log successful registration
        securityLogger.logAuthSuccess(result.user.id, result.user.email, ip, userAgent);

        // Create profile for new user
        await profileStorage.createProfile(result.user);

        res.status(201).json(result);
      } catch (error) {
        console.error('Registration error:', error);
        const message = error instanceof Error ? error.message : String(error);

        // Log failed registration
        securityLogger.logAuthFailure(
          (req.body as { email?: string })?.email || 'unknown',
          message,
          ip,
          userAgent
        );

        const status = message.includes('already exists') ? 409 : 400;
        const errorMessage = isProduction && !message.includes('already exists')
          ? 'Registration failed'
          : message;

        res.status(status).json({
          error: 'Registration failed',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/auth/login
   * Login with email and password.
   */
  router.post('/login',
    bodySizeLimit(BodySizeLimits.AUTH),
    authLimiter,
    validateBody(loginSchema),
    async (req: Request, res: Response) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      try {
        const body = req.body as z.infer<typeof loginSchema>;

        const result = await authManager.login(body.email, body.password);

        // Log successful login (already logged in AuthManager, but add IP/userAgent)
        securityLogger.logAuthSuccess(result.user.id, result.user.email, ip, userAgent);

        res.json(result);
      } catch (error) {
        console.error('Login error:', error);
        const message = error instanceof Error ? error.message : 'Invalid email or password';

        // Log failed login (already logged in AuthManager, but add IP/userAgent)
        securityLogger.logAuthFailure(
          (req.body as { email?: string })?.email || 'unknown',
          message,
          ip,
          userAgent
        );

        const errorMessage = isProduction ? 'Invalid email or password' : message;
        res.status(401).json({
          error: 'Login failed',
          message: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/auth/me
   * Get current authenticated user.
   */
  router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await authManager.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get profile with extended data
      const profile = await profileStorage.getProfile(req.user.id);
      res.json(profile ?? user);
    } catch (error) {
      console.error('Get user error:', error);
      const message = isProduction
        ? 'Failed to get user'
        : error instanceof Error ? error.message : String(error);

      res.status(500).json({
        error: 'Failed to get user',
        message,
      });
    }
  });

  /**
   * POST /api/auth/refresh
   * Refresh authentication token using refresh token.
   */
  router.post('/refresh',
    bodySizeLimit(BodySizeLimits.AUTH),
    validateBody(refreshTokenSchema),
    async (req: Request, res: Response) => {
      try {
        const { refreshToken } = req.body as z.infer<typeof refreshTokenSchema>;

        const session = await authManager.refreshSession(refreshToken);
        if (!session) {
          return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        res.json({ session });
      } catch (error) {
        console.error('Refresh token error:', error);
        const message = isProduction
          ? 'Token refresh failed'
          : error instanceof Error ? error.message : 'Token refresh failed';

        res.status(401).json({
          error: 'Token refresh failed',
          message,
        });
      }
    }
  );

  /**
   * POST /api/auth/logout
   * Logout and revoke current session tokens.
   */
  router.post('/logout',
    authMiddleware,
    bodySizeLimit(BodySizeLimits.AUTH),
    validateBody(logoutSchema),
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.user?.id;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          await authManager.revokeToken(token, userId);
        }

        // Also revoke refresh token if provided
        const { refreshToken } = req.body as z.infer<typeof logoutSchema>;
        if (refreshToken) {
          await authManager.revokeToken(refreshToken, userId);
        }

        res.status(200).json({ success: true });
      } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
          error: 'Logout failed',
          message: isProduction ? 'Logout failed' : error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  return router;
}


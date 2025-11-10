import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RouteDependencies } from './index.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
} from '../validation/schemas/auth.js';
import { bodySizeLimit, BodySizeLimits } from '../middleware/bodySizeLimit.js';
import { validateBody } from '../validation/middleware.js';
import rateLimit from '@fastify/rate-limit';

/**
 * Create auth routes for Fastify
 */
export async function createAuthRoutes(
  app: FastifyInstance,
  opts: { dependencies: RouteDependencies }
): Promise<void> {
  const { authManager, authMiddleware, profileStorage, authLimiter, isProduction, securityLogger } =
    opts.dependencies;

  // Register rate limiter for auth routes only in production (skip in dev/test)
  if (isProduction) {
    await app.register(rateLimit, authLimiter);
  }

  /**
   * POST /api/auth/register
   * Register a new user account.
   */
  app.post(
    '/register',
    {
      preHandler: [bodySizeLimit(BodySizeLimits.AUTH), validateBody(registerSchema)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ip = request.ip || 'unknown';
      const userAgent = request.headers['user-agent'] || 'unknown';

      try {
        const body = request.body as { email: string; username: string; password: string };

        const result = await authManager.register(body.email, body.username, body.password);

        // Log successful registration
        securityLogger.logAuthSuccess(result.user.id, result.user.email, ip, userAgent);

        // Create profile for new user
        await profileStorage.createProfile(result.user);

        reply.code(201).send(result);
      } catch (error) {
        console.error('Registration error:', error);
        const message = error instanceof Error ? error.message : String(error);

        // Log failed registration
        securityLogger.logAuthFailure(
          (request.body as { email?: string })?.email || 'unknown',
          message,
          ip,
          userAgent
        );

        const status = message.includes('already exists') ? 409 : 400;
        const errorMessage =
          isProduction && !message.includes('already exists') ? 'Registration failed' : message;

        reply.code(status).send({
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
  app.post(
    '/login',
    {
      preHandler: [bodySizeLimit(BodySizeLimits.AUTH), validateBody(loginSchema)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ip = request.ip || 'unknown';
      const userAgent = request.headers['user-agent'] || 'unknown';

      try {
        const body = request.body as { email: string; password: string };
        
        // Debug logging in development
        if (!isProduction) {
          console.log('[Login] Request body:', { email: body?.email, passwordLength: body?.password?.length });
        }

        const result = await authManager.login(body.email, body.password);

        // Log successful login (already logged in AuthManager, but add IP/userAgent)
        securityLogger.logAuthSuccess(result.user.id, result.user.email, ip, userAgent);

        reply.send(result);
      } catch (error) {
        console.error('Login error:', error);
        const message = error instanceof Error ? error.message : 'Invalid email or password';

        // Log failed login (already logged in AuthManager, but add IP/userAgent)
        securityLogger.logAuthFailure(
          (request.body as { email?: string })?.email || 'unknown',
          message,
          ip,
          userAgent
        );

        const errorMessage = isProduction ? 'Invalid email or password' : message;
        reply.code(401).send({
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
  app.get(
    '/me',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const user = await authManager.getUserById(request.user.id);
        if (!user) {
          return reply.code(404).send({ error: 'User not found' });
        }

        // Get profile with extended data
        let profile;
        try {
          profile = await profileStorage.getProfile(request.user.id);
        } catch (profileError) {
          // Log but don't fail - fallback to user data
          console.warn('Failed to get profile for user', request.user.id, profileError);
          profile = null;
        }

        // Return profile if exists, otherwise return user
        const result = profile ?? user;
        reply.send(result);
      } catch (error) {
        console.error('Get user error:', error);
        const message = isProduction
          ? 'Failed to get user'
          : error instanceof Error
            ? error.message
            : String(error);

        reply.code(500).send({
          error: 'Failed to get user',
          message,
        });
      }
    }
  );

  /**
   * POST /api/auth/refresh
   * Refresh authentication token using refresh token.
   */
  app.post(
    '/refresh',
    {
      preHandler: [bodySizeLimit(BodySizeLimits.AUTH), validateBody(refreshTokenSchema)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { refreshToken } = request.body as { refreshToken: string };

        const session = await authManager.refreshSession(refreshToken);
        if (!session) {
          return reply.code(401).send({ error: 'Invalid or expired refresh token' });
        }

        reply.send({ session });
      } catch (error) {
        console.error('Refresh token error:', error);
        const message = isProduction
          ? 'Token refresh failed'
          : error instanceof Error
            ? error.message
            : 'Token refresh failed';

        reply.code(401).send({
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
  app.post(
    '/logout',
    {
      preHandler: [authMiddleware, bodySizeLimit(BodySizeLimits.AUTH), validateBody(logoutSchema)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.id;
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          await authManager.revokeToken(token, userId);
        }

        // Also revoke refresh token if provided
        const { refreshToken } = request.body as { refreshToken?: string };
        if (refreshToken) {
          await authManager.revokeToken(refreshToken, userId);
        }

        reply.code(200).send({ success: true });
      } catch (error) {
        console.error('Logout error:', error);
        reply.code(500).send({
          error: 'Logout failed',
          message: isProduction
            ? 'Logout failed'
            : error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }
  );
}

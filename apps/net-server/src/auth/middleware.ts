import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthManager } from './AuthManager';
import type { UserRole } from '../types/auth';

/**
 * Extend FastifyRequest to include user.
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role?: UserRole;
    };
  }
}

/**
 * Authentication hook for Fastify - verifies JWT token and attaches user to request.
 */
export function createAuthMiddleware(authManager: AuthManager) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'Missing or invalid authorization header' });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const user = await authManager.verifyToken(token);

      if (!user) {
        reply.code(401).send({ error: 'Invalid or expired token' });
        return;
      }

      // Attach user to request
      request.user = {
        id: user.id,
        email: user.email,
        role: user.role ?? 'user',
      };
    } catch (error) {
      reply.code(401).send({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Require admin role hook for Fastify.
 */
export function requireAdmin() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    if (request.user.role !== 'admin') {
      reply.code(403).send({ error: 'Forbidden: Admin access required' });
      return;
    }
  };
}

/**
 * Require moderator or admin role hook for Fastify.
 */
export function requireModerator() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    if (request.user.role !== 'admin' && request.user.role !== 'moderator') {
      reply.code(403).send({ error: 'Forbidden: Moderator access required' });
      return;
    }
  };
}

/**
 * Require specific role hook for Fastify.
 */
export function requireRole(role: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    if (request.user.role !== role) {
      // Admin can access everything
      if (request.user.role === 'admin') {
        return;
      }

      reply.code(403).send({ error: `Forbidden: ${role} access required` });
      return;
    }
  };
}

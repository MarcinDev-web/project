import type { Request, Response, NextFunction } from 'express';
import type { AuthManager } from './AuthManager';
import type { UserRole } from '../types/auth';

/**
 * Extend Express Request to include user.
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: UserRole;
  };
}

/**
 * Authentication middleware - verifies JWT token and attaches user to request.
 */
export function createAuthMiddleware(authManager: AuthManager) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const user = await authManager.verifyToken(token);

      if (!user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role ?? 'user',
      };

      next();
    } catch (error) {
      res.status(401).json({
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/**
 * Require admin role middleware.
 */
export function requireAdmin() {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    next();
  };
}

/**
 * Require moderator or admin role middleware.
 */
export function requireModerator() {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      res.status(403).json({ error: 'Forbidden: Moderator access required' });
      return;
    }

    next();
  };
}

/**
 * Require specific role middleware.
 */
export function requireRole(role: UserRole) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.user.role !== role) {
      // Admin can access everything
      if (req.user.role === 'admin') {
        next();
        return;
      }

      res.status(403).json({ error: `Forbidden: ${role} access required` });
      return;
    }

    next();
  };
}


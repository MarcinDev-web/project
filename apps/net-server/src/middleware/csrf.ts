/**
 * CSRF protection middleware.
 * Implements Double Submit Cookie pattern for CSRF protection.
 */

import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN';

/**
 * Generate a CSRF token.
 */
function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * CSRF token middleware.
 * Generates and sets CSRF token cookie for state-changing operations.
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate token if not present
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!existingToken) {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript for Double Submit Cookie
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
    // Store in request for validation
    (req as any).csrfToken = token;
  } else {
    (req as any).csrfToken = existingToken;
  }

  next();
}

/**
 * CSRF validation middleware.
 * Validates CSRF token for state-changing operations (POST, PUT, DELETE, PATCH).
 */
export function csrfValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only validate state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for GET/HEAD/OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  if (!cookieToken) {
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }

  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME.toLowerCase()] as string | undefined;
  if (!headerToken) {
    res.status(403).json({ error: 'CSRF token not provided in header' });
    return;
  }

  // Validate tokens match (Double Submit Cookie pattern)
  if (cookieToken !== headerToken) {
    res.status(403).json({ error: 'CSRF token mismatch' });
    return;
  }

  next();
}

/**
 * Combined CSRF middleware - sets token and validates.
 * Use this for endpoints that need CSRF protection.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // First, ensure token exists (set if needed)
  csrfTokenMiddleware(req, res, () => {
    // Then validate for state-changing operations
    csrfValidationMiddleware(req, res, next);
  });
}

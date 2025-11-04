/**
 * CSRF protection middleware.
 * Implements Double Submit Cookie pattern for CSRF protection.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
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
 * CSRF token hook for Fastify.
 * Generates and sets CSRF token cookie for state-changing operations.
 */
export async function csrfTokenHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Generate token if not present
  const existingToken = request.cookies?.[CSRF_COOKIE_NAME];
  if (!existingToken) {
    const token = generateCsrfToken();
    reply.setCookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript for Double Submit Cookie
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 24 * 60 * 60, // 24 hours (in seconds for Fastify)
    });
    // Store in request for validation
    (request as any).csrfToken = token;
  } else {
    (request as any).csrfToken = existingToken;
  }
}

/**
 * CSRF validation hook for Fastify.
 * Validates CSRF token for state-changing operations (POST, PUT, DELETE, PATCH).
 */
export async function csrfValidationHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Only validate state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    return;
  }

  // Skip CSRF for GET/HEAD/OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return;
  }

  // Get token from cookie
  const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
  if (!cookieToken) {
    reply.code(403).send({ error: 'CSRF token missing' });
    return;
  }

  // Get token from header
  const headerToken = request.headers[CSRF_HEADER_NAME.toLowerCase()] as string | undefined;
  if (!headerToken) {
    reply.code(403).send({ error: 'CSRF token not provided in header' });
    return;
  }

  // Validate tokens match (Double Submit Cookie pattern)
  if (cookieToken !== headerToken) {
    reply.code(403).send({ error: 'CSRF token mismatch' });
    return;
  }
}

/**
 * Combined CSRF hook - sets token and validates.
 * Use this for endpoints that need CSRF protection.
 */
export async function csrfHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // First, ensure token exists (set if needed)
  await csrfTokenHook(request, reply);
  // Then validate for state-changing operations
  await csrfValidationHook(request, reply);
}

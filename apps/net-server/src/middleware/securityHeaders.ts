/**
 * Security headers middleware.
 * Implements comprehensive security headers for defense-in-depth.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { getCorsConfig } from '@shared/config/cors';

const isProduction = process.env.NODE_ENV === 'production';
const corsConfig = getCorsConfig();

function getAllowedSources(): string[] {
  const sources = new Set<string>(["'self'"]);
  for (const origin of corsConfig.exactOrigins) {
    sources.add(origin);
  }
  for (const pattern of corsConfig.wildcardOrigins) {
    sources.add(pattern.cspSource);
  }
  return [...sources];
}

/**
 * Generate Content Security Policy header.
 */
function getCSP(): string {
  // Allow same origin and configured frontend URLs
  const allowedSources = getAllowedSources();

  // In production, be more restrictive
  if (isProduction) {
    return [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${allowedSources.join(' ')}`, // Need unsafe-inline/eval for some tooling
      `style-src 'self' 'unsafe-inline' ${allowedSources.join(' ')}`,
      `img-src 'self' data: blob: ${allowedSources.join(' ')}`,
      `font-src 'self' data: ${allowedSources.join(' ')}`,
      `connect-src 'self' ws: wss: ${allowedSources.join(' ')}`, // WebSocket connections
      `frame-src 'none'`, // Prevent embedding
      `object-src 'none'`, // Prevent plugins
      `base-uri 'self'`, // Restrict base tag
      `form-action 'self'`, // Restrict form submissions
      `frame-ancestors 'none'`, // Prevent framing (X-Frame-Options alternative)
      `upgrade-insecure-requests`, // Force HTTPS
    ].join('; ');
  }

  // Development: more permissive
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${allowedSources.join(' ')}`,
    `style-src 'self' 'unsafe-inline' ${allowedSources.join(' ')}`,
    `img-src 'self' data: blob: ${allowedSources.join(' ')}`,
    `font-src 'self' data: ${allowedSources.join(' ')}`,
    `connect-src 'self' ws: wss: ${allowedSources.join(' ')}`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

/**
 * Security headers hook for Fastify.
 * Sets comprehensive security headers for all responses.
 */
export async function securityHeadersHook(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Content Security Policy - prevent XSS attacks
  reply.header('Content-Security-Policy', getCSP());

  // Prevent clickjacking
  reply.header('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  reply.header('X-Content-Type-Options', 'nosniff');

  // Referrer policy - limit referrer information
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature-Policy) - restrict browser features
  reply.header(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()',
    ].join(', ')
  );

  // HSTS - Force HTTPS in production
  if (isProduction) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // XSS Protection (legacy, but still useful)
  reply.header('X-XSS-Protection', '1; mode=block');

  // Don't cache sensitive responses by default
  if (!reply.getHeader('Cache-Control')) {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
  }
}


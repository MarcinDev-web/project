/**
 * Security headers middleware.
 * Implements comprehensive security headers for defense-in-depth.
 */

import type { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Generate Content Security Policy header.
 */
function getCSP(): string {
  // Allow same origin, and frontend URL
  const allowedOrigins = [FRONTEND_URL, "'self'"];
  
  // In production, be more restrictive
  if (isProduction) {
    return [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${allowedOrigins.join(' ')}`, // Need unsafe-inline/eval for some tooling
      `style-src 'self' 'unsafe-inline' ${allowedOrigins.join(' ')}`,
      `img-src 'self' data: blob: ${allowedOrigins.join(' ')}`,
      `font-src 'self' data: ${allowedOrigins.join(' ')}`,
      `connect-src 'self' ws: wss: ${allowedOrigins.join(' ')}`, // WebSocket connections
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
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${allowedOrigins.join(' ')}`,
    `style-src 'self' 'unsafe-inline' ${allowedOrigins.join(' ')}`,
    `img-src 'self' data: blob: ${allowedOrigins.join(' ')}`,
    `font-src 'self' data: ${allowedOrigins.join(' ')}`,
    `connect-src 'self' ws: wss: ${allowedOrigins.join(' ')}`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

/**
 * Security headers middleware.
 * Sets comprehensive security headers for all responses.
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // Content Security Policy - prevent XSS attacks
  res.setHeader('Content-Security-Policy', getCSP());

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer policy - limit referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature-Policy) - restrict browser features
  res.setHeader(
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
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // XSS Protection (legacy, but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Don't cache sensitive responses by default
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}


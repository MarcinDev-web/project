/**
 * Body size limit hook factory for Fastify.
 * Creates hook to limit request body size per endpoint.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Body size limit in bytes.
 */
export type BodySizeLimit = number | string; // number in bytes, or string like '10mb'

/**
 * Parse size string to bytes.
 */
function parseSize(size: BodySizeLimit): number {
  if (typeof size === 'number') {
    return size;
  }

  const match = size.match(/^(\d+)([kmg]?b?)$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();

  const multipliers: Record<string, number> = {
    '': 1,
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * Create body size limit hook for Fastify.
 */
export function bodySizeLimit(limit: BodySizeLimit) {
  const limitBytes = parseSize(limit);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Set content length limit
    const contentLength = request.headers['content-length'];
    if (contentLength) {
      const length = parseInt(contentLength, 10);
      if (length > limitBytes) {
        reply.code(413).send({
          error: 'Request entity too large',
          message: `Request body exceeds maximum size of ${limit} (${length} bytes provided)`,
        });
        return;
      }
    }
  };
}

/**
 * Common size limits.
 */
export const BodySizeLimits = {
  AUTH: 1 * 1024 * 1024, // 1MB
  DEFAULT: 10 * 1024 * 1024, // 10MB
  MARKETPLACE_PUBLISH: 50 * 1024 * 1024, // 50MB
  FILE_UPLOAD: 100 * 1024 * 1024, // 100MB
} as const;


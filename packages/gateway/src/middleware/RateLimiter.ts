import { TokenBucket } from '@engine/net-server';
import type { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  capacity: number; // Max tokens
  refillPerSec: number; // Tokens per second
  keyGenerator?: (req: Request) => string; // Custom key (default: IP + userId)
}

export class GatewayRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      capacity: config.capacity,
      refillPerSec: config.refillPerSec,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
    };
  }

  private defaultKeyGenerator(req: Request): string {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req.body as { userId?: string }).userId || '';
    return `${ip}:${userId}`;
  }

  private getBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.config.capacity, this.config.refillPerSec);
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.config.keyGenerator(req);
      const bucket = this.getBucket(key);

      if (!bucket.allow(1)) {
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(1 / this.config.refillPerSec),
        });
      }

      next();
    };
  }

  // Cleanup old buckets periodically (call from cleanup task)
  cleanup(_olderThanMs = 300000): void {
    // This is a simplified cleanup - in production, use a proper TTL map
    // For now, buckets persist for the lifetime of the limiter
    // Consider implementing TTL-based cleanup or LRU cache
  }
}

// Pre-configured limiters for different endpoints
export const tokenEndpointLimiter = new GatewayRateLimiter({
  capacity: 10, // 10 requests
  refillPerSec: 1, // 1 per second (10 requests per 10 seconds)
});

export const healthEndpointLimiter = new GatewayRateLimiter({
  capacity: 100, // More lenient for health checks
  refillPerSec: 10, // 10 per second
});


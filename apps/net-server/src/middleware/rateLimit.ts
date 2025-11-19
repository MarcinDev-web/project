import { TokenBucket } from '@engine/net-server';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface RateLimitConfig {
  capacity: number;
  refillPerSec: number;
  keyGenerator?: (req: FastifyRequest) => string;
}

export class FastifyRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      capacity: config.capacity,
      refillPerSec: config.refillPerSec,
      keyGenerator: config.keyGenerator || ((req) => req.ip || 'unknown'),
    };
  }

  // Hook function to be used with fastify.addHook
  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const key = this.config.keyGenerator(request);
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = new TokenBucket(this.config.capacity, this.config.refillPerSec);
      this.buckets.set(key, bucket);
    }

    if (!bucket.allow(1)) {
      reply.code(429).send({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(1 / this.config.refillPerSec),
      });
      // Fastify hook: if we send a response, the request lifecycle stops here (if we return)
      // But in async hook, we just send and return.
      return;
    }
  }
}

// Global API rate limiter
// 60 requests burst, 10 requests per second sustained
export const apiRateLimiter = new FastifyRateLimiter({
  capacity: 60,
  refillPerSec: 10,
});

// Auth endpoint rate limiter (stricter)
// 10 requests burst, 1 request per second sustained
export const authRateLimiter = new FastifyRateLimiter({
  capacity: 10,
  refillPerSec: 1,
});


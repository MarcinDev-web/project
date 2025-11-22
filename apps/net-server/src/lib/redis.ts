import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Client for commands
export const redis = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  console.error('[Redis] Error:', err);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

export function getResaleKey(marketplaceId: string): string {
  return `marketplace:resale:${marketplaceId}`;
}

export function getCacheKey(prefix: string, id: string): string {
  return `cache:${prefix}:${id}`;
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}


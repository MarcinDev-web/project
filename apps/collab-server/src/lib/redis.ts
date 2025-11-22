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

// Client for subscriptions (Pub/Sub)
export const subRedis = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  console.error('[Redis] Error:', err);
});

subRedis.on('error', (err) => {
  console.error('[Redis] Sub Error:', err);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

export function getRoomKey(sessionId: string): string {
  return `collab:room:${sessionId}`;
}

export function getLockKey(sessionId: string, entityId: string): string {
  return `collab:lock:${sessionId}:${entityId}`;
}

export function getChannelKey(sessionId: string): string {
  return `collab:channel:${sessionId}`;
}

export function getPlayReqKey(requestId: string): string {
  return `collab:play_req:${requestId}`;
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  await subRedis.quit();
}


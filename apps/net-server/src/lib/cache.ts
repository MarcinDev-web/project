/**
 * Redis Cache Implementation
 */
import { redis, getCacheKey } from '../lib/redis.js';

export class RedisCache {
  /**
   * Get item from cache
   */
  async get<T>(prefix: string, id: string): Promise<T | null> {
    const key = getCacheKey(prefix, id);
    const data = await redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set item in cache
   */
  async set<T>(prefix: string, id: string, data: T, ttlSeconds = 300): Promise<void> {
    const key = getCacheKey(prefix, id);
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  }

  /**
   * Delete item from cache
   */
  async del(prefix: string, id: string): Promise<void> {
    const key = getCacheKey(prefix, id);
    await redis.del(key);
  }
}

export const redisCache = new RedisCache();


import { describe, it, expect, beforeEach } from 'vitest';
import { GroundDetectionCache } from '../../src/CharacterController/GroundDetectionCache';
import type { Vec3 } from '@engine/core/math';

describe('GroundDetectionCache', () => {
  let cache: GroundDetectionCache;
  let currentTime: number;

  beforeEach(() => {
    cache = new GroundDetectionCache(0.5, 0.1); // cellSize: 0.5m, maxAge: 0.1s
    currentTime = 0;
  });

  describe('spatial hash', () => {
    it('should generate correct cell keys', () => {
      const pos1: Vec3 = [0, 0, 0];
      const pos2: Vec3 = [0.3, 0, 0.3]; // Same cell (within 0.5m)
      const pos3: Vec3 = [0.6, 0, 0.6]; // Different cell

      cache.set(pos1, { isGrounded: true, groundNormal: [0, 1, 0] }, currentTime);
      
      const result1 = cache.get(pos1, currentTime);
      const result2 = cache.get(pos2, currentTime);
      const result3 = cache.get(pos3, currentTime);

      expect(result1).not.toBeNull();
      expect(result1?.isGrounded).toBe(true);
      expect(result2).not.toBeNull(); // Same cell
      expect(result3).toBeNull(); // Different cell
    });

    it('should cache results for same position', () => {
      const position: Vec3 = [1.0, 2.0, 3.0];
      const result = { isGrounded: true, groundNormal: [0, 1, 0] as Vec3 };

      cache.set(position, result, currentTime);
      const cached = cache.get(position, currentTime);

      expect(cached).not.toBeNull();
      expect(cached?.isGrounded).toBe(true);
      expect(cached?.groundNormal).toEqual([0, 1, 0]);
    });

    it('should return null for different positions in different cells', () => {
      const pos1: Vec3 = [0, 0, 0];
      const pos2: Vec3 = [1.0, 0, 1.0]; // Different cell

      cache.set(pos1, { isGrounded: true, groundNormal: [0, 1, 0] }, currentTime);
      const cached = cache.get(pos2, currentTime);

      expect(cached).toBeNull();
    });
  });

  describe('cache expiration', () => {
    it('should return cached result when not expired', () => {
      const position: Vec3 = [0, 0, 0];
      cache.set(position, { isGrounded: true, groundNormal: [0, 1, 0] }, currentTime);

      const cached = cache.get(position, currentTime + 0.05); // 0.05s < 0.1s maxAge
      expect(cached).not.toBeNull();
    });

    it('should return null when cache entry is expired', () => {
      const position: Vec3 = [0, 0, 0];
      cache.set(position, { isGrounded: true, groundNormal: [0, 1, 0] }, currentTime);

      const cached = cache.get(position, currentTime + 0.15); // 0.15s > 0.1s maxAge
      expect(cached).toBeNull();
    });

    it('should cleanup expired entries', () => {
      const pos1: Vec3 = [0, 0, 0];
      const pos2: Vec3 = [1, 0, 1];

      cache.set(pos1, { isGrounded: true, groundNormal: [0, 1, 0] }, currentTime);
      cache.set(pos2, { isGrounded: false, groundNormal: [0, 1, 0] }, currentTime + 0.05);

      expect(cache.size()).toBe(2);

      // Cleanup at time when pos1 is expired but pos2 is not
      cache.cleanup(currentTime + 0.15);

      expect(cache.size()).toBe(1);
      expect(cache.get(pos1, currentTime + 0.15)).toBeNull();
      expect(cache.get(pos2, currentTime + 0.15)).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', () => {
      const pos1: Vec3 = [0, 0, 0];
      const pos2: Vec3 = [1, 0, 1];

      cache.set(pos1, { isGrounded: true, groundNormal: [0, 1, 0] }, currentTime);
      cache.set(pos2, { isGrounded: false, groundNormal: [0, 1, 0] }, currentTime);

      expect(cache.size()).toBe(2);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get(pos1, currentTime)).toBeNull();
      expect(cache.get(pos2, currentTime)).toBeNull();
    });
  });

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(cache.size()).toBe(0);

      cache.set([0, 0, 0], { isGrounded: true, groundNormal: [0, 1, 0] }, currentTime);
      expect(cache.size()).toBe(1);

      cache.set([1, 0, 1], { isGrounded: false, groundNormal: [0, 1, 0] }, currentTime);
      expect(cache.size()).toBe(2);
    });
  });
});


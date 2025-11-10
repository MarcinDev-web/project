import { describe, it, expect, beforeEach } from 'vitest';
import { Vec3Pool, getVec3Pool } from '../../src/utils/Vec3Pool';
import type { Vec3 } from '@engine/core/math';

describe('Vec3Pool', () => {
  let pool: Vec3Pool;

  beforeEach(() => {
    pool = new Vec3Pool(10); // Small pool for testing
  });

  describe('acquire', () => {
    it('should return Vec3 from pool', () => {
      const vec = pool.acquire();
      expect(vec).toBeDefined();
      expect(Array.isArray(vec)).toBe(true);
      expect(vec.length).toBe(3);
    });

    it('should return new Vec3 when pool is empty', () => {
      const vec1 = pool.acquire();
      const vec2 = pool.acquire();
      expect(vec1).not.toBe(vec2);
    });

    it('should reuse Vec3 from pool after release', () => {
      const vec1 = pool.acquire();
      pool.release(vec1);
      const vec2 = pool.acquire();
      expect(vec2).toBe(vec1); // Should reuse same array
    });
  });

  describe('release', () => {
    it('should add Vec3 back to pool', () => {
      const vec = pool.acquire();
      pool.release(vec);
      expect(pool.size()).toBe(1);
    });

    it('should reset Vec3 values to zero', () => {
      const vec: Vec3 = [1, 2, 3];
      pool.release(vec);
      expect(vec[0]).toBe(0);
      expect(vec[1]).toBe(0);
      expect(vec[2]).toBe(0);
    });

    it('should not exceed maxSize', () => {
      const pool = new Vec3Pool(2);
      const vec1 = pool.acquire();
      const vec2 = pool.acquire();
      const vec3 = pool.acquire();
      
      pool.release(vec1);
      pool.release(vec2);
      pool.release(vec3);
      
      expect(pool.size()).toBe(2); // Should not exceed maxSize
    });
  });

  describe('clear', () => {
    it('should clear all Vec3 from pool', () => {
      const vec1 = pool.acquire();
      const vec2 = pool.acquire();
      pool.release(vec1);
      pool.release(vec2);
      
      expect(pool.size()).toBe(2);
      pool.clear();
      expect(pool.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return correct pool size', () => {
      expect(pool.size()).toBe(0);
      
      const vec1 = pool.acquire();
      const vec2 = pool.acquire();
      pool.release(vec1);
      
      expect(pool.size()).toBe(1);
      
      pool.release(vec2);
      expect(pool.size()).toBe(2);
    });
  });
});

describe('getVec3Pool', () => {
  it('should return singleton instance', () => {
    const pool1 = getVec3Pool();
    const pool2 = getVec3Pool();
    expect(pool1).toBe(pool2);
  });
});


import { describe, it, expect, beforeEach } from 'vitest';
import {
  SeededRNG,
  initGlobalRNG,
  getGlobalRNG,
  isGlobalRNGInitialized,
  resetGlobalRNG,
} from './SeededRNG';
import {
  expectDeterministicSequence,
  expectDifferentSeedsProduceDifferentSequences,
  expectStateSerializationPreservesDeterminism,
  expectCloneProducesIdenticalSequence,
} from '@engine/test-utils';

describe('SeededRNG', () => {
  describe('determinism', () => {
    it('produces same sequence for same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      const seq1 = Array.from({ length: 10 }, () => rng1.random());
      const seq2 = Array.from({ length: 10 }, () => rng2.random());

      expect(seq1).toEqual(seq2);
    });

    it('produces different sequences for different seeds', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(67890);

      const seq1 = Array.from({ length: 10 }, () => rng1.random());
      const seq2 = Array.from({ length: 10 }, () => rng2.random());

      expect(seq1).not.toEqual(seq2);
    });

    it('produces different sequences when state diverges', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);

      // Generate some numbers
      rng1.random();
      rng1.random();
      rng2.random();

      // Now sequences should differ
      const seq1 = Array.from({ length: 5 }, () => rng1.random());
      const seq2 = Array.from({ length: 5 }, () => rng2.random());

      expect(seq1).not.toEqual(seq2);
    });
  });

  describe('random', () => {
    it('returns numbers in range [0, 1)', () => {
      const rng = new SeededRNG(12345);
      for (let i = 0; i < 1000; i++) {
        const value = rng.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('produces diverse values over many calls', () => {
      const rng = new SeededRNG(12345);
      const values = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        values.add(rng.random());
      }
      // Should have many unique values
      expect(values.size).toBeGreaterThan(900);
    });
  });

  describe('randomInt', () => {
    it('returns integers in range [min, max]', () => {
      const rng = new SeededRNG(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.randomInt(5, 10);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it('handles single value range', () => {
      const rng = new SeededRNG(12345);
      expect(rng.randomInt(5, 5)).toBe(5);
    });

    it('handles negative ranges', () => {
      const rng = new SeededRNG(12345);
      const value = rng.randomInt(-10, -5);
      expect(value).toBeGreaterThanOrEqual(-10);
      expect(value).toBeLessThanOrEqual(-5);
    });
  });

  describe('randomFloat', () => {
    it('returns floats in range [min, max)', () => {
      const rng = new SeededRNG(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.randomFloat(5.5, 10.5);
        expect(value).toBeGreaterThanOrEqual(5.5);
        expect(value).toBeLessThan(10.5);
      }
    });
  });

  describe('randomBool', () => {
    it('returns boolean values', () => {
      const rng = new SeededRNG(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.randomBool();
        expect(typeof value).toBe('boolean');
      }
    });

    it('respects probability parameter', () => {
      const rng = new SeededRNG(12345);
      let trueCount = 0;
      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        if (rng.randomBool(0.3)) trueCount++;
      }
      // Should be approximately 30% (within 5% tolerance)
      const ratio = trueCount / iterations;
      expect(ratio).toBeGreaterThan(0.25);
      expect(ratio).toBeLessThan(0.35);
    });
  });

  describe('randomChoice', () => {
    it('returns element from array', () => {
      const rng = new SeededRNG(12345);
      const array = ['a', 'b', 'c', 'd', 'e'];
      for (let i = 0; i < 100; i++) {
        const choice = rng.randomChoice(array);
        expect(array).toContain(choice);
      }
    });

    it('throws on empty array', () => {
      const rng = new SeededRNG(12345);
      expect(() => rng.randomChoice([])).toThrow('Cannot pick from empty array');
    });
  });

  describe('shuffle', () => {
    it('shuffles array in-place', () => {
      const rng = new SeededRNG(12345);
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Larger array for better shuffle probability
      const original = [...array];
      const result = rng.shuffle(array);

      expect(result).toBe(array); // Same reference
      expect(array.sort()).toEqual(original.sort()); // Same elements
      // Very unlikely to be in same order after shuffle (but possible with some seeds)
      // Just verify shuffle was called and array has same elements
      expect(array.length).toBe(original.length);
    });

    it('produces deterministic shuffle with same seed', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(12345);
      const array1 = [1, 2, 3, 4, 5];
      const array2 = [1, 2, 3, 4, 5];

      rng1.shuffle(array1);
      rng2.shuffle(array2);

      expect(array1).toEqual(array2);
    });
  });

  describe('randomId', () => {
    it('generates string IDs', () => {
      const rng = new SeededRNG(12345);
      const id = rng.randomId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('includes prefix when provided', () => {
      const rng = new SeededRNG(12345);
      const id = rng.randomId('test');
      expect(id).toMatch(/^test_/);
    });
  });

  describe('state management', () => {
    it('getState returns current state', () => {
      const rng = new SeededRNG(12345);
      const state1 = rng.getState();
      rng.random();
      const state2 = rng.getState();
      expect(state2).not.toBe(state1);
    });

    it('setState updates state', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = new SeededRNG(0);

      rng1.random();
      rng1.random();
      const state = rng1.getState();

      rng2.setState(state);
      expect(rng2.getState()).toBe(state);

      // Should produce same sequence from this point
      const seq1 = Array.from({ length: 5 }, () => rng1.random());
      const seq2 = Array.from({ length: 5 }, () => rng2.random());
      expect(seq1).toEqual(seq2);
    });

    it('clone creates independent copy', () => {
      const rng1 = new SeededRNG(12345);
      const rng2 = rng1.clone();

      expect(rng2.getState()).toBe(rng1.getState());

      // Should produce same sequence
      const seq1 = Array.from({ length: 5 }, () => rng1.random());
      const seq2 = Array.from({ length: 5 }, () => rng2.random());
      expect(seq1).toEqual(seq2);
    });
  });

  describe('global RNG', () => {
    beforeEach(() => {
      // Reset global RNG before each test
      resetGlobalRNG();
    });

    it('initializes global RNG', () => {
      initGlobalRNG(12345);
      expect(isGlobalRNGInitialized()).toBe(true);
    });

    it('getGlobalRNG returns initialized RNG', () => {
      initGlobalRNG(12345);
      const rng = getGlobalRNG();
      expect(rng).toBeInstanceOf(SeededRNG);
    });

    it('getGlobalRNG throws if not initialized', () => {
      // Reset by initializing with 0 and then trying to use
      expect(() => getGlobalRNG()).toThrow('Global RNG not initialized');
    });

    it('produces deterministic sequence', () => {
      initGlobalRNG(12345);
      const seq1 = Array.from({ length: 10 }, () => getGlobalRNG().random());

      initGlobalRNG(12345);
      const seq2 = Array.from({ length: 10 }, () => getGlobalRNG().random());

      expect(seq1).toEqual(seq2);
    });
  });

  describe('determinism utilities integration', () => {
    it('expectDeterministicSequence works with SeededRNG', () => {
      expectDeterministicSequence((seed) => new SeededRNG(seed), 12345, 100);
    });

    it('expectDifferentSeedsProduceDifferentSequences works', () => {
      expectDifferentSeedsProduceDifferentSequences(
        (seed) => new SeededRNG(seed),
        12345,
        67890,
        100
      );
    });

    it('expectStateSerializationPreservesDeterminism works', () => {
      expectStateSerializationPreservesDeterminism((seed) => new SeededRNG(seed), 12345, 50);
    });

    it('expectCloneProducesIdenticalSequence works', () => {
      expectCloneProducesIdenticalSequence((seed) => new SeededRNG(seed), 12345, 100);
    });
  });
});

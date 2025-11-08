/**
 * Determinism Test Utilities
 *
 * Provides utilities for testing deterministic behavior in simulations.
 * Ensures that same inputs produce same outputs across runs.
 */
import { expect } from 'vitest';
import { normalizeForSnapshot } from '../snapshots/index.js';
/**
 * Test that a seeded RNG produces identical sequences for the same seed
 */
export function expectDeterministicSequence(rngFactory, seed, iterations = 100, options = {}) {
    const { tolerance = 1e-10 } = options;
    // Generate first sequence
    const rng1 = rngFactory(seed);
    const sequence1 = [];
    for (let i = 0; i < iterations; i++) {
        sequence1.push(rng1.random());
    }
    // Generate second sequence with same seed
    const rng2 = rngFactory(seed);
    const sequence2 = [];
    for (let i = 0; i < iterations; i++) {
        sequence2.push(rng2.random());
    }
    // Compare sequences
    expect(sequence1.length).toBe(sequence2.length);
    for (let i = 0; i < sequence1.length; i++) {
        expect(sequence1[i]).toBeCloseTo(sequence2[i], tolerance);
    }
}
/**
 * Test that different seeds produce different sequences
 */
export function expectDifferentSeedsProduceDifferentSequences(rngFactory, seed1, seed2, iterations = 100) {
    const rng1 = rngFactory(seed1);
    const rng2 = rngFactory(seed2);
    const sequence1 = [];
    const sequence2 = [];
    for (let i = 0; i < iterations; i++) {
        sequence1.push(rng1.random());
        sequence2.push(rng2.random());
    }
    // At least some values should differ
    let differences = 0;
    for (let i = 0; i < sequence1.length; i++) {
        if (Math.abs(sequence1[i] - sequence2[i]) > 1e-10) {
            differences++;
        }
    }
    expect(differences).toBeGreaterThan(0);
}
/**
 * Test that same inputs produce same snapshot (deterministic output)
 */
export function expectDeterministicSnapshot(factory, options = {}) {
    const { maxIterations = 2 } = options;
    const results = [];
    for (let i = 0; i < maxIterations; i++) {
        const result = factory();
        const normalized = normalizeForSnapshot(result, {
            normalizeEntityIds: true,
            normalizeRngState: true,
            ...options,
        });
        results.push(normalized);
    }
    // All results should be identical
    for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
    }
}
/**
 * Helper to set up RNG and sanitize context for determinism tests
 */
export function createDeterministicTestContext(seed, rngFactory, options = {}) {
    const rng = rngFactory(seed);
    const sanitize = (value) => {
        return normalizeForSnapshot(value, {
            normalizeEntityIds: true,
            normalizeRngState: true,
            ...options,
        });
    };
    return { rng, sanitize };
}
/**
 * Wrapper around normalizeForSnapshot with determinism-specific rules
 */
export function sanitizeForDeterminism(value, options = {}) {
    return normalizeForSnapshot(value, {
        normalizeEntityIds: true,
        normalizeRngState: true,
        sortArrays: true,
        ...options,
    });
}
/**
 * Test that state serialization/deserialization preserves determinism
 */
export function expectStateSerializationPreservesDeterminism(rngFactory, seed, iterations = 50) {
    // Create RNG and generate some values
    const rng1 = rngFactory(seed);
    for (let i = 0; i < iterations; i++) {
        rng1.random();
    }
    // Get state
    const state = rng1.getState();
    // Create new RNG from same seed and advance to same point
    const rng2 = rngFactory(seed);
    for (let i = 0; i < iterations; i++) {
        rng2.random();
    }
    // States should match
    expect(rng2.getState()).toBe(state);
    // Restore state and continue
    rng2.setState(state);
    const nextValue1 = rng1.random();
    const nextValue2 = rng2.random();
    expect(nextValue1).toBeCloseTo(nextValue2, 1e-10);
}
/**
 * Test that clone() produces identical sequences
 */
export function expectCloneProducesIdenticalSequence(rngFactory, seed, iterations = 100) {
    const rng1 = rngFactory(seed);
    const rng2 = rng1.clone();
    for (let i = 0; i < iterations; i++) {
        const value1 = rng1.random();
        const value2 = rng2.random();
        expect(value1).toBeCloseTo(value2, 1e-10);
    }
}
//# sourceMappingURL=index.js.map
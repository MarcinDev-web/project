/**
 * Determinism Test Utilities
 *
 * Provides utilities for testing deterministic behavior in simulations.
 * Ensures that same inputs produce same outputs across runs.
 */
import { type SnapshotOptions } from '../snapshots/index.js';
import type { SeededRNG } from '@engine/core/utils/SeededRNG';
/**
 * Options for determinism testing
 */
export interface DeterminismTestOptions extends SnapshotOptions {
    /**
     * Maximum number of iterations to test
     */
    maxIterations?: number;
    /**
     * Tolerance for floating point comparisons
     */
    tolerance?: number;
}
/**
 * Test that a seeded RNG produces identical sequences for the same seed
 */
export declare function expectDeterministicSequence(rngFactory: (seed: number) => SeededRNG, seed: number, iterations?: number, options?: DeterminismTestOptions): void;
/**
 * Test that different seeds produce different sequences
 */
export declare function expectDifferentSeedsProduceDifferentSequences(rngFactory: (seed: number) => SeededRNG, seed1: number, seed2: number, iterations?: number): void;
/**
 * Test that same inputs produce same snapshot (deterministic output)
 */
export declare function expectDeterministicSnapshot<T>(factory: () => T, options?: DeterminismTestOptions): void;
/**
 * Create a deterministic test context with RNG and sanitization
 */
export interface DeterministicTestContext {
    rng: SeededRNG;
    sanitize: <T>(value: T) => unknown;
}
/**
 * Helper to set up RNG and sanitize context for determinism tests
 */
export declare function createDeterministicTestContext(seed: number, rngFactory: (seed: number) => SeededRNG, options?: DeterminismTestOptions): DeterministicTestContext;
/**
 * Wrapper around normalizeForSnapshot with determinism-specific rules
 */
export declare function sanitizeForDeterminism<T>(value: T, options?: DeterminismTestOptions): unknown;
/**
 * Test that state serialization/deserialization preserves determinism
 */
export declare function expectStateSerializationPreservesDeterminism(rngFactory: (seed: number) => SeededRNG, seed: number, iterations?: number): void;
/**
 * Test that clone() produces identical sequences
 */
export declare function expectCloneProducesIdenticalSequence(rngFactory: (seed: number) => SeededRNG, seed: number, iterations?: number): void;
//# sourceMappingURL=index.d.ts.map
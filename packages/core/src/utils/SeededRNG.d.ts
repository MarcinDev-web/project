/**
 * Seeded Random Number Generator
 *
 * Provides deterministic random number generation for gameplay systems.
 * Uses Mulberry32 algorithm - fast and suitable for games.
 *
 * IMPORTANT: Use this for gameplay logic (items, critical hits, events)
 * to ensure deterministic simulation results.
 *
 * NOT RECOMMENDED for heavy procedural generation (terrain, large worlds).
 * For world generation, use Rust/WASM RNG (rand/pcg) for better performance
 * and quality.
 */
/**
 * Seeded RNG using Mulberry32 algorithm
 *
 * Fast, simple, and suitable for game simulation.
 * Produces deterministic sequences from a seed.
 */
export declare class SeededRNG {
    private state;
    /**
     * Creates a new seeded RNG instance
     *
     * @param seed - Initial seed value (integer). Same seed produces same sequence.
     */
    constructor(seed: number);
    /**
     * Generates a random number in range [0, 1)
     * Equivalent to Math.random() but deterministic
     *
     * @returns Random number between 0 (inclusive) and 1 (exclusive)
     */
    random(): number;
    /**
     * Generates a random integer in range [min, max] (inclusive)
     *
     * @param min - Minimum value (inclusive)
     * @param max - Maximum value (inclusive)
     * @returns Random integer between min and max
     */
    randomInt(min: number, max: number): number;
    /**
     * Generates a random number in range [min, max)
     *
     * @param min - Minimum value (inclusive)
     * @param max - Maximum value (exclusive)
     * @returns Random number between min and max
     */
    randomFloat(min: number, max: number): number;
    /**
     * Generates a random boolean
     *
     * @param probability - Probability of true (default 0.5)
     * @returns Random boolean
     */
    randomBool(probability?: number): boolean;
    /**
     * Picks a random element from an array
     *
     * @param array - Array to pick from
     * @returns Random element from array
     */
    randomChoice<T>(array: readonly T[]): T;
    /**
     * Shuffles an array in-place using Fisher-Yates algorithm
     *
     * @param array - Array to shuffle
     * @returns The same array (for chaining)
     */
    shuffle<T>(array: T[]): T[];
    /**
     * Generates a random string ID (for non-deterministic use cases like entity IDs)
     *
     * @param prefix - Optional prefix for the ID
     * @returns Random string ID
     */
    randomId(prefix?: string): string;
    /**
     * Gets the current seed state (for serialization/debugging)
     *
     * @returns Current seed state
     */
    getState(): number;
    /**
     * Sets the seed state (for deserialization/debugging)
     *
     * @param state - New seed state
     */
    setState(state: number): void;
    /**
     * Creates a copy of this RNG with the same state
     *
     * @returns New RNG instance with copied state
     */
    clone(): SeededRNG;
}
/**
 * Resets the global RNG (for testing/debugging)
 * @internal
 */
export declare function resetGlobalRNG(): void;
/**
 * Initializes the global RNG with a seed
 * Should be called once at game start with seed from PlayManifest
 *
 * @param seed - Initial seed value
 */
export declare function initGlobalRNG(seed: number): void;
/**
 * Gets the global RNG instance
 *
 * @returns Global RNG instance (throws if not initialized)
 */
export declare function getGlobalRNG(): SeededRNG;
/**
 * Checks if global RNG is initialized
 *
 * @returns True if global RNG is initialized
 */
export declare function isGlobalRNGInitialized(): boolean;
/**
 * Convenience function: random number [0, 1)
 * Uses global RNG if available, falls back to Math.random() with warning
 *
 * @deprecated Use getGlobalRNG().random() or create SeededRNG instance
 */
export declare function random(): number;
/**
 * Convenience function: random integer [min, max]
 * Uses global RNG if available
 *
 * @deprecated Use getGlobalRNG().randomInt(min, max) or create SeededRNG instance
 */
export declare function randomInt(min: number, max: number): number;
/**
 * Convenience function: random float [min, max)
 * Uses global RNG if available
 *
 * @deprecated Use getGlobalRNG().randomFloat(min, max) or create SeededRNG instance
 */
export declare function randomFloat(min: number, max: number): number;
//# sourceMappingURL=SeededRNG.d.ts.map
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
export class SeededRNG {
  private state: number;

  /**
   * Creates a new seeded RNG instance
   *
   * @param seed - Initial seed value (integer). Same seed produces same sequence.
   */
  constructor(seed: number) {
    // Ensure seed is an integer
    this.state = Math.floor(seed) || 0;
  }

  /**
   * Generates a random number in range [0, 1)
   * Equivalent to Math.random() but deterministic
   *
   * @returns Random number between 0 (inclusive) and 1 (exclusive)
   */
  random(): number {
    // Mulberry32 algorithm
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a random integer in range [min, max] (inclusive)
   *
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   * @returns Random integer between min and max
   */
  randomInt(min: number, max: number): number {
    min = Math.floor(min);
    max = Math.floor(max);
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Generates a random number in range [min, max)
   *
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)
   * @returns Random number between min and max
   */
  randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /**
   * Generates a random boolean
   *
   * @param probability - Probability of true (default 0.5)
   * @returns Random boolean
   */
  randomBool(probability: number = 0.5): boolean {
    return this.random() < probability;
  }

  /**
   * Picks a random element from an array
   *
   * @param array - Array to pick from
   * @returns Random element from array
   */
  randomChoice<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.randomInt(0, array.length - 1)]!;
  }

  /**
   * Shuffles an array in-place using Fisher-Yates algorithm
   *
   * @param array - Array to shuffle
   * @returns The same array (for chaining)
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
  }

  /**
   * Generates a random string ID (for non-deterministic use cases like entity IDs)
   *
   * @param prefix - Optional prefix for the ID
   * @returns Random string ID
   */
  randomId(prefix: string = ''): string {
    const suffix = this.random().toString(36).substring(2, 11);
    return prefix ? `${prefix}_${suffix}` : suffix;
  }

  /**
   * Gets the current seed state (for serialization/debugging)
   *
   * @returns Current seed state
   */
  getState(): number {
    return this.state;
  }

  /**
   * Sets the seed state (for deserialization/debugging)
   *
   * @param state - New seed state
   */
  setState(state: number): void {
    this.state = Math.floor(state) || 0;
  }

  /**
   * Creates a copy of this RNG with the same state
   *
   * @returns New RNG instance with copied state
   */
  clone(): SeededRNG {
    const cloned = new SeededRNG(0);
    cloned.setState(this.state);
    return cloned;
  }
}

/**
 * Global RNG instance (should be seeded from PlayManifest)
 * Use this for gameplay logic that needs randomness.
 *
 * WARNING: This is a shared instance. For independent sequences,
 * create new SeededRNG instances with different seeds.
 */
let globalRNG: SeededRNG | null = null;

/**
 * Resets the global RNG (for testing/debugging)
 * @internal
 */
export function resetGlobalRNG(): void {
  globalRNG = null;
}

/**
 * Initializes the global RNG with a seed
 * Should be called once at game start with seed from PlayManifest
 *
 * @param seed - Initial seed value
 */
export function initGlobalRNG(seed: number): void {
  globalRNG = new SeededRNG(seed);
}

/**
 * Gets the global RNG instance
 *
 * @returns Global RNG instance (throws if not initialized)
 */
export function getGlobalRNG(): SeededRNG {
  if (!globalRNG) {
    throw new Error(
      'Global RNG not initialized. Call initGlobalRNG(seed) first, or use PlayManifest.simulation.rngSeed'
    );
  }
  return globalRNG;
}

/**
 * Checks if global RNG is initialized
 *
 * @returns True if global RNG is initialized
 */
export function isGlobalRNGInitialized(): boolean {
  return globalRNG !== null;
}

/**
 * Convenience function: random number [0, 1)
 * Uses global RNG if available, falls back to Math.random() with warning
 *
 * @deprecated Use getGlobalRNG().random() or create SeededRNG instance
 */
export function random(): number {
  if (globalRNG) {
    return globalRNG.random();
  }
  console.warn(
    'Using Math.random() fallback. Initialize global RNG with initGlobalRNG(seed) for determinism.'
  );
  return Math.random();
}

/**
 * Convenience function: random integer [min, max]
 * Uses global RNG if available
 *
 * @deprecated Use getGlobalRNG().randomInt(min, max) or create SeededRNG instance
 */
export function randomInt(min: number, max: number): number {
  if (globalRNG) {
    return globalRNG.randomInt(min, max);
  }
  console.warn(
    'Using Math.random() fallback. Initialize global RNG with initGlobalRNG(seed) for determinism.'
  );
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Convenience function: random float [min, max)
 * Uses global RNG if available
 *
 * @deprecated Use getGlobalRNG().randomFloat(min, max) or create SeededRNG instance
 */
export function randomFloat(min: number, max: number): number {
  if (globalRNG) {
    return globalRNG.randomFloat(min, max);
  }
  console.warn(
    'Using Math.random() fallback. Initialize global RNG with initGlobalRNG(seed) for determinism.'
  );
  return Math.random() * (max - min) + min;
}

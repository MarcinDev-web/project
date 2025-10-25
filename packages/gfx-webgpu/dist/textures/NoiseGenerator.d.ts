/**
 * Advanced Noise Generator
 *
 * Implements Perlin and Simplex noise for high-quality procedural textures
 * Based on Ken Perlin's improved noise (2002) and Stefan Gustavson's Simplex noise
 */
/**
 * 2D Perlin Noise Generator
 * Classic Perlin noise with gradient interpolation
 */
export declare class PerlinNoise {
    private permutation;
    private p;
    constructor(seed?: number);
    /**
     * Shuffle permutation table with seed
     */
    private shuffle;
    /**
     * Seeded random number generator
     */
    private seededRandom;
    /**
     * Fade function (6t^5 - 15t^4 + 10t^3)
     */
    private fade;
    /**
     * Linear interpolation
     */
    private lerp;
    /**
     * Gradient function
     */
    private grad;
    /**
     * 2D Perlin noise
     * @param x X coordinate
     * @param y Y coordinate
     * @returns Noise value in range [-1, 1]
     */
    noise(x: number, y: number): number;
    /**
     * Octave noise (Fractal Brownian Motion)
     * @param x X coordinate
     * @param y Y coordinate
     * @param octaves Number of octaves
     * @param persistence Amplitude multiplier per octave
     * @param lacunarity Frequency multiplier per octave
     * @returns Noise value in range [-1, 1]
     */
    octaveNoise(x: number, y: number, octaves?: number, persistence?: number, lacunarity?: number): number;
}
/**
 * 2D Simplex Noise Generator
 * More efficient than Perlin noise with fewer directional artifacts
 */
export declare class SimplexNoise {
    private perm;
    private permMod12;
    private static readonly F2;
    private static readonly G2;
    private static readonly GRAD3;
    constructor(seed?: number);
    private shuffle;
    private seededRandom;
    /**
     * 2D Simplex noise
     * @param xin X coordinate
     * @param yin Y coordinate
     * @returns Noise value in range [-1, 1]
     */
    noise(xin: number, yin: number): number;
    private dot;
    /**
     * Octave noise (Fractal Brownian Motion)
     */
    octaveNoise(x: number, y: number, octaves?: number, persistence?: number, lacunarity?: number): number;
}
/**
 * Worley/Voronoi Noise (Cellular noise)
 * Useful for stone, organic patterns
 */
export declare class WorleyNoise {
    private seed;
    constructor(seed?: number);
    /**
     * Hash function for pseudo-random feature points
     */
    private hash;
    /**
     * Get feature point in cell
     */
    private getFeaturePoint;
    /**
     * Calculate Worley noise at point
     * @param x X coordinate
     * @param y Y coordinate
     * @param distanceFunc Distance metric: 'euclidean' | 'manhattan' | 'chebyshev'
     * @returns Distance to nearest feature point
     */
    noise(x: number, y: number, distanceFunc?: 'euclidean' | 'manhattan' | 'chebyshev'): number;
    /**
     * Calculate distance between points
     */
    private distance;
    /**
     * Get distances to N nearest feature points
     */
    noiseN(x: number, y: number, n?: number): number[];
}
/**
 * Utility functions for noise processing
 */
export declare class NoiseUtils {
    /**
     * Normalize noise from [-1, 1] to [0, 1]
     */
    static normalize(value: number): number;
    /**
     * Clamp value to range [0, 1]
     */
    static clamp01(value: number): number;
    /**
     * Apply power curve to noise
     */
    static power(value: number, exponent: number): number;
    /**
     * Remap value from one range to another
     */
    static remap(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number;
    /**
     * Create ridged noise (good for mountains)
     */
    static ridge(value: number): number;
    /**
     * Turbulence (absolute value of noise)
     */
    static turbulence(noise: PerlinNoise | SimplexNoise, x: number, y: number, octaves: number): number;
}
//# sourceMappingURL=NoiseGenerator.d.ts.map
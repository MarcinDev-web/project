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
export class PerlinNoise {
  private permutation: number[];
  private p: number[];

  constructor(seed?: number) {
    // Initialize permutation table
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }

    // Shuffle with seed
    if (seed !== undefined) {
      this.shuffle(seed);
    } else {
      this.shuffle(Math.random() * 65536);
    }

    // Duplicate for wrapping
    this.p = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.p[i] = this.permutation[i & 255]!;
    }
  }

  /**
   * Shuffle permutation table with seed
   */
  private shuffle(seed: number): void {
    const random = this.seededRandom(seed);
    for (let i = this.permutation.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j]!, this.permutation[i]!];
    }
  }

  /**
   * Seeded random number generator
   */
  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  /**
   * Fade function (6t^5 - 15t^4 + 10t^3)
   */
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Linear interpolation
   */
  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  /**
   * Gradient function
   */
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * 2D Perlin noise
   * @param x X coordinate
   * @param y Y coordinate
   * @returns Noise value in range [-1, 1]
   */
  public noise(x: number, y: number): number {
    // Find unit grid cell containing point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Get relative xy coordinates of point within cell
    x -= Math.floor(x);
    y -= Math.floor(y);

    // Compute fade curves
    const u = this.fade(x);
    const v = this.fade(y);

    // Hash coordinates of the 4 square corners
    const A = this.p[X]! + Y;
    const AA = this.p[A]!;
    const AB = this.p[A + 1]!;
    const B = this.p[X + 1]! + Y;
    const BA = this.p[B]!;
    const BB = this.p[B + 1]!;

    // Blend results from 4 corners
    return this.lerp(
      v,
      this.lerp(u, this.grad(this.p[AA]!, x, y), this.grad(this.p[BA]!, x - 1, y)),
      this.lerp(u, this.grad(this.p[AB]!, x, y - 1), this.grad(this.p[BB]!, x - 1, y - 1))
    );
  }

  /**
   * Octave noise (Fractal Brownian Motion)
   * @param x X coordinate
   * @param y Y coordinate
   * @param octaves Number of octaves
   * @param persistence Amplitude multiplier per octave
   * @param lacunarity Frequency multiplier per octave
   * @returns Noise value in range [-1, 1]
   */
  public octaveNoise(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

/**
 * 2D Simplex Noise Generator
 * More efficient than Perlin noise with fewer directional artifacts
 */
export class SimplexNoise {
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  // Skewing and unskewing factors for 2D simplex grid
  private static readonly F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  private static readonly G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

  // Gradient vectors for 2D
  private static readonly GRAD3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];

  constructor(seed?: number) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle
    if (seed !== undefined) {
      this.shuffle(p, seed);
    } else {
      this.shuffle(p, Math.random() * 65536);
    }

    // Duplicate permutation
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]!;
      this.permMod12[i] = this.perm[i]! % 12;
    }
  }

  private shuffle(array: Uint8Array, seed: number): void {
    const random = this.seededRandom(seed);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  /**
   * 2D Simplex noise
   * @param xin X coordinate
   * @param yin Y coordinate
   * @returns Noise value in range [-1, 1]
   */
  public noise(xin: number, yin: number): number {
    let n0, n1, n2; // Noise contributions from the three corners

    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin) * SimplexNoise.F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * SimplexNoise.G2;
    const X0 = i - t; // Unskew the cell origin back to (x,y) space
    const Y0 = j - t;
    const x0 = xin - X0; // The x,y distances from the cell origin
    const y0 = yin - Y0;

    // Determine which simplex we are in
    let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    const x1 = x0 - i1 + SimplexNoise.G2; // Offsets for middle corner in (x,y) unskewed coords
    const y1 = y0 - j1 + SimplexNoise.G2;
    const x2 = x0 - 1.0 + 2.0 * SimplexNoise.G2; // Offsets for last corner in (x,y) unskewed coords
    const y2 = y0 - 1.0 + 2.0 * SimplexNoise.G2;

    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]!]!;
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]!]!;
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]!]!;

    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0.0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(SimplexNoise.GRAD3[gi0]!, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0.0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(SimplexNoise.GRAD3[gi1]!, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0.0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(SimplexNoise.GRAD3[gi2]!, x2, y2);
    }

    // Add contributions from each corner to get the final noise value
    // The result is scaled to return values in the interval [-1,1]
    return 70.0 * (n0 + n1 + n2);
  }

  private dot(g: number[], x: number, y: number): number {
    return g[0]! * x + g[1]! * y;
  }

  /**
   * Octave noise (Fractal Brownian Motion)
   */
  public octaveNoise(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

/**
 * Worley/Voronoi Noise (Cellular noise)
 * Useful for stone, organic patterns
 */
export class WorleyNoise {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.random() * 65536;
  }

  /**
   * Hash function for pseudo-random feature points
   */
  private hash(x: number, y: number): number {
    let h = this.seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  }

  /**
   * Get feature point in cell
   */
  private getFeaturePoint(cellX: number, cellY: number): [number, number] {
    const hash = this.hash(cellX, cellY);
    const fx = cellX + (hash & 0xffff) / 0xffff;
    const fy = cellY + ((hash >>> 16) & 0xffff) / 0xffff;
    return [fx, fy];
  }

  /**
   * Calculate Worley noise at point
   * @param x X coordinate
   * @param y Y coordinate
   * @param distanceFunc Distance metric: 'euclidean' | 'manhattan' | 'chebyshev'
   * @returns Distance to nearest feature point
   */
  public noise(
    x: number,
    y: number,
    distanceFunc: 'euclidean' | 'manhattan' | 'chebyshev' = 'euclidean'
  ): number {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);

    let minDist = Infinity;

    // Check 9 neighboring cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [fx, fy] = this.getFeaturePoint(cellX + dx, cellY + dy);
        const dist = this.distance(x, y, fx, fy, distanceFunc);
        minDist = Math.min(minDist, dist);
      }
    }

    return minDist;
  }

  /**
   * Calculate distance between points
   */
  private distance(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    metric: 'euclidean' | 'manhattan' | 'chebyshev'
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;

    switch (metric) {
      case 'euclidean':
        return Math.sqrt(dx * dx + dy * dy);
      case 'manhattan':
        return Math.abs(dx) + Math.abs(dy);
      case 'chebyshev':
        return Math.max(Math.abs(dx), Math.abs(dy));
      default:
        return Math.sqrt(dx * dx + dy * dy);
    }
  }

  /**
   * Get distances to N nearest feature points
   */
  public noiseN(x: number, y: number, n: number = 2): number[] {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);

    const distances: number[] = [];

    // Check 9 neighboring cells
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [fx, fy] = this.getFeaturePoint(cellX + dx, cellY + dy);
        const dist = this.distance(x, y, fx, fy, 'euclidean');
        distances.push(dist);
      }
    }

    distances.sort((a, b) => a - b);
    return distances.slice(0, n);
  }
}

/**
 * Utility functions for noise processing
 */
export class NoiseUtils {
  /**
   * Normalize noise from [-1, 1] to [0, 1]
   */
  static normalize(value: number): number {
    return (value + 1) * 0.5;
  }

  /**
   * Clamp value to range [0, 1]
   */
  static clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Apply power curve to noise
   */
  static power(value: number, exponent: number): number {
    return Math.pow(value, exponent);
  }

  /**
   * Remap value from one range to another
   */
  static remap(
    value: number,
    fromMin: number,
    fromMax: number,
    toMin: number,
    toMax: number
  ): number {
    const normalized = (value - fromMin) / (fromMax - fromMin);
    return toMin + normalized * (toMax - toMin);
  }

  /**
   * Create ridged noise (good for mountains)
   */
  static ridge(value: number): number {
    return 1 - Math.abs(value);
  }

  /**
   * Turbulence (absolute value of noise)
   */
  static turbulence(noise: PerlinNoise | SimplexNoise, x: number, y: number, octaves: number): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += Math.abs(noise.noise(x * frequency, y * frequency)) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return total / maxValue;
  }
}


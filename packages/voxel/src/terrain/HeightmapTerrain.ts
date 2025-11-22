/**
 * HeightmapTerrain - Heightmap-based terrain system
 *
 * Manages heightmap data and provides operations for terrain editing.
 */

import type { Vec3 } from '@engine/core/math';
import type { HeightmapTerrainData } from '@engine/world/components/TerrainComponent';

import { init, type WasmVoxelEngine } from '@engine/wasm-voxel';

/**
 * Configuration for heightmap terrain
 */
export interface HeightmapTerrainConfig {
  resolution: number; // vertices per side (must be power of 2 + 1, e.g., 129, 257, 513)
  size: number; // world size in units
  minHeight?: number;
  maxHeight?: number;
}

/**
 * HeightmapTerrain - Manages heightmap data and operations
 */
export class HeightmapTerrain {
  private config: HeightmapTerrainConfig;
  private heights: Float32Array;
  private dirty = true;
  private static wasmEngine: WasmVoxelEngine | null = null;

  constructor(config: HeightmapTerrainConfig) {
    this.config = {
      minHeight: 0,
      maxHeight: 100,
      ...config,
    };

    if (!HeightmapTerrain.isValidResolution(config.resolution)) {
      throw new Error(
        `Heightmap resolution must be power of 2 + 1 (e.g., 65, 129, 257). Got: ${config.resolution}`
      );
    }

    const totalVertices = config.resolution * config.resolution;
    this.heights = new Float32Array(totalVertices);

    // Initialize WASM engine
    HeightmapTerrain.initWasm();
  }

  /**
   * Initialize WASM engine
   */
  static async initWasm(): Promise<void> {
    if (!this.wasmEngine) {
      try {
        this.wasmEngine = await init();
      } catch (e) {
        console.warn('Failed to load WASM voxel engine, falling back to JS', e);
      }
    }
  }

  /**
   * Validates if resolution is power of 2 + 1
   */
  static isValidResolution(n: number): boolean {
    return n > 1 && ((n - 1) & ((n - 1) - 1)) === 0;
  }

  /**
   * Gets the terrain configuration
   */
  getConfig(): Readonly<HeightmapTerrainConfig> {
    return { ...this.config };
  }

  /**
   * Gets the heightmap data
   */
  getHeights(): Float32Array {
    return this.heights;
  }

  /**
   * Gets height at world position (bilinear interpolation)
   */
  getHeightAt(worldX: number, worldZ: number): number {
    const { resolution, size } = this.config;
    const halfSize = size * 0.5;

    // Convert world position to normalized coordinates [-1, 1]
    const normalizedX = (worldX + halfSize) / size;
    const normalizedZ = (worldZ + halfSize) / size;

    // Clamp to valid range
    if (normalizedX < 0 || normalizedX > 1 || normalizedZ < 0 || normalizedZ > 1) {
      return 0;
    }

    // Convert to grid coordinates
    const gridX = normalizedX * (resolution - 1);
    const gridZ = normalizedZ * (resolution - 1);

    // Bilinear interpolation
    const x0 = Math.floor(gridX);
    const x1 = Math.min(x0 + 1, resolution - 1);
    const z0 = Math.floor(gridZ);
    const z1 = Math.min(z0 + 1, resolution - 1);

    const fx = gridX - x0;
    const fz = gridZ - z0;

    const h00 = this.getHeightAtGrid(x0, z0);
    const h10 = this.getHeightAtGrid(x1, z0);
    const h01 = this.getHeightAtGrid(x0, z1);
    const h11 = this.getHeightAtGrid(x1, z1);

    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    return h0 * (1 - fz) + h1 * fz;
  }

  /**
   * Gets height at grid coordinates (direct access)
   */
  getHeightAtGrid(x: number, z: number): number {
    const { resolution } = this.config;
    if (x < 0 || x >= resolution || z < 0 || z >= resolution) {
      return 0;
    }
    return this.heights[z * resolution + x]!;
  }

  /**
   * Sets height at grid coordinates
   */
  setHeightAtGrid(x: number, z: number, height: number): void {
    const { resolution, minHeight = 0, maxHeight = 100 } = this.config;
    if (x < 0 || x >= resolution || z < 0 || z >= resolution) {
      return;
    }

    const clampedHeight = Math.max(minHeight, Math.min(maxHeight, height));
    this.heights[z * resolution + x] = clampedHeight;
    this.dirty = true;
  }

  /**
   * Sets height at world position (modifies nearest grid points)
   */
  setHeightAt(worldX: number, worldZ: number, height: number, radius: number = 1): void {
    const { resolution, size } = this.config;
    const halfSize = size * 0.5;

    const normalizedX = (worldX + halfSize) / size;
    const normalizedZ = (worldZ + halfSize) / size;

    if (normalizedX < 0 || normalizedX > 1 || normalizedZ < 0 || normalizedZ > 1) {
      return;
    }

    const gridX = normalizedX * (resolution - 1);
    const gridZ = normalizedZ * (resolution - 1);

    const gridRadius = (radius / size) * (resolution - 1);

    // Apply height to grid points within radius
    const minX = Math.max(0, Math.floor(gridX - gridRadius));
    const maxX = Math.min(resolution - 1, Math.ceil(gridX + gridRadius));
    const minZ = Math.max(0, Math.floor(gridZ - gridRadius));
    const maxZ = Math.min(resolution - 1, Math.ceil(gridZ + gridRadius));

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x - gridX) / gridRadius;
        const dz = (z - gridZ) / gridRadius;
        const distSq = dx * dx + dz * dz;
        if (distSq <= 1) {
          const influence = 1 - Math.sqrt(distSq);
          const currentHeight = this.getHeightAtGrid(x, z);
          const newHeight = currentHeight + (height - currentHeight) * influence;
          this.setHeightAtGrid(x, z, newHeight);
        }
      }
    }
  }

  /**
   * Applies smooth operation to heightmap
   */
  smooth(iterations: number = 1): void {
    const { resolution } = this.config;
    let temp = new Float32Array(this.heights.length);

    for (let iter = 0; iter < iterations; iter++) {
      for (let z = 0; z < resolution; z++) {
        for (let x = 0; x < resolution; x++) {
          let sum = 0;
          let count = 0;

          // Average with neighbors
          for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const nz = z + dz;
              if (nx >= 0 && nx < resolution && nz >= 0 && nz < resolution) {
                sum += this.heights[nz * resolution + nx]!;
                count++;
              }
            }
          }

          temp[z * resolution + x] = sum / count;
        }
      }

      // Swap arrays
      const swap = this.heights;
      this.heights = temp;
      // Create new Float32Array to avoid ArrayBuffer vs SharedArrayBuffer type issues
      temp = new Float32Array(swap);
    }

    this.dirty = true;
  }

  /**
   * Generates noise using simple algorithm (can be extended with better noise)
   * @param seed - Optional seed for deterministic generation. Defaults to random.
   */
  generateNoise(scale: number = 1, amplitude: number = 10, seed?: number): void {
    const { resolution, size } = this.config;
    const { minHeight = 0, maxHeight = 100 } = this.config;
    
    // Use provided seed or random if not provided (for editor tools)
    // Note: For world generation, ALWAYS provide a seed.
    const actualSeed = seed !== undefined ? seed : Math.random() * 10000;

    // Try to use WASM implementation first
    if (HeightmapTerrain.wasmEngine) {
      try {
        const noiseData = HeightmapTerrain.wasmEngine.generateHeightmap(
          resolution,
          resolution,
          actualSeed, // seed
          scale / resolution, // scale adjustment for Perlin
          0, // offsetX
          0, // offsetZ
          4, // octaves
          0.5, // persistence
          2.0 // lacunarity
        );

        // Copy noise data to heights array and apply amplitude/base height
        const baseHeight = (minHeight + maxHeight) * 0.5;
        for (let i = 0; i < this.heights.length; i++) {
            this.heights[i] = baseHeight + noiseData[i]! * amplitude;
        }
        
        this.dirty = true;
        return;
      } catch (e) {
        console.warn('WASM noise generation failed, falling back to JS', e);
      }
    }

    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const nx = (x / resolution) * scale;
        const nz = (z / resolution) * scale;

        // Simple noise (can be replaced with Perlin/Simplex)
        const noise = Math.sin(nx * 10) * Math.cos(nz * 10) * amplitude;
        const baseHeight = (minHeight + maxHeight) * 0.5;
        this.heights[z * resolution + x] = baseHeight + noise;
      }
    }

    this.dirty = true;
  }

  /**
   * Normalizes heights to fit within minHeight and maxHeight
   */
  normalize(): void {
    const { minHeight = 0, maxHeight = 100 } = this.config;

    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < this.heights.length; i++) {
      const h = this.heights[i]!;
      if (h < min) min = h;
      if (h > max) max = h;
    }

    if (max === min) {
      return; // All heights are the same
    }

    const range = max - min;
    const targetRange = maxHeight - minHeight;

    for (let i = 0; i < this.heights.length; i++) {
      const normalized = (this.heights[i]! - min) / range;
      this.heights[i] = minHeight + normalized * targetRange;
    }

    this.dirty = true;
  }

  /**
   * Exports terrain data for TerrainComponent
   */
  exportData(): HeightmapTerrainData {
    const data: HeightmapTerrainData = {
      resolution: this.config.resolution,
      size: this.config.size,
      heights: new Float32Array(this.heights),
    };
    
    if (this.config.minHeight !== undefined) {
      data.minHeight = this.config.minHeight;
    }
    if (this.config.maxHeight !== undefined) {
      data.maxHeight = this.config.maxHeight;
    }
    
    return data;
  }

  /**
   * Imports terrain data from TerrainComponent
   */
  importData(data: HeightmapTerrainData): void {
    this.config.resolution = data.resolution;
    this.config.size = data.size;
    if (data.minHeight !== undefined) this.config.minHeight = data.minHeight;
    if (data.maxHeight !== undefined) this.config.maxHeight = data.maxHeight;

    this.heights = new Float32Array(data.heights);
    this.dirty = true;
  }

  /**
   * Uses existing terrain data (no copy)
   * Warning: This shares the buffer with the source data.
   */
  useData(data: HeightmapTerrainData): void {
    this.config.resolution = data.resolution;
    this.config.size = data.size;
    if (data.minHeight !== undefined) this.config.minHeight = data.minHeight;
    if (data.maxHeight !== undefined) this.config.maxHeight = data.maxHeight;

    this.heights = data.heights;
    this.dirty = true;
  }

  /**
   * Checks if terrain data is dirty (needs mesh regeneration)
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Marks terrain as clean (after mesh regeneration)
   */
  markClean(): void {
    this.dirty = false;
  }

  /**
   * Gets terrain bounds (AABB)
   */
  getBounds(): { min: Vec3; max: Vec3 } {
    const { size } = this.config;
    const halfSize = size * 0.5;

    // Find actual min/max heights
    let actualMin = Infinity;
    let actualMax = -Infinity;
    for (let i = 0; i < this.heights.length; i++) {
      const h = this.heights[i]!;
      if (h < actualMin) actualMin = h;
      if (h > actualMax) actualMax = h;
    }

    return {
      min: [-halfSize, actualMin, -halfSize],
      max: [halfSize, actualMax, halfSize],
    };
  }
}


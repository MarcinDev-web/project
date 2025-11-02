/**
 * HeightmapTerrain - Heightmap-based terrain system
 *
 * Manages heightmap data and provides operations for terrain editing.
 */
import type { Vec3 } from '@engine/core/math';
import type { HeightmapTerrainData } from '@engine/world/components/TerrainComponent';
/**
 * Configuration for heightmap terrain
 */
export interface HeightmapTerrainConfig {
    resolution: number;
    size: number;
    minHeight?: number;
    maxHeight?: number;
}
/**
 * HeightmapTerrain - Manages heightmap data and operations
 */
export declare class HeightmapTerrain {
    private config;
    private heights;
    private dirty;
    constructor(config: HeightmapTerrainConfig);
    /**
     * Gets the terrain configuration
     */
    getConfig(): Readonly<HeightmapTerrainConfig>;
    /**
     * Gets the heightmap data
     */
    getHeights(): Float32Array;
    /**
     * Gets height at world position (bilinear interpolation)
     */
    getHeightAt(worldX: number, worldZ: number): number;
    /**
     * Gets height at grid coordinates (direct access)
     */
    getHeightAtGrid(x: number, z: number): number;
    /**
     * Sets height at grid coordinates
     */
    setHeightAtGrid(x: number, z: number, height: number): void;
    /**
     * Sets height at world position (modifies nearest grid points)
     */
    setHeightAt(worldX: number, worldZ: number, height: number, radius?: number): void;
    /**
     * Applies smooth operation to heightmap
     */
    smooth(iterations?: number): void;
    /**
     * Generates noise using simple algorithm (can be extended with better noise)
     */
    generateNoise(scale?: number, amplitude?: number): void;
    /**
     * Normalizes heights to fit within minHeight and maxHeight
     */
    normalize(): void;
    /**
     * Exports terrain data for TerrainComponent
     */
    exportData(): HeightmapTerrainData;
    /**
     * Imports terrain data from TerrainComponent
     */
    importData(data: HeightmapTerrainData): void;
    /**
     * Checks if terrain data is dirty (needs mesh regeneration)
     */
    isDirty(): boolean;
    /**
     * Marks terrain as clean (after mesh regeneration)
     */
    markClean(): void;
    /**
     * Gets terrain bounds (AABB)
     */
    getBounds(): {
        min: Vec3;
        max: Vec3;
    };
}
//# sourceMappingURL=HeightmapTerrain.d.ts.map
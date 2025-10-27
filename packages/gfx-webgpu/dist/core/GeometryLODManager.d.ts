/**
 * Geometry LOD (Level of Detail) Manager
 *
 * Manages mesh LOD levels for efficient rendering.
 * Switches between different geometry complexity based on distance.
 *
 * Features:
 * - Multiple LOD levels per mesh
 * - Distance-based switching
 * - Smooth transitions (dithering/crossfade)
 * - Automatic LOD generation (future)
 */
export type GeometryLODLevel = 0 | 1 | 2 | 3;
export interface GeometryLODConfig {
    enabled: boolean;
    lodDistances: number[];
    useSmoothTransition: boolean;
    transitionRange: number;
    minScreenCoverage: number;
}
export interface LODMeshData {
    vertexCount: number;
    indexCount: number;
    vertexBuffer?: GPUBuffer;
    indexBuffer?: GPUBuffer;
}
export interface GeometryLODEntry {
    entityId: string;
    lods: Map<GeometryLODLevel, LODMeshData>;
    currentLOD: GeometryLODLevel;
    targetLOD: GeometryLODLevel;
    transitionProgress: number;
    distance: number;
    screenCoverage: number;
}
/**
 * GeometryLODManager manages mesh LOD levels.
 */
export declare class GeometryLODManager {
    private config;
    private entries;
    private device;
    constructor(device: GPUDevice, config?: Partial<GeometryLODConfig>);
    /**
     * Registers an entity with LOD levels.
     */
    registerEntity(entityId: string, lods: Map<GeometryLODLevel, LODMeshData>): void;
    /**
     * Unregisters an entity.
     */
    unregisterEntity(entityId: string): void;
    /**
     * Updates entity distance and screen coverage.
     */
    updateEntity(entityId: string, distance: number, screenCoverage: number): void;
    /**
     * Gets current LOD level for rendering.
     */
    getCurrentLOD(entityId: string): GeometryLODLevel | null;
    /**
     * Gets LOD mesh data for rendering.
     */
    getLODMeshData(entityId: string): LODMeshData | null;
    /**
     * Checks if entity should be culled (too far/small).
     */
    shouldCull(entityId: string): boolean;
    /**
     * Gets transition state for smooth LOD switches.
     */
    getTransitionState(entityId: string): {
        inTransition: boolean;
        fromLOD: GeometryLODLevel;
        toLOD: GeometryLODLevel;
        progress: number;
    } | null;
    /**
     * Updates all LOD states (call once per frame).
     */
    update(deltaTime: number): void;
    /**
     * Gets LOD statistics for monitoring.
     */
    getStats(): {
        totalEntities: number;
        lodDistribution: Map<GeometryLODLevel, number>;
        inTransition: number;
        culled: number;
    };
    /**
     * Disposes all resources.
     */
    dispose(): void;
    /**
     * Calculates target LOD based on distance.
     */
    private calculateTargetLOD;
    /**
     * Updates LOD transition progress.
     */
    private updateTransition;
    /**
     * Calculates screen coverage for an entity.
     * @param worldSize Size in world units
     * @param distance Distance from camera
     * @param viewportHeight Viewport height in pixels
     * @param fov Field of view in radians
     */
    static calculateScreenCoverage(worldSize: number, distance: number, viewportHeight: number, fov: number): number;
    /**
     * Generates LOD levels from base mesh (simplified).
     * In production, use proper mesh decimation algorithms.
     */
    static generateLODLevels(baseMesh: LODMeshData, lodCount: number): Map<GeometryLODLevel, LODMeshData>;
    /**
     * Updates configuration.
     */
    updateConfig(config: Partial<GeometryLODConfig>): void;
    /**
     * Gets current configuration.
     */
    getConfig(): GeometryLODConfig;
}
//# sourceMappingURL=GeometryLODManager.d.ts.map
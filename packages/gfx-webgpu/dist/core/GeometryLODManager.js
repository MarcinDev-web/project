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
import { Logger } from '@engine/core/utils';
const DEFAULT_CONFIG = {
    enabled: true,
    lodDistances: [10, 25, 50, 100], // LOD 0, 1, 2, 3, cull
    useSmoothTransition: true,
    transitionRange: 2.0, // 2 unit transition zone
    minScreenCoverage: 0.01, // 1% of screen
};
/**
 * GeometryLODManager manages mesh LOD levels.
 */
export class GeometryLODManager {
    config;
    entries = new Map();
    device;
    constructor(device, config) {
        this.device = device;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Registers an entity with LOD levels.
     */
    registerEntity(entityId, lods) {
        if (this.entries.has(entityId)) {
            Logger.warn(`Entity ${entityId} already registered for LOD`);
            return;
        }
        this.entries.set(entityId, {
            entityId,
            lods,
            currentLOD: 0,
            targetLOD: 0,
            transitionProgress: 1.0,
            distance: 0,
            screenCoverage: 1.0,
        });
    }
    /**
     * Unregisters an entity.
     */
    unregisterEntity(entityId) {
        this.entries.delete(entityId);
    }
    /**
     * Updates entity distance and screen coverage.
     */
    updateEntity(entityId, distance, screenCoverage) {
        const entry = this.entries.get(entityId);
        if (!entry)
            return;
        entry.distance = distance;
        entry.screenCoverage = screenCoverage;
        // Calculate target LOD based on distance
        const targetLOD = this.calculateTargetLOD(distance);
        if (targetLOD !== entry.targetLOD) {
            entry.targetLOD = targetLOD;
            entry.transitionProgress = 0.0; // Start transition
        }
        // Update transition progress
        if (entry.currentLOD !== entry.targetLOD) {
            this.updateTransition(entry);
        }
    }
    /**
     * Gets current LOD level for rendering.
     */
    getCurrentLOD(entityId) {
        const entry = this.entries.get(entityId);
        return entry ? entry.currentLOD : null;
    }
    /**
     * Gets LOD mesh data for rendering.
     */
    getLODMeshData(entityId) {
        const entry = this.entries.get(entityId);
        if (!entry)
            return null;
        return entry.lods.get(entry.currentLOD) ?? null;
    }
    /**
     * Checks if entity should be culled (too far/small).
     */
    shouldCull(entityId) {
        const entry = this.entries.get(entityId);
        if (!entry)
            return false;
        // Cull if beyond max LOD distance
        const maxDistance = this.config.lodDistances[this.config.lodDistances.length - 1];
        if (maxDistance !== undefined && entry.distance > maxDistance) {
            return true;
        }
        // Cull if screen coverage too small
        if (entry.screenCoverage < this.config.minScreenCoverage) {
            return true;
        }
        return false;
    }
    /**
     * Gets transition state for smooth LOD switches.
     */
    getTransitionState(entityId) {
        const entry = this.entries.get(entityId);
        if (!entry)
            return null;
        const inTransition = this.config.useSmoothTransition &&
            entry.currentLOD !== entry.targetLOD &&
            entry.transitionProgress < 1.0;
        return {
            inTransition,
            fromLOD: entry.currentLOD,
            toLOD: entry.targetLOD,
            progress: entry.transitionProgress,
        };
    }
    /**
     * Updates all LOD states (call once per frame).
     */
    update(deltaTime) {
        if (!this.config.enabled)
            return;
        for (const entry of this.entries.values()) {
            if (entry.currentLOD !== entry.targetLOD) {
                this.updateTransition(entry, deltaTime);
            }
        }
    }
    /**
     * Gets LOD statistics for monitoring.
     */
    getStats() {
        const lodDistribution = new Map([
            [0, 0],
            [1, 0],
            [2, 0],
            [3, 0],
        ]);
        let inTransition = 0;
        let culled = 0;
        for (const entry of this.entries.values()) {
            if (this.shouldCull(entry.entityId)) {
                culled++;
                continue;
            }
            const count = lodDistribution.get(entry.currentLOD) ?? 0;
            lodDistribution.set(entry.currentLOD, count + 1);
            if (entry.transitionProgress < 1.0) {
                inTransition++;
            }
        }
        return {
            totalEntities: this.entries.size,
            lodDistribution,
            inTransition,
            culled,
        };
    }
    /**
     * Disposes all resources.
     */
    dispose() {
        // Note: Buffers are managed externally, we just clear references
        this.entries.clear();
    }
    /**
     * Calculates target LOD based on distance.
     */
    calculateTargetLOD(distance) {
        const distances = this.config.lodDistances;
        for (let i = 0; i < distances.length - 1; i++) {
            const threshold = distances[i];
            if (threshold !== undefined && distance <= threshold) {
                return i;
            }
        }
        return Math.min(3, distances.length - 1);
    }
    /**
     * Updates LOD transition progress.
     */
    updateTransition(entry, deltaTime = 0.016) {
        if (!this.config.useSmoothTransition) {
            // Instant switch
            entry.currentLOD = entry.targetLOD;
            entry.transitionProgress = 1.0;
            return;
        }
        // Calculate transition speed based on distance change
        const transitionSpeed = 2.0; // Seconds for full transition
        entry.transitionProgress = Math.min(1.0, entry.transitionProgress + deltaTime / transitionSpeed);
        // Complete transition
        if (entry.transitionProgress >= 1.0) {
            entry.currentLOD = entry.targetLOD;
            entry.transitionProgress = 1.0;
        }
    }
    /**
     * Calculates screen coverage for an entity.
     * @param worldSize Size in world units
     * @param distance Distance from camera
     * @param viewportHeight Viewport height in pixels
     * @param fov Field of view in radians
     */
    static calculateScreenCoverage(worldSize, distance, viewportHeight, fov) {
        // Project world size to screen space
        const tanHalfFov = Math.tan(fov / 2);
        const screenHeight = (worldSize * viewportHeight) / (2 * distance * tanHalfFov);
        // Screen coverage as fraction of viewport
        return Math.max(0, Math.min(1, screenHeight / viewportHeight));
    }
    /**
     * Generates LOD levels from base mesh (simplified).
     * In production, use proper mesh decimation algorithms.
     */
    static generateLODLevels(baseMesh, lodCount) {
        const lods = new Map();
        // LOD 0 is the base mesh
        lods.set(0, baseMesh);
        // Generate simplified versions
        // This is a placeholder - real implementation would use mesh decimation
        for (let i = 1; i < lodCount && i <= 3; i++) {
            const reductionFactor = Math.pow(0.5, i); // 50% reduction per level
            const vertexCount = Math.max(3, Math.floor(baseMesh.vertexCount * reductionFactor));
            const indexCount = Math.max(3, Math.floor(baseMesh.indexCount * reductionFactor));
            lods.set(i, {
                vertexCount,
                indexCount,
                // Buffers would be created from decimated mesh
            });
        }
        return lods;
    }
    /**
     * Updates configuration.
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Gets current configuration.
     */
    getConfig() {
        return { ...this.config };
    }
}
//# sourceMappingURL=GeometryLODManager.js.map
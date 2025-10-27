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

import type { Entity } from '@engine/world';
import { Logger } from '@engine/core/utils';

export type GeometryLODLevel = 0 | 1 | 2 | 3; // 0 = highest detail, 3 = lowest

export interface GeometryLODConfig {
  enabled: boolean;
  lodDistances: number[]; // Distance thresholds for each LOD level
  useSmoothTransition: boolean; // Dithering for smooth LOD switches
  transitionRange: number; // Distance range for transition
  minScreenCoverage: number; // Min % screen coverage before culling
}

const DEFAULT_CONFIG: GeometryLODConfig = {
  enabled: true,
  lodDistances: [10, 25, 50, 100], // LOD 0, 1, 2, 3, cull
  useSmoothTransition: true,
  transitionRange: 2.0, // 2 unit transition zone
  minScreenCoverage: 0.01, // 1% of screen
};

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
  transitionProgress: number; // 0-1 for smooth transitions
  distance: number;
  screenCoverage: number; // % of screen (0-1)
}

/**
 * GeometryLODManager manages mesh LOD levels.
 */
export class GeometryLODManager {
  private config: GeometryLODConfig;
  private entries = new Map<string, GeometryLODEntry>();
  private device: GPUDevice;

  constructor(device: GPUDevice, config?: Partial<GeometryLODConfig>) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registers an entity with LOD levels.
   */
  registerEntity(
    entityId: string,
    lods: Map<GeometryLODLevel, LODMeshData>
  ): void {
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
  unregisterEntity(entityId: string): void {
    this.entries.delete(entityId);
  }

  /**
   * Updates entity distance and screen coverage.
   */
  updateEntity(
    entityId: string,
    distance: number,
    screenCoverage: number
  ): void {
    const entry = this.entries.get(entityId);
    if (!entry) return;

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
  getCurrentLOD(entityId: string): GeometryLODLevel | null {
    const entry = this.entries.get(entityId);
    return entry ? entry.currentLOD : null;
  }

  /**
   * Gets LOD mesh data for rendering.
   */
  getLODMeshData(entityId: string): LODMeshData | null {
    const entry = this.entries.get(entityId);
    if (!entry) return null;

    return entry.lods.get(entry.currentLOD) ?? null;
  }

  /**
   * Checks if entity should be culled (too far/small).
   */
  shouldCull(entityId: string): boolean {
    const entry = this.entries.get(entityId);
    if (!entry) return false;

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
  getTransitionState(entityId: string): {
    inTransition: boolean;
    fromLOD: GeometryLODLevel;
    toLOD: GeometryLODLevel;
    progress: number; // 0-1
  } | null {
    const entry = this.entries.get(entityId);
    if (!entry) return null;

    const inTransition =
      this.config.useSmoothTransition &&
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
  update(deltaTime: number): void {
    if (!this.config.enabled) return;

    for (const entry of this.entries.values()) {
      if (entry.currentLOD !== entry.targetLOD) {
        this.updateTransition(entry, deltaTime);
      }
    }
  }

  /**
   * Gets LOD statistics for monitoring.
   */
  getStats(): {
    totalEntities: number;
    lodDistribution: Map<GeometryLODLevel, number>;
    inTransition: number;
    culled: number;
  } {
    const lodDistribution = new Map<GeometryLODLevel, number>([
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
  dispose(): void {
    // Note: Buffers are managed externally, we just clear references
    this.entries.clear();
  }

  /**
   * Calculates target LOD based on distance.
   */
  private calculateTargetLOD(distance: number): GeometryLODLevel {
    const distances = this.config.lodDistances;

    for (let i = 0; i < distances.length - 1; i++) {
      const threshold = distances[i];
      if (threshold !== undefined && distance <= threshold) {
        return i as GeometryLODLevel;
      }
    }

    return Math.min(3, distances.length - 1) as GeometryLODLevel;
  }

  /**
   * Updates LOD transition progress.
   */
  private updateTransition(entry: GeometryLODEntry, deltaTime = 0.016): void {
    if (!this.config.useSmoothTransition) {
      // Instant switch
      entry.currentLOD = entry.targetLOD;
      entry.transitionProgress = 1.0;
      return;
    }

    // Calculate transition speed based on distance change
    const transitionSpeed = 2.0; // Seconds for full transition
    entry.transitionProgress = Math.min(
      1.0,
      entry.transitionProgress + deltaTime / transitionSpeed
    );

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
  static calculateScreenCoverage(
    worldSize: number,
    distance: number,
    viewportHeight: number,
    fov: number
  ): number {
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
  static generateLODLevels(
    baseMesh: LODMeshData,
    lodCount: number
  ): Map<GeometryLODLevel, LODMeshData> {
    const lods = new Map<GeometryLODLevel, LODMeshData>();
    
    // LOD 0 is the base mesh
    lods.set(0, baseMesh);

    // Generate simplified versions
    // This is a placeholder - real implementation would use mesh decimation
    for (let i = 1; i < lodCount && i <= 3; i++) {
      const reductionFactor = Math.pow(0.5, i); // 50% reduction per level
      const vertexCount = Math.max(3, Math.floor(baseMesh.vertexCount * reductionFactor));
      const indexCount = Math.max(3, Math.floor(baseMesh.indexCount * reductionFactor));

      lods.set(i as GeometryLODLevel, {
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
  updateConfig(config: Partial<GeometryLODConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration.
   */
  getConfig(): GeometryLODConfig {
    return { ...this.config };
  }
}


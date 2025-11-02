/**
 * TerrainSculptTool - Tool for interactive terrain sculpting
 *
 * Provides sculpting operations (raise, lower, smooth, flatten, pinch)
 * that modify heightmap terrain in real-time.
 */

import type { Entity } from '@engine/world';
import { TerrainComponent } from '@engine/world/components/TerrainComponent';
import { HeightmapTerrain } from '@engine/voxel/terrain';
import { TerrainBrush, type BrushOperation } from './TerrainBrush';
import type { Vec3 } from '@engine/core/math';
import { Logger } from '../../../utils/logger';

/**
 * Sculpting operation configuration
 */
export interface SculptOperationConfig {
  operation: BrushOperation;
  strength: number;
  targetHeight?: number; // For flatten operation
}

/**
 * TerrainSculptTool - Manages terrain sculpting operations
 */
export class TerrainSculptTool {
  private brush: TerrainBrush;
  private terrainEntity: Entity | null = null;
  private terrainComponent: TerrainComponent | null = null;
  private heightmapTerrain: HeightmapTerrain | null = null;
  private isActive = false;

  constructor(brush?: TerrainBrush) {
    this.brush = brush ?? new TerrainBrush();
  }

  /**
   * Sets the terrain entity to sculpt
   */
  setTerrainEntity(entity: Entity): void {
    const terrainComp = entity.getComponent(TerrainComponent);
    if (!terrainComp) {
      Logger.warn('[TerrainSculptTool] Entity does not have TerrainComponent');
      return;
    }

    if (terrainComp.terrainData.type !== 'heightmap' && terrainComp.terrainData.type !== 'hybrid') {
      Logger.warn('[TerrainSculptTool] Terrain must be heightmap or hybrid type');
      return;
    }

    this.terrainEntity = entity;
    this.terrainComponent = terrainComp;

    // Create HeightmapTerrain instance from component data
    if (terrainComp.terrainData.heightmap) {
      const heightmapData = terrainComp.terrainData.heightmap;
      const config: {
        resolution: number;
        size: number;
        minHeight?: number;
        maxHeight?: number;
      } = {
        resolution: heightmapData.resolution,
        size: heightmapData.size,
      };
      if (heightmapData.minHeight !== undefined) {
        config.minHeight = heightmapData.minHeight;
      }
      if (heightmapData.maxHeight !== undefined) {
        config.maxHeight = heightmapData.maxHeight;
      }
      this.heightmapTerrain = new HeightmapTerrain(config);
      this.heightmapTerrain.importData(heightmapData);
    } else {
      Logger.warn('[TerrainSculptTool] TerrainComponent missing heightmap data');
      this.terrainEntity = null;
      this.terrainComponent = null;
      this.heightmapTerrain = null;
    }
  }

  /**
   * Activates sculpting mode
   */
  activate(): void {
    if (!this.terrainEntity || !this.heightmapTerrain) {
      Logger.warn('[TerrainSculptTool] Cannot activate: no terrain entity set');
      return;
    }
    this.isActive = true;
  }

  /**
   * Deactivates sculpting mode
   */
  deactivate(): void {
    this.isActive = false;
    this.commitChanges();
  }

  /**
   * Checks if sculpting is active
   */
  isSculptingActive(): boolean {
    return this.isActive;
  }

  /**
   * Applies sculpting operation at world position
   */
  sculptAt(worldPosition: Vec3, config: SculptOperationConfig): void {
    if (!this.isActive || !this.heightmapTerrain) {
      return;
    }

    const { operation, strength, targetHeight } = config;

    switch (operation) {
      case 'raise':
        this.applyRaise(worldPosition, strength);
        break;
      case 'lower':
        this.applyLower(worldPosition, strength);
        break;
      case 'smooth':
        this.applySmooth(worldPosition, strength);
        break;
      case 'flatten':
        if (targetHeight !== undefined) {
          this.applyFlatten(worldPosition, targetHeight, strength);
        }
        break;
      case 'pinch':
        this.applyPinch(worldPosition, strength);
        break;
    }
  }

  /**
   * Applies raise operation
   */
  private applyRaise(position: Vec3, strength: number): void {
    if (!this.heightmapTerrain) return;

    const brushSize = this.brush.getConfig().size;

    // Get sample points within brush
    const samplePoints = this.brush.getSamplePoints(position, 0.5); // Sample every 0.5 units

    for (const point of samplePoints) {
      const currentHeight = this.heightmapTerrain.getHeightAt(point[0], point[2]);
      const delta = this.brush.calculateHeightDelta(position, point, 'raise', strength);
      const newHeight = currentHeight + delta;

      // Apply height change
      this.heightmapTerrain.setHeightAt(point[0], point[2], newHeight, brushSize * 0.1);
    }
  }

  /**
   * Applies lower operation
   */
  private applyLower(position: Vec3, strength: number): void {
    if (!this.heightmapTerrain) return;

    const brushSize = this.brush.getConfig().size;
    const samplePoints = this.brush.getSamplePoints(position, 0.5);

    for (const point of samplePoints) {
      const currentHeight = this.heightmapTerrain.getHeightAt(point[0], point[2]);
      const delta = this.brush.calculateHeightDelta(position, point, 'lower', strength);
      const newHeight = currentHeight + delta;

      this.heightmapTerrain.setHeightAt(point[0], point[2], newHeight, brushSize * 0.1);
    }
  }

  /**
   * Applies smooth operation
   */
  private applySmooth(position: Vec3, strength: number): void {
    if (!this.heightmapTerrain) return;

    const brushSize = this.brush.getConfig().size;
    const samplePoints = this.brush.getSamplePoints(position, 0.5);

    // Collect heights and calculate average
    let totalHeight = 0;
    let totalWeight = 0;

    for (const point of samplePoints) {
      const height = this.heightmapTerrain.getHeightAt(point[0], point[2]);
      const weight = this.brush.getInfluenceAt(position, point);
      totalHeight += height * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      const averageHeight = totalHeight / totalWeight;

      // Apply smoothing
      for (const point of samplePoints) {
        const currentHeight = this.heightmapTerrain.getHeightAt(point[0], point[2]);
        const smoothFactor = this.brush.calculateSmoothFactor(position, point, strength);
        const newHeight = currentHeight + (averageHeight - currentHeight) * smoothFactor;
        this.heightmapTerrain.setHeightAt(point[0], point[2], newHeight, brushSize * 0.1);
      }
    }
  }

  /**
   * Applies flatten operation
   */
  private applyFlatten(position: Vec3, targetHeight: number, strength: number): void {
    if (!this.heightmapTerrain) return;

    const brushSize = this.brush.getConfig().size;
    const samplePoints = this.brush.getSamplePoints(position, 0.5);

    for (const point of samplePoints) {
      const currentHeight = this.heightmapTerrain.getHeightAt(point[0], point[2]);
      const flattenFactor = this.brush.calculateFlattenFactor(position, point, strength);
      const newHeight = currentHeight + (targetHeight - currentHeight) * flattenFactor;
      this.heightmapTerrain.setHeightAt(point[0], point[2], newHeight, brushSize * 0.1);
    }
  }

  /**
   * Applies pinch operation
   */
  private applyPinch(position: Vec3, strength: number): void {
    if (!this.heightmapTerrain) return;

    const brushSize = this.brush.getConfig().size;
    const samplePoints = this.brush.getSamplePoints(position, 0.5);

    // Get center height
    const centerHeight = this.heightmapTerrain.getHeightAt(position[0], position[2]);

    for (const point of samplePoints) {
      const currentHeight = this.heightmapTerrain.getHeightAt(point[0], point[2]);
      const distance = Math.sqrt(
        (point[0] - position[0]) * (point[0] - position[0]) +
        (point[2] - position[2]) * (point[2] - position[2])
      );

      if (distance > 0) {
        const pinchFactor = this.brush.calculatePinchFactor(position, point, strength);
        const delta = (centerHeight - currentHeight) * pinchFactor;
        const newHeight = currentHeight + delta;
        this.heightmapTerrain.setHeightAt(point[0], point[2], newHeight, brushSize * 0.1);
      }
    }
  }

  /**
   * Updates brush configuration
   */
  updateBrushConfig(config: Partial<import('./TerrainBrush').BrushConfig>): void {
    this.brush.updateConfig(config);
  }

  /**
   * Gets brush instance
   */
  getBrush(): TerrainBrush {
    return this.brush;
  }

  /**
   * Commits changes to TerrainComponent
   */
  commitChanges(): void {
    if (!this.terrainComponent || !this.heightmapTerrain) {
      return;
    }

    // Export updated heightmap data
    const updatedData = this.heightmapTerrain.exportData();

    // Update component
    if (this.terrainComponent.terrainData.heightmap) {
      this.terrainComponent.terrainData.heightmap.heights = updatedData.heights;
      if (updatedData.minHeight !== undefined) {
        this.terrainComponent.terrainData.heightmap.minHeight = updatedData.minHeight;
      }
      if (updatedData.maxHeight !== undefined) {
        this.terrainComponent.terrainData.heightmap.maxHeight = updatedData.maxHeight;
      }
    }
  }

  /**
   * Gets heightmap terrain instance (for mesh regeneration)
   */
  getHeightmapTerrain(): HeightmapTerrain | null {
    return this.heightmapTerrain;
  }

  /**
   * Disposes the tool
   */
  dispose(): void {
    this.deactivate();
    this.terrainEntity = null;
    this.terrainComponent = null;
    this.heightmapTerrain = null;
  }
}


/**
 * VegetationPaintTool - Paint tool for mass vegetation placement
 * 
 * Features:
 * - Click and drag to paint vegetation
 * - Density control (spacing between instances)
 * - Random rotation and scale variation
 * - Brush size control
 * - Paint on terrain surface
 */

import type { Scene } from '@engine/world';
import { Entity, VegetationComponent, VegetationType, MaterialComponent } from '@engine/world';
import type { AssetPreset } from '../types/BlockAssetTypes';
import type { Vec3 } from '@engine/core/math';
import { distanceVec3 } from '@engine/core/math';
import { Raycaster, type Ray } from '@engine/world';
import { Logger } from '../../utils/logger';

/**
 * Configuration for vegetation paint tool
 */
export interface VegetationPaintToolConfig {
  /** Brush radius in world units */
  brushRadius: number;
  /** Density factor (0-1, higher = more vegetation per unit area) */
  density: number;
  /** Enable random rotation */
  randomRotation: boolean;
  /** Enable random scale variation */
  randomScale: boolean;
  /** Scale variation amount (0-1) */
  scaleVariation: number;
  /** Minimum distance between instances (to prevent overlap) */
  minSpacing: number;
}

const DEFAULT_CONFIG: VegetationPaintToolConfig = {
  brushRadius: 3.0,
  density: 0.3,
  randomRotation: true,
  randomScale: true,
  scaleVariation: 0.2,
  minSpacing: 0.5,
};

/**
 * VegetationPaintTool - Tool for painting vegetation in the scene
 */
export class VegetationPaintTool {
  private scene: Scene;
  private config: VegetationPaintToolConfig;
  private raycaster: Raycaster;
  
  /** Currently active vegetation preset */
  private activePreset: AssetPreset | null = null;
  
  /** Is painting currently active */
  private isPainting = false;
  
  /** Last painted positions (for spacing control) */
  private lastPaintedPositions: Vec3[] = [];
  
  /** Maximum positions to track (for performance) */
  private readonly MAX_TRACKED_POSITIONS = 100;

  constructor(scene: Scene, config?: Partial<VegetationPaintToolConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.raycaster = new Raycaster();
  }

  /**
   * Sets the active vegetation preset for painting
   */
  setActivePreset(preset: AssetPreset | null): void {
    this.activePreset = preset;
  }

  /**
   * Starts painting at the given world position
   */
  startPaint(worldPosition: Vec3, rayOrigin?: Vec3, rayDirection?: Vec3): void {
    if (!this.activePreset || !this.activePreset.vegetationConfig) {
      Logger.warn('[VegetationPaintTool] No active vegetation preset');
      return;
    }

    this.isPainting = true;
    this.lastPaintedPositions = [];
    this.paintAt(worldPosition, rayOrigin, rayDirection);
  }

  /**
   * Paints vegetation at the given world position (called during drag)
   */
  paintAt(worldPosition: Vec3, rayOrigin?: Vec3, rayDirection?: Vec3): void {
    if (!this.isPainting || !this.activePreset?.vegetationConfig) {
      return;
    }

    // Cast ray to find terrain surface if ray provided
    let surfacePosition = worldPosition;
    if (rayOrigin && rayDirection) {
      const hit = this.raycastToSurface(rayOrigin, rayDirection);
      if (hit) {
        surfacePosition = hit;
      }
    }

    // Calculate number of instances based on brush radius and density
    const brushArea = Math.PI * this.config.brushRadius * this.config.brushRadius;
    const targetCount = Math.floor(brushArea * this.config.density);
    
    // Generate random positions within brush radius
    const positions: Vec3[] = [];
    for (let i = 0; i < targetCount; i++) {
      const pos = this.generateRandomPosition(surfacePosition, this.config.brushRadius);
      
      // Check spacing constraints
      if (this.isValidPosition(pos)) {
        positions.push(pos);
        this.lastPaintedPositions.push(pos);
        
        // Limit tracked positions
        if (this.lastPaintedPositions.length > this.MAX_TRACKED_POSITIONS) {
          this.lastPaintedPositions.shift();
        }
      }
    }

    // Create vegetation entities at valid positions
    for (const pos of positions) {
      this.createVegetationEntity(pos);
    }
  }

  /**
   * Stops painting
   */
  stopPaint(): void {
    this.isPainting = false;
  }

  /**
   * Updates tool configuration
   */
  updateConfig(config: Partial<VegetationPaintToolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets current configuration
   */
  getConfig(): VegetationPaintToolConfig {
    return { ...this.config };
  }

  /**
   * Generates a random position within brush radius
   */
  private generateRandomPosition(center: Vec3, radius: number): Vec3 {
    // Uniform distribution within circle
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius; // sqrt for uniform distribution
    
    return [
      center[0] + Math.cos(angle) * distance,
      center[1],
      center[2] + Math.sin(angle) * distance,
    ];
  }

  /**
   * Checks if position is valid (not too close to other instances)
   */
  private isValidPosition(pos: Vec3): boolean {
    for (const existing of this.lastPaintedPositions) {
      const distance = distanceVec3(pos, existing);
      if (distance < this.config.minSpacing) {
        return false;
      }
    }
    return true;
  }

  /**
   * Raycasts to find surface position
   */
  private raycastToSurface(origin: Vec3, direction: Vec3): Vec3 | null {
    // Simple implementation: raycast against scene entities
    // In production, would use proper terrain/ground detection
    const ray: Ray = { origin, direction };
    const entities = this.scene.getAllEntities();
    const hit = this.raycaster.raycastClosest(ray, entities);
    if (hit) {
      return hit.point;
    }
    
    // Fallback: project to Y=0 plane
    if (direction[1] < 0) {
      const t = -origin[1] / direction[1];
      if (t > 0) {
        return [
          origin[0] + direction[0] * t,
          0,
          origin[2] + direction[2] * t,
        ];
      }
    }
    
    return null;
  }

  /**
   * Creates a vegetation entity at the given position
   */
  private createVegetationEntity(position: Vec3): void {
    if (!this.activePreset?.vegetationConfig) {
      return;
    }

    const entity = new Entity(`${this.activePreset.name} ${this.scene.entityCount + 1}`);
    entity.transform.position = position;
    
    // Apply random rotation if enabled
    if (this.config.randomRotation) {
      const angle = Math.random() * Math.PI * 2;
      const halfAngle = angle / 2;
      entity.transform.rotation = [0, Math.sin(halfAngle), 0, Math.cos(halfAngle)];
    }

    // Apply random scale if enabled
    if (this.config.randomScale) {
      const variation = (Math.random() - 0.5) * 2 * this.config.scaleVariation;
      const baseScale = this.activePreset.scale;
      entity.transform.scale = [
        baseScale[0] * (1 + variation),
        baseScale[1] * (1 + variation),
        baseScale[2] * (1 + variation),
      ];
    } else {
      entity.transform.scale = [...this.activePreset.scale];
    }

    // Add vegetation component
    const vegConfig = this.activePreset.vegetationConfig;
    const vegetationTypeMap: Record<string, VegetationType> = {
      grass: VegetationType.Grass,
      flower: VegetationType.Flower,
      shrub: VegetationType.Shrub,
      tree: VegetationType.Tree,
      custom: VegetationType.Custom,
    };

    const vegetationConfig: Partial<VegetationComponent['config']> = {
      type: vegetationTypeMap[vegConfig.type] ?? VegetationType.Grass,
      height: entity.transform.scale[1],
      radius: Math.max(entity.transform.scale[0], entity.transform.scale[2]) / 2,
      canBeHarvested: vegConfig.canBeHarvested ?? false,
      windStrength: vegConfig.windStrength ?? 0.3,
      windFrequency: vegConfig.windFrequency ?? 1.0,
      colorVariation: 0.1,
      scaleVariation: this.config.scaleVariation,
    };

    // Only include optional properties if they're defined (exactOptionalPropertyTypes requirement)
    if (vegConfig.billboardTexture !== undefined) {
      vegetationConfig.billboardTexture = vegConfig.billboardTexture;
    }
    if (vegConfig.modelUrl !== undefined) {
      vegetationConfig.modelUrl = vegConfig.modelUrl;
    }
    if (vegConfig.harvestTime !== undefined) {
      vegetationConfig.harvestTime = vegConfig.harvestTime;
    }

    entity.addComponent(new VegetationComponent(vegetationConfig));

    // Set material color if preset has color
    if (this.activePreset.color) {
      const mat = entity.addComponent(new MaterialComponent());
      mat.primaryColor = [...this.activePreset.color];
    }

    // Add to scene
    this.scene.addEntity(entity);
  }

  /**
   * Clears all painted vegetation in the scene
   */
  clearPaintedVegetation(): void {
    const vegetationEntities: Entity[] = [];
    this.scene.traverse((entity) => {
      if (entity.getComponent(VegetationComponent)) {
        vegetationEntities.push(entity);
      }
    });

    for (const entity of vegetationEntities) {
      this.scene.removeEntity(entity);
    }
  }

  /**
   * Gets statistics about painted vegetation
   */
  getStatistics(): {
    totalCount: number;
    byType: Record<string, number>;
  } {
    const stats = {
      totalCount: 0,
      byType: {} as Record<string, number>,
    };

    this.scene.traverse((entity) => {
      const veg = entity.getComponent(VegetationComponent);
      if (veg) {
        stats.totalCount++;
        const typeName = veg.config.type;
        stats.byType[typeName] = (stats.byType[typeName] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Disposes the tool
   */
  dispose(): void {
    this.stopPaint();
    this.activePreset = null;
    this.lastPaintedPositions = [];
  }
}


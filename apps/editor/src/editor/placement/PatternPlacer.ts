/**
 * PatternPlacer - Handles pattern-based placement (line, grid, circle).
 * 
 * Responsibilities:
 * - Generate positions for different pattern types
 * - Preview pattern positions with ghost entities
 * - Validate positions for collisions
 * - Batch placement of entities
 */

import type { Vec3 } from '@engine/core/math';
import type { Scene, Entity } from '@engine/world';
import { Entity as EntityClass } from '@engine/world';
import { initializeBaseColor } from '../visuals/SelectionVisuals';
import type { CollisionDetector } from './CollisionDetector';

export interface PatternPosition {
  position: Vec3;
  valid: boolean; // No collision at this position
}

export interface LinePatternConfig {
  start: Vec3;
  end: Vec3;
  spacing: number;
}

export interface GridPatternConfig {
  center: Vec3;
  width: number; // Number of columns
  height: number; // Number of rows
  spacing: number;
}

export interface CirclePatternConfig {
  center: Vec3;
  radius: number;
  count: number; // Number of objects around circle
  startAngle?: number; // Starting angle in radians
}

export interface WallPatternConfig {
  start: Vec3;
  end: Vec3;
  height: number;
  spacing: number;
}

/**
 * Generates positions for pattern-based placement
 */
export class PatternPlacer {
  private previewEntities: Entity[] = [];

  constructor(
    private scene: Scene,
    private collisionDetector: CollisionDetector
  ) {}

  /**
   * Generates positions for a line pattern
   */
  generateLinePattern(config: LinePatternConfig): PatternPosition[] {
    const { start, end, spacing } = config;
    const positions: PatternPosition[] = [];

    // Calculate direction and total distance
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < 0.001) {
      // Start and end are the same
      return [{ position: start, valid: true }];
    }

    // Normalize direction
    const dirX = dx / distance;
    const dirY = dy / distance;
    const dirZ = dz / distance;

    // Calculate number of positions
    const count = Math.max(2, Math.floor(distance / spacing) + 1);

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const position: Vec3 = [
        start[0] + dirX * distance * t,
        start[1] + dirY * distance * t,
        start[2] + dirZ * distance * t,
      ];
      positions.push({ position, valid: true });
    }

    return positions;
  }

  /**
   * Generates positions for a grid pattern
   */
  generateGridPattern(config: GridPatternConfig): PatternPosition[] {
    const { center, width, height, spacing } = config;
    const positions: PatternPosition[] = [];

    // Calculate grid offset to center it
    const offsetX = ((width - 1) * spacing) / 2;
    const offsetZ = ((height - 1) * spacing) / 2;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const position: Vec3 = [
          center[0] + col * spacing - offsetX,
          center[1],
          center[2] + row * spacing - offsetZ,
        ];
        positions.push({ position, valid: true });
      }
    }

    return positions;
  }

  /**
   * Generates positions for a circle pattern
   */
  generateCirclePattern(config: CirclePatternConfig): PatternPosition[] {
    const { center, radius, count, startAngle = 0 } = config;
    const positions: PatternPosition[] = [];

    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angleStep;
      const position: Vec3 = [
        center[0] + Math.cos(angle) * radius,
        center[1],
        center[2] + Math.sin(angle) * radius,
      ];
      positions.push({ position, valid: true });
    }

    return positions;
  }

  /**
   * Generates positions for a wall pattern (vertical grid)
   */
  generateWallPattern(config: WallPatternConfig): PatternPosition[] {
    const { start, end, height, spacing } = config;
    const positions: PatternPosition[] = [];

    // Calculate base line positions
    const basePositions = this.generateLinePattern({ start, end, spacing });

    // Extrude upwards
    for (const base of basePositions) {
      for (let y = 0; y < height; y++) {
        const position: Vec3 = [
          base.position[0],
          base.position[1] + y * spacing,
          base.position[2],
        ];
        positions.push({ position, valid: true });
      }
    }

    return positions;
  }

  /**
   * Validates positions for collisions
   */
  async validatePositions(
    positions: PatternPosition[],
    previewEntity: Entity,
    excludeEntities?: Set<Entity>
  ): Promise<void> {
    for (const pos of positions) {
      const collisionResult = await this.collisionDetector.checkCollisionOBB(
        previewEntity,
        pos.position,
        previewEntity.transform.rotation,
        previewEntity.transform.scale,
        excludeEntities
      );
      pos.valid = !collisionResult.hasCollision;
    }
  }

  /**
   * Creates preview entities for pattern positions
   */
  createPreviewEntities(
    positions: PatternPosition[],
    templateEntity: Entity,
    validColor: [number, number, number, number],
    invalidColor: [number, number, number, number]
  ): void {
    // Clear existing previews
    this.clearPreviewEntities();

    for (const pos of positions) {
      const preview = new EntityClass(`${templateEntity.name}_pattern_preview`);
      preview.transform.position = pos.position;
      preview.transform.rotation = [...templateEntity.transform.rotation];
      preview.transform.scale = [...templateEntity.transform.scale];
      preview.color = pos.valid ? [...validColor] : [...invalidColor];
      preview.userData.isPreview = true;
      preview.userData.isPatternPreview = true;

      // Copy base color
      const templateBase = templateEntity.userData.baseColor as [number, number, number, number] | undefined;
      if (templateBase) {
        preview.userData.baseColor = [...templateBase];
      }

      this.scene.addEntity(preview);
      this.previewEntities.push(preview);
    }
  }

  /**
   * Clears all preview entities
   */
  clearPreviewEntities(): void {
    for (const entity of this.previewEntities) {
      if (entity.scene) {
        this.scene.removeEntity(entity);
      }
    }
    this.previewEntities = [];
  }

  /**
   * Gets the count of valid positions
   */
  getValidCount(positions: PatternPosition[]): number {
    return positions.filter(p => p.valid).length;
  }

  /**
   * Gets preview entities
   */
  getPreviewEntities(): Entity[] {
    return [...this.previewEntities];
  }
}

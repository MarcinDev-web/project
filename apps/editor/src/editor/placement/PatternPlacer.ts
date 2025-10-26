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
import type { CollisionDetector } from './CollisionDetector';
import { Entity as EntityClass } from '@engine/world';

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
   * Validates positions for collisions
   */
  validatePositions(
    positions: PatternPosition[],
    previewEntity: Entity,
    excludeEntities?: Set<Entity>
  ): void {
    for (const pos of positions) {
      const collisionResult = this.collisionDetector.checkCollisionOBB(
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
      if (templateEntity.userData.baseColor) {
        preview.userData.baseColor = pos.valid ? [...validColor] : [...invalidColor];
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
   * Places entities at valid positions in the pattern
   */
  placeEntities(
    positions: PatternPosition[],
    templateEntity: Entity
  ): Entity[] {
    const placedEntities: Entity[] = [];

    for (const pos of positions) {
      if (!pos.valid) continue;

      const entity = new EntityClass(templateEntity.name);
      entity.transform.position = pos.position;
      entity.transform.rotation = [...templateEntity.transform.rotation];
      entity.transform.scale = [...templateEntity.transform.scale];
      entity.color = [...templateEntity.color];

      // Copy userData
      if (templateEntity.userData.baseColor) {
        entity.userData.baseColor = [...(templateEntity.userData.baseColor as [number, number, number, number])];
      }
      if (templateEntity.userData.asset) {
        entity.userData.asset = templateEntity.userData.asset;
      }

      this.scene.addEntity(entity);
      placedEntities.push(entity);
    }

    return placedEntities;
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


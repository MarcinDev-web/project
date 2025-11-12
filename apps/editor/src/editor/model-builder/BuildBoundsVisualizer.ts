/**
 * BuildBoundsVisualizer - Visualizes build bounds with grid lines
 */

import { Entity, TransformComponent, MeshComponent, MaterialComponent } from '@engine/world';
import type { Scene } from '@engine/world';
import type { BuildBounds } from '@engine/blocks';
import type { Vec3 } from '@engine/core/math';
import { MICRO_BLOCK_SIZE } from '@engine/microblocks';
import { DisposableGroup } from '@engine/core';

/**
 * BuildBoundsVisualizer creates visual grid showing build boundaries
 */
export class BuildBoundsVisualizer {
  private readonly scene: Scene;
  private readonly bounds: BuildBounds;
  private readonly disposables = new DisposableGroup();
  private gridEntities: Entity[] = [];

  constructor(scene: Scene, bounds: BuildBounds) {
    this.scene = scene;
    this.bounds = bounds;
    this.createGrid();
  }

  /**
   * Creates grid lines showing build bounds
   */
  private createGrid(): void {
    const min = this.bounds.min;
    const max = this.bounds.max;
    const gridColor: [number, number, number, number] = [0.2, 0.4, 0.8, 0.5]; // Semi-transparent blue

    // Create grid lines along X axis
    for (let y = min[1]; y <= max[1]; y++) {
      for (let z = min[2]; z <= max[2]; z++) {
        // Line along X
        const entity = this.createGridLine(
          [min[0] * MICRO_BLOCK_SIZE, y * MICRO_BLOCK_SIZE, z * MICRO_BLOCK_SIZE],
          [max[0] * MICRO_BLOCK_SIZE, y * MICRO_BLOCK_SIZE, z * MICRO_BLOCK_SIZE],
          gridColor
        );
        this.gridEntities.push(entity);
      }
    }

    // Create grid lines along Y axis
    for (let x = min[0]; x <= max[0]; x++) {
      for (let z = min[2]; z <= max[2]; z++) {
        // Line along Y
        const entity = this.createGridLine(
          [x * MICRO_BLOCK_SIZE, min[1] * MICRO_BLOCK_SIZE, z * MICRO_BLOCK_SIZE],
          [x * MICRO_BLOCK_SIZE, max[1] * MICRO_BLOCK_SIZE, z * MICRO_BLOCK_SIZE],
          gridColor
        );
        this.gridEntities.push(entity);
      }
    }

    // Create grid lines along Z axis
    for (let x = min[0]; x <= max[0]; x++) {
      for (let y = min[1]; y <= max[1]; y++) {
        // Line along Z
        const entity = this.createGridLine(
          [x * MICRO_BLOCK_SIZE, y * MICRO_BLOCK_SIZE, min[2] * MICRO_BLOCK_SIZE],
          [x * MICRO_BLOCK_SIZE, y * MICRO_BLOCK_SIZE, max[2] * MICRO_BLOCK_SIZE],
          gridColor
        );
        this.gridEntities.push(entity);
      }
    }
  }

  /**
   * Creates a grid line entity (simplified - uses cube mesh)
   */
  private createGridLine(start: Vec3, end: Vec3, color: [number, number, number, number]): Entity {
    const entity = new Entity('build-bounds-grid-line');
    
    // Calculate center and scale
    const center: Vec3 = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2,
    ];
    
    const length = Math.sqrt(
      Math.pow(end[0] - start[0], 2) +
      Math.pow(end[1] - start[1], 2) +
      Math.pow(end[2] - start[2], 2)
    );

    entity.addComponent(new TransformComponent({
      position: center,
      scale: [length, 0.01, 0.01], // Thin line
    }));

    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    entity.addComponent(mesh);

    const material = new MaterialComponent();
    material.primaryColor = color;
    material.opacity = color[3];
    material.alphaMode = 'blend';
    entity.addComponent(material);

    this.scene.addEntity(entity);
    return entity;
  }

  /**
   * Updates visualization (for animations, etc.)
   */
  update(deltaTime: number): void {
    // Could add pulsing animation here
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    for (const entity of this.gridEntities) {
      this.scene.removeEntity(entity);
      entity.dispose();
    }
    this.gridEntities = [];
    this.disposables.dispose();
  }
}


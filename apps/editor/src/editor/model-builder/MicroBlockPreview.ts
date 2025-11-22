/**
 * MicroBlockPreview - Ghost preview of micro block before placement
 */

import { Entity, Transform, MeshComponent, MaterialComponent } from '@engine/world';
import type { Scene } from '@engine/world';
import type { LocalPos, MicroBlock } from '@engine/microblocks';
import type { Vec3 } from '@engine/core/math';
import { MICRO_BLOCK_SIZE } from '@engine/microblocks';
import { DisposableGroup } from '@engine/core';

/**
 * MicroBlockPreview shows ghost preview of block to be placed
 */
export class MicroBlockPreview {
  private readonly scene: Scene;
  private readonly disposables = new DisposableGroup();
  private previewEntity: Entity | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Shows preview at position
   */
  showPreview(pos: LocalPos, _block: MicroBlock, isValid: boolean): void {
    // Remove existing preview
    this.hidePreview();

    // Create preview entity
    const worldPos: Vec3 = [
      pos[0] * MICRO_BLOCK_SIZE,
      pos[1] * MICRO_BLOCK_SIZE,
      pos[2] * MICRO_BLOCK_SIZE,
    ];

    this.previewEntity = new Entity('microblock-preview');
    this.previewEntity.addComponent(new Transform(worldPos));

    const mesh = new MeshComponent();
    mesh.meshType = 'cube'; // Simplified - could use actual micro block shape
    this.previewEntity.addComponent(mesh);

    const material = new MaterialComponent();
    // Green for valid, red for invalid
    material.primaryColor = isValid ? [0.2, 1.0, 0.2, 0.6] : [1.0, 0.2, 0.2, 0.6];
    material.opacity = 0.6;
    material.alphaMode = 'blend';
    this.previewEntity.addComponent(material);

    this.scene.addEntity(this.previewEntity);
  }

  /**
   * Shows box preview defined by start and end positions
   */
  showBoxPreview(start: LocalPos, end: LocalPos, isValid: boolean): void {
    this.hidePreview();

    const minX = Math.min(start[0], end[0]);
    const minY = Math.min(start[1], end[1]);
    const minZ = Math.min(start[2], end[2]);
    const maxX = Math.max(start[0], end[0]) + 1; // +1 because block coords are inclusive
    const maxY = Math.max(start[1], end[1]) + 1;
    const maxZ = Math.max(start[2], end[2]) + 1;

    const sizeX = (maxX - minX) * MICRO_BLOCK_SIZE;
    const sizeY = (maxY - minY) * MICRO_BLOCK_SIZE;
    const sizeZ = (maxZ - minZ) * MICRO_BLOCK_SIZE;

    // Position is center of the box? MeshComponent 'cube' is usually centered at 0,0,0 with size 1,1,1.
    // Note: Transform position is the center of the entity.
    // However, usually blocks are anchored at corner. 
    // Let's assume 'cube' mesh is size 1x1x1 centered.
    // We need to scale it.

    // But wait, standard cube mesh in this engine might be size 1?
    // And MICRO_BLOCK_SIZE might be e.g. 0.25.
    
    this.previewEntity = new Entity('microblock-preview-box');
    const transform = new Transform();
    
    // Wait, simplistic math:
    // Center of the bounding box is:
    // min + size/2
    
    const centerPos: Vec3 = [
        minX * MICRO_BLOCK_SIZE + sizeX / 2,
        minY * MICRO_BLOCK_SIZE + sizeY / 2,
        minZ * MICRO_BLOCK_SIZE + sizeZ / 2
    ];
    
    // But the mesh primitive 'cube' is likely 1x1x1.
    // So we need to scale it by size.
    
    transform.position = centerPos;
    transform.scale = [sizeX, sizeY, sizeZ];

    this.previewEntity.addComponent(transform);

    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    this.previewEntity.addComponent(mesh);

    const material = new MaterialComponent();
    material.primaryColor = isValid ? [0.2, 1.0, 0.2, 0.4] : [1.0, 0.2, 0.2, 0.4];
    material.opacity = 0.4;
    material.alphaMode = 'blend';
    this.previewEntity.addComponent(material);

    this.scene.addEntity(this.previewEntity);
  }

  /**
   * Updates preview position
   */
  updatePosition(pos: LocalPos, isValid: boolean): void {
    if (!this.previewEntity) return;

    const worldPos: Vec3 = [
      pos[0] * MICRO_BLOCK_SIZE,
      pos[1] * MICRO_BLOCK_SIZE,
      pos[2] * MICRO_BLOCK_SIZE,
    ];

    const transform = this.previewEntity.getComponent(Transform);
    if (transform) {
      transform.position = worldPos;
    }

    // Update color based on validity
    const material = this.previewEntity.getComponent(MaterialComponent);
    if (material) {
      material.primaryColor = isValid ? [0.2, 1.0, 0.2, 0.6] : [1.0, 0.2, 0.2, 0.6];
    }
  }

  /**
   * Hides preview
   */
  hidePreview(): void {
    if (this.previewEntity) {
      this.scene.removeEntity(this.previewEntity);
      this.previewEntity = null;
    }
  }

  /**
   * Gets current preview position
   */
  getPreviewPosition(): LocalPos | null {
    if (!this.previewEntity) return null;

    const transform = this.previewEntity.getComponent(Transform);
    if (!transform) return null;

    const worldPos = transform.position;
    return [
      Math.floor(worldPos[0] / MICRO_BLOCK_SIZE),
      Math.floor(worldPos[1] / MICRO_BLOCK_SIZE),
      Math.floor(worldPos[2] / MICRO_BLOCK_SIZE),
    ];
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    this.hidePreview();
    this.disposables.dispose();
  }
}

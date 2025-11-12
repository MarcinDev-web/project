/**
 * MicroBlockPreview - Ghost preview of micro block before placement
 */

import { Entity, TransformComponent, MeshComponent, MaterialComponent } from '@engine/world';
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
  private currentBlock: MicroBlock | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Shows preview at position
   */
  showPreview(pos: LocalPos, block: MicroBlock, isValid: boolean): void {
    // Remove existing preview
    this.hidePreview();

    // Create preview entity
    const worldPos: Vec3 = [
      pos[0] * MICRO_BLOCK_SIZE,
      pos[1] * MICRO_BLOCK_SIZE,
      pos[2] * MICRO_BLOCK_SIZE,
    ];

    this.previewEntity = new Entity('microblock-preview');
    this.previewEntity.addComponent(new TransformComponent({ position: worldPos }));

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
    this.currentBlock = block;
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

    const transform = this.previewEntity.getComponent(TransformComponent);
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
      this.previewEntity.dispose();
      this.previewEntity = null;
    }
    this.currentBlock = null;
  }

  /**
   * Gets current preview position
   */
  getPreviewPosition(): LocalPos | null {
    if (!this.previewEntity) return null;

    const transform = this.previewEntity.getComponent(TransformComponent);
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


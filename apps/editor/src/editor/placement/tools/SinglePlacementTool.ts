import { Entity } from '@engine/world';
import type { AssetPreset } from '../../types/BlockAssetTypes';
import { validateAssetPreset } from '../../types/BlockAssetTypes';
import { initializeBaseColor } from '../../visuals/SelectionVisuals';
import { Logger } from '../../../utils/logger';
import { PlacementAnimator } from '../PlacementAnimator';
import { warmupCollisionWorker } from '../../../wasm/collisionWorkerClient';
import { PlacementTool, PlacementToolContext } from './PlacementTool';
import { PlacementPreview } from '../PlacementMode';
import type { Vec3 } from '@engine/core/math';
import { quatFromAxisAngle } from '@engine/core/math';
import { getBlock } from '@engine/blocks';

export class SinglePlacementTool extends PlacementTool {
  private preview: PlacementPreview;
  private animator: PlacementAnimator;
  private lastUpdateId = 0;

  constructor(context: PlacementToolContext) {
    super(context);

    this.preview = {
      previewEntity: null,
      active: false,
      canPlace: false,
      asset: null,
      rotationAngle: 0,
      position: null,
    };

    this.animator = new PlacementAnimator({
      enabled: this.context.config.animationEnabled !== false,
      duration: {
        spawn: this.context.config.animationDuration?.spawn ?? 0.2,
        position: this.context.config.animationDuration?.position ?? 0.1,
        rotation: this.context.config.animationDuration?.rotation ?? 0.15,
      },
    });
  }

  startPlacement(asset: AssetPreset): void {
    let normalizedAsset: AssetPreset;
    try {
      normalizedAsset = validateAssetPreset(asset);
    } catch (error) {
      Logger.warn('SinglePlacementTool: Invalid asset provided', error);
      return;
    }

    this.cancelPlacement();

    try {
      warmupCollisionWorker();
    } catch (error) {
      Logger.debug('SinglePlacementTool: Failed to warmup collision worker', error);
    }

    const previewEntity = new Entity(`${normalizedAsset.name}_preview`);
    initializeBaseColor(previewEntity, normalizedAsset.color);

    previewEntity.userData.isPreview = true;
    previewEntity.userData.asset = normalizedAsset.name;

    previewEntity.transform.position = [0, -1000, 0];
    previewEntity.transform.scale = [...normalizedAsset.scale];

    // Add to scene so it's visible (assuming PatternPlacer behavior)
    this.context.scene.addEntity(previewEntity);

    this.preview = {
      previewEntity,
      active: true,
      canPlace: false,
      asset: normalizedAsset,
      rotationAngle: 0,
      position: null,
    };

    this.context.config.onPlacementStart?.(normalizedAsset, previewEntity);
  }

  async updatePreview(
    position: Vec3,
    normal: Vec3,
    options: { ignoreEntities?: Entity[]; applySnap?: boolean; targetEntity?: Entity | undefined } = {}
  ): Promise<void> {
    if (!this.preview.active || !this.preview.previewEntity || !this.preview.asset) {
      return;
    }

    const { applySnap = true, ignoreEntities, targetEntity } = options;
    const currentUpdateId = ++this.lastUpdateId;

    let targetPos: Vec3 = [...position];
    if (applySnap && this.context.snapSystem.isEnabled()) {
       targetPos = this.context.snapSystem.snapPosition(position);
    }

    const rotationQuat = quatFromAxisAngle([0, 1, 0], this.preview.rotationAngle);
    
    this.animator.setTargetPosition(targetPos);
    this.animator.setTargetRotation(rotationQuat);
    
    this.preview.previewEntity.transform.position = targetPos;
    this.preview.previewEntity.transform.rotation = rotationQuat;

    const collisionResult = await this.context.collisionDetector.checkCollisionOBB(
        this.preview.previewEntity,
        targetPos,
        rotationQuat,
        this.preview.asset.scale,
        new Set(ignoreEntities)
    );

    if (this.lastUpdateId !== currentUpdateId) return;

    this.preview.canPlace = !collisionResult.hasCollision;

    // Check placement constraints
    if (this.preview.canPlace && this.preview.asset.blockId) {
      const blockDef = getBlock(this.preview.asset.blockId);
      if (blockDef?.constraints?.allowedSurfaces?.length) {
        if (targetEntity && targetEntity.userData.blockId) {
          const allowed = blockDef.constraints.allowedSurfaces.includes(targetEntity.userData.blockId as string);
          if (!allowed) {
            this.preview.canPlace = false;
          }
        } else {
          // If constraints exist but we're not on a valid block surface, disallow
          this.preview.canPlace = false;
        }
      }
    }

    this.preview.position = targetPos;

    const color = this.preview.canPlace 
        ? this.context.config.validColor 
        : this.context.config.invalidColor;
    
    this.preview.previewEntity.userData.previewColor = color;
    
    // Also set base color for visual feedback if system supports it
    // initializeBaseColor(this.preview.previewEntity, color);

    this.animator.update(0.016);
    
    this.preview.previewEntity.transform.position = this.animator.getCurrentPosition();
    this.preview.previewEntity.transform.rotation = this.animator.getCurrentRotation();

    this.context.config.onPreviewPositionUpdate?.(targetPos, this.preview.previewEntity);
  }

  confirmPlacement(): Entity[] | Entity | null {
    if (!this.preview.active || !this.preview.canPlace || !this.preview.previewEntity || !this.preview.asset) {
      return null;
    }

    // Optimize: Use StaticBlockManager for blocks
    if (this.context.staticBlockManager && this.preview.asset.blockId) {
        const position = this.preview.position || [...this.preview.previewEntity.transform.position];
        const rotation = [...this.preview.previewEntity.transform.rotation];
        const scale = [...this.preview.asset.scale];
        const color = this.preview.asset.color || [1, 1, 1, 1];

        this.context.staticBlockManager.addBlock({
            assetName: this.preview.asset.name,
            position: position as [number, number, number],
            rotation: rotation as [number, number, number, number],
            scale: scale as [number, number, number],
            color: color as [number, number, number, number],
            blockId: this.preview.asset.blockId,
            meshType: 'cube',
            materialId: 0 // TODO: Resolve from asset/material system
        });

        // Notify config but don't return a new entity (instanced)
        // We pass the preview entity as a placeholder/reference if needed by listeners
        this.context.config.onPlacementConfirmed?.(this.preview.previewEntity);
        
        // Return empty array to indicate success but no new selectable entities
        return [];
    }

    const entity = new Entity(this.preview.asset.name);
    entity.transform.position = [...this.preview.previewEntity.transform.position];
    entity.transform.rotation = [...this.preview.previewEntity.transform.rotation];
    entity.transform.scale = [...this.preview.asset.scale];

    initializeBaseColor(entity, this.preview.asset.color);
    
    if (this.preview.asset.blockId) {
        entity.userData.blockId = this.preview.asset.blockId;
    }

    this.context.scene.addEntity(entity);
    this.context.config.onEntityCreated?.(entity);
    this.context.config.onPlacementConfirmed?.(entity);
    
    return entity;
  }

  cancelPlacement(): void {
    if (this.preview.previewEntity) {
        this.context.scene.removeEntity(this.preview.previewEntity);
    }
    
    this.preview.active = false;
    this.preview.previewEntity = null;
    this.preview.canPlace = false;
    this.preview.asset = null;
    this.context.config.onPlacementCancelled?.();
  }

  getPreviewEntities(): Entity[] {
    return this.preview.previewEntity ? [this.preview.previewEntity] : [];
  }

  isActive(): boolean {
    return this.preview.active;
  }
  
  isValid(): boolean {
      return this.preview.canPlace;
  }
  
  getAsset(): AssetPreset | null {
      return this.preview.asset;
  }

  rotatePreview(direction: number = 1): void {
    this.preview.rotationAngle += this.context.config.rotationIncrement * Math.sign(direction);
  }
  
  getPreviewState(): PlacementPreview {
      return this.preview;
  }
}

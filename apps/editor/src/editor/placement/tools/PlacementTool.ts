import { Entity, Scene } from '@engine/world';
import type { AssetPreset } from '../../types/BlockAssetTypes';
import type { Vec3 } from '@engine/core/math';
import { CollisionDetector } from '../CollisionDetector';
import type { SnapSystem } from '@engine/editor-utils';
import type { PlacementModeConfig } from '../PlacementMode';

export interface PlacementToolContext {
  scene: Scene;
  snapSystem: SnapSystem;
  collisionDetector: CollisionDetector;
  config: PlacementModeConfig;
}

export type ToolAction = 'none' | 'confirm' | 'cancel';

export abstract class PlacementTool {
  constructor(protected context: PlacementToolContext) {}

  abstract startPlacement(asset: AssetPreset): void;

  abstract updatePreview(
    position: Vec3,
    normal: Vec3,
    options?: { ignoreEntities?: Entity[]; applySnap?: boolean; targetEntity?: Entity | undefined }
  ): Promise<void>;

  abstract confirmPlacement(): Entity[] | Entity | null;

  abstract cancelPlacement(): void;

  abstract getPreviewEntities(): Entity[];

  abstract isActive(): boolean;
  
  abstract isValid(): boolean;
  abstract getAsset(): AssetPreset | null;

  handleInput(_type: 'down' | 'up' | 'move', _ray: { origin: Vec3; direction: Vec3 }): ToolAction {
      return 'none';
  }
}

import { Entity, MaterialComponent } from '@engine/world';
import type { AssetPreset } from '../../types/BlockAssetTypes';
import { PlacementTool, PlacementToolContext, ToolAction } from './PlacementTool';
import { Vec3 } from '@engine/core/math';
import { initializeBaseColor } from '../../visuals/SelectionVisuals';

export class PaintPlacementTool extends PlacementTool {
  private currentAsset: AssetPreset | null = null;
  private active: boolean = false;
  private targetEntity: Entity | null = null;
  private highlightEntity: Entity | null = null;

  constructor(context: PlacementToolContext) {
    super(context);
  }

  startPlacement(asset: AssetPreset): void {
    this.currentAsset = asset;
    this.active = true;
  }

  async updatePreview(
    position: Vec3,
    normal: Vec3,
    options: { ignoreEntities?: Entity[]; applySnap?: boolean; targetEntity?: Entity | undefined } = {}
  ): Promise<void> {
    if (!this.active || !this.currentAsset) return;

    this.targetEntity = options.targetEntity || null;

    if (this.targetEntity) {
        if (!this.highlightEntity) {
            this.highlightEntity = new Entity('paint_highlight');
            this.highlightEntity.userData.isPreview = true;
            this.context.scene.addEntity(this.highlightEntity);
        }
        
        this.highlightEntity.transform.position = [...this.targetEntity.transform.position];
        this.highlightEntity.transform.rotation = [...this.targetEntity.transform.rotation];
        this.highlightEntity.transform.scale = [
            this.targetEntity.transform.scale[0] * 1.01,
            this.targetEntity.transform.scale[1] * 1.01,
            this.targetEntity.transform.scale[2] * 1.01
        ];
        
        const color = [...this.currentAsset.color] as [number, number, number, number];
        color[3] = 0.5; 
        initializeBaseColor(this.highlightEntity, color);
    } else {
        if (this.highlightEntity) {
            this.highlightEntity.transform.position = [0, -1000, 0];
        }
    }
  }

  confirmPlacement(): Entity | null {
    if (!this.active || !this.currentAsset || !this.targetEntity) return null;

    initializeBaseColor(this.targetEntity, this.currentAsset.color);
    if (this.currentAsset.blockId) {
        this.targetEntity.userData.blockId = this.currentAsset.blockId;
    }
    
    return this.targetEntity;
  }

  cancelPlacement(): void {
    if (this.highlightEntity) {
        this.context.scene.removeEntity(this.highlightEntity);
        this.highlightEntity = null;
    }
    this.targetEntity = null;
    this.active = false;
    this.currentAsset = null;
  }

  getPreviewEntities(): Entity[] {
    return this.highlightEntity ? [this.highlightEntity] : [];
  }

  isActive(): boolean {
    return this.active;
  }
  
  isValid(): boolean {
      return !!this.targetEntity;
  }
  
  getAsset(): AssetPreset | null {
      return this.currentAsset;
  }

  handleInput(type: 'down' | 'up' | 'move', ray: { origin: Vec3; direction: Vec3 }): ToolAction {
      if (type === 'up' && this.isValid()) {
          return 'confirm';
      }
      return 'none';
  }
}

import { Entity } from '@engine/world';
import type { AssetPreset } from '../../types/BlockAssetTypes';
import { PlacementTool, PlacementToolContext, ToolAction } from './PlacementTool';
import { PatternPlacer, PatternPosition } from '../PatternPlacer';
import { Vec3 } from '@engine/core/math';
import { initializeBaseColor } from '../../visuals/SelectionVisuals';

export class LinePlacementTool extends PlacementTool {
  private patternPlacer: PatternPlacer;
  private dragStart: Vec3 | null = null;
  private currentAsset: AssetPreset | null = null;
  private active: boolean = false;

  constructor(context: PlacementToolContext) {
    super(context);
    this.patternPlacer = new PatternPlacer(context.scene, context.collisionDetector);
  }

  startPlacement(asset: AssetPreset): void {
    this.currentAsset = asset;
    this.active = true;
    this.dragStart = null;
  }

  async updatePreview(
    position: Vec3,
    normal: Vec3,
    options: { ignoreEntities?: Entity[]; applySnap?: boolean } = {}
  ): Promise<void> {
    if (!this.active || !this.currentAsset) return;

    let positions: PatternPosition[] = [];

    if (this.dragStart) {
      let endPos = position;
      if (options.applySnap && this.context.snapSystem.isEnabled()) {
        endPos = this.context.snapSystem.snapPosition(position);
      }

      const spacing = Math.max(
          this.currentAsset.scale[0], 
          this.currentAsset.scale[1], 
          this.currentAsset.scale[2]
      ) || 1.0;

      positions = this.patternPlacer.generateLinePattern({
        start: this.dragStart,
        end: endPos,
        spacing
      });
    } else {
      let pos = position;
      if (options.applySnap && this.context.snapSystem.isEnabled()) {
        pos = this.context.snapSystem.snapPosition(position);
      }
      positions = [{ position: pos, valid: true }];
    }

    const tempEntity = new Entity('temp_validation');
    tempEntity.transform.scale = [...this.currentAsset.scale];
    tempEntity.transform.rotation = [0, 0, 0, 1];

    await this.patternPlacer.validatePositions(
      positions, 
      tempEntity, 
      options.ignoreEntities ? new Set(options.ignoreEntities) : undefined
    );

    const template = new Entity('template');
    template.transform.scale = [...this.currentAsset.scale];
    template.transform.rotation = [0, 0, 0, 1];
    initializeBaseColor(template, this.currentAsset.color);
    
    this.patternPlacer.createPreviewEntities(
      positions, 
      template, 
      this.context.config.validColor, 
      this.context.config.invalidColor
    );
  }

  confirmPlacement(): Entity[] | null {
    if (!this.active || !this.currentAsset) return null;

    const previews = this.patternPlacer.getPreviewEntities();
    const createdEntities: Entity[] = [];

    for (const preview of previews) {
      const entity = new Entity(this.currentAsset.name);
      entity.transform.position = [...preview.transform.position];
      entity.transform.rotation = [...preview.transform.rotation];
      entity.transform.scale = [...preview.transform.scale];
      initializeBaseColor(entity, this.currentAsset.color);
      if (this.currentAsset.blockId) {
        entity.userData.blockId = this.currentAsset.blockId;
      }
      this.context.scene.addEntity(entity);
      createdEntities.push(entity);
    }

    this.dragStart = null;
    return createdEntities;
  }

  cancelPlacement(): void {
    this.patternPlacer.clearPreviewEntities();
    this.dragStart = null;
    this.active = false;
    this.currentAsset = null;
  }

  getPreviewEntities(): Entity[] {
    return this.patternPlacer.getPreviewEntities();
  }

  isActive(): boolean {
    return this.active;
  }

  handleInput(type: 'down' | 'up' | 'move', ray: { origin: Vec3; direction: Vec3 }): ToolAction {
    if (type === 'down') {
        const ghosts = this.getPreviewEntities();
        if (ghosts.length > 0) {
            this.dragStart = [...ghosts[0].transform.position];
        }
        return 'none';
    } else if (type === 'up') {
        if (this.dragStart) {
             return 'confirm';
        }
    }
    return 'none';
  }
  
  isValid(): boolean {
      return this.patternPlacer.getPreviewEntities().length > 0;
  }
  
  getAsset(): AssetPreset | null {
      return this.currentAsset;
  }
}

import { Entity } from '@engine/world';
import type { AssetPreset } from '../../types/BlockAssetTypes';
import { PlacementTool, PlacementToolContext, ToolAction } from './PlacementTool';
import { PatternPlacer, PatternPosition } from '../PatternPlacer';
import { Vec3 } from '@engine/core/math';
import { initializeBaseColor } from '../../visuals/SelectionVisuals';

export class BoxPlacementTool extends PlacementTool {
  private patternPlacer: PatternPlacer;
  private dragStart: Vec3 | null = null;
  private dragNormal: Vec3 | null = null;
  private lastNormal: Vec3 | null = null;
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
    this.dragNormal = null;
  }

  async updatePreview(
    position: Vec3,
    normal: Vec3,
    options: { ignoreEntities?: Entity[]; applySnap?: boolean } = {}
  ): Promise<void> {
    if (!this.active || !this.currentAsset) return;
    
    this.lastNormal = [...normal];

    let positions: PatternPosition[] = [];

    if (this.dragStart && this.dragNormal) {
      let endPos = position;
      if (options.applySnap && this.context.snapSystem.isEnabled()) {
        endPos = this.context.snapSystem.snapPosition(position);
      }

      const spacing = Math.max(
          this.currentAsset.scale[0], 
          this.currentAsset.scale[1], 
          this.currentAsset.scale[2]
      ) || 1.0;

      const minX = Math.min(this.dragStart[0], endPos[0]);
      const maxX = Math.max(this.dragStart[0], endPos[0]);
      const minY = Math.min(this.dragStart[1], endPos[1]);
      const maxY = Math.max(this.dragStart[1], endPos[1]);
      const minZ = Math.min(this.dragStart[2], endPos[2]);
      const maxZ = Math.max(this.dragStart[2], endPos[2]);

      const countX = Math.floor((maxX - minX) / spacing) + 1;
      const countY = Math.floor((maxY - minY) / spacing) + 1;
      const countZ = Math.floor((maxZ - minZ) / spacing) + 1;

      const absNormal = [Math.abs(this.dragNormal[0]), Math.abs(this.dragNormal[1]), Math.abs(this.dragNormal[2])];

      positions = [];

      if (absNormal[1] > 0.9) {
        // XZ Plane
        for (let x = 0; x < countX; x++) {
            for (let z = 0; z < countZ; z++) {
                positions.push({
                    position: [minX + x * spacing, this.dragStart[1], minZ + z * spacing],
                    valid: true
                });
            }
        }
      } else if (absNormal[0] > 0.9) {
        // YZ Plane
        for (let y = 0; y < countY; y++) {
            for (let z = 0; z < countZ; z++) {
                positions.push({
                    position: [this.dragStart[0], minY + y * spacing, minZ + z * spacing],
                    valid: true
                });
            }
        }
      } else {
        // XY Plane
        for (let x = 0; x < countX; x++) {
            for (let y = 0; y < countY; y++) {
                positions.push({
                    position: [minX + x * spacing, minY + y * spacing, this.dragStart[2]],
                    valid: true
                });
            }
        }
      }
    } else {
      let pos = position;
      if (options.applySnap && this.context.snapSystem.isEnabled()) {
        pos = this.context.snapSystem.snapPosition(position);
      }
      positions = [{ position: pos, valid: true }];
    }

    const template = new Entity('template');
    template.transform.scale = [...this.currentAsset.scale];
    initializeBaseColor(template, this.currentAsset.color);

    await this.patternPlacer.validatePositions(
      positions, 
      template, 
      options.ignoreEntities ? new Set(options.ignoreEntities) : undefined
    );

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
    this.dragNormal = null;
    return createdEntities;
  }

  cancelPlacement(): void {
    this.patternPlacer.clearPreviewEntities();
    this.dragStart = null;
    this.dragNormal = null;
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
            this.dragNormal = this.lastNormal ? [...this.lastNormal] : [0, 1, 0];
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

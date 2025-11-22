import { Entity } from '@engine/world';
import type { AssetPreset } from '../../types/BlockAssetTypes';
import { PlacementTool, PlacementToolContext, ToolAction } from './PlacementTool';
import { SinglePlacementTool } from './SinglePlacementTool';
import { Vec3 } from '@engine/core/math';
import { initializeBaseColor } from '../../visuals/SelectionVisuals';

export class SymmetryPlacementTool extends PlacementTool {
  private baseTool: SinglePlacementTool;
  private mirrorGhosts: Entity[] = [];
  private mirrorAxis: 'x' | 'z' = 'x';
  private active: boolean = false;

  constructor(context: PlacementToolContext) {
    super(context);
    this.baseTool = new SinglePlacementTool(context);
  }

  startPlacement(asset: AssetPreset): void {
    this.baseTool.startPlacement(asset);
    this.active = true;
  }

  async updatePreview(
    position: Vec3,
    normal: Vec3,
    options: { ignoreEntities?: Entity[]; applySnap?: boolean; targetEntity?: Entity | undefined } = {}
  ): Promise<void> {
    await this.baseTool.updatePreview(position, normal, options);
    
    const baseGhosts = this.baseTool.getPreviewEntities();
    
    while (this.mirrorGhosts.length < baseGhosts.length) {
        const ghost = new Entity('mirror_ghost');
        ghost.userData.isPreview = true;
        this.context.scene.addEntity(ghost);
        this.mirrorGhosts.push(ghost);
    }
    while (this.mirrorGhosts.length > baseGhosts.length) {
        const ghost = this.mirrorGhosts.pop();
        if (ghost) this.context.scene.removeEntity(ghost);
    }

    for (let i = 0; i < baseGhosts.length; i++) {
        const base = baseGhosts[i];
        const mirror = this.mirrorGhosts[i];
        
        const pos = [...base.transform.position] as Vec3;
        if (this.mirrorAxis === 'x') {
            pos[0] = -pos[0];
        } else {
            pos[2] = -pos[2];
        }
        
        mirror.transform.position = pos;
        mirror.transform.rotation = [...base.transform.rotation];
        mirror.transform.scale = [...base.transform.scale];
        
        if (base.userData.previewColor) {
            initializeBaseColor(mirror, base.userData.previewColor as [number, number, number, number]);
            mirror.userData.previewColor = base.userData.previewColor;
        }
    }
  }

  confirmPlacement(): Entity[] | null {
    const baseResult = this.baseTool.confirmPlacement();
    if (!baseResult) return null;
    
    const baseEntities = Array.isArray(baseResult) ? baseResult : [baseResult];
    const newEntities: Entity[] = [...baseEntities];

    for (const base of baseEntities) {
        const mirror = new Entity(base.name + '_mirror');
        const pos = [...base.transform.position] as Vec3;
        if (this.mirrorAxis === 'x') {
            pos[0] = -pos[0];
        } else {
            pos[2] = -pos[2];
        }
        mirror.transform.position = pos;
        mirror.transform.rotation = [...base.transform.rotation];
        mirror.transform.scale = [...base.transform.scale];
        
        if (base.userData.baseColor) {
             initializeBaseColor(mirror, base.userData.baseColor as [number, number, number, number]);
        }
        if (base.userData.blockId) {
            mirror.userData.blockId = base.userData.blockId;
        }

        this.context.scene.addEntity(mirror);
        newEntities.push(mirror);
    }
    
    return newEntities;
  }

  cancelPlacement(): void {
    this.baseTool.cancelPlacement();
    for (const ghost of this.mirrorGhosts) {
        this.context.scene.removeEntity(ghost);
    }
    this.mirrorGhosts = [];
    this.active = false;
  }

  getPreviewEntities(): Entity[] {
    return [...this.baseTool.getPreviewEntities(), ...this.mirrorGhosts];
  }

  isActive(): boolean {
    return this.active;
  }
  
  isValid(): boolean {
      return this.baseTool.isValid();
  }
  
  getAsset(): AssetPreset | null {
      return this.baseTool.getAsset();
  }

  setAxis(axis: 'x' | 'z') {
      this.mirrorAxis = axis;
  }
  
  handleInput(type: 'down' | 'up' | 'move', ray: { origin: Vec3; direction: Vec3 }): ToolAction {
      return this.baseTool.handleInput(type, ray);
  }
}

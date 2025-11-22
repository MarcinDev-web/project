/**
 * PlacementMode - Handles object placement with ghost preview and collision detection.
 * Inspired by block placement systems.
 */

import { Entity, Scene } from '@engine/world';
import type { AssetPreset } from '../types/BlockAssetTypes';
import type { Vec3, Quat } from '@engine/core/math';
import { initializeBaseColor } from '../visuals/SelectionVisuals';
import { CollisionDetector } from './CollisionDetector';
import type { SnapSystem } from '@engine/editor-utils';
import { StaticBlockManager } from '@engine/world';

// Tools
import { PlacementTool, type ToolAction } from './tools/PlacementTool';
import { SinglePlacementTool } from './tools/SinglePlacementTool';
import { LinePlacementTool } from './tools/LinePlacementTool';
import { BoxPlacementTool } from './tools/BoxPlacementTool';
import { PaintPlacementTool } from './tools/PaintPlacementTool';
import { SymmetryPlacementTool } from './tools/SymmetryPlacementTool';

export type { ToolAction };

/**
 * State of the placement preview
 */
export interface PlacementPreview {
  /** Preview entity (ghost) */
  previewEntity: Entity | null;
  /** Whether placement mode is active */
  active: boolean;
  /** Whether current position is valid (no collision) */
  canPlace: boolean;
  /** Asset being placed */
  asset: AssetPreset | null;
  /** Current rotation angle (radians, around Y axis) */
  rotationAngle: number;
  /** Current position */
  position: Vec3 | null;
}

/**
 * Configuration for placement mode
 */
export interface PlacementModeConfig {
  /** Color for valid placement (no collision) */
  validColor: [number, number, number, number];
  /** Color for invalid placement (collision) */
  invalidColor: [number, number, number, number];
  /** Opacity for ghost preview (reserved for future use) */
  ghostOpacity: number;
  /** Rotation increment (radians) */
  rotationIncrement: number;
  /** Contraction applied to preview scale when testing contact vs collision */
  contactTolerance: number;
  /** Enable animations (default: true) */
  animationEnabled?: boolean;
  /** Animation durations in seconds */
  animationDuration?: {
    spawn?: number;
    position?: number;
    rotation?: number;
  };
  /** Called when placement starts with the asset and created preview entity */
  onPlacementStart?: (asset: AssetPreset, previewEntity: Entity) => void;

  onPreviewPositionUpdate?: (position: Vec3, previewEntity: Entity) => void;
  /** Called when collision state toggles; provides colliding entities */
  onCollisionChange?: (canPlace: boolean, colliding: Entity[]) => void;
  /** Called when placement is confirmed with the created entity */
  onPlacementConfirmed?: (entity: Entity) => void;
  /** Called when placement is cancelled by the user */
  onPlacementCancelled?: () => void;
  /** Called when entity is created (for replication) */
  onEntityCreated?: (entity: Entity) => void;
}

/**
 * Default placement mode configuration
 */
const DEFAULT_CONFIG: PlacementModeConfig = {
  validColor: [0.2, 1.0, 0.2, 0.6], // Green with alpha
  invalidColor: [1.0, 0.2, 0.2, 0.6], // Red with alpha
  ghostOpacity: 0.6,
  rotationIncrement: Math.PI / 4, // 45 degrees
  // Slightly larger default tolerance to better treat face contact as non-collision
  contactTolerance: 0.005,
};

export type PlacementToolType = 'single' | 'line' | 'box' | 'paint' | 'symmetry';

/**
 * PlacementMode manages the ghost preview and placement logic.
 */
export class PlacementMode {
  private scene: Scene;
  private snapSystem: SnapSystem;
  private collisionDetector: CollisionDetector;
  private staticBlockManager?: StaticBlockManager | undefined;
  private config: PlacementModeConfig;
  
  private currentToolType: PlacementToolType = 'single';
  private currentTool: PlacementTool;
  private tools: Map<PlacementToolType, PlacementTool> = new Map();

  constructor(
    scene: Scene,
    snapSystem: SnapSystem,
    collisionDetector: CollisionDetector,
    config?: Partial<PlacementModeConfig>,
    staticBlockManager?: StaticBlockManager
  ) {
    this.scene = scene;
    this.snapSystem = snapSystem;
    this.collisionDetector = collisionDetector;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.staticBlockManager = staticBlockManager;

    const context = {
      scene: this.scene,
      snapSystem: this.snapSystem,
      collisionDetector: this.collisionDetector,
      config: this.config,
      staticBlockManager: this.staticBlockManager
    };

    this.tools.set('single', new SinglePlacementTool(context));
    this.tools.set('line', new LinePlacementTool(context));
    this.tools.set('box', new BoxPlacementTool(context));
    this.tools.set('paint', new PaintPlacementTool(context));
    this.tools.set('symmetry', new SymmetryPlacementTool(context));

    this.currentTool = this.tools.get('single')!;
  }

  setTool(type: PlacementToolType): void {
    if (this.currentToolType === type) return;
    
    // If active, transfer state? Or just cancel and restart?
    const wasActive = this.currentTool.isActive();
    const currentAsset = this.currentTool.getAsset();

    this.currentTool.cancelPlacement();
    this.currentToolType = type;
    this.currentTool = this.tools.get(type)!;

    if (wasActive && currentAsset) {
        this.currentTool.startPlacement(currentAsset);
    }
  }
  
  getCurrentToolType(): PlacementToolType {
      return this.currentToolType;
  }

  /**
   * Starts placement mode with the given asset.
   * @param asset - Asset to place (will be validated and normalized)
   */
  startPlacement(asset: AssetPreset): void {
    this.currentTool.startPlacement(asset);
  }

  /**
   * Updates the preview position based on raycast results.
   * @param position - World space position from raycast
   * @param options - Update options
   */
  async updatePreviewPosition(
    position: Vec3,
    options: { ignoreEntities?: Entity[]; applySnap?: boolean; surfaceNormal?: Vec3; targetEntity?: Entity | undefined } = {}
  ): Promise<void> {
    const normal = options.surfaceNormal || [0, 1, 0];
    await this.currentTool.updatePreview(position, normal, options);
  }

  /**
   * Confirms placement at current valid position.
   * @returns The created entity if successful, null otherwise
   */
  confirmPlacement(): Entity | null {
    const result = this.currentTool.confirmPlacement();
    if (Array.isArray(result)) {
        return result[0] || null; // Return first entity for backward compatibility
    }
    return result;
  }

  /**
   * Cancels current placement mode.
   */
  cancelPlacement(): void {
    this.currentTool.cancelPlacement();
  }

  /**
   * Checks if placement mode is active.
   */
  isActive(): boolean {
    return this.currentTool.isActive();
  }

  /**
   * Gets the current preview entity (primary).
   */
  getPreviewEntity(): Entity | null {
    const entities = this.currentTool.getPreviewEntities();
    return entities[0] ?? null;
  }
  
  /**
   * Gets all preview entities.
   */
  getPreviewEntities(): Entity[] {
      return this.currentTool.getPreviewEntities();
  }

  /**
   * Gets the current preview state.
   * @deprecated Use specialized methods on tools or this.getPreviewEntities()
   */
  getPreview(): PlacementPreview {
    // Construct backward compatible preview object
    const entities = this.currentTool.getPreviewEntities();
    const entity = entities[0] || null;
    
    // Try to get internal preview state from SinglePlacementTool for rotation/pos
    // Or construct from entity
    let rotationAngle = 0;
    let position: Vec3 | null = null;

    if (this.currentTool instanceof SinglePlacementTool) {
        const state = this.currentTool.getPreviewState();
        rotationAngle = state.rotationAngle;
        position = state.position;
    } else if (entity) {
        position = entity.transform.position as Vec3;
    }

    return {
      previewEntity: entity,
      active: this.currentTool.isActive(),
      canPlace: this.currentTool.isValid(),
      asset: this.currentTool.getAsset(),
      rotationAngle,
      position,
    };
  }
  
  getConfig(): PlacementModeConfig {
      return this.config;
  }

  setConfig(config: Partial<PlacementModeConfig>): void {
      this.config = { ...this.config, ...config };
  }
  
  /**
   * Rotates the preview.
   */
  rotatePreview(direction: number = 1): void {
      if (this.currentTool instanceof SinglePlacementTool) {
          this.currentTool.rotatePreview(direction);
      }
  }
  
  /**
   * Handles input event (for tools that need drag/interaction).
   */
  handleInput(type: 'down' | 'up' | 'move', ray: { origin: Vec3; direction: Vec3 }): ToolAction {
      return this.currentTool.handleInput(type, ray);
  }
  
  placeEntityFromTemplate(
    template: Entity,
    options: {
      position?: Vec3;
      rotation?: Quat;
      scale?: Vec3;
      asset?: AssetPreset | null;
      emitPlacementConfirmed?: boolean;
    } = {}
  ): Entity {
    const {
      position = template.transform.position,
      rotation = template.transform.rotation,
      scale = template.transform.scale,
      asset = null,
      emitPlacementConfirmed = true,
    } = options;

    // Optimization: Use StaticBlockManager for blocks if available and asset has blockId
    if (this.staticBlockManager && asset?.blockId) {
      this.staticBlockManager.addBlock({
        assetName: asset.name,
        position: [...position] as [number, number, number],
        rotation: [...rotation] as [number, number, number, number],
        scale: [...scale] as [number, number, number],
        color: (asset.color || [1, 1, 1, 1]) as [number, number, number, number],
        blockId: asset.blockId,
        meshType: 'cube',
        materialId: 0,
      });

      // Return a dummy entity as handle
      const dummy = new Entity(asset.name);
      dummy.transform.position = [...position] as Vec3;
      return dummy;
    }

    const name = asset ? asset.name : template.name.replace('_preview', '');
    const entity = new Entity(name);

    entity.transform.position = [...position] as Vec3;
    entity.transform.rotation = [...rotation] as Quat;
    entity.transform.scale = [...scale] as Vec3;

    if (asset) {
      initializeBaseColor(entity, asset.color);
      if (asset.blockId) {
        entity.userData.blockId = asset.blockId;
      }
    } else {
      // Fallback to template color if available
      const templateColor = template.userData.previewColor || template.userData.color;
      if (templateColor) {
        initializeBaseColor(entity, templateColor as any);
      }
    }

    this.scene.addEntity(entity);
    this.config.onEntityCreated?.(entity);

    if (emitPlacementConfirmed) {
      this.config.onPlacementConfirmed?.(entity);
    }

    return entity;
  }
}

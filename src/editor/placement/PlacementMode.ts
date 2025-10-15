/**
 * PlacementMode - Handles object placement with ghost preview and collision detection.
 * Inspired by Minecraft's block placement system.
 */

import { Entity } from '../../scene/Entity';
import type { Scene } from '../../scene/Scene';
import type { Vec3, Quat } from '../../math';
import { CollisionDetector } from './CollisionDetector';
import type { SnapSystem } from '../snap/SnapSystem';
import { MaterialComponent } from '../../scene/components/MaterialComponent';
import type { AssetPreset } from '../assets/AssetTypes';
import { initializeBaseColor } from '../visuals/SelectionVisuals';
import { Logger } from '../../logger';

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
  /** Called when placement starts with the asset and created preview entity */
  onPlacementStart?: (asset: AssetPreset, previewEntity: Entity) => void;
  /** Called whenever preview position updates (after snapping) */
  onPreviewPositionUpdate?: (position: Vec3, previewEntity: Entity) => void;
  /** Called when collision state toggles; provides colliding entities */
  onCollisionChange?: (canPlace: boolean, colliding: Entity[]) => void;
  /** Called when placement is confirmed with the created entity */
  onPlacementConfirmed?: (entity: Entity) => void;
  /** Called when placement is cancelled by the user */
  onPlacementCancelled?: () => void;
}

/**
 * Default placement mode configuration
 */
const DEFAULT_CONFIG: PlacementModeConfig = {
  validColor: [0.2, 1.0, 0.2, 0.6], // Green with alpha
  invalidColor: [1.0, 0.2, 0.2, 0.6], // Red with alpha
  ghostOpacity: 0.6,
  rotationIncrement: Math.PI / 4, // 45 degrees
  contactTolerance: 0.001,
};

/**
 * PlacementMode manages the ghost preview and placement logic.
 */
export class PlacementMode {
  private scene: Scene;
  private snapSystem: SnapSystem;
  private collisionDetector: CollisionDetector;
  private config: PlacementModeConfig;
  private preview: PlacementPreview;

  constructor(
    scene: Scene,
    snapSystem: SnapSystem,
    collisionDetector: CollisionDetector,
    config?: Partial<PlacementModeConfig>
  ) {
    this.scene = scene;
    this.snapSystem = snapSystem;
    this.collisionDetector = collisionDetector;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.preview = {
      previewEntity: null,
      active: false,
      canPlace: false,
      asset: null,
      rotationAngle: 0,
      position: null,
    };
  }

  /**
   * Starts placement mode with the given asset.
   * @param asset - Asset to place
   */
  startPlacement(asset: AssetPreset): void {
    // Cancel any existing placement
    this.cancelPlacement();

    // Create preview entity
    const previewEntity = new Entity(`${asset.name}_preview`);
    previewEntity.transform.scale = [...asset.scale];

    // Set base color from asset (preserve tuple type)
    initializeBaseColor(previewEntity, asset.color);

    // Mark as preview (not added to scene yet)
    previewEntity.userData.isPreview = true;
    previewEntity.userData.asset = asset.name;

    // Delay adding to scene until first position update to avoid origin flash

    this.preview = {
      previewEntity,
      active: true,
      canPlace: false,
      asset,
      rotationAngle: 0,
      position: null,
    };

    // Notify listeners that placement has started
    this.config.onPlacementStart?.(asset, previewEntity);
  }

  /**
   * Updates the preview position based on world position (e.g., from raycast).
   * @param worldPosition - Target position in world space
   */
  updatePreviewPosition(
    worldPosition: Vec3,
    options?: { ignoreEntities?: Set<Entity> | Entity[] }
  ): void {
    if (!this.preview.active || !this.preview.previewEntity) {
      return;
    }

    // Lazily add preview to scene on first valid update to avoid flashing at origin
    if (!this.preview.previewEntity.scene) {
      this.scene.addEntity(this.preview.previewEntity);
    }

    // Apply snap to position
    const snappedPosition = this.snapSystem.snapPosition(worldPosition);
    this.preview.position = snappedPosition;

    // Update preview entity position
    this.preview.previewEntity.transform.position = snappedPosition;

    // Notify listeners about position update
    this.config.onPreviewPositionUpdate?.(snappedPosition, this.preview.previewEntity);

    // Check collision at this position
    // Use precise OBB collision check
    let excludeSet: Set<Entity> | undefined;
    if (options?.ignoreEntities) {
      excludeSet = Array.isArray(options.ignoreEntities)
        ? new Set(options.ignoreEntities)
        : options.ignoreEntities;
    }
    // Use a slight contraction on the preview's scale to treat face-to-face contact as non-collision
    const s = this.preview.previewEntity.transform.scale;
    // Make contact tolerance scale-aware: treat it as a fraction of the smallest dimension
    const minDim = Math.min(Math.abs(s[0]), Math.abs(s[1]), Math.abs(s[2]));
    const CONTACT_TOLERANCE = Math.max(0, this.config.contactTolerance * (Number.isFinite(minDim) ? minDim : 1));
    const testScale: Vec3 = [
      Math.max(0.001, s[0] - CONTACT_TOLERANCE),
      Math.max(0.001, s[1] - CONTACT_TOLERANCE),
      Math.max(0.001, s[2] - CONTACT_TOLERANCE),
    ];

    const collisionResult = this.collisionDetector.checkCollisionOBB(
      this.preview.previewEntity,
      snappedPosition,
      this.preview.previewEntity.transform.rotation,
      testScale,
      excludeSet
    );

    const prevCanPlace = this.preview.canPlace;
    this.preview.canPlace = !collisionResult.hasCollision;

    // Emit collision state change only when toggled
    const tintInitialized = this.preview.previewEntity.userData.__placementTintApplied === true;
    if (prevCanPlace !== this.preview.canPlace) {
      this.config.onCollisionChange?.(this.preview.canPlace, collisionResult.collidingEntities);
      this.updatePreviewColor();
    } else if (!tintInitialized) {
      // Ensure initial tint gets applied on first update
      this.updatePreviewColor();
    }
  }

  /**
   * Rotates the preview by the configured increment.
   * @param direction - 1 for clockwise, -1 for counter-clockwise
   */
  rotatePreview(direction: 1 | -1): void {
    if (!this.preview.active || !this.preview.previewEntity) {
      return;
    }

    this.preview.rotationAngle += direction * this.config.rotationIncrement;

    // Normalize angle to [0, 2π) using modulo
    const TWO_PI = Math.PI * 2;
    this.preview.rotationAngle = ((this.preview.rotationAngle % TWO_PI) + TWO_PI) % TWO_PI;

    // Update entity rotation (around Y axis)
    const halfAngle = this.preview.rotationAngle / 2;
    const quat: Quat = [0, Math.sin(halfAngle), 0, Math.cos(halfAngle)];
    this.preview.previewEntity.transform.rotation = quat;

    // Re-check collision after rotation
    if (this.preview.position) {
      this.updatePreviewPosition(this.preview.position);
    }

    // Force any renderer to pick up rotation change (handled by owner UI)
  }

  /**
   * Confirms the placement and creates the actual entity.
   * @returns Placed entity or null if placement failed
   */
  confirmPlacement(): Entity | null {
    if (!this.preview.active || !this.preview.previewEntity || !this.preview.canPlace) {
      return null;
    }

    // Create actual entity from preview
    const entity = new Entity(this.preview.asset?.name ?? 'Object');
    entity.transform.position = this.preview.previewEntity.transform.position;
    entity.transform.rotation = this.preview.previewEntity.transform.rotation;
    entity.transform.scale = this.preview.previewEntity.transform.scale;

    // Initialize color of the placed entity from asset color (not the tinted preview)
    if (this.preview.asset?.color) {
      initializeBaseColor(entity, this.preview.asset.color);
    }
    if (this.preview.asset) {
      entity.userData.asset = this.preview.asset.name;
    }

    // Assign material based on asset type/color to vary atlas usage
    try {
      const mat = entity.getComponent(MaterialComponent) ?? entity.addComponent(new MaterialComponent());
      const assetColor = this.preview.asset?.color ?? entity.color;
      mat.materialId = this.chooseMaterialIdForAsset(this.preview.asset ?? null, assetColor);
    } catch (e) {
      Logger.warn('PlacementMode: Failed to assign materialId', e);
    }

    // Add to scene
    this.scene.addEntity(entity);

    // Notify before clearing preview
    this.config.onPlacementConfirmed?.(entity);

    // Clear preview silently (do not emit cancel event)
    this.cancelPlacement(true);

    return entity;
  }

  /**
   * Heuristic to choose a materialId for the atlas from asset/block info or color.
   * Matches names in TextureAtlas default set: default(0), stone(1), wood(2), metal(3), grass(4),
   * dirt(5), brick(6), glass(7), gold(8), sand(9), plastic_red(10), plastic_blue(11),
   * plastic_green(12), plastic_yellow(13), concrete(14), ice(15)
   */
  private chooseMaterialIdForAsset(asset: AssetPreset | null, color: [number, number, number, number]): number {
    const blockId = asset?.blockId ?? '';
    const id = blockId.toLowerCase();
    // Direct mappings by block id when available
    if (id.includes('grass')) return 4;
    if (id.includes('dirt')) return 5;
    if (id.includes('stone') && !id.includes('brick')) return 1;
    if (id.includes('brick')) return 6;
    if (id.includes('wood') || id.includes('plank')) return 2;
    if (id.includes('glass')) return 7;
    if (id.includes('gold')) return 8;
    if (id.includes('sand')) return 9;
    if (id.includes('plastic_red')) return 10;
    if (id.includes('plastic_blue')) return 11;
    if (id.includes('plastic_green')) return 12;
    if (id.includes('plastic_yellow')) return 13;

    // Fallback based on color dominance
    const r = color?.[0] ?? 0.7;
    const g = color?.[1] ?? 0.7;
    const b = color?.[2] ?? 0.7;
    const max = Math.max(r, g, b);
    if (max === r) return 10; // red plastic
    if (max === g) return 12; // green plastic
    if (max === b) return 11; // blue plastic
    // Neutral fallback
    return 14; // concrete
  }

  /**
   * Cancels placement mode and removes preview.
   */
  cancelPlacement(silent = false): void {
    const wasActive = this.preview.active;
    if (this.preview.previewEntity) {
      // Remove from scene if it was added
      if (this.preview.previewEntity.scene) {
        this.scene.removeEntity(this.preview.previewEntity);
      }
    }

    this.preview = {
      previewEntity: null,
      active: false,
      canPlace: false,
      asset: null,
      rotationAngle: 0,
      position: null,
    };

    if (wasActive && !silent) {
      this.config.onPlacementCancelled?.();
    }
  }

  /**
   * Updates the preview color based on collision state.
   */
  private updatePreviewColor(): void {
    if (!this.preview.previewEntity) {
      return;
    }

    const src = this.preview.canPlace ? this.config.validColor : this.config.invalidColor;
    const alpha = Math.max(0, Math.min(1, src[3] * this.config.ghostOpacity));
    const c = this.preview.previewEntity.color ?? [1, 1, 1, 1];
    c[0] = src[0];
    c[1] = src[1];
    c[2] = src[2];
    c[3] = alpha;
    this.preview.previewEntity.color = c;
    // Mark that tint has been applied at least once
    this.preview.previewEntity.userData.__placementTintApplied = true;
  }

  /**
   * Checks if placement mode is currently active.
   */
  isActive(): boolean {
    return this.preview.active;
  }

  /**
   * Gets the current preview state.
   */
  getPreview(): PlacementPreview {
    return {
      ...this.preview,
      position: this.preview.position ? [...this.preview.position] : null,
    };
  }

  /**
   * Gets the preview entity (for rendering).
   */
  getPreviewEntity(): Entity | null {
    return this.preview.previewEntity;
  }

  /**
   * Updates the configuration.
   */
  setConfig(config: Partial<PlacementModeConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.preview.active) {
      this.updatePreviewColor();
    }
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): PlacementModeConfig {
    return { ...this.config };
  }
}

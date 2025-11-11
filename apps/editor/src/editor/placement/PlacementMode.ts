/**
 * PlacementMode - Handles object placement with ghost preview and collision detection.
 * Inspired by Minecraft's block placement system.
 */

import { Entity, MaterialComponent, LightComponent, PhysicsComponent, RigidbodyType, VegetationComponent, VegetationType, NpcComponent, CharacterController, WeaponComponent } from '@engine/world';
import type { VegetationConfig } from '@engine/world';
import type { Scene } from '@engine/world';
import type { Vec3, Quat } from '@engine/core/math';
import { CollisionDetector } from './CollisionDetector';
import type { SnapSystem } from '@engine/editor-utils';
import type { AssetPreset } from '../types/BlockAssetTypes';
import { initializeBaseColor } from '../visuals/SelectionVisuals';
import { Logger } from '../../utils/logger';
import { getBlock } from '@engine/blocks';
import { PlacementAnimator } from './PlacementAnimator';
import { warmupCollisionWorker } from '../../wasm/collisionWorkerClient';

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
  /** Called whenever preview position updates (after snapping) */
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

/**
 * PlacementMode manages the ghost preview and placement logic.
 */
export class PlacementMode {
  private scene: Scene;
  private snapSystem: SnapSystem;
  private collisionDetector: CollisionDetector;
  private config: PlacementModeConfig;
  private preview: PlacementPreview;
  private animator: PlacementAnimator;
  /** Track the latest update request ID to ignore stale collision results */
  private lastUpdateId = 0;

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

    // Create animator with config
    this.animator = new PlacementAnimator({
      enabled: this.config.animationEnabled !== false,
      duration: {
        spawn: this.config.animationDuration?.spawn ?? 0.2,
        position: this.config.animationDuration?.position ?? 0.1,
        rotation: this.config.animationDuration?.rotation ?? 0.15,
      },
    });
  }

  /**
   * Starts placement mode with the given asset.
   * @param asset - Asset to place
   */
  startPlacement(asset: AssetPreset): void {
    // Cancel any existing placement
    this.cancelPlacement();

    // Warm up collision worker early to avoid first-use stall when rotating/checking
    try { warmupCollisionWorker(); } catch {}

    // Create preview entity (not added to scene - no ghost/preview visible)
    const previewEntity = new Entity(`${asset.name}_preview`);

    // Set base color from asset (preserve tuple type)
    initializeBaseColor(previewEntity, asset.color);

    // Mark as preview (not added to scene - no ghost/preview visible)
    previewEntity.userData.isPreview = true;
    previewEntity.userData.asset = asset.name;

    // Set initial position and scale (preview is not added to scene - no ghost/preview visible)
    previewEntity.transform.position = [0, -1000, 0];
    previewEntity.transform.scale = [...asset.scale];
    
    // Preview entity is NOT added to scene - no ghost/preview rendering
    // It's only used internally for collision detection and position tracking

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
   * 
   * Race condition protection: Uses request ID tracking to prevent stale collision
   * results from overwriting newer ones. If multiple updates are triggered rapidly
   * (e.g., fast mouse movement), only the latest collision check result is applied.
   * 
   * @param worldPosition - Target position in world space
   */
  async updatePreviewPosition(
    worldPosition: Vec3,
    options?: { ignoreEntities?: Set<Entity> | Entity[]; applySnap?: boolean }
  ): Promise<void> {
    if (!this.preview.active || !this.preview.previewEntity) {
      return;
    }

    // Increment update ID to track the latest request
    // This prevents race conditions where old collision checks complete after new ones
    const updateId = ++this.lastUpdateId;

    // Preview entity is already added to scene in startPlacement() to ensure spawn animation is visible

    // Apply snap to position unless explicitly disabled
    const shouldSnap = options?.applySnap !== false;
    const targetPosition: Vec3 = shouldSnap
      ? this.snapSystem.snapPosition(worldPosition)
      : ([worldPosition[0], worldPosition[1], worldPosition[2]] as Vec3);
    this.preview.position = targetPosition;

    // Update position directly (no animation, preview not visible anyway)
    this.preview.previewEntity.transform.position = [...targetPosition];

    // Notify listeners about position update
    this.config.onPreviewPositionUpdate?.(targetPosition, this.preview.previewEntity);

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

    const collisionResult = await this.collisionDetector.checkCollisionOBB(
      this.preview.previewEntity,
      targetPosition,
      this.preview.previewEntity.transform.rotation,
      testScale,
      excludeSet
    );

    // Ignore stale results from previous update requests
    // This check prevents race conditions: if a newer update started while this collision
    // check was running, we discard this result to avoid overwriting newer state
    if (updateId !== this.lastUpdateId || !this.preview.active || !this.preview.previewEntity) {
      return;
    }

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
  async rotatePreview(direction: 1 | -1): Promise<void> {
    if (!this.preview.active || !this.preview.previewEntity) {
      return;
    }

    this.preview.rotationAngle += direction * this.config.rotationIncrement;

    // Normalize angle to [0, 2π) using modulo
    const TWO_PI = Math.PI * 2;
    this.preview.rotationAngle = ((this.preview.rotationAngle % TWO_PI) + TWO_PI) % TWO_PI;

    // Calculate target rotation (around Y axis)
    const halfAngle = this.preview.rotationAngle / 2;
    const targetQuat: Quat = [0, Math.sin(halfAngle), 0, Math.cos(halfAngle)];

    // Update rotation directly (no animation, preview not visible anyway)
    this.preview.previewEntity.transform.rotation = [...targetQuat];

    // Re-check collision after rotation
    // Note: This is intentionally fire-and-forget (void) to keep rotation UI responsive.
    // The request ID tracking in updatePreviewPosition ensures stale collision results
    // are ignored if the user rotates again quickly. The collision check will complete
    // asynchronously and update the preview color when done.
    if (this.preview.position) {
      void this.updatePreviewPosition(this.preview.position);
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

    const entity = this.placeEntityFromTemplate(this.preview.previewEntity, {
      position: this.preview.previewEntity.transform.position,
      rotation: this.preview.previewEntity.transform.rotation,
      scale: this.preview.previewEntity.transform.scale,
      asset: this.preview.asset,
      emitPlacementConfirmed: true,
    });

    // Clear preview silently (do not emit cancel event)
    this.cancelPlacement(true);

    return entity;
  }

  /**
   * Places an entity in the scene based on a template entity and optional asset metadata.
   * The template is typically the placement preview. Emits placement events when requested.
   */
  placeEntityFromTemplate(
    template: Entity,
    options: {
      position: Vec3;
      rotation: Quat;
      scale: Vec3;
      asset?: AssetPreset | null;
      emitPlacementConfirmed?: boolean;
    }
  ): Entity {
    const { position, rotation, scale, asset = null, emitPlacementConfirmed = false } = options;

    const entityName = asset?.name ?? template.name ?? 'Object';
    const entity = new Entity(entityName);
    entity.transform.position = [...position];
    entity.transform.rotation = [...rotation];
    entity.transform.scale = [...scale];

    const templateBaseColor = template.userData.baseColor as [number, number, number, number] | undefined;
    const templateTint = template.color as [number, number, number, number] | undefined;
    const assetBaseColor = asset?.color;
    const finalColor = templateBaseColor ?? assetBaseColor ?? templateTint;
    if (finalColor) {
      initializeBaseColor(entity, finalColor);
    }

    const assetName = asset?.name ?? (template.userData.asset as string | undefined);
    if (assetName) {
      entity.userData.asset = assetName;
    }

    const blockId = asset?.blockId ?? (template.userData.blockId as string | undefined);
    if (blockId) {
      entity.userData.blockId = blockId;
    }

    try {
      const material = entity.getComponent(MaterialComponent) ?? entity.addComponent(new MaterialComponent());
      const colorForMaterial = asset?.color ?? (entity.color as [number, number, number, number] | undefined);
      const fallbackColor: [number, number, number, number] = colorForMaterial ?? [0.7, 0.7, 0.7, 1];
      material.materialId = this.chooseMaterialIdForAsset(asset ?? null, fallbackColor);
    } catch (error) {
      Logger.warn('PlacementMode: Failed to assign materialId', error);
    }

    this.applyBlockSpecialProperties(entity, blockId);

    if (asset?.vegetationConfig) {
      this.applyVegetationProperties(entity, asset.vegetationConfig);
    }

    if (asset?.npcConfig) {
      this.applyNpcProperties(entity, asset.npcConfig);
    }

    this.scene.addEntity(entity);
    this.config.onEntityCreated?.(entity);

    if (emitPlacementConfirmed) {
      this.config.onPlacementConfirmed?.(entity);
    }

    return entity;
  }

  /**
   * Applies special properties for blocks that need them (lights, glass, etc.)
   * @param entity - The entity to apply properties to
   * @param blockId - The block ID from the asset preset
   */
  private applyBlockSpecialProperties(entity: Entity, blockId?: string): void {
    if (!blockId) {
      return;
    }

    const blockDef = getBlock(blockId);
    if (!blockDef) {
      return;
    }

    // Handle light blocks - add LightComponent for point light emission
    if (blockId === 'light_white') {
      const lightComp = new LightComponent();
      lightComp.lightType = 'point';
      lightComp.color = [1, 1, 1]; // White light
      lightComp.intensity = blockDef.properties.emissive;
      lightComp.range = 10.0; // Reasonable range for point light
      entity.addComponent(lightComp);
    }

    // Handle glass blocks - configure material for transparency
    if (blockId === 'glass_clear') {
      const mat = entity.getComponent(MaterialComponent);
      if (mat) {
        // Get opacity from block definition (alpha from texture color)
        const opacity = blockDef.textures.top.color[3] ?? 0.3;
        mat.opacity = opacity;
        // MaterialComponent will automatically set alphaMode='blend' when opacity < 0.999
        
        // Set metallic and roughness from block definition
        mat.metallic = blockDef.properties.metallic;
        mat.roughness = blockDef.properties.roughness;
      }
    }

    // Store blockId in userData for BlockBehaviorSystem
    entity.userData.blockId = blockId;

    // Handle natural blocks - add physics properties
    if (blockId === 'grass' || blockId === 'dirt' || blockId === 'stone') {
      let physics = entity.getComponent(PhysicsComponent);
      if (!physics) {
        physics = entity.addComponent(new PhysicsComponent());
      }

      // Set as static (terrain blocks don't move)
      physics.rigidbodyType = RigidbodyType.Static;

      // Configure physics material properties based on block type
      if (blockId === 'grass') {
        // Grass: soft, low friction (slippery), low density, low restitution
        physics.material.friction = 0.3;
        physics.material.restitution = 0.1;
        physics.material.density = 0.6;
      } else if (blockId === 'dirt') {
        // Dirt: medium properties, higher friction, medium density, low restitution
        physics.material.friction = 0.7;
        physics.material.restitution = 0.05;
        physics.material.density = 1.0;
      } else if (blockId === 'stone') {
        // Stone: hard, high friction, high density, no bounce
        physics.material.friction = 0.9;
        physics.material.restitution = 0.0;
        physics.material.density = 2.5;
      }

      // Add box collider matching the entity scale (half extents)
      if (physics.colliders.length === 0) {
        const scale = entity.transform.scale;
        const halfExtents: Vec3 = [
          Math.abs(scale[0]) / 2,
          Math.abs(scale[1]) / 2,
          Math.abs(scale[2]) / 2,
        ];
        physics.addBoxCollider(halfExtents, [0, 0, 0], false);
      }
    }

    // Handle gameplay blocks (ice, slime, lava, poison) - add physics properties
    if (blockId === 'ice' || blockId === 'slime' || blockId === 'lava' || blockId === 'poison') {
      let physics = entity.getComponent(PhysicsComponent);
      if (!physics) {
        physics = entity.addComponent(new PhysicsComponent());
      }

      // Set as static (blocks don't move)
      physics.rigidbodyType = RigidbodyType.Static;

      // Add box collider for collision detection
      if (physics.colliders.length === 0) {
        const scale = entity.transform.scale;
        const halfExtents: Vec3 = [
          Math.abs(scale[0]) / 2,
          Math.abs(scale[1]) / 2,
          Math.abs(scale[2]) / 2,
        ];
        physics.addBoxCollider(halfExtents, [0, 0, 0], false);
      }
    }
  }

  /**
   * Applies vegetation properties to entity
   * @param entity - The entity to apply vegetation properties to
   * @param vegetationConfig - Vegetation configuration from asset preset
   */
  private applyVegetationProperties(
    entity: Entity,
    vegetationConfig: AssetPreset['vegetationConfig']
  ): void {
    if (!vegetationConfig) {
      return;
    }

    // Map string type to VegetationType enum
    const vegetationTypeMap: Record<string, VegetationType> = {
      grass: VegetationType.Grass,
      flower: VegetationType.Flower,
      shrub: VegetationType.Shrub,
      tree: VegetationType.Tree,
      custom: VegetationType.Custom,
    };

    const vegetationType = vegetationTypeMap[vegetationConfig.type] ?? VegetationType.Grass;

    // Create VegetationComponent
    // Build config object with conditional optional properties to satisfy exactOptionalPropertyTypes
    const config: Partial<VegetationConfig> = {
      type: vegetationType,
      height: entity.transform.scale[1], // Use Y scale as height
      radius: Math.max(entity.transform.scale[0], entity.transform.scale[2]) / 2, // Use X/Z for radius
      canBeHarvested: vegetationConfig.canBeHarvested ?? false,
      windStrength: vegetationConfig.windStrength ?? 0.3,
      windFrequency: vegetationConfig.windFrequency ?? 1.0,
      colorVariation: 0.1,
      scaleVariation: 0.15,
    };

    // Only include optional properties when they're defined
    if (vegetationConfig.billboardTexture !== undefined) {
      config.billboardTexture = vegetationConfig.billboardTexture;
    }
    if (vegetationConfig.modelUrl !== undefined) {
      config.modelUrl = vegetationConfig.modelUrl;
    }
    if (vegetationConfig.harvestTime !== undefined) {
      config.harvestTime = vegetationConfig.harvestTime;
    }

    entity.addComponent(new VegetationComponent(config));

    // Store vegetation type in userData for easy identification
    entity.userData.vegetationType = vegetationConfig.type;

    // For billboard types (grass, flowers), ensure mesh type is appropriate
    if (vegetationType === VegetationType.Grass || vegetationType === VegetationType.Flower) {
      // Billboard rendering handles geometry, but ensure entity has basic components
      if (!entity.getComponent(MaterialComponent)) {
        entity.addComponent(new MaterialComponent());
      }
    }
  }

  /**
   * Applies NPC properties to an entity
   * @param entity - The entity to apply properties to
   * @param npcConfig - The NPC configuration from the asset preset
   */
  private applyNpcProperties(
    entity: Entity,
    npcConfig: AssetPreset['npcConfig']
  ): void {
    if (!npcConfig) {
      return;
    }

    // Create NpcComponent with configuration
    // For guard-position behavior, set guard position to entity position if not specified
    let guardPosition = npcConfig.guardPosition;
    if (npcConfig.behavior === 'guard-position' && !guardPosition) {
      guardPosition = [
        entity.transform.position[0],
        entity.transform.position[1],
        entity.transform.position[2],
      ];
    }

    const npcComponent = new NpcComponent({
      unitType: npcConfig.unitType ?? 'soldier',
      faction: npcConfig.faction ?? 'neutral',
      behavior: npcConfig.behavior ?? 'idle',
      armyId: npcConfig.armyId ?? '',
      ...(npcConfig.patrolWaypoints !== undefined && { patrolWaypoints: npcConfig.patrolWaypoints }),
      ...(npcConfig.patrolSpeed !== undefined && { patrolSpeed: npcConfig.patrolSpeed }),
      ...(guardPosition !== undefined && { guardPosition }),
      ...(npcConfig.guardRadius !== undefined && { guardRadius: npcConfig.guardRadius }),
      ...(npcConfig.detectionRange !== undefined && { detectionRange: npcConfig.detectionRange }),
    });
    entity.addComponent(npcComponent);

    // Add CharacterController for movement
    if (!entity.getComponent(CharacterController)) {
      const controller = new CharacterController({
        moveSpeed: npcConfig.patrolSpeed ?? 3.0,
        autoRotate: true,
      });
      entity.addComponent(controller);
    }

    // Add PhysicsComponent if not present (required for CharacterController)
    if (!entity.getComponent(PhysicsComponent)) {
      const physics = new PhysicsComponent();
      physics.rigidbodyType = RigidbodyType.Dynamic;
      physics.mass = 70; // Average human mass
      physics.useGravity = true;
      physics.linearDrag = 5;
      physics.addCapsuleCollider(0.5, 2.0); // Radius 0.5, height 2.0
      physics.freezeRotationX = true;
      physics.freezeRotationZ = true;
      entity.addComponent(physics);
    }

    // Add WeaponComponent for combat behaviors (soldier, guard)
    if ((npcConfig.unitType === 'soldier' || npcConfig.unitType === 'guard') && 
        !entity.getComponent(WeaponComponent)) {
      const weapon = new WeaponComponent({
        type: 'hitscan',
        damage: 25,
        fireRate: 10,
        range: 100,
        ammo: 30,
        maxAmmo: 30,
      });
      entity.addComponent(weapon);
    }

    // Store NPC type in userData for easy identification
    entity.userData.npcType = npcConfig.unitType;
    entity.userData.npcFaction = npcConfig.faction;
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
    
    // Cancel any active animations
    this.animator.cancel();
    
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

    // Update animator config if animation settings changed
    if (config.animationEnabled !== undefined || config.animationDuration !== undefined) {
      this.animator.setConfig({
        enabled: this.config.animationEnabled !== false,
        duration: {
          spawn: this.config.animationDuration?.spawn ?? 0.2,
          position: this.config.animationDuration?.position ?? 0.1,
          rotation: this.config.animationDuration?.rotation ?? 0.15,
        },
      });
    }
  }

  /**
   * Gets the current configuration.
   */
  getConfig(): PlacementModeConfig {
    return { ...this.config };
  }
}

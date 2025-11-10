import { Entity } from '@engine/world';
import { AnimationComponent } from '@engine/stdlib/Animation';
import { getVec3Pool } from '@engine/core/utils/Vec3Pool';
import { AvatarAnimationPlayer, type AvatarAnimation } from './animation';
import { avatarAnimationToClip } from './animation-adapter';
import { avatarSkeletonToSkeleton } from './skeleton-adapter';
import {
  AVATAR_SLOTS,
  type AvatarPartDefinition,
  type AvatarPartLibrary,
  type AvatarSlot,
} from './slots';
import { AvatarSkeleton, DEFAULT_AVATAR_JOINTS, type AvatarJointName } from './skeleton';
import type { RgbaColor } from '@engine/world';
import { cloneColorRecord } from './utils/clone';
import { AvatarMeshGenerator } from './mesh/avatar-mesh-generator';
import { AvatarMaterialManager } from './material/avatar-material-manager';
import { AvatarColorManager } from './color/avatar-color-manager';
import { AvatarPartMountManager } from './mount/avatar-part-mount-manager';
import { AvatarLoadoutSerializer } from './serialization/avatar-loadout-serializer';
import { DEFAULT_AVATAR_PART_DEFINITIONS } from './default-parts';
import { DEFAULT_AVATAR_LOADOUT } from './default-loadout';
import { createAvatarPartLibrary } from './part-library-factory';

interface AvatarPartSelectionState {
  id: string;
  definition: AvatarPartDefinition;
  colors?: Record<string, RgbaColor>;
  materialId?: string;
  appliedColors?: Record<string, RgbaColor>;
}

export interface AvatarMaterialBinding {
  readonly materialId?: number;
  readonly color?: RgbaColor;
  readonly metallic?: number;
  readonly roughness?: number;
}

export interface AvatarLoadoutPart {
  mesh: string;
  mat?: string;
  material?: string;
  colors?: Record<string, RgbaColor>;
}

export interface AvatarLoadout {
  readonly version: number;
  readonly parts: Partial<Record<AvatarSlot, AvatarLoadoutPart>>;
}

export type AvatarMaterialResolver = (id: string) => AvatarMaterialBinding | null | undefined;

export interface AvatarInstanceOptions {
  readonly name?: string;
  readonly partLibrary?: AvatarPartLibrary;
  readonly loadout?: AvatarLoadout;
  readonly materialResolver?: AvatarMaterialResolver;
  readonly strictMode?: boolean;
}

export class AvatarInstance {
  private readonly root: Entity;
  private readonly skeleton: AvatarSkeleton;
  private readonly animator: AvatarAnimationPlayer; // Deprecated: kept for backward compatibility
  private readonly partLibrary: AvatarPartLibrary;
  private readonly jointEntities = new Map<AvatarJointName, Entity>();
  private readonly slotEntities = new Map<AvatarSlot, Entity>();
  private readonly selections = new Map<AvatarSlot, AvatarPartSelectionState>();
  private readonly meshGenerator: AvatarMeshGenerator;
  private readonly materialManager: AvatarMaterialManager;
  private readonly colorManager: AvatarColorManager;
  private readonly mountManager: AvatarPartMountManager;
  private readonly serializer: AvatarLoadoutSerializer;
  private readonly strictMode: boolean;

  constructor(parent: Entity, options: AvatarInstanceOptions = {}) {
    this.strictMode = options.strictMode ?? false;
    this.root = new Entity(options.name ?? 'AvatarInstanceRoot');
    this.root.userData.isAvatarInstanceRoot = true;
    parent.addChild(this.root);

    this.partLibrary = options.partLibrary ?? createAvatarPartLibrary(DEFAULT_AVATAR_PART_DEFINITIONS);
    this.skeleton = new AvatarSkeleton(DEFAULT_AVATAR_JOINTS);
    this.animator = new AvatarAnimationPlayer(this.skeleton);

    // Initialize managers
    this.meshGenerator = new AvatarMeshGenerator();
    this.materialManager = new AvatarMaterialManager(options.materialResolver);
    this.colorManager = new AvatarColorManager();
    this.mountManager = new AvatarPartMountManager(
      this.jointEntities,
      this.slotEntities,
      this.meshGenerator,
      this.materialManager,
      this.colorManager,
    );
    this.serializer = new AvatarLoadoutSerializer();

    this.buildSkeletonEntities();
    this.applyLoadout(options.loadout ?? DEFAULT_AVATAR_LOADOUT);
  }

  getRootEntity(): Entity {
    return this.root;
  }

  getSkeleton(): AvatarSkeleton {
    return this.skeleton;
  }

  /**
   * @deprecated Use getAnimationComponent() instead. This method is kept for backward compatibility.
   */
  getAnimator(): AvatarAnimationPlayer {
    return this.animator;
  }

  /**
   * Get AnimationComponent from the root entity or parent entity.
   * Returns null if not found.
   */
  getAnimationComponent(): AnimationComponent | null {
    // Check root entity first
    let component = this.root.getComponent(AnimationComponent);
    if (component) {
      return component;
    }
    // Check parent entity
    const parent = this.root.parent;
    if (parent) {
      component = parent.getComponent(AnimationComponent);
      if (component) {
        return component;
      }
    }
    return null;
  }

  /**
   * Get or create AnimationComponent for this avatar instance.
   * If component doesn't exist, creates it on the root entity and configures it with skeleton.
   */
  getOrCreateAnimationComponent(): AnimationComponent {
    let component = this.getAnimationComponent();
    if (!component) {
      component = new AnimationComponent();
      this.root.addComponent(component);
      // Configure skeleton
      const skeleton = avatarSkeletonToSkeleton(this.skeleton);
      component.setSkeleton(skeleton);
    }
    return component;
  }

  update(deltaTime: number): void {
    // AnimationComponent is updated by AnimationSystem, so we don't need to call animator.update()
    // But we keep it for backward compatibility if someone is using the old animator directly
    // this.animator.update(deltaTime); // Removed - AnimationSystem handles this
    
    // Sync pose from AnimationComponent to AvatarSkeleton
    this.syncPoseFromAnimationComponent();
    
    // Sync joint entities from skeleton (which is updated by AnimationSystem)
    this.syncJointEntities();
  }

  /**
   * Synchronize pose from AnimationComponent to AvatarSkeleton.
   * This bridges the gap between AnimationComponent's generic Skeleton and AvatarSkeleton.
   */
  private syncPoseFromAnimationComponent(): void {
    const component = this.getAnimationComponent();
    if (!component || !component.skeleton || !component.pose) {
      return;
    }

    // Update AvatarSkeleton with pose data from AnimationComponent
    const jointNames = this.skeleton.getJointNames();
    for (let i = 0; i < jointNames.length; i++) {
      const jointName = jointNames[i];
      const boneIndex = component.skeleton.findBoneIndex(jointName);
      if (boneIndex === -1) continue;
      
      const poseBone = component.pose[boneIndex];
      if (!poseBone) continue;

      if (poseBone.position) {
        this.skeleton.setLocalPosition(jointName, poseBone.position);
      }
      if (poseBone.rotation) {
        this.skeleton.setLocalRotation(jointName, poseBone.rotation);
      }
      // Note: AvatarSkeleton doesn't support scale, so we skip it
    }
  }

  playAnimation(animation: AvatarAnimation, startTime = 0): void {
    const component = this.getOrCreateAnimationComponent();
    const clip = avatarAnimationToClip(animation);
    
    // Add clip if it doesn't exist
    if (!component.clips.has(clip.name)) {
      component.addClip(clip);
    }
    
    // Set active state
    component.setActiveState(animation.name);
    
    // Sync immediately
    this.syncJointEntities();
  }

  stopAnimation(): void {
    const component = this.getAnimationComponent();
    if (component) {
      // Stop all controllers instead of setting state to null
      // (AnimationStateMachine doesn't support null state)
      for (const controller of component.controllers.values()) {
        controller.stop();
      }
      // Clear active state name
      component.setActiveState(null);
    } else {
      // Fallback to old animator for backward compatibility
      this.animator.stop();
    }
  }

  dispose(): void {
    for (const slot of this.slotEntities.keys()) {
      this.mountManager.unmountSlot(slot);
    }
    this.slotEntities.clear();
    const parent = this.root.parent;
    if (parent) {
      parent.removeChild(this.root);
    }
  }

  applyLoadout(loadout: AvatarLoadout): void {
    // Validate loadout before applying
    const validation = this.serializer.validate(loadout, this.partLibrary);
    if (!validation.valid) {
      const errorMessage = `[AvatarInstance] Loadout validation failed: ${validation.errors.join(', ')}`;
      if (this.strictMode) {
        throw new Error(errorMessage);
      }
      console.warn(errorMessage);
      // Continue applying valid parts, but log errors
    }

    for (const slot of AVATAR_SLOTS) {
      const part = loadout.parts?.[slot] ?? null;
      this.setSlot(slot, part);
    }
    this.syncJointEntities();
  }

  setSlot(slot: AvatarSlot, part: AvatarLoadoutPart | null): void {
    this.mountManager.unmountSlot(slot);
    if (!part) {
      this.selections.delete(slot);
      return;
    }

    const definition = this.resolveDefinition(slot, part.mesh);
    if (!definition) {
      const errorMessage = `[AvatarInstance] Missing definition for slot ${slot} part "${part.mesh}"`;
      if (this.strictMode) {
        throw new Error(errorMessage);
      }
      console.warn(errorMessage);
      this.selections.delete(slot);
      return;
    }

    const colors = part.colors ? cloneColorRecord(part.colors) : undefined;
    const materialId = part.material ?? part.mat ?? definition.defaultMaterial;
    const selection: AvatarPartSelectionState = {
      id: part.mesh,
      definition,
      ...(colors ? { colors } : {}),
      ...(materialId ? { materialId } : {}),
    };
    this.selections.set(slot, selection);
    this.mountManager.mountPart(selection);
  }

  serializeLoadout(): AvatarLoadout {
    return this.serializer.serialize(this.selections);
  }

  /**
   * Check if an entity is part of this avatar instance hierarchy
   * 
   * @param entity - Entity to check
   * @returns True if entity is the root or a descendant of this avatar instance
   */
  isEntityPartOfAvatar(entity: Entity | null | undefined): boolean {
    if (!entity) return false;
    if (entity === this.root) return true;
    let current: Entity | null = entity;
    while (current) {
      if (current === this.root) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Set slot visibility (for hiding head in FPS mode, etc.)
   */
  setSlotVisible(slot: AvatarSlot, visible: boolean): void {
    const slotEntity = this.slotEntities.get(slot);
    if (slotEntity) {
      slotEntity.active = visible;
    }
  }

  /**
   * Get slot entity (for external manipulation)
   */
  getSlotEntity(slot: AvatarSlot): Entity | undefined {
    return this.slotEntities.get(slot);
  }

  syncJointEntities(): void {
    // Get dirty joints from skeleton
    const dirtyJoints = this.skeleton.getDirtyJoints();
    const pool = getVec3Pool();
    
    // If all joints are dirty, sync all (optimization: avoid per-joint checks)
    if (dirtyJoints.length === this.skeleton.getJointNames().length) {
      this.skeleton.forEachJoint((name) => {
        const jointEntity = this.jointEntities.get(name);
        if (!jointEntity) {
          return;
        }
        const local = this.skeleton.getLocalTransform(name);
        jointEntity.transform.position = local.position;
        jointEntity.transform.rotation = local.rotation;
        // Release pooled Vec3 after assignment (setter clones it internally)
        pool.release(local.position);
        this.skeleton.markJointClean(name);
      });
    } else {
      // Only sync dirty joints
      for (const name of dirtyJoints) {
        const jointEntity = this.jointEntities.get(name);
        if (!jointEntity) {
          continue;
        }
        const local = this.skeleton.getLocalTransform(name);
        jointEntity.transform.position = local.position;
        jointEntity.transform.rotation = local.rotation;
        // Release pooled Vec3 after assignment (setter clones it internally)
        pool.release(local.position);
        this.skeleton.markJointClean(name);
      }
    }
  }

  private buildSkeletonEntities(): void {
    const pool = getVec3Pool();
    this.skeleton.forEachJoint((name, parentName) => {
      const entity = new Entity(`AvatarJoint:${name}`);
      entity.userData.avatarJoint = name;
      const local = this.skeleton.getLocalTransform(name);
      entity.transform.position = local.position;
      entity.transform.rotation = local.rotation;
      // Release pooled Vec3 after assignment (setter clones it internally)
      pool.release(local.position);
      entity.transform.scale = [1, 1, 1];

      if (parentName) {
        const parentEntity = this.jointEntities.get(parentName);
        if (!parentEntity) {
          throw new Error(`Parent joint entity "${parentName}" missing for "${name}"`);
        }
        parentEntity.addChild(entity);
      } else {
        this.root.addChild(entity);
      }
      this.jointEntities.set(name, entity);
    });
  }


  private resolveDefinition(slot: AvatarSlot, id: string): AvatarPartDefinition | null {
    const definition = this.partLibrary[id];
    if (!definition) {
      return null;
    }
    if (definition.slot !== slot) {
      console.warn(
        `[AvatarInstance] Part "${id}" is registered for ${definition.slot}, cannot mount to ${slot}`,
      );
      return null;
    }
    return definition;
  }
}


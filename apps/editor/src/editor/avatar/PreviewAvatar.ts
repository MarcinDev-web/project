import type { Vec3 } from '@engine/core/math';
import { Entity, type Scene } from '@engine/world';
import {
  AvatarInstance,
  DEFAULT_AVATAR_LOADOUT,
  IDLE_ANIMATION,
  RUN_ANIMATION,
  WALK_ANIMATION,
  JUMP_ANIMATION,
  type AvatarAnimation,
  type AvatarLoadout,
} from '@engine/avatar';
import { MeshComponent } from '@engine/world/components/MeshComponent';
import { MaterialComponent } from '@engine/world/components/MaterialComponent';

const DEFAULT_PREVIEW_PLAYER_ID = '__editor_preview_player';
const CAMERA_PIVOT_HEIGHT = 1.6;
const DEFAULT_SPAWN_POSITION: Vec3 = [0, CAMERA_PIVOT_HEIGHT, 0]; // Spawn at origin, camera will be positioned separately

interface PreviewAvatarOptions {
  id?: string;
  loadout?: AvatarLoadout;
  initialPosition?: Vec3; // Initial spawn position
}

export interface AvatarPose {
  position: Vec3;
  yaw: number;
}

/**
 * PreviewAvatar owns the editor preview character entity hierarchy.
 * Root transform stays at the camera pivot height to keep camera offsets intact.
 */
export class PreviewAvatar {
  private readonly scene: Scene;
  private readonly root: Entity;
  private readonly visualRoot: Entity;
  private readonly avatar: AvatarInstance;
  private yaw = 0;
  private currentAnimation: AvatarAnimation | null = null;

  constructor(scene: Scene, options: PreviewAvatarOptions = {}) {
    this.scene = scene;
    const id = options.id ?? DEFAULT_PREVIEW_PLAYER_ID;
    const initialPosition = options.initialPosition ?? DEFAULT_SPAWN_POSITION;
    this.root = this.ensureRootEntity(id, initialPosition);
    this.visualRoot = this.ensureVisualRoot();
    this.clearVisualChildren();
    const loadout = options.loadout ?? DEFAULT_AVATAR_LOADOUT;
    this.avatar = new AvatarInstance(this.visualRoot, {
      name: 'EditorPreviewAvatarBody',
      loadout,
    });
    // Start with idle animation
    this.playIdleAnimation();
  }

  dispose(): void {
    this.avatar.dispose();
    this.clearVisualChildren();
  }

  getRoot(): Entity {
    return this.root;
  }

  getVisualRoot(): Entity {
    return this.visualRoot;
  }

  getAvatarInstance(): AvatarInstance {
    return this.avatar;
  }

  getLoadout(): AvatarLoadout {
    return this.avatar.serializeLoadout();
  }

  setLoadout(loadout: AvatarLoadout): void {
    this.avatar.applyLoadout(loadout);
  }

  update(deltaTime: number): void {
    this.avatar.update(deltaTime);
  }

  /**
   * Play idle animation (standing still).
   */
  playIdleAnimation(): void {
    if (this.currentAnimation !== IDLE_ANIMATION) {
      this.avatar.playAnimation(IDLE_ANIMATION);
      this.currentAnimation = IDLE_ANIMATION;
    }
  }

  /**
   * Play run animation (movement).
   */
  playRunAnimation(): void {
    if (this.currentAnimation !== RUN_ANIMATION) {
      this.avatar.playAnimation(RUN_ANIMATION);
      this.currentAnimation = RUN_ANIMATION;
    }
  }

  /**
   * Play walk animation (slower movement).
   */
  playWalkAnimation(): void {
    if (this.currentAnimation !== WALK_ANIMATION) {
      this.avatar.playAnimation(WALK_ANIMATION);
      this.currentAnimation = WALK_ANIMATION;
    }
  }

  /**
   * Play jump animation (one-time, non-looping).
   */
  playJumpAnimation(): void {
    if (this.currentAnimation !== JUMP_ANIMATION) {
      this.avatar.playAnimation(JUMP_ANIMATION);
      this.currentAnimation = JUMP_ANIMATION;
      // Jump animation emits 'finished' event, so we'll reset to idle when done
      // Note: This would require listening to animation events, which is a future enhancement
    }
  }

  /**
   * Stop current animation and reset to default pose.
   */
  stopAnimation(): void {
    this.avatar.stopAnimation();
    this.currentAnimation = null;
  }

  ownsEntity(entity: Entity | null | undefined): boolean {
    if (!entity) return false;
    if (entity === this.root || entity === this.visualRoot) return true;
    if (this.avatar.isEntityPartOfAvatar(entity)) return true;
    return this.isDescendantOfVisualRoot(entity);
  }

  getPose(): AvatarPose {
    const position = this.root.transform.position;
    return {
      position: [position[0], position[1], position[2]],
      yaw: this.yaw,
    };
  }

  getCameraPivotHeight(): number {
    return CAMERA_PIVOT_HEIGHT;
  }

  setPosition(position: Vec3): void {
    this.root.transform.position = [...position] as Vec3;
  }

  setYaw(yaw: number): void {
    this.yaw = yaw;
    this.root.transform.setEulerAngles(0, yaw, 0);
  }

  setVisible(visible: boolean): void {
    // Propagate visibility to entire avatar subtree to ensure renderer filters out parts
    try {
      this.root.traverse((e) => {
        e.active = visible;
      });
    } catch {
      // Fallbacks if traverse is unavailable in certain test environments
      this.root.active = visible;
      this.visualRoot.active = visible;
      this.avatar.getRootEntity().active = visible;
    }
  }

  lookTowards(forward: Vec3): void {
    const direction = [...forward] as Vec3;
    const length = Math.hypot(direction[0], direction[1], direction[2]);
    if (length > 1e-5) {
      direction[0] /= length;
      direction[2] /= length;
      const yaw = Math.atan2(direction[0], -direction[2]);
      this.setYaw(yaw);
    }
  }

  private ensureRootEntity(id: string, initialPosition: Vec3): Entity {
    const existing = this.scene.findEntityById(id);
    if (existing) {
      if (existing.parent) {
        existing.removeFromParent();
      }
      existing.userData.isEditorPreviewPlayer = true;
      existing.userData.isHidden = true;
      existing.transform.position = [...initialPosition] as Vec3;
      existing.transform.setEulerAngles(0, 0, 0);
      existing.transform.scale = [1, 1, 1];
      existing.removeComponent(MeshComponent);
      existing.removeComponent(MaterialComponent);
      return existing;
    }

    const entity = new Entity('EditorPreviewAvatar', undefined, id);
    entity.userData.isEditorPreviewPlayer = true;
    entity.userData.isHidden = true;
    entity.transform.position = [...initialPosition] as Vec3;
    entity.transform.setEulerAngles(0, 0, 0);
    entity.transform.scale = [1, 1, 1];
    this.scene.addEntity(entity);
    return entity;
  }

  private ensureVisualRoot(): Entity {
    const existing = this.root.children.find(
      (child) => child.userData?.isEditorAvatarVisualRoot === true,
    );
    if (existing) {
      existing.transform.position = [0, -CAMERA_PIVOT_HEIGHT, 0];
      existing.transform.setEulerAngles(0, 0, 0);
      existing.userData.isEditorAvatarVisualRoot = true;
      return existing;
    }

    const visualRoot = new Entity('AvatarVisualRoot');
    visualRoot.userData.isEditorAvatarVisualRoot = true;
    visualRoot.userData.isHidden = true;
    visualRoot.transform.position = [0, -CAMERA_PIVOT_HEIGHT, 0];
    visualRoot.transform.scale = [1, 1, 1];
    this.root.addChild(visualRoot);
    return visualRoot;
  }

  private clearVisualChildren(): void {
    const children = [...this.visualRoot.children];
    for (const child of children) {
      const data = child.userData ?? {};
      if (data.isEditorAvatarPart === true || data.isAvatarInstanceRoot === true) {
        this.visualRoot.removeChild(child);
      }
    }
  }

  private isDescendantOfVisualRoot(entity: Entity): boolean {
    let current = entity.parent;
    while (current) {
      if (current === this.visualRoot) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
}

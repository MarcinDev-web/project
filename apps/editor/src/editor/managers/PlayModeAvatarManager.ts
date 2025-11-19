import { Entity } from '@engine/world';
import { CharacterController, CharacterState } from '@engine/world/components/CharacterController';
import {
  AvatarInstance,
  DEFAULT_AVATAR_LOADOUT,
  type AvatarLoadout,
  IDLE_ANIMATION,
  RUN_ANIMATION,
  WALK_ANIMATION,
  JUMP_ANIMATION,
} from '@engine/avatar';
import type { PlayManifest } from '../core/PlayManifest';
import { getCurrentUser, getUserAvatarLoadout, type AvatarLoadoutData } from '../../utils/auth';

export class PlayModeAvatarManager {
  private avatarInstance: AvatarInstance | null = null;
  private avatarVisualRoot: Entity | null = null;
  private lastPlayedAnim: 'idle' | 'walk' | 'run' | 'jump' | null = null;

  /**
   * Create and attach AvatarInstance visuals under the player entity,
   * offset so feet are on the ground and hide obstructing FPS parts.
   */
  attachAvatarToPlayer(player: Entity, manifest: PlayManifest | null): void {
    // Cleanup previous visuals if any
    this.dispose();

    const visualRoot = new Entity('PlayerAvatarVisual');
    visualRoot.userData.isPlayerAvatarVisual = true;

    // Offset avatar so feet align with ground: use collider center Y from manifest (or default)
    const centerY = manifest?.pawn.physics.collider.center[1] ?? 0.85;
    visualRoot.transform.position = [0, -centerY, 0];
    visualRoot.transform.scale = [1, 1, 1];

    player.addChild(visualRoot);
    this.avatarVisualRoot = visualRoot;

    // Instantiate avatar with default loadout for now (can be replaced with user profile later)
    const avatar = new AvatarInstance(visualRoot, {
      name: 'EditorPlayModeAvatar',
      loadout: DEFAULT_AVATAR_LOADOUT,
      strictMode: true,
    });

    // Hide head-related slots for FPS to avoid clipping
    try {
      avatar.setSlotVisible('HeadSlot', false);
      avatar.setSlotVisible('HairSlot', false);
      avatar.setSlotVisible('FaceOverlaySlot', false);
    } catch {
      // non-fatal
    }

    this.avatarInstance = avatar;
    this.lastPlayedAnim = null;
  }

  /**
   * Update avatar visuals and drive animations based on CharacterController state.
   */
  update(deltaTime: number, player: Entity): void {
    if (!this.avatarInstance) return;

    // Tick avatar internal animator
    this.avatarInstance.update(deltaTime);

    // Drive animation from character state
    const controller = player.getComponent(CharacterController);
    if (!controller) return;

    let desired: 'idle' | 'walk' | 'run' | 'jump' = 'idle';
    switch (controller.state) {
      case CharacterState.Running:
        desired = 'run';
        break;
      case CharacterState.Walking:
        desired = 'walk';
        break;
      case CharacterState.Jumping:
      case CharacterState.Falling:
        desired = 'jump';
        break;
      case CharacterState.Idle:
      case CharacterState.Landing:
      default:
        desired = 'idle';
        break;
    }

    if (desired !== this.lastPlayedAnim) {
      switch (desired) {
        case 'run':
          this.avatarInstance.playAnimation(RUN_ANIMATION);
          break;
        case 'walk':
          this.avatarInstance.playAnimation(WALK_ANIMATION);
          break;
        case 'jump':
          this.avatarInstance.playAnimation(JUMP_ANIMATION);
          break;
        case 'idle':
        default:
          this.avatarInstance.playAnimation(IDLE_ANIMATION);
          break;
      }
      this.lastPlayedAnim = desired;
    }
  }

  dispose(): void {
    if (this.avatarInstance) {
      try {
        this.avatarInstance.dispose();
      } catch {
        // ignore
      }
      this.avatarInstance = null;
    }
    if (this.avatarVisualRoot && this.avatarVisualRoot.parent) {
      try {
        this.avatarVisualRoot.parent.removeChild(this.avatarVisualRoot);
      } catch {
        // ignore
      }
    }
    this.avatarVisualRoot = null;
    this.lastPlayedAnim = null;
  }

  /**
   * Load user's saved avatar and apply to current avatar instance.
   */
  async loadAndApplyUserAvatar(): Promise<void> {
    try {
      const loadout = await this.fetchUserAvatarLoadout();
      if (loadout && this.avatarInstance) {
        this.avatarInstance.applyLoadout(loadout);
      }
    } catch {
      // Ignore failures, default avatar remains
    }
  }

  /**
   * Fetch current user's avatar loadout from API.
   */
  private async fetchUserAvatarLoadout(): Promise<AvatarLoadout | null> {
    // Get current user
    const me = await getCurrentUser();
    if (!me?.id) return null;

    // Get avatar loadout
    const data = await getUserAvatarLoadout(me.id);
    if (!data) return null;
    
    return this.convertAvatarLoadoutData(data);
  }

  private convertAvatarLoadoutData(data: AvatarLoadoutData): AvatarLoadout {
    const parts: AvatarLoadout['parts'] = {};
    for (const [slot, part] of Object.entries(data.parts || {})) {
      if (!part) continue;
      (parts as any)[slot] = {
        mesh: part.mesh,
        ...(part.mat && { mat: part.mat }),
        ...(part.material && { material: part.material }),
        ...(part.colors && { colors: part.colors }),
      };
    }
    return { version: data.version, parts };
  }
}


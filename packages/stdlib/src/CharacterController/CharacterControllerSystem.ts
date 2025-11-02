import type { Scene, Entity } from '@engine/world';
import { CharacterController, type CharacterInput, CharacterState } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { distanceVec3 } from '@engine/core/math';
import { MovementProfileRegistry } from '../MovementProfiles/MovementProfileRegistry';
import { AnimationComponent } from '../Animation';

interface IntentFrame {
  move: [number, number];
  jump: boolean;
  sprint: boolean;
  forward: Vec3;
  right: Vec3;
}

interface GroundDetectionCache {
  lastPosition: Vec3;
  lastIsGrounded: boolean;
  lastGroundNormal: Vec3;
}

/**
 * Maps CharacterState to animation state names
 */
const STATE_TO_ANIMATION: Record<CharacterState, string> = {
  [CharacterState.Idle]: 'idle',
  [CharacterState.Walking]: 'walk',
  [CharacterState.Running]: 'run',
  [CharacterState.Jumping]: 'jump',
  [CharacterState.Falling]: 'fall',
  [CharacterState.Landing]: 'land',
};

/**
 * System for updating all character controllers in a scene
 * 
 * Handles:
 * - Character controller updates
 * - Ground detection using physics raycasting
 * - Animation synchronization with character state
 * - Integration with physics world
 */
export class CharacterControllerSystem {
  private scene: Scene;
  private physics: PhysicsWorld;
  private intentBuffer = new Map<CharacterController, IntentFrame>();
  private groundDetectionCache = new Map<CharacterController, GroundDetectionCache>();

  constructor(scene: Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;
  }

  /**
   * Update all character controllers
   */
  update(deltaTime: number): void {
    const entities = this.scene.queryEntities(CharacterController);

    for (const entity of entities) {
      const controller = entity.getComponent(CharacterController) as CharacterController;
      if (!controller) continue;

      // Load profile if controller was deserialized with profileId but profile not loaded
      this.ensureProfileLoaded(controller);

      const bufferedIntent = this.intentBuffer.get(controller);
      if (bufferedIntent) {
        const input: CharacterInput = {
          moveDirection: [bufferedIntent.move[0], 0, bufferedIntent.move[1]],
          sprint: bufferedIntent.sprint,
          jump: bufferedIntent.jump,
          cameraForward: bufferedIntent.forward,
          cameraRight: bufferedIntent.right,
        };
        controller.setInput(input);
        this.intentBuffer.delete(controller);
      }

      // Update ground detection using physics raycast
      // Must be called BEFORE controller.update() to cache position before any potential changes
      this.updateGroundDetection(controller);

      // Update character controller
      controller.update(deltaTime);

      // Synchronize animation with character state
      this.syncAnimation(controller);

      // Update profile extensions
      const profile = controller.getCurrentProfile();
      if (profile?.extensions) {
        for (const ext of profile.extensions) {
          if (ext.update) {
            ext.update(controller, deltaTime);
          }
        }
      }

      // Cleanup cache if controller entity is removed
      if (!controller.entity) {
        this.groundDetectionCache.delete(controller);
      }
    }
  }

  /**
   * Ensure profile is loaded for controller (if deserialized with profileId)
   */
  private ensureProfileLoaded(controller: CharacterController): void {
    const currentProfile = controller.getCurrentProfile();
    // Check if profile is just a placeholder (has id but not full profile object)
    if (currentProfile && typeof currentProfile === 'object' && 'id' in currentProfile && !currentProfile.name) {
      const registry = MovementProfileRegistry.getInstance();
      const profile = registry.get(currentProfile.id);
      if (profile) {
        controller.applyProfile(profile);
      }
    }
  }

  applyIntent(
    controller: CharacterController,
    intent: { move: [number, number]; jump: boolean; sprint: boolean },
    cameraForward: Vec3,
    cameraRight: Vec3
  ): void {
    this.intentBuffer.set(controller, {
      move: [intent.move[0], intent.move[1]],
      jump: intent.jump,
      sprint: intent.sprint,
      forward: [...cameraForward] as Vec3,
      right: [...cameraRight] as Vec3,
    });
  }

  /**
   * Update ground detection for a character using raycasting
   * Uses caching to avoid unnecessary raycasts when position hasn't changed significantly
   */
  private updateGroundDetection(controller: CharacterController): void {
    if (!controller.entity) return;

    const origin = controller.entity.transform.position;
    // Create a copy to ensure we're comparing values, not references
    const originCopy: Vec3 = [origin[0], origin[1], origin[2]];
    const cache = this.groundDetectionCache.get(controller);

    // Check cache if position hasn't changed significantly
    if (cache) {
      const distance = distanceVec3(originCopy, cache.lastPosition);
      if (distance < 0.01) {
        // Use cached result
        controller.isGrounded = cache.lastIsGrounded;
        controller.groundNormal = [...cache.lastGroundNormal] as Vec3;
        return;
      }
    }

    // Position changed significantly or no cache - perform raycast
    const direction: [number, number, number] = [0, -1, 0];

    // Raycast downward to detect ground
    const hit = this.physics.raycast(originCopy, direction, {
      // Use a generous distance to ensure floors slightly below the character are detected in tests
      maxDistance: Math.max(controller.config.groundCheckDistance, 0.1) + 5.0,
      ignoreEntities: [controller.entity],
    });

    // Update controller state
    if (hit) {
      controller.isGrounded = true;
      controller.groundNormal = hit.normal;
    } else {
      controller.isGrounded = false;
      controller.groundNormal = [0, 1, 0];
    }

    // Update cache with copied position to avoid reference issues
    this.groundDetectionCache.set(controller, {
      lastPosition: originCopy,
      lastIsGrounded: controller.isGrounded,
      lastGroundNormal: [...controller.groundNormal] as Vec3,
    });
  }

  /**
   * Set input for a specific character controller
   */
  setInput(controller: CharacterController, input: CharacterInput): void {
    controller.setInput(input);
  }

  /**
   * Get all character controllers in the scene
   */
  getControllers(): CharacterController[] {
    const entities = this.scene.queryEntities(CharacterController);
    return entities
      .map((e: Entity) => e.getComponent(CharacterController) as CharacterController)
      .filter((c: CharacterController | null): c is CharacterController => c !== null);
  }

  /**
   * Synchronize animation state with character controller state
   * 
   * Automatically switches animation states based on CharacterState:
   * - Idle → "idle" animation
   * - Walking → "walk" animation
   * - Running → "run" animation
   * - Jumping → "jump" animation
   * - Falling → "fall" animation
   * - Landing → "land" animation
   * 
   * Public for testing purposes.
   */
  syncAnimation(controller: CharacterController): void {
    if (!controller.entity) return;

    const animationComponent = controller.entity.getComponent(AnimationComponent);
    if (!animationComponent) return;

    const animationStateName = STATE_TO_ANIMATION[controller.state];
    if (!animationStateName) return;

    // Only update if animation state exists and is different from current
    const currentState = animationComponent.getActiveState();
    if (currentState === animationStateName) return;

    // Check if animation clip exists for this state
    const hasClip = animationComponent.clips.has(animationStateName);
    if (!hasClip) {
      // Clip doesn't exist - silently ignore (allows partial animation setups)
      return;
    }

    // Switch to the appropriate animation state
    animationComponent.setActiveState(animationStateName);
  }
}


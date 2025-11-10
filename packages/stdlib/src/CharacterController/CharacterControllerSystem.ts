import type { Scene, Entity } from '@engine/world';
import { CharacterController, type CharacterInput, CharacterState, type MovementProfile } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { MovementProfileRegistry } from '../MovementProfiles/MovementProfileRegistry';
import { AnimationComponent } from '../Animation';
import { GroundDetectionCache } from './GroundDetectionCache';
import { AnimationStateName } from './AnimationStateName';

interface IntentFrame {
  move: [number, number];
  jump: boolean;
  sprint: boolean;
  forward: Vec3;
  right: Vec3;
}

/**
 * Maps CharacterState to animation state names
 */
const STATE_TO_ANIMATION: Record<CharacterState, AnimationStateName> = {
  [CharacterState.Idle]: AnimationStateName.Idle,
  [CharacterState.Walking]: AnimationStateName.Walk,
  [CharacterState.Running]: AnimationStateName.Run,
  [CharacterState.Jumping]: AnimationStateName.Jump,
  [CharacterState.Falling]: AnimationStateName.Fall,
  [CharacterState.Landing]: AnimationStateName.Land,
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
  private groundDetection: GroundDetectionSystem;
  private readonly vec3Pool = getVec3Pool();

  constructor(scene: Scene, physics: PhysicsWorld, cacheCellSize = 0.5, cacheMaxAge = 0.1) {
    this.scene = scene;
    this.physics = physics;
    this.groundDetection = new GroundDetectionSystem(physics, cacheCellSize, cacheMaxAge);
  }

  /**
   * Update all character controllers
   */
  update(deltaTime: number): void {
    const entities = this.scene.queryEntities(CharacterController);
    const controllers: CharacterController[] = [];

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

        // Release Vec3 arrays back to pool
        this.vec3Pool.release(bufferedIntent.forward);
        this.vec3Pool.release(bufferedIntent.right);

        this.intentBuffer.delete(controller);
      }

      controllers.push(controller);
    }

    // Update ground detection for all controllers (must be before controller.update())
    this.groundDetection.update(controllers, deltaTime);

    // Update each controller
    for (const controller of controllers) {
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
    }
  }

  /**
   * Ensure profile is loaded for controller (if deserialized with profileId)
   */
  private ensureProfileLoaded(controller: CharacterController): void {
    const currentProfile = controller.getCurrentProfile();
    // Check if profile is just a placeholder (has id but not full profile object)
    // Placeholder has id and config but empty name (created in deserialize)
    if (currentProfile && currentProfile.id && (!currentProfile.name || currentProfile.name === '')) {
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
    // Acquire Vec3 arrays from pool
    const forward = this.vec3Pool.acquire();
    const right = this.vec3Pool.acquire();
    
    // Copy values
    forward[0] = cameraForward[0];
    forward[1] = cameraForward[1];
    forward[2] = cameraForward[2];
    
    right[0] = cameraRight[0];
    right[1] = cameraRight[1];
    right[2] = cameraRight[2];
    
    this.intentBuffer.set(controller, {
      move: [intent.move[0], intent.move[1]],
      jump: intent.jump,
      sprint: intent.sprint,
      forward: forward as Vec3,
      right: right as Vec3,
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
   * - Idle → AnimationStateName.Idle ("idle" animation)
   * - Walking → AnimationStateName.Walk ("walk" animation)
   * - Running → AnimationStateName.Run ("run" animation)
   * - Jumping → AnimationStateName.Jump ("jump" animation)
   * - Falling → AnimationStateName.Fall ("fall" animation)
   * - Landing → AnimationStateName.Land ("land" animation)
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

    // Switch to the appropriate animation state with a small blend for smoothness
    const DEFAULT_BLEND_TIME = 0.12; // seconds
    animationComponent.setActiveState(animationStateName, DEFAULT_BLEND_TIME);
  }
}


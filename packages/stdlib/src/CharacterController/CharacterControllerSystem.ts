import type { Scene, Entity } from '@engine/world';
import { CharacterController, type CharacterInput, CharacterState } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { MovementProfileRegistry } from '../MovementProfiles/MovementProfileRegistry';
import { AnimationComponent } from '../Animation';
import { AnimationStateName } from './AnimationStateName';
import { AnimationBlendConfig } from './AnimationBlendConfig';

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
 * - Animation synchronization with character state
 * - Integration with physics world
 *
 * Note: Ground detection is handled by GroundDetectionSystem, which must be
 * updated before this system in the game loop. Pass it via dependency injection
 * if you need to share the same instance, otherwise it can be omitted.
 */
export class CharacterControllerSystem {
  private scene: Scene;
  private intentBuffer = new Map<CharacterController, IntentFrame>();
  private readonly blendConfig: AnimationBlendConfig;
  // Reused array to avoid allocations in hot path (update loop)
  private readonly controllers: CharacterController[] = [];

  constructor(
    scene: Scene,
    _physics: PhysicsWorld,
    options?: {
      blendConfig?: AnimationBlendConfig;
    }
  ) {
    this.scene = scene;
    this.blendConfig = options?.blendConfig ?? new AnimationBlendConfig();
    // Note: _physics parameter kept for API consistency with other systems
    // but not used here as ground detection is handled by GroundDetectionSystem
  }

  /**
   * Get the scene that this system queries for character controllers.
   */
  getScene(): Scene {
    return this.scene;
  }

  /**
   * Update all character controllers
   */
  update(deltaTime: number): void {
    const entities = this.scene.queryEntities(CharacterController);
    // Reuse array instead of creating new one each frame (performance optimization)
    this.controllers.length = 0;

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

      this.controllers.push(controller);
    }

    // Note: Ground detection should be handled by GroundDetectionSystem.update()
    // which must be called before this system's update() in the game loop

    // Update each controller
    for (const controller of this.controllers) {
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
    if (
      currentProfile &&
      currentProfile.id &&
      (!currentProfile.name || currentProfile.name === '')
    ) {
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
    // Create copies of Vec3 arrays to avoid reference issues
    const forward: Vec3 = [cameraForward[0], cameraForward[1], cameraForward[2]];
    const right: Vec3 = [cameraRight[0], cameraRight[1], cameraRight[2]];

    this.intentBuffer.set(controller, {
      move: [intent.move[0], intent.move[1]],
      jump: intent.jump,
      sprint: intent.sprint,
      forward: forward,
      right: right,
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
   * Uses AnimationBlendConfig for intelligent blend times and easing functions.
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

    // Get intelligent blend time and easing from config
    const blendTime = this.blendConfig.getBlendTime(currentState, animationStateName);
    const blendEasing = this.blendConfig.getBlendEasing(currentState, animationStateName);

    // Switch to the appropriate animation state with intelligent blending
    animationComponent.setActiveState(animationStateName, blendTime, blendEasing);
  }
}

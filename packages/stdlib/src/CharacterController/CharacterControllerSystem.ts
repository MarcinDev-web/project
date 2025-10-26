import type { Scene } from '@engine/world';
import { CharacterController, type CharacterInput } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

interface IntentFrame {
  move: [number, number];
  jump: boolean;
  sprint: boolean;
  forward: Vec3;
  right: Vec3;
}

/**
 * System for updating all character controllers in a scene
 * 
 * Handles:
 * - Character controller updates
 * - Ground detection using physics raycasting
 * - Integration with physics world
 */
export class CharacterControllerSystem {
  private scene: Scene;
  private physics: PhysicsWorld;
  private intentBuffer = new Map<CharacterController, IntentFrame>();

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
      this.updateGroundDetection(controller);

      // Update character controller
      controller.update(deltaTime);
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
   */
  private updateGroundDetection(controller: CharacterController): void {
    if (!controller.entity) return;

    const origin = controller.entity.transform.position;
    const direction: [number, number, number] = [0, -1, 0];

    // Raycast downward to detect ground
    const hit = this.physics.raycast(origin, direction, {
      // Use a generous distance to ensure floors slightly below the character are detected in tests
      maxDistance: Math.max(controller.config.groundCheckDistance, 0.1) + 5.0,
      ignoreEntities: [controller.entity],
    });

    if (hit) {
      controller.isGrounded = true;
      controller.groundNormal = hit.normal;
    } else {
      controller.isGrounded = false;
      controller.groundNormal = [0, 1, 0];
    }
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
      .map(e => e.getComponent(CharacterController) as CharacterController)
      .filter(c => c !== null);
  }
}


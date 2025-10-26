import { CharacterController } from '@engine/world';
/**
 * System for updating all character controllers in a scene
 *
 * Handles:
 * - Character controller updates
 * - Ground detection using physics raycasting
 * - Integration with physics world
 */
export class CharacterControllerSystem {
    scene;
    physics;
    intentBuffer = new Map();
    constructor(scene, physics) {
        this.scene = scene;
        this.physics = physics;
    }
    /**
     * Update all character controllers
     */
    update(deltaTime) {
        const entities = this.scene.queryEntities(CharacterController);
        for (const entity of entities) {
            const controller = entity.getComponent(CharacterController);
            if (!controller)
                continue;
            const bufferedIntent = this.intentBuffer.get(controller);
            if (bufferedIntent) {
                const input = {
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
    applyIntent(controller, intent, cameraForward, cameraRight) {
        this.intentBuffer.set(controller, {
            move: [intent.move[0], intent.move[1]],
            jump: intent.jump,
            sprint: intent.sprint,
            forward: [...cameraForward],
            right: [...cameraRight],
        });
    }
    /**
     * Update ground detection for a character using raycasting
     */
    updateGroundDetection(controller) {
        if (!controller.entity)
            return;
        const origin = controller.entity.transform.position;
        const direction = [0, -1, 0];
        // Raycast downward to detect ground
        const hit = this.physics.raycast(origin, direction, {
            // Use a generous distance to ensure floors slightly below the character are detected in tests
            maxDistance: Math.max(controller.config.groundCheckDistance, 0.1) + 5.0,
            ignoreEntities: [controller.entity],
        });
        if (hit) {
            controller.isGrounded = true;
            controller.groundNormal = hit.normal;
        }
        else {
            controller.isGrounded = false;
            controller.groundNormal = [0, 1, 0];
        }
    }
    /**
     * Set input for a specific character controller
     */
    setInput(controller, input) {
        controller.setInput(input);
    }
    /**
     * Get all character controllers in the scene
     */
    getControllers() {
        const entities = this.scene.queryEntities(CharacterController);
        return entities
            .map(e => e.getComponent(CharacterController))
            .filter(c => c !== null);
    }
}
//# sourceMappingURL=CharacterControllerSystem.js.map
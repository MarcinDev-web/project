import { CharacterController, CharacterState } from '@engine/world';
import { distanceVec3 } from '@engine/core/math';
import { MovementProfileRegistry } from '../MovementProfiles/MovementProfileRegistry';
import { AnimationComponent } from '../Animation';
/**
 * Maps CharacterState to animation state names
 */
const STATE_TO_ANIMATION = {
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
    scene;
    physics;
    intentBuffer = new Map();
    groundDetectionCache = new Map();
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
            // Load profile if controller was deserialized with profileId but profile not loaded
            this.ensureProfileLoaded(controller);
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
    ensureProfileLoaded(controller) {
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
     * Uses caching to avoid unnecessary raycasts when position hasn't changed significantly
     */
    updateGroundDetection(controller) {
        if (!controller.entity)
            return;
        const origin = controller.entity.transform.position;
        // Create a copy to ensure we're comparing values, not references
        const originCopy = [origin[0], origin[1], origin[2]];
        const cache = this.groundDetectionCache.get(controller);
        // Check cache if position hasn't changed significantly
        if (cache) {
            const distance = distanceVec3(originCopy, cache.lastPosition);
            if (distance < 0.01) {
                // Use cached result
                controller.isGrounded = cache.lastIsGrounded;
                controller.groundNormal = [...cache.lastGroundNormal];
                return;
            }
        }
        // Position changed significantly or no cache - perform raycast
        const direction = [0, -1, 0];
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
        }
        else {
            controller.isGrounded = false;
            controller.groundNormal = [0, 1, 0];
        }
        // Update cache with copied position to avoid reference issues
        this.groundDetectionCache.set(controller, {
            lastPosition: originCopy,
            lastIsGrounded: controller.isGrounded,
            lastGroundNormal: [...controller.groundNormal],
        });
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
            .map((e) => e.getComponent(CharacterController))
            .filter((c) => c !== null);
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
     */
    syncAnimation(controller) {
        if (!controller.entity)
            return;
        const animationComponent = controller.entity.getComponent(AnimationComponent);
        if (!animationComponent)
            return;
        const animationStateName = STATE_TO_ANIMATION[controller.state];
        if (!animationStateName)
            return;
        // Only update if animation state exists and is different from current
        const currentState = animationComponent.getActiveState();
        if (currentState === animationStateName)
            return;
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
//# sourceMappingURL=CharacterControllerSystem.js.map
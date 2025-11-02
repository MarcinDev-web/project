import type { Scene } from '@engine/world';
import { CharacterController, type CharacterInput } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
/**
 * System for updating all character controllers in a scene
 *
 * Handles:
 * - Character controller updates
 * - Ground detection using physics raycasting
 * - Animation synchronization with character state
 * - Integration with physics world
 */
export declare class CharacterControllerSystem {
    private scene;
    private physics;
    private intentBuffer;
    private groundDetectionCache;
    constructor(scene: Scene, physics: PhysicsWorld);
    /**
     * Update all character controllers
     */
    update(deltaTime: number): void;
    /**
     * Ensure profile is loaded for controller (if deserialized with profileId)
     */
    private ensureProfileLoaded;
    applyIntent(controller: CharacterController, intent: {
        move: [number, number];
        jump: boolean;
        sprint: boolean;
    }, cameraForward: Vec3, cameraRight: Vec3): void;
    /**
     * Update ground detection for a character using raycasting
     * Uses caching to avoid unnecessary raycasts when position hasn't changed significantly
     */
    private updateGroundDetection;
    /**
     * Set input for a specific character controller
     */
    setInput(controller: CharacterController, input: CharacterInput): void;
    /**
     * Get all character controllers in the scene
     */
    getControllers(): CharacterController[];
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
    private syncAnimation;
}
//# sourceMappingURL=CharacterControllerSystem.d.ts.map
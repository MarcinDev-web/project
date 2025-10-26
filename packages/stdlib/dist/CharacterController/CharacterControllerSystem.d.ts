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
 * - Integration with physics world
 */
export declare class CharacterControllerSystem {
    private scene;
    private physics;
    private intentBuffer;
    constructor(scene: Scene, physics: PhysicsWorld);
    /**
     * Update all character controllers
     */
    update(deltaTime: number): void;
    applyIntent(controller: CharacterController, intent: {
        move: [number, number];
        jump: boolean;
        sprint: boolean;
    }, cameraForward: Vec3, cameraRight: Vec3): void;
    /**
     * Update ground detection for a character using raycasting
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
}
//# sourceMappingURL=CharacterControllerSystem.d.ts.map
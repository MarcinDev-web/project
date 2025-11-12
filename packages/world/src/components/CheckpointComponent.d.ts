import { Component } from './Component.js';
export interface CheckpointComponentJSON {
    rotation?: number;
    activationRadius?: number;
}
/**
 * CheckpointComponent marks an entity as a checkpoint that the player can activate.
 *
 * Usage:
 * - Place entities with this component in the scene to define checkpoints
 * - When the player enters the checkpoint's activation radius, it becomes the active checkpoint
 * - On respawn, the player will spawn at the last activated checkpoint
 * - The checkpoint uses the entity's transform position for spawning
 */
export declare class CheckpointComponent extends Component {
    static readonly type = "Checkpoint";
    /**
     * Optional spawn rotation (yaw) in radians.
     * If not set, uses the entity's rotation.
     */
    rotation: number;
    /**
     * Activation radius in world units.
     * Player must be within this distance to activate the checkpoint.
     * Default: 2.0 units
     */
    activationRadius: number;
    getType(): string;
    clone(): CheckpointComponent;
    toJSON(): CheckpointComponentJSON;
    fromJSON(data: CheckpointComponentJSON): void;
}
//# sourceMappingURL=CheckpointComponent.d.ts.map
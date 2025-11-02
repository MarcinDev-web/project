import { Component } from './Component';
import { registerComponent } from './registry';

export interface CheckpointComponentJSON {
  rotation?: number; // Yaw rotation in radians
  activationRadius?: number; // Radius for activation detection
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
export class CheckpointComponent extends Component {
  static readonly type = 'Checkpoint';

  /**
   * Optional spawn rotation (yaw) in radians.
   * If not set, uses the entity's rotation.
   */
  rotation = 0;

  /**
   * Activation radius in world units.
   * Player must be within this distance to activate the checkpoint.
   * Default: 2.0 units
   */
  activationRadius = 2.0;

  getType(): string {
    return CheckpointComponent.type;
  }

  override clone(): CheckpointComponent {
    const clone = new CheckpointComponent();
    clone.rotation = this.rotation;
    clone.activationRadius = this.activationRadius;
    return clone;
  }

  override toJSON(): CheckpointComponentJSON {
    return {
      rotation: this.rotation,
      activationRadius: this.activationRadius,
    };
  }

  fromJSON(data: CheckpointComponentJSON): void {
    if (typeof data.rotation === 'number') {
      this.rotation = data.rotation;
    }
    if (typeof data.activationRadius === 'number' && data.activationRadius > 0) {
      this.activationRadius = data.activationRadius;
    }
  }
}

registerComponent(CheckpointComponent.type, CheckpointComponent);


import { Component } from './Component';
import { registerComponent } from './registry';
import type { Vec3 } from '@engine/core/math';

export interface SpawnPointComponentJSON {
  isDefault?: boolean;
  rotation?: number; // Yaw rotation in radians
}

/**
 * SpawnPointComponent marks an entity as a potential player spawn location.
 * 
 * Usage:
 * - Place entities with this component in the scene to define spawn points
 * - Mark one as `isDefault: true` to designate the primary spawn point
 * - The spawn system will use the entity's transform position for spawning
 */
export class SpawnPointComponent extends Component {
  static readonly type = 'SpawnPoint';

  /** 
   * If true, this is the primary/default spawn point.
   * If multiple spawn points have isDefault=true, the first one found is used.
   */
  isDefault = false;

  /**
   * Optional spawn rotation (yaw) in radians.
   * If not set, uses the entity's rotation.
   */
  rotation = 0;

  getType(): string {
    return SpawnPointComponent.type;
  }

  override clone(): SpawnPointComponent {
    const clone = new SpawnPointComponent();
    clone.isDefault = this.isDefault;
    clone.rotation = this.rotation;
    return clone;
  }

  override toJSON(): SpawnPointComponentJSON {
    return {
      isDefault: this.isDefault,
      rotation: this.rotation,
    };
  }

  fromJSON(data: SpawnPointComponentJSON): void {
    if (typeof data.isDefault === 'boolean') {
      this.isDefault = data.isDefault;
    }
    if (typeof data.rotation === 'number') {
      this.rotation = data.rotation;
    }
  }
}

registerComponent(SpawnPointComponent.type, SpawnPointComponent);


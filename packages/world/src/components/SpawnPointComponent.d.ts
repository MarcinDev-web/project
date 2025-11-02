import { Component } from './Component';
export interface SpawnPointComponentJSON {
    isDefault?: boolean;
    rotation?: number;
}
/**
 * SpawnPointComponent marks an entity as a potential player spawn location.
 *
 * Usage:
 * - Place entities with this component in the scene to define spawn points
 * - Mark one as `isDefault: true` to designate the primary spawn point
 * - The spawn system will use the entity's transform position for spawning
 */
export declare class SpawnPointComponent extends Component {
    static readonly type = "SpawnPoint";
    /**
     * If true, this is the primary/default spawn point.
     * If multiple spawn points have isDefault=true, the first one found is used.
     */
    isDefault: boolean;
    /**
     * Optional spawn rotation (yaw) in radians.
     * If not set, uses the entity's rotation.
     */
    rotation: number;
    getType(): string;
    clone(): SpawnPointComponent;
    toJSON(): SpawnPointComponentJSON;
    fromJSON(data: SpawnPointComponentJSON): void;
}
//# sourceMappingURL=SpawnPointComponent.d.ts.map
import type { SnapshotMessage } from '@engine/net-protocol';
import type { EcsReplicator, EcsReplicatorContext } from './EcsReplicator.js';
import type { ReplicationEntityRef } from './types.js';
import type { Scene } from '@engine/world';
/**
 * Quantization configuration for Transform component
 */
export interface TransformQuantization {
    positionBits: number;
    rotationBits: number;
    positionScale: number;
}
/**
 * Replicator for Transform component (position, rotation)
 */
export declare class TransformReplicator implements EcsReplicator {
    private readonly scene;
    private readonly quantization;
    constructor(scene: Scene, quantization?: TransformQuantization);
    buildSnapshot(_context: EcsReplicatorContext, entities: ReplicationEntityRef[], seq: number, ackInputSeq: number, baselineSeq?: number): SnapshotMessage;
}
//# sourceMappingURL=TransformReplicator.d.ts.map
import type { SnapshotMessage } from '@engine/net-protocol';
import type { ReplicationEntityRef } from './types.js';
export interface EcsReplicatorContext {
    scene?: import('@engine/world').Scene;
}
export interface EcsReplicator {
    buildSnapshot(context: EcsReplicatorContext, entities: ReplicationEntityRef[], seq: number, ackInputSeq: number, baselineSeq?: number): SnapshotMessage;
}
export declare class NoopReplicator implements EcsReplicator {
    buildSnapshot(_context: EcsReplicatorContext, _entities: ReplicationEntityRef[], seq: number, ackInputSeq: number, baselineSeq?: number): SnapshotMessage;
}
//# sourceMappingURL=EcsReplicator.d.ts.map
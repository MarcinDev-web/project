import type { SnapshotMessage } from '@engine/net-protocol';
import type { ReplicationEntityRef } from './types.js';

export interface EcsReplicatorContext {
  scene?: import('@engine/world').Scene;
  // future: time, deltaTime, etc.
}

export interface EcsReplicator {
  buildSnapshot(context: EcsReplicatorContext, entities: ReplicationEntityRef[], seq: number, ackInputSeq: number, baselineSeq?: number): SnapshotMessage;
}

export class NoopReplicator implements EcsReplicator {
  buildSnapshot(_context: EcsReplicatorContext, _entities: ReplicationEntityRef[], seq: number, ackInputSeq: number, baselineSeq?: number): SnapshotMessage {
    return {
      header: { 
        seq, 
        ackInputSeq, 
        ...(baselineSeq !== undefined && { baselineSeq }), 
        byteLength: 0 
      },
      payload: new Uint8Array(0),
    };
  }
}



import type { SnapshotMessage } from '@engine/net-protocol';
import type { ClientBaselineState, ReplicationBudget, ReplicationEntityRef } from './types.js';
import type { EcsReplicator, EcsReplicatorContext } from './EcsReplicator.js';

export class SnapshotScheduler {
  private seqCounter = 1;

  constructor(private readonly replicator: EcsReplicator, private readonly budget: ReplicationBudget) {}

  scheduleForClient(ctx: EcsReplicatorContext, client: ClientBaselineState, entities: ReplicationEntityRef[] = []): SnapshotMessage | null {
    const seq = this.seqCounter++;
    const snap = this.replicator.buildSnapshot(ctx, entities, seq, client.lastAckInputSeq, client.lastBaselineSeq);
    if (snap.header.byteLength <= this.budget.maxBytesPerTick) {
      client.lastBaselineSeq = snap.header.seq;
      return snap;
    }
    return null;
  }
}



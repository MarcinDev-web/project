import type { SnapshotMessage } from '@engine/net-protocol';
import type { ClientBaselineState, ReplicationBudget } from './types.js';
import type { EcsReplicator, EcsReplicatorContext } from './EcsReplicator.js';
export declare class SnapshotScheduler {
    private readonly replicator;
    private readonly budget;
    private seqCounter;
    constructor(replicator: EcsReplicator, budget: ReplicationBudget);
    scheduleForClient(ctx: EcsReplicatorContext, client: ClientBaselineState): SnapshotMessage | null;
}
//# sourceMappingURL=SnapshotScheduler.d.ts.map
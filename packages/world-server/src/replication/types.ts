export interface ReplicationEntityRef {
  id: bigint;
}

export interface ClientBaselineState {
  lastBaselineSeq: number;
  lastAckInputSeq: number;
}

export interface ReplicationBudget {
  maxBytesPerTick: number;
}



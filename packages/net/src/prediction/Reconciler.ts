import type { InputFrame } from '@engine/net-protocol';

export interface SimulationState<T> {
  snapshot: T;
}

export type ApplyInput<T> = (state: T, input: InputFrame) => T;

export function reconcile<T>(authoritative: T, lastAckInputSeq: number, buffer: InputFrame[], apply: ApplyInput<T>): T {
  let state = authoritative;
  for (const input of buffer) {
    if (input.seq > lastAckInputSeq) {
      state = apply(state, input);
    }
  }
  return state;
}



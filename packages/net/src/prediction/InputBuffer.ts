import type { InputFrame } from '@engine/net-protocol';

export class InputBuffer {
  private readonly buffer: InputFrame[] = [];

  push(frame: InputFrame): void {
    this.buffer.push(frame);
  }

  clearUpTo(seq: number): void {
    while (this.buffer.length && (this.buffer[0]?.seq ?? Infinity) <= seq) {
      this.buffer.shift();
    }
  }

  unackedSince(seq: number): InputFrame[] {
    return this.buffer.filter((f) => f.seq > seq);
  }
}



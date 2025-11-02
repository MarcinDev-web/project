export class BitReader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}

  readByte(): number {
    const byte = this.bytes[this.offset++];
    if (byte === undefined) {
      throw new Error('BitReader: Read past end of buffer');
    }
    return byte;
  }

  readBytes(len: number): Uint8Array {
    const end = this.offset + len;
    const out = this.bytes.slice(this.offset, end);
    this.offset = end;
    return out;
  }
}



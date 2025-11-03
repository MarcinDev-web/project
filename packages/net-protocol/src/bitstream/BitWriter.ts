export class BitWriter {
  private readonly bytes: number[] = [];

  writeByte(v: number): void {
    this.bytes.push(v & 0xff);
  }

  writeBytes(src: Uint8Array): void {
    for (let i = 0; i < src.length; i++) {
      const byte = src[i];
      if (byte !== undefined) {
        this.bytes.push(byte);
      }
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

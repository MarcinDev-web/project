// Typed array pool to reduce transient allocations

export class TypedArrayPool {
  private f32: Float32Array[] = [];
  private u8: Uint8Array[] = [];
  private i16: Int16Array[] = [];
  private u16: Uint16Array[] = [];
  private u32: Uint32Array[] = [];

  getFloat32(minLength: number): Float32Array {
    const arr = this.popSuitable(this.f32, minLength);
    return arr ?? new Float32Array(this.nextCap(minLength));
  }
  releaseFloat32(arr: Float32Array): void {
    this.f32.push(arr);
  }

  clear(): void {
    this.f32.length = 0;
    this.u8.length = 0;
    this.i16.length = 0;
    this.u16.length = 0;
    this.u32.length = 0;
  }

  private nextCap(min: number): number {
    let cap = 1;
    while (cap < Math.max(16, min)) cap <<= 1;
    return cap;
  }

  private popSuitable<T extends ArrayBufferView>(pool: T[], minLength: number): T | undefined {
    for (let i = 0; i < pool.length; i++) {
      const arr = pool[i];
      if ((arr as any).length >= minLength) {
        pool.splice(i, 1);
        return arr;
      }
    }
    return undefined;
  }
}

export const GlobalTypedArrayPool = new TypedArrayPool();



export declare class TypedArrayPool {
    private f32;
    private u8;
    private i16;
    private u16;
    private u32;
    getFloat32(minLength: number): Float32Array;
    releaseFloat32(arr: Float32Array): void;
    clear(): void;
    private nextCap;
    private popSuitable;
}
export declare const GlobalTypedArrayPool: TypedArrayPool;
//# sourceMappingURL=TypedArrayPool.d.ts.map
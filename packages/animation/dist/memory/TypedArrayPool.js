// Typed array pool to reduce transient allocations
export class TypedArrayPool {
    f32 = [];
    u8 = [];
    i16 = [];
    u16 = [];
    u32 = [];
    getFloat32(minLength) {
        const arr = this.popSuitable(this.f32, minLength);
        return arr ?? new Float32Array(this.nextCap(minLength));
    }
    releaseFloat32(arr) {
        this.f32.push(arr);
    }
    clear() {
        this.f32.length = 0;
        this.u8.length = 0;
        this.i16.length = 0;
        this.u16.length = 0;
        this.u32.length = 0;
    }
    nextCap(min) {
        let cap = 1;
        while (cap < Math.max(16, min))
            cap <<= 1;
        return cap;
    }
    popSuitable(pool, minLength) {
        for (let i = 0; i < pool.length; i++) {
            const arr = pool[i];
            if (arr.length >= minLength) {
                pool.splice(i, 1);
                return arr;
            }
        }
        return undefined;
    }
}
export const GlobalTypedArrayPool = new TypedArrayPool();
//# sourceMappingURL=TypedArrayPool.js.map
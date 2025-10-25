function nextCapacity(minSize) {
    // Grow exponentially to reduce realloc churn; minimum 256 bytes
    const min = Math.max(minSize, 256);
    let cap = 256;
    while (cap < min)
        cap <<= 1;
    return cap;
}
export class GPUBufferPool {
    device;
    buffers = new Map();
    constructor(device) {
        this.device = device;
    }
    getOrCreate(name, size, usage, label) {
        const existing = this.buffers.get(name);
        if (existing && existing.usage === usage && existing.capacity >= size) {
            return existing.buffer;
        }
        const capacity = nextCapacity(size);
        const buffer = this.device.createBuffer({
            label: label ?? name,
            size: capacity,
            usage,
        });
        // Destroy previous if present
        if (existing) {
            try {
                existing.buffer.destroy();
            }
            catch {
                // ignore destroy errors
            }
        }
        this.buffers.set(name, { buffer, capacity, usage });
        return buffer;
    }
    get(name) {
        return this.buffers.get(name)?.buffer ?? null;
    }
    disposeAll() {
        for (const rec of this.buffers.values()) {
            try {
                rec.buffer.destroy();
            }
            catch {
                // ignore destroy errors
            }
        }
        this.buffers.clear();
    }
}
//# sourceMappingURL=bufferPool.js.map
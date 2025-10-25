export interface BufferRecord {
    buffer: GPUBuffer;
    capacity: number;
    usage: GPUBufferUsageFlags;
}
export declare class GPUBufferPool {
    private readonly device;
    private readonly buffers;
    constructor(device: GPUDevice);
    getOrCreate(name: string, size: number, usage: GPUBufferUsageFlags, label?: string): GPUBuffer;
    get(name: string): GPUBuffer | null;
    disposeAll(): void;
}
//# sourceMappingURL=bufferPool.d.ts.map
export declare class BloomPass {
    private device;
    private pipeline;
    private bindGroupLayout;
    private sampler;
    private cachedBindGroup;
    private cachedSrcView;
    private cachedDstView;
    constructor(device: GPUDevice);
    initialize(format: GPUTextureFormat): void;
    render(encoder: GPUCommandEncoder, srcView: GPUTextureView, dstView: GPUTextureView, opts?: {
        querySet?: GPUQuerySet;
        begin?: number;
        end?: number;
    }): void;
}
//# sourceMappingURL=Bloom.d.ts.map
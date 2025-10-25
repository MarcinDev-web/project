export declare class BloomPass {
    private device;
    private pipeline;
    private bindGroupLayout;
    private sampler;
    constructor(device: GPUDevice);
    initialize(format: GPUTextureFormat): void;
    render(encoder: GPUCommandEncoder, srcView: GPUTextureView, dstView: GPUTextureView): void;
}
//# sourceMappingURL=Bloom.d.ts.map
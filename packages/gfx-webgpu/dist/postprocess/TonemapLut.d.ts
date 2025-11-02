export declare class TonemapLutPass {
    private device;
    private pipeline;
    private bindGroupLayout;
    private sampler;
    private lutTexture;
    private cachedBindGroup;
    private cachedSrcView;
    private cachedBloomView;
    constructor(device: GPUDevice);
    private createIdentityLUT;
    initialize(presentationFormat: GPUTextureFormat): void;
    render(encoder: GPUCommandEncoder, srcView: GPUTextureView, bloomView: GPUTextureView, dstView: GPUTextureView, opts?: {
        querySet?: GPUQuerySet;
        begin?: number;
        end?: number;
    }): void;
}
//# sourceMappingURL=TonemapLut.d.ts.map
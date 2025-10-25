export declare class TonemapLutPass {
    private device;
    private pipeline;
    private bindGroupLayout;
    private sampler;
    private lutTexture;
    constructor(device: GPUDevice);
    private createIdentityLUT;
    initialize(presentationFormat: GPUTextureFormat): void;
    render(encoder: GPUCommandEncoder, srcView: GPUTextureView, bloomView: GPUTextureView, dstView: GPUTextureView): void;
}
//# sourceMappingURL=TonemapLut.d.ts.map
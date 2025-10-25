export declare class BrdfLutPass {
    private device;
    private pipeline;
    private bindGroupLayout;
    private lutTexture;
    constructor(device: GPUDevice);
    initialize(size?: number): void;
    generate(encoder: GPUCommandEncoder, size?: number): GPUTexture;
}
//# sourceMappingURL=BrdfLut.d.ts.map
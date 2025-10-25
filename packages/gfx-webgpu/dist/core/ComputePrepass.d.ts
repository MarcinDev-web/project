/**
 * Minimal compute prepass to demonstrate WebGPU compute integration.
 *
 * The pass writes a constant value into a small storage buffer. It does not
 * currently feed back into the render pipeline, serving as a foundation for
 * future GPU-side preprocessing (culling, clustering, etc.).
 */
export declare class ComputePrepass {
    private readonly device;
    private readonly pipeline;
    private readonly bindGroup;
    private readonly outputBuffer;
    constructor(device: GPUDevice);
    run(encoder: GPUCommandEncoder): void;
    dispose(): void;
}
//# sourceMappingURL=ComputePrepass.d.ts.map
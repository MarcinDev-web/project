import type { GeometryData } from '../resources/resources';
import type { Mat4, Vec3 } from '@engine/core/math';
export declare class ShadowPass {
    private device;
    private atlas;
    private atlasView;
    private pipeline;
    private uniformLayout;
    private uniformBuffer;
    private uniformBindGroup;
    private comparisonSampler;
    private readonly atlasSize;
    private cascadeOverlap;
    private filterParamsRef;
    private biasParamsRef;
    private lastCascadeCounts;
    private culledCapacity;
    private culledOffsetBuffer;
    private culledColorScaleBuffer;
    private culledRotationBuffer;
    private culledMaterialIdBuffer;
    private culledOffsetF32;
    private culledColorScaleF32;
    private culledRotationF32;
    private culledMaterialIdF32;
    constructor(device: GPUDevice);
    setQualityPreset(preset: 'low' | 'med' | 'high' | 'ultra'): void;
    getLastCascadeInstanceCounts(): readonly [number, number, number, number];
    private ensureResources;
    private ensureCulledBuffers;
    private rowNorm;
    private cullInstancesForCascade;
    render(params: {
        encoder: GPUCommandEncoder;
        frameResources: {
            vertexBuffer: GPUBuffer;
            indexBuffer: GPUBuffer;
            instanceOffsetBuffer: GPUBuffer;
            instanceColorScaleBuffer: GPUBuffer;
            instanceRotationBuffer: GPUBuffer;
            instanceMaterialIdBuffer: GPUBuffer;
            textureBindGroupLayout: GPUBindGroupLayout;
            textureBindGroup: GPUBindGroup;
            uniformBuffer: GPUBuffer;
            sideTexture: GPUTexture;
            normalAtlasTexture: GPUTexture;
            sampler: GPUSampler;
            atlasMetaBuffer?: GPUBuffer;
        };
        geometry: GeometryData;
        viewMatrix: Mat4;
        projectionMatrix: Mat4;
        uniformManager: {
            updateShadowUniforms: Function;
        };
        lightingData?: {
            directionalLightDir?: Vec3;
            lights: Array<{
                type: number;
                direction: Vec3;
            }>;
        };
        ibl?: {
            brdfLut?: GPUTexture | null;
            envCube?: GPUTexture | null;
        };
    }): void;
}
//# sourceMappingURL=ShadowPass.d.ts.map
/**
 * Uniform Buffer Manager
 *
 * Manages GPU uniform buffer initialization and updates.
 * Handles both static (one-time) and dynamic (per-frame) uniform data.
 *
 * Buffer Layout:
 * - 0-64: viewProjectionMatrix (mat4x4<f32>)
 * - 64-80: cameraPosition (vec3<f32> + padding)
 * - 80-96: atlasInsetAndPad (vec4<f32>)
 * - 96-112: shadingParams0 (vec4<f32>)
 * - 112-128: atlasParams (vec4<f32>)
 * - 144-464: lighting data (managed by LightingUniformWriter)
 */
import type { Mat4, Vec3 } from '@engine/core/math';
import type { LightingData } from '../lighting/LightManager';
/**
 * UniformManager handles all uniform buffer operations.
 */
export declare class UniformManager {
    private uniformBuffer;
    private device;
    private atlasInsetAndPad;
    private shadingParams0;
    private atlasParams;
    private eyePosition;
    private viewMatrix;
    constructor(device: GPUDevice, uniformBuffer: GPUBuffer);
    /**
     * Initializes static uniform data (called once during setup).
     */
    initializeStaticUniforms(atlasConfig: {
        atlasSize: number;
        materialTextureSize: number;
        padding: number;
    }): void;
    /**
     * Updates dynamic uniform data (called per frame).
     */
    updateDynamicUniforms(viewProjectionMatrix: Mat4, eyePosition: Vec3, lightingData?: LightingData): void;
    /**
     * Updates shadow-related uniforms appended after the lighting block.
     * Layout (offsets from 464 bytes):
     *  - 0..64: viewMatrix
     *  - 64..320: lightViewProj[4]
     *  - 320..336: cascadeSplits (vec4)
     *  - 336..400: atlasRects[4] (vec4 each)
     *  - 400..416: filterParams (vec4)
     *  - 416..432: biasParams (vec4)
     */
    updateShadowUniforms(params: {
        viewMatrix: Mat4;
        lightViewProj: readonly Mat4[];
        cascadeSplits: readonly [number, number, number, number];
        atlasRects: readonly [number, number, number, number][];
        filterParams: readonly [number, number, number, number];
        biasParams: readonly [number, number, number, number];
    }): void;
    /**
     * Gets the uniform buffer.
     */
    getBuffer(): GPUBuffer;
}
//# sourceMappingURL=UniformManager.d.ts.map
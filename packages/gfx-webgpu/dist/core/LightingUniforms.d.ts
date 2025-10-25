/**
 * Lighting Uniform System
 *
 * Manages writing lighting data to GPU uniform buffers.
 * Handles directional lights, point lights, and ambient lighting.
 *
 * Buffer Layout (starting at offset 144):
 * - 144-160: pointLightCount (u32 + 3 padding)
 * - 160-176: directionalLightDir (vec3 + padding)
 * - 176-192: directionalLightColor (vec3 + padding)
 * - 192-208: ambientColor (vec3) + ambientIntensity (f32)
 * - 208-464: pointLights array (4 * 64 bytes)
 */
import type { LightingData } from '../lighting/LightManager';
/** Byte offset where lighting uniforms start in the uniform buffer */
export declare const LIGHTING_UNIFORMS_OFFSET = 144;
/** Total byte size of lighting uniforms section */
export declare const LIGHTING_UNIFORMS_SIZE = 320;
/**
 * LightingUniformWriter manages writing lighting data to GPU buffers.
 */
export declare class LightingUniformWriter {
    /**
     * Writes lighting uniforms to the GPU buffer.
     *
     * @param device - GPU device for buffer writes
     * @param uniformBuffer - Target uniform buffer
     * @param lightingData - Lighting data from LightManager
     */
    writeLightingUniforms(device: GPUDevice, uniformBuffer: GPUBuffer, lightingData: LightingData): void;
}
/**
 * Writes lighting uniforms to the GPU buffer.
 * Legacy function for backward compatibility.
 *
 * Buffer layout (starting at offset 144 after atlasParams):
 * - 144-160: pointLightCount (u32 + 3 padding as f32/unused)
 * - 160-176: directionalLightDir (vec3 + padding)
 * - 176-192: directionalLightColor (vec3 + padding)
 * - 192-208: ambientColor (vec3) + ambientIntensity (f32)
 * - 208-464: pointLights array (4 * 64 bytes)
 */
export declare function writeLightingUniforms(device: GPUDevice, uniformBuffer: GPUBuffer, lightingData: LightingData): void;
//# sourceMappingURL=LightingUniforms.d.ts.map
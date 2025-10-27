/**
 * Lighting Uniform System
 *
 * Manages writing lighting data to GPU uniform buffers.
 * Handles directional lights, point lights, and ambient lighting.
 *
 * Buffer Layout (starting at offset 128):
 * - 128-144: pointLightCount (u32 + 3 padding)
 * - 144-160: directionalLightDir (vec3 + padding)
 * - 160-176: directionalLightColor (vec3 + padding)
 * - 176-192: ambientColor (vec3) + ambientIntensity (f32)
 * - 192-448: pointLights array (4 * 64 bytes)
 */
/** Byte offset where lighting uniforms start in the uniform buffer */
export const LIGHTING_UNIFORMS_OFFSET = 128;
/** Total byte size of lighting uniforms section */
export const LIGHTING_UNIFORMS_SIZE = 320;
/**
 * LightingUniformWriter manages writing lighting data to GPU buffers.
 */
export class LightingUniformWriter {
    /**
     * Writes lighting uniforms to the GPU buffer.
     *
     * @param device - GPU device for buffer writes
     * @param uniformBuffer - Target uniform buffer
     * @param lightingData - Lighting data from LightManager
     */
    writeLightingUniforms(device, uniformBuffer, lightingData) {
        const byteSize = LIGHTING_UNIFORMS_SIZE;
        const arrayBuffer = new ArrayBuffer(byteSize);
        const f32 = new Float32Array(arrayBuffer);
        const u32 = new Uint32Array(arrayBuffer);
        let f = 0; // float index (in 4-byte floats)
        // Point light count (u32) + padding (3 floats)
        const pointLights = lightingData.lights.filter((l) => l.type === 1).slice(0, 4);
        u32[f++] = pointLights.length; // occupies first 4 bytes
        f32[f++] = 0; // pad
        f32[f++] = 0; // pad
        f32[f++] = 0; // pad
        // Directional light (dir + color), with sane defaults if absent
        const dirLight = lightingData.lights.find((l) => l.type === 0) ?? {
            type: 0,
            position: [0, 0, 0],
            direction: [0.3, -0.7, -0.5],
            color: [1.0, 0.98, 0.95],
            range: 0,
            spotInnerCos: 0,
            spotOuterCos: 0,
        };
        f32[f++] = dirLight.direction[0];
        f32[f++] = dirLight.direction[1];
        f32[f++] = dirLight.direction[2];
        f32[f++] = 0; // pad
        f32[f++] = dirLight.color[0];
        f32[f++] = dirLight.color[1];
        f32[f++] = dirLight.color[2];
        f32[f++] = 0; // pad
        // Ambient (vec3 + intensity)
        f32[f++] = lightingData.ambientColor[0];
        f32[f++] = lightingData.ambientColor[1];
        f32[f++] = lightingData.ambientColor[2];
        f32[f++] = lightingData.ambientIntensity;
        // Up to 4 point lights
        for (let i = 0; i < 4; i++) {
            const light = pointLights[i];
            if (light) {
                // type (as u32) + 3 pad
                u32[f++] = light.type;
                f32[f++] = 0;
                f32[f++] = 0;
                f32[f++] = 0;
                // position (vec3) + pad
                f32[f++] = light.position[0];
                f32[f++] = light.position[1];
                f32[f++] = light.position[2];
                f32[f++] = 0;
                // color (vec3) + pad
                f32[f++] = light.color[0];
                f32[f++] = light.color[1];
                f32[f++] = light.color[2];
                f32[f++] = 0;
                // range + direction (vec3)
                f32[f++] = light.range;
                f32[f++] = light.direction[0];
                f32[f++] = light.direction[1];
                f32[f++] = light.direction[2];
            }
            else {
                // Zero-fill remaining slot (16 floats)
                for (let j = 0; j < 16; j++)
                    f32[f++] = 0;
            }
        }
        device.queue.writeBuffer(uniformBuffer, LIGHTING_UNIFORMS_OFFSET, arrayBuffer, 0, byteSize);
    }
}
/**
 * Writes lighting uniforms to the GPU buffer.
 * Legacy function for backward compatibility.
 *
 * Buffer layout (starting at offset 128 after atlasParams):
 * - 128-144: pointLightCount (u32 + 3 padding as f32/unused)
 * - 144-160: directionalLightDir (vec3 + padding)
 * - 160-176: directionalLightColor (vec3 + padding)
 * - 176-192: ambientColor (vec3) + ambientIntensity (f32)
 * - 192-448: pointLights array (4 * 64 bytes)
 */
export function writeLightingUniforms(device, uniformBuffer, lightingData) {
    const writer = new LightingUniformWriter();
    writer.writeLightingUniforms(device, uniformBuffer, lightingData);
}
//# sourceMappingURL=LightingUniforms.js.map
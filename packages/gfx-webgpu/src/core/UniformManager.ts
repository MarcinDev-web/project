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
 * - 128-448: lighting data (managed by LightingUniformWriter)
 */

import type { Mat4, Vec3 } from '@engine/core/math';
import type { LightingData } from '../lighting/LightManager';
import { writeLightingUniforms } from './LightingUniforms';
import { TEXTURE_SIZE, SHADING_AMBIENT, SHADING_TOON_BANDS, SHADING_SPECULAR_POWER } from '../config';

/**
 * UniformManager handles all uniform buffer operations.
 */
export class UniformManager {
  private uniformBuffer: GPUBuffer;
  private device: GPUDevice;

  // Static uniform data (initialized once)
  private atlasInsetAndPad: Float32Array;
  private shadingParams0: Float32Array;
  private atlasParams: Float32Array;

  // Dynamic uniform data (updated per frame)
  private eyePosition: Float32Array;
  // Shadow & camera extra
  private viewMatrix: Float32Array;

  constructor(device: GPUDevice, uniformBuffer: GPUBuffer) {
    this.device = device;
    this.uniformBuffer = uniformBuffer;

    // Initialize static uniform arrays
    
    const halfTexel = 0.5 / TEXTURE_SIZE;
    this.atlasInsetAndPad = new Float32Array([halfTexel, halfTexel, 0, 0]);
    
    this.shadingParams0 = new Float32Array([
      SHADING_AMBIENT,
      SHADING_TOON_BANDS,
      SHADING_SPECULAR_POWER,
      0,
    ]);
    
    this.atlasParams = new Float32Array(4);
    this.eyePosition = new Float32Array(4);
    this.viewMatrix = new Float32Array(16);
  }

  /**
   * Initializes static uniform data (called once during setup).
   */
  initializeStaticUniforms(atlasConfig: {
    atlasSize: number;
    materialTextureSize: number;
    padding: number;
  }): void {
    // Write static uniforms that don't change per frame
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      80,
      this.atlasInsetAndPad.buffer,
      this.atlasInsetAndPad.byteOffset,
      16
    );

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      96,
      this.shadingParams0.buffer,
      this.shadingParams0.byteOffset,
      16
    );

    // Calculate and write atlas params
    const cellSize = atlasConfig.materialTextureSize + atlasConfig.padding;
    const materialsPerRow = Math.floor(atlasConfig.atlasSize / cellSize);
    
    this.atlasParams[0] = materialsPerRow; // x: materials per row
    this.atlasParams[1] = atlasConfig.materialTextureSize; // y: texture size in atlas
    this.atlasParams[2] = atlasConfig.atlasSize; // z: total atlas size
    this.atlasParams[3] = atlasConfig.padding; // w: padding between textures

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      112,
      this.atlasParams.buffer,
      this.atlasParams.byteOffset,
      16
    );
  }

  /**
   * Updates dynamic uniform data (called per frame).
   */
  updateDynamicUniforms(
    viewProjectionMatrix: Mat4,
    eyePosition: Vec3,
    lightingData?: LightingData
  ): void {
    // Update view-projection matrix
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      viewProjectionMatrix.buffer as ArrayBuffer,
      viewProjectionMatrix.byteOffset,
      64
    );

    // Update camera position
    this.eyePosition[0] = eyePosition[0];
    this.eyePosition[1] = eyePosition[1];
    this.eyePosition[2] = eyePosition[2];
    this.eyePosition[3] = 0;

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      64,
      this.eyePosition.buffer,
      this.eyePosition.byteOffset,
      16
    );

    // Update lighting uniforms if provided
    if (lightingData) {
      writeLightingUniforms(this.device, this.uniformBuffer, lightingData);
    }
  }

  /**
   * Updates shadow-related uniforms appended after the lighting block.
   * Layout (offsets from 448 bytes):
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
    atlasRects: readonly [number, number, number, number][]; // uvMin.xy, uvMax.zw per cascade
    filterParams: readonly [number, number, number, number];
    biasParams: readonly [number, number, number, number];
    extraParams?: readonly [number, number, number, number];
  }): void {
    // Base offset right after lighting block
    const baseOffset = 448;
    // viewMatrix
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      baseOffset,
      params.viewMatrix.buffer as ArrayBuffer,
      (params.viewMatrix as Float32Array).byteOffset ?? 0,
      64
    );

    // lightViewProj[4]
    for (let i = 0; i < 4; i++) {
      const m = params.lightViewProj[i] ?? new Float32Array(16);
      this.device.queue.writeBuffer(
        this.uniformBuffer,
        baseOffset + 64 + i * 64,
        (m as Float32Array).buffer as ArrayBuffer,
        (m as Float32Array).byteOffset ?? 0,
        64
      );
    }

    // cascadeSplits
    const splits = new Float32Array(params.cascadeSplits);
    this.device.queue.writeBuffer(this.uniformBuffer, baseOffset + 64 + 256, splits.buffer, 0, 16);

    // atlasRects (as 4 vec4)
    const rectsF32 = new Float32Array(16);
    let rOff = 0;
    for (let i = 0; i < 4; i++) {
      const r = params.atlasRects[i] ?? [0, 0, 1, 1];
      rectsF32[rOff++] = r[0];
      rectsF32[rOff++] = r[1];
      rectsF32[rOff++] = r[2];
      rectsF32[rOff++] = r[3];
    }
    this.device.queue.writeBuffer(this.uniformBuffer, baseOffset + 64 + 256 + 16, rectsF32.buffer, 0, 64);

    // filterParams
    const filterF32 = new Float32Array(params.filterParams);
    this.device.queue.writeBuffer(this.uniformBuffer, baseOffset + 64 + 256 + 16 + 64, filterF32.buffer, 0, 16);

    // biasParams
    const biasF32 = new Float32Array(params.biasParams);
    this.device.queue.writeBuffer(this.uniformBuffer, baseOffset + 64 + 256 + 16 + 64 + 16, biasF32.buffer, 0, 16);

    // extra shadow params (e.g., cascadeOverlap)
    const extra = params.extraParams ?? [0, 0, 0, 0];
    const extraF32 = new Float32Array(extra);
    this.device.queue.writeBuffer(this.uniformBuffer, baseOffset + 64 + 256 + 16 + 64 + 16 + 16, extraF32.buffer, 0, 16);
  }

  /**
   * Gets the uniform buffer.
   */
  getBuffer(): GPUBuffer {
    return this.uniformBuffer;
  }
}


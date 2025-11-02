/**
 * Normal Render Pass
 * 
 * Renders world-space normals to a G-buffer texture for use by SSAO and other effects.
 * Uses the same geometry and vertex shader as the main render pass, but outputs only normals.
 */

import type { FrameResources, GeometryData } from '../resources/resources';
import { createPbrShaderCode } from '../shaders/pbr';
import { ShaderEntryPoint } from '../shaders/types';
import { Logger } from '@engine/core/utils';

export class NormalRenderPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private initialized = false;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Creates a shader module for normal rendering
   * Reuses vertex shader from PBR, but fragment shader only outputs normals
   */
  private createNormalShader(): string {
    // Import helpers
    const { WGSL_COMMON_HELPERS } = require('../shaders/chunks');
    
    // Get the full PBR shader to extract needed parts
    const pbrCode = createPbrShaderCode();
    
    // Split at fragment shader to get everything before it
    const parts = pbrCode.split('@fragment');
    const beforeFragment = parts[0] || '';
    
    // Create simplified fragment shader that outputs normals
    const fragmentShader = `
@fragment
fn fs_normal(
  @location(0) vNormal : vec3<f32>
) -> @location(0) vec4<f32> {
  // Normalize and encode to [0,1] range: normal * 0.5 + 0.5
  // Normals are in world space from vertex shader
  let n = normalize(vNormal);
  // Encode normal from [-1,1] to [0,1] for texture storage
  let encoded = n * 0.5 + 0.5;
  return vec4<f32>(encoded, 1.0);
}`;

    // Combine everything: PBR preamble (uniforms, structs, vertex shader) + new fragment shader
    return beforeFragment + fragmentShader;
  }

  /**
   * Initializes the normal render pass pipeline
   */
  initialize(
    uniformBindGroupLayout: GPUBindGroupLayout,
    textureBindGroupLayout: GPUBindGroupLayout,
    vertexBuffers: GPUVertexBufferLayout[],
    format: GPUTextureFormat,
    sampleCount: number
  ): void {
    if (this.initialized && this.pipeline) return;

    try {
      const shaderCode = this.createNormalShader();
      const shaderModule = this.device.createShaderModule({
        label: 'normal-pass-shader',
        code: shaderCode,
      });

      const pipelineLayout = this.device.createPipelineLayout({
        label: 'normal-pass-layout',
        bindGroupLayouts: [uniformBindGroupLayout, textureBindGroupLayout],
      });

      const devAny = this.device as unknown as { 
        pushErrorScope?: (scope: GPUErrorFilter) => void;
        popErrorScope?: () => Promise<GPUError | null>;
      };

      const hasErrorScope = typeof devAny.pushErrorScope === 'function' && typeof devAny.popErrorScope === 'function';
      if (hasErrorScope) devAny.pushErrorScope!('validation');

      this.pipeline = this.device.createRenderPipeline({
        label: 'normal-pass-pipeline',
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: vertexBuffers,
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_normal',
          targets: [{ format }],
        },
        primitive: { 
          topology: 'triangle-list', 
          cullMode: 'back', 
          frontFace: 'ccw' 
        },
        depthStencil: { 
          depthWriteEnabled: true, 
          depthCompare: 'less', 
          format: 'depth24plus' 
        },
        multisample: { count: sampleCount },
      });

      if (hasErrorScope) {
        // Pop error scope asynchronously (fire and forget)
        devAny.popErrorScope!().then((pipelineError) => {
          if (pipelineError) {
            Logger.error('Normal render pipeline validation error:', pipelineError as unknown as Error);
          }
        }).catch(() => {
          // ignore
        });
      }

      this.initialized = true;
    } catch (err) {
      Logger.error('Failed to initialize normal render pass:', err as unknown as Error);
      this.initialized = false;
      this.pipeline = null;
    }
  }

  /**
   * Renders normals to the G-buffer texture
   */
  render(
    passEncoder: GPURenderPassEncoder,
    frameResources: FrameResources,
    geometry: GeometryData
  ): void {
    if (!this.pipeline || !this.initialized) {
      Logger.warn('Normal render pass not initialized, skipping');
      return;
    }

    try {
      // Set up vertex buffers (same as main pass)
      passEncoder.setVertexBuffer(0, frameResources.vertexBuffer);
      passEncoder.setVertexBuffer(1, frameResources.instanceOffsetBuffer);
      passEncoder.setVertexBuffer(2, frameResources.instanceColorScaleBuffer);
      passEncoder.setVertexBuffer(3, frameResources.instanceSecondaryColorBuffer);
      passEncoder.setVertexBuffer(4, frameResources.instanceEmissiveColorBuffer);
      passEncoder.setVertexBuffer(5, frameResources.instanceMaterialParamsBuffer);
      passEncoder.setVertexBuffer(6, frameResources.instanceRotationBuffer);
      passEncoder.setVertexBuffer(7, frameResources.instanceMaterialIdBuffer);
      passEncoder.setIndexBuffer(frameResources.indexBuffer, 'uint16');

      // Set bind groups (same uniforms and textures as main pass)
      passEncoder.setBindGroup(0, frameResources.uniformBindGroup);
      passEncoder.setBindGroup(1, frameResources.textureBindGroup);

      // Set pipeline
      passEncoder.setPipeline(this.pipeline);

      // Draw opaque geometry only (transparent objects don't contribute to normals for SSAO)
      const totalInstances = geometry.instanceCount;
      const opaqueCount = Math.min(Math.max(geometry.opaqueCount ?? totalInstances, 0), totalInstances);

      if (opaqueCount > 0) {
        passEncoder.drawIndexed(geometry.indices.length, opaqueCount, 0, 0, 0);
      }
    } catch (err) {
      Logger.warn('Normal render pass failed:', err);
    }
  }

  /**
   * Checks if the pass is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.pipeline !== null;
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    this.pipeline = null;
    this.initialized = false;
  }
}


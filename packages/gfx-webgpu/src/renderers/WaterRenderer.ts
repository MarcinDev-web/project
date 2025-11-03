import type { Mat4, Vec2, Vec3, Vec4 } from '@engine/core/math';
import type { Entity, Scene } from '@engine/world';
import { WaterComponent, Transform } from '@engine/world';
import { createWaterShaderCode } from '../shaders/water';
import type { IDisposable } from '@engine/core/utils';
import { mat4Identity, mat4Scale, mat4FromQuatTranslation, type Quat } from '@engine/core/math';

/**
 * Configuration for water renderer initialization
 */
export interface WaterRenderConfig {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  sampleCount?: number;
}

/**
 * Water plane geometry helper
 * Creates a quad mesh for water rendering
 */
function createWaterPlaneGeometry(
  width: number,
  height: number,
  segmentsX: number = 32,
  segmentsZ: number = 32
): {
  vertices: Float32Array;
  indices: Uint16Array;
} {
  const vertexCount = (segmentsX + 1) * (segmentsZ + 1);
  const vertices = new Float32Array(vertexCount * 8); // 3 pos + 3 normal + 2 uv

  const indexCount = segmentsX * segmentsZ * 6;
  const indices = new Uint16Array(indexCount);

  // Generate vertices
  let vIndex = 0;
  for (let z = 0; z <= segmentsZ; z++) {
    for (let x = 0; x <= segmentsX; x++) {
      const u = x / segmentsX;
      const v = z / segmentsZ;

      // Position (centered at origin, y=0)
      const px = (u - 0.5) * width;
      const py = 0.0;
      const pz = (v - 0.5) * height;

      // Normal (pointing up)
      const nx = 0.0;
      const ny = 1.0;
      const nz = 0.0;

      // UV coordinates
      const uvx = u;
      const uvy = v;

      vertices[vIndex++] = px;
      vertices[vIndex++] = py;
      vertices[vIndex++] = pz;
      vertices[vIndex++] = nx;
      vertices[vIndex++] = ny;
      vertices[vIndex++] = nz;
      vertices[vIndex++] = uvx;
      vertices[vIndex++] = uvy;
    }
  }

  // Generate indices
  let iIndex = 0;
  for (let z = 0; z < segmentsZ; z++) {
    for (let x = 0; x < segmentsX; x++) {
      const a = z * (segmentsX + 1) + x;
      const b = z * (segmentsX + 1) + x + 1;
      const c = (z + 1) * (segmentsX + 1) + x;
      const d = (z + 1) * (segmentsX + 1) + x + 1;

      // First triangle
      indices[iIndex++] = a;
      indices[iIndex++] = c;
      indices[iIndex++] = b;

      // Second triangle
      indices[iIndex++] = b;
      indices[iIndex++] = c;
      indices[iIndex++] = d;
    }
  }

  return { vertices, indices };
}

/**
 * WaterRenderer handles rendering of water surfaces with animated waves,
 * reflections, refractions, and foam effects.
 */
export class WaterRenderer implements IDisposable {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private uniformBindGroupLayout!: GPUBindGroupLayout;
  private textureBindGroupLayout!: GPUBindGroupLayout;
  private uniformBuffer!: GPUBuffer;
  private uniformBindGroup!: GPUBindGroup;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private indexCount: number = 0;
  private sampler!: GPUSampler;
  private initialized = false;

  // Water geometry (will be created per water component, or use shared quad)
  private waterGeometry: {
    vertices: Float32Array;
    indices: Uint16Array;
  } | null = null;

  constructor() {
    this.device = null!; // Will be set in initialize
  }

  /**
   * Initializes the water renderer with WebGPU resources
   */
  async initialize(config: WaterRenderConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.device = config.device;
    const sampleCount = config.sampleCount ?? 4;

    // Create default water plane geometry (1x1 unit, can be scaled)
    this.waterGeometry = createWaterPlaneGeometry(1, 1, 32, 32);

    // Create vertex and index buffers
    this.vertexBuffer = this.device.createBuffer({
      label: 'water-vertex-buffer',
      size: this.waterGeometry.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(
      this.vertexBuffer,
      0,
      this.waterGeometry.vertices.buffer,
      this.waterGeometry.vertices.byteOffset,
      this.waterGeometry.vertices.byteLength
    );

    this.indexBuffer = this.device.createBuffer({
      label: 'water-index-buffer',
      size: this.waterGeometry.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(
      this.indexBuffer,
      0,
      this.waterGeometry.indices.buffer,
      this.waterGeometry.indices.byteOffset,
      this.waterGeometry.indices.byteLength
    );
    this.indexCount = this.waterGeometry.indices.length;

    // Create sampler
    this.sampler = this.device.createSampler({
      label: 'water-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

    // Create bind group layouts
    this.uniformBindGroupLayout = this.device.createBindGroupLayout({
      label: 'water-uniform-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.textureBindGroupLayout = this.device.createBindGroupLayout({
      label: 'water-texture-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { viewDimension: 'cube' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { viewDimension: '2d' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { viewDimension: '2d' },
        },
      ],
    });

    // Create uniform buffer (WaterUniforms + LightingUniforms)
    // WaterUniforms: ~400 bytes, LightingUniforms: ~256 bytes
    this.uniformBuffer = this.device.createBuffer({
      label: 'water-uniform-buffer',
      size: 656, // Approximate size for both uniform blocks
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create uniform bind group
    this.uniformBindGroup = this.device.createBindGroup({
      label: 'water-uniform-bind-group',
      layout: this.uniformBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.uniformBuffer, offset: 400 }, // Offset for lighting uniforms
        },
      ],
    });

    // Create shader module
    const shaderCode = createWaterShaderCode();
    const shaderModule = this.device.createShaderModule({
      label: 'water-shader',
      code: shaderCode,
    });

    // Create render pipeline
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'water-pipeline-layout',
      bindGroupLayouts: [this.uniformBindGroupLayout, this.textureBindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'water-pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [
          {
            arrayStride: 32, // 3 pos + 3 normal + 2 uv = 8 floats = 32 bytes
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3', // position
              },
              {
                shaderLocation: 1,
                offset: 12,
                format: 'float32x3', // normal
              },
              {
                shaderLocation: 2,
                offset: 24,
                format: 'float32x2', // uv
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [
          {
            format: config.presentationFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none', // Water can be viewed from both sides
      },
      depthStencil: {
        depthWriteEnabled: false, // Water should not write depth (transparent)
        depthCompare: 'less',
        format: 'depth24plus',
      },
      multisample: {
        count: sampleCount,
      },
    });

    this.initialized = true;
  }

  /**
   * Renders water entities from the scene
   */
  render(
    passEncoder: GPURenderPassEncoder,
    scene: Scene | null,
    viewProjectionMatrix: Mat4,
    cameraPosition: Vec3,
    time: number,
    environmentCubemap: GPUTexture | null,
    depthTexture: GPUTexture | null,
    sceneColorTexture: GPUTexture | null
  ): void {
    if (!this.initialized || !this.pipeline || !this.vertexBuffer || !this.indexBuffer) {
      return;
    }

    if (!scene) {
      return;
    }

    // Find all entities with WaterComponent
    const waterEntities: Array<{ entity: Entity; component: WaterComponent }> = [];
    const entities = scene.queryEntities(WaterComponent);
    for (const entity of entities) {
      const waterComp = entity.getComponent(WaterComponent);
      if (waterComp && waterComp.enabled) {
        waterEntities.push({ entity, component: waterComp });
      }
    }

    if (waterEntities.length === 0) {
      return;
    }

    // Render each water entity
    for (const { entity, component } of waterEntities) {
      const transform = entity.transform;
      if (!transform) {
        continue;
      }

      // Build model matrix from transform
      const modelMatrix = new Float32Array(16) as Mat4;
      mat4Identity(modelMatrix);
      mat4FromQuatTranslation(
        modelMatrix,
        transform.rotation,
        transform.position
      );
      mat4Scale(modelMatrix, [component.size[0], 1.0, component.size[1]]);

      // Build normal matrix (transpose of inverse of 3x3 upper-left of model matrix)
      // Simplified: for uniform scale, we can use model matrix directly
      const normalMatrix = new Float32Array(16) as Mat4;
      mat4Identity(normalMatrix);
      // Copy upper-left 3x3 for normal transformation
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          normalMatrix[i * 4 + j] = modelMatrix[i * 4 + j]!;
        }
      }

      // Prepare uniform data
      const uniformData = new Float32Array(164); // 41 vec4s
      let offset = 0;

      // View projection matrix (16 floats)
      uniformData.set(viewProjectionMatrix, offset);
      offset += 16;

      // Model matrix (16 floats)
      uniformData.set(modelMatrix, offset);
      offset += 16;

      // Normal matrix (16 floats)
      uniformData.set(normalMatrix, offset);
      offset += 16;

      // Camera position (3 floats + pad)
      uniformData[offset++] = cameraPosition[0];
      uniformData[offset++] = cameraPosition[1];
      uniformData[offset++] = cameraPosition[2];
      offset++; // pad

      // Time
      uniformData[offset++] = time;
      offset += 3; // pad

      // Wave direction (2 floats + pad)
      uniformData[offset++] = component.waveDirection[0];
      uniformData[offset++] = component.waveDirection[1];
      offset += 2; // pad

      // Wave parameters
      uniformData[offset++] = component.waveHeight;
      uniformData[offset++] = component.waveFrequency;
      uniformData[offset++] = component.waveSpeed;
      offset++; // pad

      // Water color (4 floats)
      uniformData.set(component.waterColor, offset);
      offset += 4;

      // Foam color (4 floats)
      uniformData.set(component.foamColor, offset);
      offset += 4;

      // Foam threshold, transparency, refraction, reflection
      uniformData[offset++] = component.foamThreshold;
      uniformData[offset++] = component.transparency;
      uniformData[offset++] = component.refractionStrength;
      uniformData[offset++] = component.reflectionStrength;

      // Water size (2 floats + pad)
      uniformData[offset++] = component.size[0];
      uniformData[offset++] = component.size[1];
      offset += 2; // pad

      // Caustics enabled (as u32, but stored as f32)
      uniformData[offset++] = component.causticsEnabled ? 1.0 : 0.0;
      offset += 3; // pad

      // Update uniform buffer
      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData.buffer);

      // Create texture bind group for this water entity
      const textureBindGroup = this.device.createBindGroup({
        label: 'water-texture-bind-group',
        layout: this.textureBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: this.sampler,
          },
          {
            binding: 1,
            resource: environmentCubemap
              ? environmentCubemap.createView({ dimension: 'cube' })
              : this.createDummyCubemap(),
          },
          {
            binding: 2,
            resource: depthTexture
              ? depthTexture.createView()
              : this.createDummyTexture(),
          },
          {
            binding: 3,
            resource: sceneColorTexture
              ? sceneColorTexture.createView()
              : this.createDummyTexture(),
          },
        ],
      });

      // Set pipeline and bind groups
      passEncoder.setPipeline(this.pipeline);
      passEncoder.setBindGroup(0, this.uniformBindGroup);
      passEncoder.setBindGroup(1, textureBindGroup);
      passEncoder.setVertexBuffer(0, this.vertexBuffer);
      passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
      passEncoder.drawIndexed(this.indexCount);
    }
  }

  /**
   * Creates a dummy 1x1 cubemap for fallback when environment cubemap is not available
   */
  private createDummyCubemap(): GPUTextureView {
    const dummyTex = this.device.createTexture({
      label: 'water-dummy-cubemap',
      size: { width: 1, height: 1, depthOrArrayLayers: 6 },
      dimension: '2d',
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING,
    });
    return dummyTex.createView({ dimension: 'cube' });
  }

  /**
   * Creates a dummy 1x1 texture for fallback
   */
  private createDummyTexture(): GPUTextureView {
    const dummyTex = this.device.createTexture({
      label: 'water-dummy-texture',
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING,
    });
    return dummyTex.createView();
  }

  dispose(): void {
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.initialized = false;
  }
}


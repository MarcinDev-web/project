import type { GeometryData, INSTANCE_STRIDE } from '../resources/resources';
import { MaterialComponent } from '@engine/world';
import type { Mat4, Vec3 } from '@engine/core/math';
import { ShadowCascadeCalculator } from './ShadowCascades';
import { TIMESTAMP_INDICES } from '../config';
import { Z_NEAR, Z_FAR } from '../config';
import {
  INSTANCE_STRIDE as STRIDE,
  INSTANCE_OFFSET_OFFSET,
  INSTANCE_COLOR_SCALE_OFFSET,
  INSTANCE_MATERIAL_PARAMS_OFFSET,
  INSTANCE_ROTATION_OFFSET,
  INSTANCE_MATERIAL_ID_OFFSET,
} from '../core/InstanceManager';

export class ShadowPass {
  private device: GPUDevice;
  private atlas: GPUTexture | null = null;
  private atlasView: GPUTextureView | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniformLayout: GPUBindGroupLayout | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private uniformBindGroup: GPUBindGroup | null = null;
  private comparisonSampler: GPUSampler | null = null;

  private readonly atlasSize = 2048;

  private shadowCalculator = new ShadowCascadeCalculator();

  // Shadow quality & blending
  private cascadeOverlap = 0.07; // fraction of cascade range used for blending
  private filterParamsRef: [number, number, number, number] = [2.0, 2.0 / 2048, 8.0 / 2048, 0.0];
  private biasParamsRef: [number, number, number, number] = [0.0008, 0.01, 0.0, 0.0];

  // Metrics per cascade
  private lastCascadeCounts: [number, number, number, number] = [0, 0, 0, 0];

  // Scratch buffers for per-cascade CPU culling (reused each frame)
  private culledCapacity = 0;
  private culledOffsetBuffer: GPUBuffer | null = null;
  private culledColorScaleBuffer: GPUBuffer | null = null;
  private culledRotationBuffer: GPUBuffer | null = null;
  private culledMaterialIdBuffer: GPUBuffer | null = null;
  private culledOffsetF32: Float32Array | null = null;
  private culledColorScaleF32: Float32Array | null = null;
  private culledRotationF32: Float32Array | null = null;
  private culledMaterialIdF32: Float32Array | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  public setQualityPreset(preset: 'low' | 'med' | 'high' | 'ultra'): void {
    // Adjust PCSS radius and bias; atlas size kept constant in this iteration
    switch (preset) {
      case 'low':
        this.filterParamsRef = [1.0, 1.0 / this.atlasSize, 4.0 / this.atlasSize, 0.0];
        this.biasParamsRef = [0.0012, 0.008, 0.0, 0.0];
        this.cascadeOverlap = 0.05;
        break;
      case 'med':
        this.filterParamsRef = [2.0, 2.0 / this.atlasSize, 8.0 / this.atlasSize, 0.0];
        this.biasParamsRef = [0.0008, 0.01, 0.0, 0.0];
        this.cascadeOverlap = 0.07;
        break;
      case 'high':
        this.filterParamsRef = [3.0, 2.5 / this.atlasSize, 10.0 / this.atlasSize, 0.0];
        this.biasParamsRef = [0.0006, 0.012, 0.0, 0.0];
        this.cascadeOverlap = 0.08;
        break;
      case 'ultra':
        this.filterParamsRef = [4.0, 3.0 / this.atlasSize, 12.0 / this.atlasSize, 0.0];
        this.biasParamsRef = [0.0005, 0.014, 0.0, 0.0];
        this.cascadeOverlap = 0.1;
        break;
    }
  }

  public getLastCascadeInstanceCounts(): readonly [number, number, number, number] {
    return this.lastCascadeCounts;
  }

  private ensureResources(): void {
    if (!this.atlas) {
      this.atlas = this.device.createTexture({
        label: 'shadow-atlas',
        size: [this.atlasSize, this.atlasSize, 1],
        format: 'depth32float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      this.atlasView = this.atlas.createView({ label: 'shadow-atlas-view' });
    }
    if (!this.uniformLayout) {
      this.uniformLayout = this.device.createBindGroupLayout({
        label: 'shadow-pass-uniform-layout',
        entries: [
          { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        ],
      });
    }
    if (!this.uniformBuffer) {
      this.uniformBuffer = this.device.createBuffer({
        label: 'shadow-pass-uniform',
        size: 64, // single mat4x4
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
    }
    if (!this.uniformBindGroup && this.uniformLayout && this.uniformBuffer) {
      this.uniformBindGroup = this.device.createBindGroup({
        label: 'shadow-pass-uniform-bg',
        layout: this.uniformLayout,
        entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
      });
    }
    if (!this.comparisonSampler) {
      this.comparisonSampler = this.device.createSampler({
        label: 'shadow-comparison-sampler-main',
        compare: 'less-equal',
        magFilter: 'linear',
        minFilter: 'linear',
      });
    }
    if (!this.pipeline) {
      const shader = this.device.createShaderModule({
        label: 'shadow-pass-shader',
        code: /* wgsl */ `
struct VSOut { @builtin(position) position: vec4<f32> }
struct ShadowUniform { lightVP: mat4x4<f32> }
@group(0) @binding(0) var<uniform> sh: ShadowUniform;

fn quat_rotate(q : vec4<f32>, v : vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

@vertex
fn vs_main(
  @location(0) position : vec3<f32>,
  @location(4) instanceOffset : vec3<f32>,
  @location(5) instanceColorScale : vec4<f32>,
  @location(9) instanceRotation : vec4<f32>,
  @location(10) instanceMaterialId : f32
) -> VSOut {
  var o: VSOut;
  let scale = instanceColorScale.w;
  let q = normalize(instanceRotation);
  let worldPos = quat_rotate(q, position * scale) + instanceOffset;
  o.position = sh.lightVP * vec4<f32>(worldPos, 1.0);
  return o;
}
`,
      });

      const pipelineLayout = this.device.createPipelineLayout({
        label: 'shadow-pass-pl',
        bindGroupLayouts: [this.uniformLayout!],
      });

      // Vertex buffer layouts must match main geometry buffers
      const vertexBuffers: GPUVertexBufferLayout[] = [
        { arrayStride: 24, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
        { arrayStride: 12, stepMode: 'instance', attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x3' }] },
        { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x4' }] },
        { arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 9, offset: 0, format: 'float32x4' }] },
        { arrayStride: 4, stepMode: 'instance', attributes: [{ shaderLocation: 10, offset: 0, format: 'float32' }] },
      ];

      this.pipeline = this.device.createRenderPipeline({
        label: 'shadow-pass-pipeline',
        layout: pipelineLayout,
        vertex: { module: shader, entryPoint: 'vs_main', buffers: vertexBuffers },
        primitive: { topology: 'triangle-list', cullMode: 'back' },
        depthStencil: {
          format: 'depth32float',
          depthWriteEnabled: true,
          depthCompare: 'less',
          depthBias: 1,
          depthBiasSlopeScale: 2.5,
          depthBiasClamp: 0.05,
        },
      });
    }
  }

  private ensureCulledBuffers(capacity: number): void {
    if (capacity <= this.culledCapacity) return;
    this.culledCapacity = capacity;
    const offsetsBytes = capacity * 3 * 4;
    const colorScaleBytes = capacity * 4 * 4;
    const rotationBytes = capacity * 4 * 4;
    const materialIdBytes = capacity * 4;

    this.culledOffsetF32 = new Float32Array(capacity * 3);
    this.culledColorScaleF32 = new Float32Array(capacity * 4);
    this.culledRotationF32 = new Float32Array(capacity * 4);
    this.culledMaterialIdF32 = new Float32Array(capacity);

    this.culledOffsetBuffer?.destroy?.();
    this.culledColorScaleBuffer?.destroy?.();
    this.culledRotationBuffer?.destroy?.();
    this.culledMaterialIdBuffer?.destroy?.();

    this.culledOffsetBuffer = this.device.createBuffer({
      label: 'shadow-culled-instance-offsets',
      size: offsetsBytes,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.culledColorScaleBuffer = this.device.createBuffer({
      label: 'shadow-culled-instance-colorScale',
      size: colorScaleBytes,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.culledRotationBuffer = this.device.createBuffer({
      label: 'shadow-culled-instance-rotation',
      size: rotationBytes,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.culledMaterialIdBuffer = this.device.createBuffer({
      label: 'shadow-culled-instance-materialId',
      size: materialIdBytes,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  private rowNorm(m: Float32Array, row: 0 | 1 | 2): number {
    // Column-major mat: row components are m[row], m[4+row], m[8+row]
    const a = m[row + 0]!;
    const b = m[row + 4]!;
    const c = m[row + 8]!;
    return Math.hypot(a, b, c);
  }

  private cullInstancesForCascade(
    lightVP: Float32Array,
    geometry: GeometryData
  ): number {
    // Read from interleaved buffer using stride offsets
    const interleaved = geometry.instanceInterleavedData;

    const outOffsets = this.culledOffsetF32!;
    const outColorScale = this.culledColorScaleF32!;
    const outRotation = this.culledRotationF32!;
    const outMatIds = this.culledMaterialIdF32!;

    const n = geometry.instanceCount;
    let outCount = 0;
    // Base mesh bounding sphere radius for unit scale cube: sqrt(3)/2
    const baseRadius = 0.8660254037844386;
    // Row norms to convert world radius -> clip radius per axis
    const nx = this.rowNorm(lightVP as Float32Array, 0);
    const ny = this.rowNorm(lightVP as Float32Array, 1);
    const nz = this.rowNorm(lightVP as Float32Array, 2);

    for (let i = 0; i < n; i++) {
      const base = i * STRIDE;
      const flags = interleaved[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 3] ?? 0;
      if (((flags | 0) & MaterialComponent.FLAG_TRANSPARENT) != 0) {
        continue;
      }
      const ox = interleaved[base + INSTANCE_OFFSET_OFFSET + 0]!;
      const oy = interleaved[base + INSTANCE_OFFSET_OFFSET + 1]!;
      const oz = interleaved[base + INSTANCE_OFFSET_OFFSET + 2]!;
      const scale = interleaved[base + INSTANCE_COLOR_SCALE_OFFSET + 3] ?? 1.0;
      const radius = baseRadius * scale;

      // Clip-space position p = M * [o,1]
      const m = lightVP as Float32Array;
      const px = ox * m[0]! + oy * m[4]! + oz * m[8]! + m[12]!;
      const py = ox * m[1]! + oy * m[5]! + oz * m[9]! + m[13]!;
      const pz = ox * m[2]! + oy * m[6]! + oz * m[10]! + m[14]!;
      const pw = ox * m[3]! + oy * m[7]! + oz * m[11]! + m[15]!;
      const invW = pw !== 0 ? 1.0 / pw : 1.0;
      const cx = px * invW;
      const cy = py * invW;
      const cz = pz * invW;

      const rX = radius * nx;
      const rY = radius * ny;
      const rZ = radius * nz;

      if (cx < -1 - rX || cx > 1 + rX) continue;
      if (cy < -1 - rY || cy > 1 + rY) continue;
      if (cz < -1 - rZ || cz > 1 + rZ) continue;

      // keep instance: write attributes at outCount
      const o3 = outCount * 3;
      outOffsets[o3 + 0] = ox;
      outOffsets[o3 + 1] = oy;
      outOffsets[o3 + 2] = oz;

      const c4 = outCount * 4;
      outColorScale[c4 + 0] = interleaved[base + INSTANCE_COLOR_SCALE_OFFSET + 0]!;
      outColorScale[c4 + 1] = interleaved[base + INSTANCE_COLOR_SCALE_OFFSET + 1]!;
      outColorScale[c4 + 2] = interleaved[base + INSTANCE_COLOR_SCALE_OFFSET + 2]!;
      outColorScale[c4 + 3] = scale;

      outRotation[c4 + 0] = interleaved[base + INSTANCE_ROTATION_OFFSET + 0]!;
      outRotation[c4 + 1] = interleaved[base + INSTANCE_ROTATION_OFFSET + 1]!;
      outRotation[c4 + 2] = interleaved[base + INSTANCE_ROTATION_OFFSET + 2]!;
      outRotation[c4 + 3] = interleaved[base + INSTANCE_ROTATION_OFFSET + 3]!;

      outMatIds[outCount] = interleaved[base + INSTANCE_MATERIAL_ID_OFFSET] ?? 0;

      outCount++;
    }

    return outCount;
  }

  render(params: {
    encoder: GPUCommandEncoder;
    frameResources: {
      vertexBuffer: GPUBuffer;
      indexBuffer: GPUBuffer;
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
    uniformManager: { updateShadowUniforms: Function };
    lightingData?: { directionalLightDir?: Vec3; lights: Array<{ type: number; direction: Vec3 }>; };
    ibl?: { brdfLut?: GPUTexture | null; envCube?: GPUTexture | null };
  }): void {
    this.ensureResources();
    if (!this.pipeline || !this.atlas || !this.atlasView || !this.uniformBuffer || !this.uniformBindGroup) return;

    // Derive primary directional light direction
    let lightDir: Vec3 = [0.3, -0.7, -0.5] as unknown as Vec3;
    const dir = params.lightingData?.lights.find((l) => l.type === 0);
    if (dir && Array.isArray((dir as any).direction)) {
      const d = (dir as any).direction as Vec3;
      const len = Math.hypot(d[0], d[1], d[2]) || 1;
      lightDir = [d[0] / len, d[1] / len, d[2] / len] as unknown as Vec3;
    }

    // Compute cascades
    const cascades = this.shadowCalculator.compute({
      viewMatrix: params.viewMatrix,
      projectionMatrix: params.projectionMatrix,
      lightDirection: lightDir as unknown as Vec3,
      cameraNear: Z_NEAR,
      cameraFar: Z_FAR,
      atlasSize: this.atlasSize,
      cascades: 4,
    });

    // Write shadow uniforms into the main uniform buffer
    params.uniformManager.updateShadowUniforms({
      viewMatrix: params.viewMatrix,
      lightViewProj: cascades.lightViewProj,
      cascadeSplits: cascades.cascadeSplits,
      atlasRects: cascades.atlasRects,
      // pcfKernelRadius, pcssLightRadiusUV, maxFilterRadiusUV, pad
      filterParams: this.filterParamsRef,
      // x: depth bias in [0..1] depth range, y: normal bias in world units
      biasParams: this.biasParamsRef,
      extraParams: [this.cascadeOverlap, 0, 0, 0],
    });

    // Ensure scratch buffers for per-cascade culling
    this.ensureCulledBuffers(params.geometry.instanceCount | 0);

    // Render all cascades in one pass into different viewports of the atlas
    const qs = ((params.frameResources as unknown) as { timestampQuerySet?: GPUQuerySet | null }).timestampQuerySet ?? null;
    const passDesc: GPURenderPassDescriptor = {
      label: 'shadow-atlas-pass',
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.atlasView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
      ...(qs
        ? {
            timestampWrites: {
              querySet: qs,
              beginningOfPassWriteIndex: TIMESTAMP_INDICES.SHADOW_BEGIN,
              endOfPassWriteIndex: TIMESTAMP_INDICES.SHADOW_END,
            },
          }
        : {}),
    } as GPURenderPassDescriptor;
    const pass = params.encoder.beginRenderPass(passDesc);

    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, params.frameResources.vertexBuffer);
    // Vertex buffer 0 is static mesh; 1..4 will be set per cascade from culled buffers
    pass.setIndexBuffer(params.frameResources.indexBuffer, 'uint16');
    pass.setBindGroup(0, this.uniformBindGroup);

    const half = this.atlasSize >> 1;
    const viewports: Array<[number, number]> = [
      [0, 0], [half, 0], [0, half], [half, half],
    ];
    if (params.geometry.instanceCount > 0) {
      for (let c = 0; c < 4; c++) {
        // Upload current cascade lightVP
        const m = cascades.lightViewProj[c]!;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, (m as Float32Array).buffer as ArrayBuffer, (m as Float32Array).byteOffset ?? 0, 64);

        // CPU cull instances to this cascade's ortho frustum
        const visibleCount = this.cullInstancesForCascade(m as Float32Array, params.geometry);
        // Track metrics
        if (c === 0 || c === 1 || c === 2 || c === 3) {
          (this.lastCascadeCounts as any)[c] = visibleCount;
        }

        if (visibleCount > 0) {
          // Upload culled per-instance data
          const offBytes = visibleCount * 3 * 4;
          const colBytes = visibleCount * 4 * 4;
          const rotBytes = visibleCount * 4 * 4;
          const matBytes = visibleCount * 4;
          this.device.queue.writeBuffer(this.culledOffsetBuffer!, 0, this.culledOffsetF32!.buffer as ArrayBuffer, 0, offBytes);
          this.device.queue.writeBuffer(this.culledColorScaleBuffer!, 0, this.culledColorScaleF32!.buffer as ArrayBuffer, 0, colBytes);
          this.device.queue.writeBuffer(this.culledRotationBuffer!, 0, this.culledRotationF32!.buffer as ArrayBuffer, 0, rotBytes);
          this.device.queue.writeBuffer(this.culledMaterialIdBuffer!, 0, this.culledMaterialIdF32!.buffer as ArrayBuffer, 0, matBytes);

          // Bind culled buffers for this cascade
          pass.setVertexBuffer(1, this.culledOffsetBuffer!);
          pass.setVertexBuffer(2, this.culledColorScaleBuffer!);
          pass.setVertexBuffer(3, this.culledRotationBuffer!);
          pass.setVertexBuffer(4, this.culledMaterialIdBuffer!);

          const [vx, vy] = viewports[c]!;
          pass.setViewport(vx, vy, half, half, 0, 1);
          pass.setScissorRect(vx, vy, half, half);
          pass.drawIndexed(params.geometry.indices.length, visibleCount, 0, 0, 0);
        }
      }
    }

    pass.end();

    // Recreate material bind group to swap in the real shadow atlas + comparison sampler
    try {
      const newBg = this.device.createBindGroup({
        label: 'material-atlas-bg+shadow',
        layout: params.frameResources.textureBindGroupLayout,
        entries: [
          { binding: 0, resource: params.frameResources.sampler },
          { binding: 1, resource: params.frameResources.sideTexture.createView({ label: 'atlas-texture-view' }) },
          { binding: 2, resource: params.frameResources.normalAtlasTexture.createView({ label: 'atlas-normal-texture-view' }) },
          ...(params.frameResources.atlasMetaBuffer ? [{ binding: 3, resource: { buffer: params.frameResources.atlasMetaBuffer } }] as const : []),
          { binding: 4, resource: this.atlas.createView({ label: 'shadow-atlas-depth-view' }) },
          { binding: 5, resource: this.comparisonSampler! },
          { binding: 6, resource: (params.ibl?.brdfLut ?? this.device.createTexture({ label:'brdf-lut-fallback', size:[4,4,1], format:'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING })).createView() },
          { binding: 7, resource: (params.ibl?.envCube ?? this.device.createTexture({ label:'env-cube-fallback', size:[1,1,6], format:'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING })).createView({ dimension: 'cube' }) },
        ],
      });
      (params.frameResources as any).textureBindGroup = newBg;
    } catch {
      // If layout mismatch occurs in a test environment, keep placeholder bind group
    }
  }

  dispose(): void {
    try {
      this.atlas?.destroy();
    } catch {
      // ignore
    }
    this.atlas = null;
    this.atlasView = null;
    try {
      this.uniformBuffer?.destroy();
    } catch {
      // ignore
    }
    this.uniformBuffer = null;
    this.uniformBindGroup = null;
    this.uniformLayout = null;
    this.comparisonSampler = null;
    try {
      this.culledOffsetBuffer?.destroy();
    } catch {
      // ignore
    }
    this.culledOffsetBuffer = null;
    try {
      this.culledColorScaleBuffer?.destroy();
    } catch {
      // ignore
    }
    this.culledColorScaleBuffer = null;
    try {
      this.culledRotationBuffer?.destroy();
    } catch {
      // ignore
    }
    this.culledRotationBuffer = null;
    try {
      this.culledMaterialIdBuffer?.destroy();
    } catch {
      // ignore
    }
    this.culledMaterialIdBuffer = null;
    this.culledOffsetF32 = null;
    this.culledColorScaleF32 = null;
    this.culledRotationF32 = null;
    this.culledMaterialIdF32 = null;
    this.pipeline = null;
  }
}



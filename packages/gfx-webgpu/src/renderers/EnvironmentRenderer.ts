import type { Mat4, Vec3 } from '@engine/core/math';
import type { EnvironmentComponent } from '@engine/world';
import { BrdfLutPass } from '../postprocess/BrdfLut';

/**
 * Skybox vertex shader - renders a full-screen quad at far plane
 */
const SKYBOX_VERTEX_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) viewDirection: vec3f,
}

struct Uniforms {
  inverseViewProjection: mat4x4f,
  cameraPosition: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  
  // Full-screen triangle (covers NDC space)
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  
  let pos = positions[vertexIndex];
  output.position = vec4f(pos, 1.0, 1.0); // At far plane
  
  // Transform NDC position to view direction
  let worldPos = uniforms.inverseViewProjection * vec4f(pos, 1.0, 1.0);
  output.viewDirection = normalize(worldPos.xyz / worldPos.w - uniforms.cameraPosition);
  
  return output;
}
`;

/**
 * Solid color skybox fragment shader
 */
const SKYBOX_SOLID_FRAGMENT_SHADER = /* wgsl */ `
struct FragmentInput {
  @location(0) viewDirection: vec3f,
}

struct SkyboxParams {
  skyColor: vec3f,
  _pad0: f32,
}

@group(1) @binding(0) var<uniform> params: SkyboxParams;

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  return vec4f(params.skyColor, 1.0);
}
`;

/**
 * Gradient skybox fragment shader
 */
const SKYBOX_GRADIENT_FRAGMENT_SHADER = /* wgsl */ `
struct FragmentInput {
  @location(0) viewDirection: vec3f,
}

struct SkyboxParams {
  skyColor: vec3f,
  _pad0: f32,
  horizonColor: vec3f,
  _pad1: f32,
  groundColor: vec3f,
  _pad2: f32,
}

@group(1) @binding(0) var<uniform> params: SkyboxParams;

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  let dir = normalize(input.viewDirection);
  let elevation = dir.y;
  
  var color: vec3f;
  
  if (elevation > 0.0) {
    // Above horizon: blend from horizon to sky
    let t = pow(elevation, 0.5);
    color = mix(params.horizonColor, params.skyColor, t);
  } else {
    // Below horizon: blend from horizon to ground
    let t = pow(-elevation, 0.5);
    color = mix(params.horizonColor, params.groundColor, t);
  }
  
  return vec4f(color, 1.0);
}
`;

/**
 * Procedural sky fragment shader with atmospheric scattering approximation
 */
const SKYBOX_PROCEDURAL_FRAGMENT_SHADER = /* wgsl */ `
struct FragmentInput {
  @location(0) viewDirection: vec3f,
}

struct SkyboxParams {
  skyColor: vec3f,
  _pad0: f32,
  horizonColor: vec3f,
  _pad1: f32,
  sunDirection: vec3f,
  _pad2: f32,
  sunColor: vec3f,
  sunIntensity: f32,
}

@group(1) @binding(0) var<uniform> params: SkyboxParams;

// Simple atmospheric scattering approximation
fn atmosphericScattering(viewDir: vec3f, sunDir: vec3f) -> vec3f {
  let elevation = viewDir.y;
  let sunDot = max(dot(viewDir, sunDir), 0.0);
  
  // Sky gradient based on elevation
  let skyGradient = pow(max(elevation, 0.0), 0.4);
  let horizonFade = pow(1.0 - abs(elevation), 2.0);
  
  // Base sky color
  var skyColor = mix(params.horizonColor, params.skyColor, skyGradient);
  
  // Sun contribution
  let sunRadius = 0.02;
  let sunGlow = pow(sunDot, 512.0); // Sharp sun disc
  let sunHalo = pow(sunDot, 8.0) * 0.5; // Soft glow around sun
  
  let sunContribution = (sunGlow + sunHalo) * params.sunColor * params.sunIntensity;
  
  // Atmospheric glow near horizon when looking toward sun
  let atmosphericGlow = horizonFade * pow(max(dot(viewDir, sunDir), 0.0), 4.0) * params.sunColor * 0.3;
  
  return skyColor + sunContribution + atmosphericGlow;
}

@fragment
fn fragmentMain(input: FragmentInput) -> @location(0) vec4f {
  let viewDir = normalize(input.viewDirection);
  let sunDir = normalize(params.sunDirection);
  
  let color = atmosphericScattering(viewDir, sunDir);
  
  return vec4f(color, 1.0);
}
`;

/**
 * Configuration for environment rendering pipeline
 */
interface EnvironmentRenderConfig {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  sampleCount?: number;
}

/**
 * EnvironmentRenderer handles skybox and atmospheric rendering
 */
export class EnvironmentRenderer {
  private device: GPUDevice;
  private pipelines: Map<string, GPURenderPipeline> = new Map();
  private uniformBindGroupLayout!: GPUBindGroupLayout;
  private paramsBindGroupLayout!: GPUBindGroupLayout;
  private uniformBuffer!: GPUBuffer;
  private paramsBuffer!: GPUBuffer;
  private uniformBindGroup!: GPUBindGroup;
  private paramsBindGroups: Map<string, GPUBindGroup> = new Map();
  private initialized = false;
  // IBL resources
  private brdfLut: GPUTexture | null = null;
  private envCube: GPUTexture | null = null;

  constructor() {
    this.device = null!; // Will be set in initialize
  }

  /**
   * Initializes the environment renderer with WebGPU resources
   */
  async initialize(config: EnvironmentRenderConfig): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.device = config.device;
    const sampleCount = config.sampleCount ?? 4;

    // Create bind group layouts
    this.uniformBindGroupLayout = this.device.createBindGroupLayout({
      label: 'environment-uniform-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.paramsBindGroupLayout = this.device.createBindGroupLayout({
      label: 'environment-params-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    // Create uniform buffers
    // Uniform buffer: inverseViewProjection (64 bytes) + cameraPosition (16 bytes) = 80 bytes
    this.uniformBuffer = this.device.createBuffer({
      label: 'environment-uniform-buffer',
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Params buffer: varies by skybox type, max 112 bytes (7 vec4s for procedural sky)
    this.paramsBuffer = this.device.createBuffer({
      label: 'environment-params-buffer',
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind groups
    this.uniformBindGroup = this.device.createBindGroup({
      label: 'environment-uniform-bind-group',
      layout: this.uniformBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    // Create pipeline for each skybox type
    await this.createPipeline('solid', SKYBOX_SOLID_FRAGMENT_SHADER, config.presentationFormat, sampleCount);
    await this.createPipeline('gradient', SKYBOX_GRADIENT_FRAGMENT_SHADER, config.presentationFormat, sampleCount);
    await this.createPipeline('procedural-sky', SKYBOX_PROCEDURAL_FRAGMENT_SHADER, config.presentationFormat, sampleCount);

    this.initialized = true;
  }

  /**
   * Creates a render pipeline for a specific skybox type
   */
  private async createPipeline(
    type: string,
    fragmentShader: string,
    presentationFormat: GPUTextureFormat,
    sampleCount: number
  ): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: `environment-shader-${type}`,
      code: SKYBOX_VERTEX_SHADER + '\n' + fragmentShader,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: `environment-pipeline-layout-${type}`,
      bindGroupLayouts: [this.uniformBindGroupLayout, this.paramsBindGroupLayout],
    });

    const createPipeline = (desc: GPURenderPipelineDescriptor): GPURenderPipeline | Promise<GPURenderPipeline> => {
      const anyDevice = this.device as unknown as { createRenderPipelineAsync?: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, createRenderPipeline: (d: GPURenderPipelineDescriptor) => GPURenderPipeline };
      if (typeof anyDevice.createRenderPipelineAsync === 'function') {
        return anyDevice.createRenderPipelineAsync(desc);
      }
      return anyDevice.createRenderPipeline(desc);
    };

    const pipeline = await createPipeline({
      label: `environment-pipeline-${type}`,
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: presentationFormat }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false, // Skybox is at infinity
        depthCompare: 'less-equal',
      },
      multisample: {
        count: sampleCount,
      },
    });

    this.pipelines.set(type, pipeline);
  }

  /**
   * Updates uniform data for the current frame
   */
  updateUniforms(inverseViewProjection: Mat4, cameraPosition: Vec3): void {
    if (!this.initialized) return;

    const data = new Float32Array(20); // 80 bytes
    let offset = 0;

    // inverseViewProjection matrix (64 bytes)
    for (let i = 0; i < 16; i++) {
      data[offset++] = inverseViewProjection[i] ?? 0;
    }

    // cameraPosition (16 bytes: vec3 + padding)
    data[offset++] = cameraPosition[0];
    data[offset++] = cameraPosition[1];
    data[offset++] = cameraPosition[2];
    data[offset++] = 0; // padding

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data.buffer, data.byteOffset, data.byteLength);
  }

  /**
   * Updates skybox parameters from environment component
   */
  updateParams(environment: EnvironmentComponent): void {
    if (!this.initialized) return;

    const type = environment.skyboxType;
    const data = new Float32Array(28); // 112 bytes max
    let offset = 0;

    switch (type) {
      case 'solid':
        // skyColor (vec3 + padding)
        data[offset++] = environment.skyColor[0];
        data[offset++] = environment.skyColor[1];
        data[offset++] = environment.skyColor[2];
        data[offset++] = 0;
        break;

      case 'gradient':
        // skyColor (vec3 + padding)
        data[offset++] = environment.skyColor[0];
        data[offset++] = environment.skyColor[1];
        data[offset++] = environment.skyColor[2];
        data[offset++] = 0;
        // horizonColor (vec3 + padding)
        data[offset++] = environment.horizonColor[0];
        data[offset++] = environment.horizonColor[1];
        data[offset++] = environment.horizonColor[2];
        data[offset++] = 0;
        // groundColor (vec3 + padding)
        data[offset++] = environment.groundColor[0];
        data[offset++] = environment.groundColor[1];
        data[offset++] = environment.groundColor[2];
        data[offset++] = 0;
        break;

      case 'procedural-sky':
        // skyColor (vec3 + padding)
        data[offset++] = environment.skyColor[0];
        data[offset++] = environment.skyColor[1];
        data[offset++] = environment.skyColor[2];
        data[offset++] = 0;
        // horizonColor (vec3 + padding)
        data[offset++] = environment.horizonColor[0];
        data[offset++] = environment.horizonColor[1];
        data[offset++] = environment.horizonColor[2];
        data[offset++] = 0;
        // sunDirection (vec3 + padding)
        data[offset++] = environment.sunDirection[0];
        data[offset++] = environment.sunDirection[1];
        data[offset++] = environment.sunDirection[2];
        data[offset++] = 0;
        // sunColor + sunIntensity (vec3 + f32)
        data[offset++] = environment.sunColor[0];
        data[offset++] = environment.sunColor[1];
        data[offset++] = environment.sunColor[2];
        data[offset++] = environment.sunIntensity;
        break;
    }

    this.device.queue.writeBuffer(this.paramsBuffer, 0, data.buffer, data.byteOffset, data.byteLength);

    // Create/update params bind group for this type if needed
    if (!this.paramsBindGroups.has(type)) {
      const bindGroup = this.device.createBindGroup({
        label: `environment-params-bind-group-${type}`,
        layout: this.paramsBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.paramsBuffer },
          },
        ],
      });
      this.paramsBindGroups.set(type, bindGroup);
    }
  }

  /**
   * Renders the skybox/environment
   */
  render(passEncoder: GPURenderPassEncoder, environment: EnvironmentComponent): void {
    if (!this.initialized || !environment.enabled) return;

    const type = environment.skyboxType;
    const pipeline = this.pipelines.get(type);
    const paramsBindGroup = this.paramsBindGroups.get(type);

    if (!pipeline || !paramsBindGroup) {
      console.warn(`No pipeline or bind group for skybox type: ${type}`);
      return;
    }

    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, this.uniformBindGroup);
    passEncoder.setBindGroup(1, paramsBindGroup);
    passEncoder.draw(3, 1, 0, 0); // Full-screen triangle
  }

  /**
   * Cleans up GPU resources
   */
  cleanup(): void {
    if (!this.initialized) return;

    this.uniformBuffer?.destroy();
    this.paramsBuffer?.destroy();
    this.pipelines.clear();
    this.paramsBindGroups.clear();
    this.initialized = false;
  }

  getBrdfLutTexture(): GPUTexture | null { return this.brdfLut; }
  getEnvCubeTexture(): GPUTexture | null { return this.envCube; }

  /**
   * Generates IBL resources: BRDF LUT (2D) and environment cubemap from procedural sky.
   * Returns generated textures for binding.
   */
  async prepareIBLResources(resolution = 128): Promise<{ brdfLut: GPUTexture; envCube: GPUTexture }> {
    if (!this.initialized) throw new Error('EnvironmentRenderer not initialized');
    // BRDF LUT via compute
    const encoder = this.device.createCommandEncoder({ label: 'ibl-precompute-encoder' });
    const brdfGen = new BrdfLutPass(this.device);
    this.brdfLut = brdfGen.generate(encoder, 256);

    // Env cubemap render (procedural sky only)
    this.envCube = this.device.createTexture({
      label: 'ibl-env-cubemap',
      size: { width: resolution, height: resolution, depthOrArrayLayers: 6 },
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Create one pipeline that uses faceIndex uniform to compute direction
    const shader = this.device.createShaderModule({
      label: 'ibl-env-capture-shader',
      code: /* wgsl */ `
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) vid:u32)->VSOut{
  var o:VSOut; let x=f32((vid<<1u)&2u); let y=f32(vid&2u); o.pos=vec4f(x*2.0-1.0, y*-2.0+1.0, 0.0, 1.0); o.uv=vec2f(x,y); return o;
}
struct SkyboxParams { skyColor: vec3f, _p0:f32, horizonColor: vec3f, _p1:f32, sunDirection: vec3f, _p2:f32, sunColor: vec3f, sunIntensity: f32 };
@group(0) @binding(0) var<uniform> params: SkyboxParams;
struct FaceInfo { faceIndex: u32, _pad: vec3<u32> };
@group(1) @binding(0) var<uniform> face: FaceInfo;

fn faceUVToDir(faceIndex:u32, uv: vec2<f32>) -> vec3<f32> {
  let a = uv*2.0 - vec2<f32>(1.0,1.0);
  switch(i32(faceIndex)){
    case 0: { return normalize(vec3<f32>( 1.0, -a.y, -a.x)); } // +X
    case 1: { return normalize(vec3<f32>(-1.0, -a.y,  a.x)); } // -X
    case 2: { return normalize(vec3<f32>( a.x,  1.0,  a.y)); } // +Y
    case 3: { return normalize(vec3<f32>( a.x, -1.0, -a.y)); } // -Y
    case 4: { return normalize(vec3<f32>( a.x, -a.y,  1.0)); } // +Z
    default: { return normalize(vec3<f32>(-a.x, -a.y, -1.0)); } // -Z
  }
}

fn atmosphericScattering(viewDir: vec3f, sunDir: vec3f) -> vec3f {
  let elevation = viewDir.y;
  let sunDot = max(dot(viewDir, sunDir), 0.0);
  let skyGradient = pow(max(elevation, 0.0), 0.4);
  let horizonFade = pow(1.0 - abs(elevation), 2.0);
  var skyColor = mix(params.horizonColor, params.skyColor, skyGradient);
  let sunRadius = 0.02;
  let sunGlow = pow(sunDot, 512.0);
  let sunHalo = pow(sunDot, 8.0) * 0.5;
  let sunContribution = (sunGlow + sunHalo) * params.sunColor * params.sunIntensity;
  let atmosphericGlow = horizonFade * pow(max(dot(viewDir, sunDir), 0.0), 4.0) * params.sunColor * 0.3;
  return skyColor + sunContribution + atmosphericGlow;
}

@fragment fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let dir = faceUVToDir(face.faceIndex, uv);
  let color = atmosphericScattering(normalize(dir), normalize(params.sunDirection));
  return vec4<f32>(color, 1.0);
}
`,
    });
    const pipeline = await (this.device as any).createRenderPipelineAsync?.({
      label: 'ibl-env-capture-pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.paramsBindGroupLayout, this.device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] })] }),
      vertex: { module: shader, entryPoint: 'vs' },
      fragment: { module: shader, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    }) ?? this.device.createRenderPipeline({
      label: 'ibl-env-capture-pipeline',
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.paramsBindGroupLayout, this.device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] })] }),
      vertex: { module: shader, entryPoint: 'vs' },
      fragment: { module: shader, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    // Face uniform buffer (32 bytes to satisfy uniform binding padding requirements)
    const faceBuffer = this.device.createBuffer({ label: 'ibl-face-ubo', size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const faceLayout = (pipeline.getBindGroupLayout(1));

    for (let face = 0; face < 6; face++) {
      const view = this.envCube.createView({ baseArrayLayer: face, arrayLayerCount: 1 });
      const pass = encoder.beginRenderPass({
        label: `ibl-env-capture-face-${face}`,
        colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, this.paramsBindGroups.get('procedural-sky') ?? this.paramsBindGroups.values().next().value);
      const faceData = new Uint32Array(8);
      faceData[0] = face;
      this.device.queue.writeBuffer(faceBuffer, 0, faceData);
      const faceBg = this.device.createBindGroup({ label: `ibl-face-bg-${face}`, layout: faceLayout, entries: [{ binding: 0, resource: { buffer: faceBuffer } }] });
      pass.setBindGroup(1, faceBg);
      pass.draw(3, 1, 0, 0);
      pass.end();
    }

    this.device.queue.submit([encoder.finish()]);
    return { brdfLut: this.brdfLut!, envCube: this.envCube! };
  }
}


/**
 * VegetationRenderer - Renders vegetation (grass, flowers, trees, shrubs)
 * 
 * Features:
 * - Instanced billboard rendering for grass/flowers
 * - 3D model rendering with LOD for trees/shrubs
 * - Wind animation via vertex shader
 * - Frustum culling and distance-based LOD
 */

import type { Scene, Entity } from '@engine/world';
import { VegetationComponent, VegetationType } from '@engine/world';
import { InstanceManager, InstanceDataBuilder } from '../core/InstanceManager';
import { FrustumCuller, type Frustum } from '../core/FrustumCuller';
import { GeometryLODManager, type GeometryLODLevel } from '../core/GeometryLODManager';
import type { Mat4, Vec3 } from '@engine/core/math';
import { Logger } from '@engine/core/utils';

/**
 * Billboard vertex data (quad: 2 triangles, 4 vertices)
 */
interface BillboardGeometry {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  vertexCount: number;
  indexCount: number;
}

/**
 * Vegetation instance data for rendering
 */
interface VegetationInstance {
  entity: Entity;
  vegetation: VegetationComponent;
  position: Vec3;
  rotation: number; // Y-axis rotation
  scale: number; // Varied scale for natural look (affected by growth stage)
  distance?: number; // Distance from camera (for LOD selection)
}

/**
 * Configuration for vegetation rendering
 */
export interface VegetationRendererConfig {
  /** Maximum distance for rendering vegetation */
  maxRenderDistance: number;
  /** Distance-based LOD thresholds (for billboards) */
  lodDistances: number[];
  /** Enable wind animation */
  enableWind: boolean;
  /** Global wind strength multiplier */
  windGlobalStrength: number;
  /** Global wind frequency */
  windGlobalFrequency: number;
}

const DEFAULT_CONFIG: VegetationRendererConfig = {
  maxRenderDistance: 100.0,
  lodDistances: [20, 40, 60], // LOD levels
  enableWind: true,
  windGlobalStrength: 1.0,
  windGlobalFrequency: 1.0,
};

/**
 * VegetationRenderer manages rendering of all vegetation in the scene
 */
export class VegetationRenderer {
  private device: GPUDevice | null = null;
  private config: VegetationRendererConfig;
  private instanceManager: InstanceManager;
  private frustumCuller: FrustumCuller;
  
  /** Billboard geometry (quad) */
  private billboardGeometry: BillboardGeometry | null = null;
  
  /** Render pipeline for billboards */
  private billboardPipeline: GPURenderPipeline | null = null;
  
  /** Render pipeline for 3D models */
  private model3DPipeline: GPURenderPipeline | null = null;
  
  /** Bind group layouts */
  private uniformBindGroupLayout: GPUBindGroupLayout | null = null;
  private textureBindGroupLayout: GPUBindGroupLayout | null = null;
  
  /** Uniform buffer for view/projection and wind params */
  private uniformBuffer: GPUBuffer | null = null;
  
  /** Texture for billboard (grass/flowers) */
  private billboardTexture: GPUTexture | null = null;
  private billboardSampler: GPUSampler | null = null;
  
  /** Default white texture for 3D models when no texture is available */
  private defaultWhiteTexture: GPUTexture | null = null;
  
  /** Cached visible vegetation entities */
  private visibleVegetation: VegetationInstance[] = [];
  
  /** Geometry LOD manager for 3D models */
  private lodManager: GeometryLODManager | null = null;
  
  /** Buffer pool for instance data (reuse buffers to reduce allocations) */
  private bufferPool: {
    position?: GPUBuffer;
    scale?: GPUBuffer;
    wind?: GPUBuffer;
    color?: GPUBuffer;
    maxSize: number;
  } = { maxSize: 0 };
  
  /** Buffer pool for 3D model instance data */
  private model3DBufferPool: {
    transform?: GPUBuffer; // mat4 per instance (64 bytes)
    color?: GPUBuffer; // vec4 per instance (16 bytes)
    maxSize: number;
  } = { maxSize: 0 };
  
  /** Cached 3D model geometries by URL */
  private modelGeometries = new Map<string, {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    vertexCount: number;
    indexCount: number;
    lodLevels?: Map<GeometryLODLevel, {
      vertexBuffer: GPUBuffer;
      indexBuffer: GPUBuffer;
      vertexCount: number;
      indexCount: number;
    }>;
  }>();
  
  /** Texture cache for model URLs */
  private textureCache = new Map<string, GPUTexture>();
  
  /** Pending texture loads to avoid duplicate requests */
  private pendingTextureLoads = new Map<string, Promise<GPUTexture>>();
  
  /** Current time for wind animation */
  private currentTime = 0;
  
  private initialized = false;

  constructor(config?: Partial<VegetationRendererConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.instanceManager = new InstanceManager(5000); // Initial capacity for many grass instances
    this.frustumCuller = new FrustumCuller();
  }

  /**
   * Initializes the vegetation renderer with WebGPU resources
   */
  async initialize(device: GPUDevice, presentationFormat: GPUTextureFormat): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.device = device;

    // Create billboard geometry (simple quad)
    this.billboardGeometry = this.createBillboardGeometry(device);

    // Create bind group layouts
    this.uniformBindGroupLayout = device.createBindGroupLayout({
      label: 'vegetation-uniform-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.textureBindGroupLayout = device.createBindGroupLayout({
      label: 'vegetation-texture-layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
      ],
    });

    // Create uniform buffer
    // Size: viewProjection (64) + cameraPosition (16) + windParams (16) + time (4) = 100 bytes, padded to 112
    this.uniformBuffer = device.createBuffer({
      label: 'vegetation-uniform-buffer',
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create default sampler
    this.billboardSampler = device.createSampler({
      label: 'vegetation-billboard-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // Create default white texture for 3D models (1x1 white pixel)
    this.defaultWhiteTexture = device.createTexture({
      label: 'vegetation-default-white-texture',
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture(
      { texture: this.defaultWhiteTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4, rowsPerImage: 1 },
      [1, 1]
    );

    // Create render pipeline
    await this.createBillboardPipeline(device, presentationFormat);
    
    // Create 3D model render pipeline
    await this.create3DModelPipeline(device, presentationFormat);

    // Initialize LOD manager for 3D models
    this.lodManager = new GeometryLODManager(device, {
      enabled: true,
      lodDistances: [15, 30, 50, 80],
      useSmoothTransition: true,
      transitionRange: 2.0,
      minScreenCoverage: 0.005,
    });

    this.initialized = true;
  }

  /**
   * Creates billboard geometry (quad facing camera)
   */
  private createBillboardGeometry(device: GPUDevice): BillboardGeometry {
    // Quad vertices: 4 vertices, each with position (vec3) and UV (vec2) = 5 floats = 20 bytes per vertex
    // Positions: bottom-left, bottom-right, top-left, top-right
    // UVs: (0,0), (1,0), (0,1), (1,1)
    const vertices = new Float32Array([
      // Position (x, y, z), UV (u, v)
      -0.5, 0.0, 0.0, 0.0, 0.0, // bottom-left
       0.5, 0.0, 0.0, 1.0, 0.0, // bottom-right
      -0.5, 1.0, 0.0, 0.0, 1.0, // top-left
       0.5, 1.0, 0.0, 1.0, 1.0, // top-right
    ]);

    // Indices: 2 triangles forming a quad
    const indices = new Uint16Array([
      0, 1, 2, // First triangle
      2, 1, 3, // Second triangle
    ]);

    const vertexBuffer = device.createBuffer({
      label: 'vegetation-billboard-vertex-buffer',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const indexBuffer = device.createBuffer({
      label: 'vegetation-billboard-index-buffer',
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(vertexBuffer, 0, vertices);
    device.queue.writeBuffer(indexBuffer, 0, indices);

    return {
      vertexBuffer,
      indexBuffer,
      vertexCount: 4,
      indexCount: 6,
    };
  }

  /**
   * Creates render pipeline for billboard rendering
   */
  private async createBillboardPipeline(
    device: GPUDevice,
    presentationFormat: GPUTextureFormat
  ): Promise<void> {
    // Shader code will be added in next task (vegetation-shader-wind)
    // For now, create basic pipeline structure
    const shaderModule = device.createShaderModule({
      label: 'vegetation-billboard-shader',
      code: this.getBillboardShaderCode(),
    });

    const pipelineLayout = device.createPipelineLayout({
      label: 'vegetation-billboard-pipeline-layout',
      bindGroupLayouts: [this.uniformBindGroupLayout!, this.textureBindGroupLayout!],
    });

    const createPipeline = (desc: GPURenderPipelineDescriptor): GPURenderPipeline | Promise<GPURenderPipeline> => {
      const anyDevice = device as unknown as {
        createRenderPipelineAsync?: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>;
        createRenderPipeline: (d: GPURenderPipelineDescriptor) => GPURenderPipeline;
      };
      if (typeof anyDevice.createRenderPipelineAsync === 'function') {
        return anyDevice.createRenderPipelineAsync(desc);
      }
      return anyDevice.createRenderPipeline(desc);
    };

    this.billboardPipeline = await createPipeline({
      label: 'vegetation-billboard-pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [
          {
            arrayStride: 20, // 5 floats * 4 bytes
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
              { shaderLocation: 1, offset: 12, format: 'float32x2' }, // uv
            ],
          },
          {
            arrayStride: 16, // instance offset (vec3 + padding)
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'float32x3' }, // instancePosition
            ],
          },
          {
            arrayStride: 4, // instance scale (float)
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 3, offset: 0, format: 'float32' }, // instanceScale
            ],
          },
          {
            arrayStride: 16, // wind params (vec4: strength, frequency, phase, growthStage)
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 4, offset: 0, format: 'float32x4' }, // windParams (w component = growthStage)
            ],
          },
          {
            arrayStride: 16, // color tint (vec4: RGB + variationFactor)
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 5, offset: 0, format: 'float32x4' }, // colorTint
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: presentationFormat }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none', // Billboards visible from both sides
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
  }

  /**
   * Creates render pipeline for 3D model rendering with instancing
   */
  private async create3DModelPipeline(
    device: GPUDevice,
    presentationFormat: GPUTextureFormat
  ): Promise<void> {
    const shaderModule = device.createShaderModule({
      label: 'vegetation-3d-model-shader',
      code: this.get3DModelShaderCode(),
    });

    const pipelineLayout = device.createPipelineLayout({
      label: 'vegetation-3d-model-pipeline-layout',
      bindGroupLayouts: [this.uniformBindGroupLayout!, this.textureBindGroupLayout!],
    });

    const createPipeline = (desc: GPURenderPipelineDescriptor): GPURenderPipeline | Promise<GPURenderPipeline> => {
      const anyDevice = device as unknown as {
        createRenderPipelineAsync?: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>;
        createRenderPipeline: (d: GPURenderPipelineDescriptor) => GPURenderPipeline;
      };
      if (typeof anyDevice.createRenderPipelineAsync === 'function') {
        return anyDevice.createRenderPipelineAsync(desc);
      }
      return anyDevice.createRenderPipeline(desc);
    };

    this.model3DPipeline = await createPipeline({
      label: 'vegetation-3d-model-pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [
          {
            // Vertex buffer: position (vec3) + normal (vec3) + uv (vec2) = 8 floats = 32 bytes
            arrayStride: 32,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
              { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
              { shaderLocation: 2, offset: 24, format: 'float32x2' }, // uv
            ],
          },
          {
            // Instance transform (mat4) = 64 bytes
            arrayStride: 64,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 3, offset: 0, format: 'float32x4' }, // transform row 0
              { shaderLocation: 4, offset: 16, format: 'float32x4' }, // transform row 1
              { shaderLocation: 5, offset: 32, format: 'float32x4' }, // transform row 2
              { shaderLocation: 6, offset: 48, format: 'float32x4' }, // transform row 3
            ],
          },
          {
            // Instance color (vec4) = 16 bytes
            arrayStride: 16,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 7, offset: 0, format: 'float32x4' }, // color
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: presentationFormat }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back', // Cull back faces
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
  }

  /**
   * Gets billboard shader code with advanced wind animation
   */
  private getBillboardShaderCode(): string {
    return `
struct Uniforms {
  viewProjectionMatrix: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  _pad0: f32,
  windParams: vec4<f32>, // x: globalStrength, y: globalFrequency, z: time, w: unused
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var billboardTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) colorTint: vec4<f32>,
}

// Wind animation function
// Uses multiple sine waves for natural, organic movement
fn applyWindDisplacement(
  worldPos: vec3<f32>,
  vertexHeight: f32, // 0-1 normalized height on billboard (0 = bottom, 1 = top)
  windStrength: f32,
  windFrequency: f32,
  windPhase: f32,
  time: f32
) -> vec3<f32> {
  // Primary wind wave (main sway)
  let primaryWave = sin(time * windFrequency + windPhase) * windStrength;
  
  // Secondary wave for organic variation (half frequency, different phase)
  let secondaryWave = sin(time * windFrequency * 0.5 + windPhase * 1.3) * windStrength * 0.3;
  
  // Height-based amplification (top moves more than bottom, like real grass)
  let heightFactor = vertexHeight * vertexHeight; // Quadratic for more natural motion
  
  // Combined wind displacement
  let windDisplacement = (primaryWave + secondaryWave) * heightFactor * 0.15;
  
  // Apply displacement perpendicular to billboard forward (sideways sway)
  let windOffset = vec3<f32>(windDisplacement, 0.0, 0.0);
  
  // Add slight vertical component for realistic bending
  let verticalBend = -abs(windDisplacement) * 0.1 * heightFactor;
  
  return worldPos + windOffset + vec3<f32>(0.0, verticalBend, 0.0);
}

@vertex
fn vertexMain(
  @location(0) vertexPos: vec3<f32>,
  @location(1) vertexUV: vec2<f32>,
  @location(2) instancePos: vec3<f32>,
  @location(3) instanceScale: f32,
  @location(4) windParams: vec4<f32>, // x: strength, y: frequency, z: phase, w: growthStage
  @location(5) colorTint: vec4<f32> // RGB color tint, w: variationFactor (passed through)
) -> VertexOutput {
  var output: VertexOutput;
  
  // Billboard always faces camera
  let worldPos = instancePos;
  let toCamera = normalize(uniforms.cameraPosition - worldPos);
  let right = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), toCamera));
  let up = cross(toCamera, right);
  
  // Apply growth stage to scale (vegetation shrinks when harvested/growing)
  let growthStage = windParams.w; // Growth stage stored in wind params w component
  let effectiveScale = instanceScale * growthStage;
  
  // Apply billboard transformation
  let billboardPos = worldPos + (vertexPos.x * right + vertexPos.y * up) * effectiveScale;
  
  // Calculate normalized height on billboard (0 = bottom, 1 = top)
  let normalizedHeight = (vertexPos.y + 0.5) / 1.0; // vertexPos.y ranges from -0.5 to 0.5
  
  // Apply wind animation if enabled
  var finalPos = billboardPos;
  if (uniforms.windParams.x > 0.0) { // Only if wind is enabled
    let instanceWindStrength = windParams.x * uniforms.windParams.x;
    let instanceWindFreq = windParams.y * uniforms.windParams.y;
    let windTime = uniforms.windParams.z + windParams.z; // Add instance phase offset
    
    // Calculate wind displacement
    let windOffset = applyWindDisplacement(
      billboardPos,
      normalizedHeight,
      instanceWindStrength,
      instanceWindFreq,
      windParams.z,
      windTime
    ) - billboardPos;
    
    // Apply wind in world space (needs to be transformed to billboard space)
    // Wind primarily affects X axis (sideways) and slight Y (bend)
    let windRight = right * windOffset.x;
    let windUp = up * windOffset.y;
    finalPos = billboardPos + windRight + windUp;
  }
  
  output.position = uniforms.viewProjectionMatrix * vec4<f32>(finalPos, 1.0);
  output.uv = vertexUV;
  // Pass color tint through to fragment shader via UV channel (hack, but works)
  // We'll use a separate varying for proper color support
  output.colorTint = colorTint;
  
  return output;
}

@fragment
fn fragmentMain(
  @location(0) uv: vec2<f32>,
  @location(1) colorTint: vec4<f32>
) -> @location(0) vec4<f32> {
  var color = textureSample(billboardTexture, texSampler, uv);
  
  // Alpha discard for transparent backgrounds (cutout rendering)
  if (color.a < 0.1) {
    discard;
  }
  
  // Apply color tint (RGB from instance data)
  color.rgb = color.rgb * colorTint.rgb;
  
  return color;
}
`;
  }

  /**
   * Gets 3D model shader code for instanced rendering with LOD support
   */
  private get3DModelShaderCode(): string {
    return `
struct Uniforms {
  viewProjectionMatrix: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  _pad0: f32,
  windParams: vec4<f32>, // x: globalStrength, y: globalFrequency, z: time, w: unused
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var modelTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
  @location(3) color: vec4<f32>,
}

@vertex
fn vertexMain(
  @location(0) vertexPos: vec3<f32>,
  @location(1) vertexNormal: vec3<f32>,
  @location(2) vertexUV: vec2<f32>,
  @location(3) instanceTransform0: vec4<f32>,
  @location(4) instanceTransform1: vec4<f32>,
  @location(5) instanceTransform2: vec4<f32>,
  @location(6) instanceTransform3: vec4<f32>,
  @location(7) instanceColor: vec4<f32>
) -> VertexOutput {
  var output: VertexOutput;
  
  // Build instance transform matrix
  let instanceTransform = mat4x4<f32>(
    instanceTransform0,
    instanceTransform1,
    instanceTransform2,
    instanceTransform3
  );
  
  // Transform vertex to world space
  let worldPos = (instanceTransform * vec4<f32>(vertexPos, 1.0)).xyz;
  
  // Transform normal to world space (using inverse transpose for proper normal transformation)
  // For simplicity, we'll use the rotation part of the transform
  let worldNormal = normalize((instanceTransform * vec4<f32>(vertexNormal, 0.0)).xyz);
  
  // Apply view-projection
  output.position = uniforms.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
  output.uv = vertexUV;
  output.normal = worldNormal;
  output.worldPos = worldPos;
  output.color = instanceColor;
  
  return output;
}

@fragment
fn fragmentMain(
  @location(0) uv: vec2<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
  @location(3) color: vec4<f32>
) -> @location(0) vec4<f32> {
  // Sample texture if available
  var baseColor = textureSample(modelTexture, texSampler, uv);
  
  // Apply instance color tint
  baseColor.rgb = baseColor.rgb * color.rgb;
  
  // Simple lighting (directional light from above)
  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.3));
  let N = normalize(normal);
  let lightIntensity = max(dot(N, lightDir), 0.3); // Ambient + diffuse
  
  baseColor.rgb = baseColor.rgb * lightIntensity;
  
  // Alpha discard for transparent areas
  if (baseColor.a < 0.1) {
    discard;
  }
  
  return baseColor;
}
`;
  }

  /**
   * Updates vegetation renderer (called each frame)
   */
  update(deltaTime: number, scene: Scene | null, viewProjectionMatrix: Mat4, cameraPosition: Vec3): void {
    if (!this.initialized || !scene) {
      return;
    }

    this.currentTime += deltaTime;

    // Extract frustum for culling
    const frustum = this.frustumCuller.extractFrustumFromVP(viewProjectionMatrix);

    // Collect all vegetation entities
    const allVegetation = scene.queryEntities(VegetationComponent);
    
    // Filter visible vegetation (frustum cull + distance cull)
    this.visibleVegetation = [];
    for (const entity of allVegetation) {
      const vegetation = entity.getComponent(VegetationComponent);
      if (!vegetation || vegetation.isHarvested) {
        continue; // Skip harvested vegetation
      }

      const position = entity.transform.getWorldPosition();
      const distance = Math.sqrt(
        Math.pow(position[0] - cameraPosition[0], 2) +
        Math.pow(position[1] - cameraPosition[1], 2) +
        Math.pow(position[2] - cameraPosition[2], 2)
      );

      // Distance cull
      if (distance > this.config.maxRenderDistance) {
        continue;
      }

      // Frustum cull (simplified - check if position is within expanded AABB)
      // For billboards, create simple AABB around position
      const radius = vegetation.config.radius * 2; // Expanded for billboard
      const aabb = {
        min: [position[0] - radius, position[1] - radius, position[2] - radius] as Vec3,
        max: [position[0] + radius, position[1] + radius, position[2] + radius] as Vec3,
      };
      // Simple plane test - check if AABB is outside any frustum plane
      let isVisible = true;
      for (const plane of frustum.planes) {
        const px = plane.nx >= 0 ? aabb.max[0] : aabb.min[0];
        const py = plane.ny >= 0 ? aabb.max[1] : aabb.min[1];
        const pz = plane.nz >= 0 ? aabb.max[2] : aabb.min[2];
        const dist = plane.nx * px + plane.ny * py + plane.nz * pz + plane.d;
        if (dist < 0) {
          isVisible = false;
          break;
        }
      }
      if (!isVisible) {
        continue;
      }

      // Calculate varied scale with growth stage influence
      const scaleVariation = vegetation.config.scaleVariation;
      const hash = this.hashPosition(position);
      const randomScale = 1.0 + (hash % 200 / 100.0 - 1.0) * scaleVariation;
      
      // Apply growth stage to scale (vegetation grows from 0 to full size)
      const growthScale = vegetation.growthStage;

      this.visibleVegetation.push({
        entity,
        vegetation,
        position,
        rotation: 0, // Can be randomized later
        scale: randomScale * vegetation.config.height * growthScale,
        distance, // Store distance for LOD selection
      });
    }

    // Update uniform buffer
    this.updateUniforms(viewProjectionMatrix, cameraPosition);
  }

  /**
   * Renders all visible vegetation
   */
  async render(passEncoder: GPURenderPassEncoder): Promise<void> {
    if (!this.initialized || !this.billboardPipeline || !this.billboardGeometry) {
      return;
    }

    // Group vegetation by type for efficient rendering
    const billboardVegetation = this.visibleVegetation.filter(
      (v) => v.vegetation.config.type === VegetationType.Grass ||
             v.vegetation.config.type === VegetationType.Flower
    );

    const modelVegetation = this.visibleVegetation.filter(
      (v) => v.vegetation.config.type === VegetationType.Tree ||
             v.vegetation.config.type === VegetationType.Shrub
    );

    // Render billboards
    if (billboardVegetation.length > 0) {
      this.renderBillboards(passEncoder, billboardVegetation);
    }

    // Render 3D models (trees, shrubs)
    if (modelVegetation.length > 0 && this.lodManager) {
      await this.render3DModels(passEncoder, modelVegetation);
    }
  }

  /**
   * Renders 3D model vegetation (trees, shrubs) with LOD support
   */
  private async render3DModels(
    passEncoder: GPURenderPassEncoder,
    instances: VegetationInstance[]
  ): Promise<void> {
    if (!this.device || !this.lodManager || !this.model3DPipeline) {
      return;
    }

    // Group by model URL and LOD level for efficient batch rendering
    const modelLODGroups = new Map<string, Map<GeometryLODLevel, VegetationInstance[]>>();
    
    // Calculate LOD for each instance and group them
    for (const inst of instances) {
      const modelUrl = inst.vegetation.config.modelUrl;
      if (!modelUrl) {
        continue; // Skip if no model URL
      }

      const geometry = this.modelGeometries.get(modelUrl);
      if (!geometry) {
        continue; // Skip if geometry not loaded
      }

      // Calculate distance for LOD selection
      // Note: distance is already calculated in update(), but we need camera position
      // For now, we'll use a simple distance-based LOD selection
      const lodLevel = this.selectLODLevel(inst);
      
      // Register entity with LOD manager if not already registered
      const entityId = inst.entity.id;
      if (!this.lodManager.getCurrentLOD(entityId)) {
        // Create LOD levels map if not exists
        if (!geometry.lodLevels) {
          // Use base geometry for all LOD levels (simplified - in production, generate actual LOD meshes)
          geometry.lodLevels = new Map();
          geometry.lodLevels.set(0, {
            vertexBuffer: geometry.vertexBuffer,
            indexBuffer: geometry.indexBuffer,
            vertexCount: geometry.vertexCount,
            indexCount: geometry.indexCount,
          });
          // For now, use same geometry for all LODs (in production, generate simplified meshes)
          for (let i = 1; i <= 3; i++) {
            geometry.lodLevels.set(i as GeometryLODLevel, {
              vertexBuffer: geometry.vertexBuffer,
              indexBuffer: geometry.indexBuffer,
              vertexCount: geometry.vertexCount,
              indexCount: geometry.indexCount,
            });
          }
        }
        
        this.lodManager.registerEntity(entityId, geometry.lodLevels);
      }

      // Group by model URL and LOD level
      if (!modelLODGroups.has(modelUrl)) {
        modelLODGroups.set(modelUrl, new Map());
      }
      const lodMap = modelLODGroups.get(modelUrl)!;
      if (!lodMap.has(lodLevel)) {
        lodMap.set(lodLevel, []);
      }
      lodMap.get(lodLevel)!.push(inst);
    }

    // Render each model/LOD group
    for (const [modelUrl, lodMap] of modelLODGroups.entries()) {
      const geometry = this.modelGeometries.get(modelUrl);
      if (!geometry) {
        continue;
      }

      // Render each LOD level separately
      for (const [lodLevel, modelInstances] of lodMap.entries()) {
        if (modelInstances.length === 0) {
          continue;
        }

        // Get LOD geometry
        const lodGeometry = geometry.lodLevels?.get(lodLevel) ?? {
          vertexBuffer: geometry.vertexBuffer,
          indexBuffer: geometry.indexBuffer,
          vertexCount: geometry.vertexCount,
          indexCount: geometry.indexCount,
        };

        // Render this LOD group
        await this.render3DModelGroup(
          passEncoder,
          modelInstances,
          lodGeometry,
          modelUrl
        );
      }
    }
  }

  /**
   * Selects LOD level based on distance
   */
  private selectLODLevel(instance: VegetationInstance): GeometryLODLevel {
    const lodDistances = this.lodManager?.getConfig().lodDistances ?? [15, 30, 50, 80];
    const distance = instance.distance ?? 0;
    
    const d0 = lodDistances[0] ?? 15;
    const d1 = lodDistances[1] ?? 30;
    const d2 = lodDistances[2] ?? 50;
    
    if (distance <= d0) return 0;
    if (distance <= d1) return 1;
    if (distance <= d2) return 2;
    return 3;
  }

  /**
   * Gets texture for a model URL, loading it if necessary
   * @param modelUrl Model URL (may contain texture URL)
   * @returns GPUTexture or null
   */
  private async getTextureForModel(modelUrl: string): Promise<GPUTexture | null> {
    // Try to extract texture URL from model URL or use model URL as texture URL
    // For now, assume modelUrl can be used as texture URL if it ends with image extension
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const isImageUrl = imageExtensions.some(ext => modelUrl.toLowerCase().endsWith(ext));
    
    if (isImageUrl) {
      try {
        return await this.loadTexture(modelUrl);
      } catch {
        // Fall back to default
      }
    }
    
    // Use billboard texture if available, otherwise default white
    return this.billboardTexture ?? this.defaultWhiteTexture;
  }
  
  /**
   * Renders a group of 3D model instances with the same LOD level
   */
  private async render3DModelGroup(
    passEncoder: GPURenderPassEncoder,
    instances: VegetationInstance[],
    geometry: {
      vertexBuffer: GPUBuffer;
      indexBuffer: GPUBuffer;
      vertexCount: number;
      indexCount: number;
    },
    modelUrl: string
  ): Promise<void> {
    if (!this.device || !this.model3DPipeline) {
      return;
    }

    const instanceCount = instances.length;
    if (instanceCount === 0) {
      return;
    }

    // Build instance data: transform matrices and colors
    const transformData = new Float32Array(instanceCount * 16); // mat4 per instance
    const colorData = new Float32Array(instanceCount * 4); // vec4 per instance

    for (let i = 0; i < instanceCount; i++) {
      const inst = instances[i];
      if (!inst) continue;

      // Build transform matrix (position, rotation, scale)
      const pos = inst.position;
      const scale = inst.scale;
      const rotation = inst.rotation; // Y-axis rotation in radians

      // Create transform matrix: T * R * S
      // Rotation around Y axis
      const cosR = Math.cos(rotation);
      const sinR = Math.sin(rotation);
      
      // Scale matrix
      const sx = scale;
      const sy = scale * inst.vegetation.growthStage; // Apply growth stage
      const sz = scale;

      // Combined transform matrix (column-major)
      const mat = [
        cosR * sx, 0, sinR * sz, 0,
        0, sy, 0, 0,
        -sinR * sx, 0, cosR * sz, 0,
        pos[0], pos[1], pos[2], 1,
      ];

      // Write matrix to buffer (column-major)
      for (let j = 0; j < 16; j++) {
        transformData[i * 16 + j] = mat[j] ?? 0;
      }

      // Color tint
      const colorTint = inst.vegetation.config.colorTint ?? [1.0, 1.0, 1.0];
      const colorVariation = inst.vegetation.config.colorVariation;
      const variation = (inst.vegetation.colorVariationFactor - 0.5) * 2.0 * colorVariation;
      colorData[i * 4 + 0] = colorTint[0] * (1.0 + variation);
      colorData[i * 4 + 1] = colorTint[1] * (1.0 + variation);
      colorData[i * 4 + 2] = colorTint[2] * (1.0 + variation);
      colorData[i * 4 + 3] = 1.0; // Alpha
    }

    // Use buffer pool for better performance
    const transformBufferSize = transformData.byteLength;
    const colorBufferSize = colorData.byteLength;

    if (this.model3DBufferPool.maxSize < instanceCount) {
      // Destroy old buffers
      this.model3DBufferPool.transform?.destroy();
      this.model3DBufferPool.color?.destroy();

      // Create new larger buffers
      this.model3DBufferPool.transform = this.device.createBuffer({
        label: 'vegetation-3d-instance-transform-pooled',
        size: transformBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      this.model3DBufferPool.color = this.device.createBuffer({
        label: 'vegetation-3d-instance-color-pooled',
        size: colorBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      this.model3DBufferPool.maxSize = instanceCount;
    }

    // Write data to pooled buffers
    this.device.queue.writeBuffer(this.model3DBufferPool.transform!, 0, transformData);
    this.device.queue.writeBuffer(this.model3DBufferPool.color!, 0, colorData);

    // Set up pipeline and render
    passEncoder.setPipeline(this.model3DPipeline);

    // Set vertex buffers
    passEncoder.setVertexBuffer(0, geometry.vertexBuffer);
    passEncoder.setVertexBuffer(1, this.model3DBufferPool.transform!);
    passEncoder.setVertexBuffer(2, this.model3DBufferPool.color!);
    passEncoder.setIndexBuffer(geometry.indexBuffer, 'uint32');

    // Create bind groups
    const uniformBindGroup = this.device.createBindGroup({
      label: 'vegetation-3d-uniform-bg',
      layout: this.uniformBindGroupLayout!,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer! } }],
    });

    // Use model-specific texture if available, otherwise use default white texture
    const modelTexture = await this.getTextureForModel(modelUrl);
    if (!modelTexture) {
      Logger.warn(`[VegetationRenderer] No texture available for 3D model rendering: ${modelUrl}`);
      return;
    }

    const textureBindGroup = this.device.createBindGroup({
      label: 'vegetation-3d-texture-bg',
      layout: this.textureBindGroupLayout!,
      entries: [
        { binding: 0, resource: this.billboardSampler! },
        { binding: 1, resource: modelTexture.createView() },
      ],
    });

    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setBindGroup(1, textureBindGroup);
    passEncoder.drawIndexed(geometry.indexCount, instanceCount, 0, 0, 0);
  }

  /**
   * Loads a texture from URL and caches it
   * @param url Texture URL
   * @returns Promise resolving to GPUTexture
   */
  async loadTexture(url: string): Promise<GPUTexture> {
    if (!this.device) {
      throw new Error('VegetationRenderer not initialized');
    }
    
    // Check cache first
    const cached = this.textureCache.get(url);
    if (cached) {
      return cached;
    }
    
    // Check if already loading
    const pending = this.pendingTextureLoads.get(url);
    if (pending) {
      return pending;
    }
    
    // Start loading
    const loadPromise = (async () => {
      try {
        // Load image
        const image = new Image();
        image.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
          image.src = url;
        });
        
        // Create texture from image
        const texture = this.device!.createTexture({
          label: `vegetation-texture-${url}`,
          size: [image.width, image.height],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        
        // Upload image data to texture
        this.device!.queue.copyExternalImageToTexture(
          { source: image },
          { texture },
          { width: image.width, height: image.height }
        );
        
        // Cache texture
        this.textureCache.set(url, texture);
        this.pendingTextureLoads.delete(url);
        
        return texture;
      } catch (error) {
        this.pendingTextureLoads.delete(url);
        Logger.warn(`[VegetationRenderer] Failed to load texture ${url}:`, error);
        // Return default white texture on error
        return this.defaultWhiteTexture!;
      }
    })();
    
    this.pendingTextureLoads.set(url, loadPromise);
    return loadPromise;
  }
  register3DModel(
    modelUrl: string,
    geometry: {
      vertexBuffer: GPUBuffer;
      indexBuffer: GPUBuffer;
      vertexCount: number;
      indexCount: number;
    }
  ): void {
    this.modelGeometries.set(modelUrl, {
      ...geometry,
      lodLevels: undefined, // Will be generated on demand
    });
  }

  /**
   * Removes a 3D model from cache
   */
  unregister3DModel(modelUrl: string): void {
    const geometry = this.modelGeometries.get(modelUrl);
    if (geometry) {
      geometry.vertexBuffer.destroy();
      geometry.indexBuffer.destroy();
      if (geometry.lodLevels) {
        for (const lod of geometry.lodLevels.values()) {
          lod.vertexBuffer.destroy();
          lod.indexBuffer.destroy();
        }
      }
      this.modelGeometries.delete(modelUrl);
    }
  }

  /**
   * Renders billboard vegetation (grass, flowers)
   */
  private renderBillboards(
    passEncoder: GPURenderPassEncoder,
    instances: VegetationInstance[]
  ): void {
    if (!this.device || !this.billboardPipeline || !this.billboardGeometry) {
      return;
    }

    passEncoder.setPipeline(this.billboardPipeline);

    // Create instance buffers for this frame
    const instanceCount = instances.length;
    if (instanceCount === 0) {
      return;
    }

    // Create instance data buffers
    const instancePositionData = new Float32Array(instanceCount * 3);
    const instanceScaleData = new Float32Array(instanceCount);
    const instanceWindData = new Float32Array(instanceCount * 4);
    const instanceColorData = new Float32Array(instanceCount * 4); // RGBA + growth stage

    for (let i = 0; i < instanceCount; i++) {
      const inst = instances[i];
      if (!inst) continue;
      const pos = inst.position;
      const veg = inst.vegetation;

      // Position
      instancePositionData[i * 3 + 0] = pos[0];
      instancePositionData[i * 3 + 1] = pos[1];
      instancePositionData[i * 3 + 2] = pos[2];

      // Scale
      instanceScaleData[i] = inst.scale;

      // Wind params: strength, frequency, phase, growthStage
      instanceWindData[i * 4 + 0] = veg.config.windStrength;
      instanceWindData[i * 4 + 1] = veg.config.windFrequency;
      instanceWindData[i * 4 + 2] = veg.windPhase;
      instanceWindData[i * 4 + 3] = veg.growthStage; // Store growth stage in wind buffer padding

      // Color tint + variation: RGB + colorVariationFactor
      const colorTint = veg.config.colorTint ?? [1.0, 1.0, 1.0];
      const colorVariation = veg.config.colorVariation;
      const variation = (veg.colorVariationFactor - 0.5) * 2.0 * colorVariation; // -variation to +variation
      instanceColorData[i * 4 + 0] = colorTint[0] * (1.0 + variation);
      instanceColorData[i * 4 + 1] = colorTint[1] * (1.0 + variation);
      instanceColorData[i * 4 + 2] = colorTint[2] * (1.0 + variation);
      instanceColorData[i * 4 + 3] = veg.colorVariationFactor; // Store variation factor in alpha
    }

    // Use buffer pool for better performance (reuse buffers when possible)
    const positionBufferSize = instancePositionData.byteLength;
    const scaleBufferSize = instanceScaleData.byteLength;
    const windBufferSize = instanceWindData.byteLength;
    const colorBufferSize = instanceColorData.byteLength;

    // Ensure buffer pool is large enough, or create new buffers
    if (this.bufferPool.maxSize < instanceCount) {
      // Destroy old buffers if they exist
      this.bufferPool.position?.destroy();
      this.bufferPool.scale?.destroy();
      this.bufferPool.wind?.destroy();
      this.bufferPool.color?.destroy();

      // Create new larger buffers
      this.bufferPool.position = this.device.createBuffer({
        label: 'vegetation-instance-positions-pooled',
        size: positionBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      this.bufferPool.scale = this.device.createBuffer({
        label: 'vegetation-instance-scales-pooled',
        size: scaleBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      this.bufferPool.wind = this.device.createBuffer({
        label: 'vegetation-instance-wind-pooled',
        size: windBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      this.bufferPool.color = this.device.createBuffer({
        label: 'vegetation-instance-color-pooled',
        size: colorBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      this.bufferPool.maxSize = instanceCount;
    }

    // Write data to pooled buffers
    this.device.queue.writeBuffer(this.bufferPool.position!, 0, instancePositionData);
    this.device.queue.writeBuffer(this.bufferPool.scale!, 0, instanceScaleData);
    this.device.queue.writeBuffer(this.bufferPool.wind!, 0, instanceWindData);
    this.device.queue.writeBuffer(this.bufferPool.color!, 0, instanceColorData);

    // Set vertex buffers
    passEncoder.setVertexBuffer(0, this.billboardGeometry.vertexBuffer);
    passEncoder.setVertexBuffer(1, this.bufferPool.position!);
    passEncoder.setVertexBuffer(2, this.bufferPool.scale!);
    passEncoder.setVertexBuffer(3, this.bufferPool.wind!);
    passEncoder.setVertexBuffer(4, this.bufferPool.color!);
    passEncoder.setIndexBuffer(this.billboardGeometry.indexBuffer, 'uint16');

    // Create bind groups
    const uniformBindGroup = this.device.createBindGroup({
      label: 'vegetation-uniform-bg',
      layout: this.uniformBindGroupLayout!,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer! } }],
    });

    // Create texture bind group when billboard texture is available
    if (!this.billboardTexture) {
      // No texture available, skip rendering
      return;
    }
    
    const textureBindGroup = this.device.createBindGroup({
      label: 'vegetation-texture-bg',
      layout: this.textureBindGroupLayout!,
      entries: [
        { binding: 0, resource: this.billboardSampler! },
        { binding: 1, resource: this.billboardTexture.createView() },
      ],
    });

    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.setBindGroup(1, textureBindGroup);
    passEncoder.drawIndexed(this.billboardGeometry.indexCount, instanceCount, 0, 0, 0);
  }

  /**
   * Updates uniform buffer with view/projection and wind parameters
   */
  private updateUniforms(viewProjectionMatrix: Mat4, cameraPosition: Vec3): void {
    if (!this.device || !this.uniformBuffer) {
      return;
    }

    const data = new Float32Array(28); // 112 bytes / 4 = 28 floats
    let offset = 0;

    // View-projection matrix (64 bytes = 16 floats)
    for (let i = 0; i < 16; i++) {
      data[offset++] = viewProjectionMatrix[i] ?? 0;
    }

    // Camera position (16 bytes = 4 floats: vec3 + padding)
    data[offset++] = cameraPosition[0];
    data[offset++] = cameraPosition[1];
    data[offset++] = cameraPosition[2];
    data[offset++] = 0; // padding

    // Wind params (16 bytes = 4 floats)
    data[offset++] = this.config.windGlobalStrength;
    data[offset++] = this.config.windGlobalFrequency;
    data[offset++] = this.currentTime;
    data[offset++] = 0; // padding

    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  /**
   * Sets billboard texture for rendering
   */
  setBillboardTexture(texture: GPUTexture): void {
    this.billboardTexture = texture;
  }

  /**
   * Simple hash function for position-based random values
   */
  private hashPosition(pos: Vec3): number {
    return Math.floor(pos[0] * 73856093) ^
           Math.floor(pos[1] * 19349663) ^
           Math.floor(pos[2] * 83492791);
  }

  /**
   * Disposes all GPU resources
   */
  dispose(): void {
    if (!this.initialized) {
      return;
    }

    this.billboardGeometry?.vertexBuffer.destroy();
    this.billboardGeometry?.indexBuffer.destroy();
    this.uniformBuffer?.destroy();
    this.billboardTexture?.destroy();
    this.defaultWhiteTexture?.destroy();
    
    // Dispose cached textures
    for (const texture of this.textureCache.values()) {
      texture.destroy();
    }
    this.textureCache.clear();
    this.pendingTextureLoads.clear();

    // Dispose buffer pool
    this.bufferPool.position?.destroy();
    this.bufferPool.scale?.destroy();
    this.bufferPool.wind?.destroy();
    this.bufferPool.color?.destroy();

    // Dispose 3D model buffer pool
    this.model3DBufferPool.transform?.destroy();
    this.model3DBufferPool.color?.destroy();

    // Dispose 3D model geometries
    for (const geometry of this.modelGeometries.values()) {
      geometry.vertexBuffer.destroy();
      geometry.indexBuffer.destroy();
      if (geometry.lodLevels) {
        for (const lod of geometry.lodLevels.values()) {
          lod.vertexBuffer.destroy();
          lod.indexBuffer.destroy();
        }
      }
    }

    this.billboardGeometry = null;
    this.billboardPipeline = null;
    this.model3DPipeline = null;
    this.uniformBuffer = null;
    this.billboardTexture = null;
    this.billboardSampler = null;
    this.defaultWhiteTexture = null;
    this.bufferPool = { maxSize: 0 };
    this.model3DBufferPool = { maxSize: 0 };
    this.modelGeometries.clear();
    this.lodManager?.dispose();
    this.lodManager = null;
    this.initialized = false;
  }
}


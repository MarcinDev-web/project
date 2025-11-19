/**
 * Forward+ Lighting System
 * 
 * Tiled light culling using compute shaders for efficient multi-light rendering.
 * Groups lights into tiles and culls them per-tile for better performance.
 */
import type { Mat4, Vec3 } from '@engine/core/math';

/**
 * Light data structure matching GPU layout.
 */
export interface PointLight {
  position: Vec3;
  color: Vec3;
  range: number;
  intensity: number;
}

/**
 * Forward+ lighting system.
 */
export class ForwardPlus {
  private device: GPUDevice;
  private tileSize = 16; // 16x16 tiles
  private lightCullPipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private lightBuffer: GPUBuffer | null = null;
  private lightIndexBuffer: GPUBuffer | null = null;
  private lightGridBuffer: GPUBuffer | null = null;
  private maxLights = 256;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Initializes Forward+ resources.
   */
  private initialize(): void {
    if (this.lightCullPipeline) return;

    // Create buffers
    if (!this.lightBuffer) {
      this.lightBuffer = this.device.createBuffer({
        label: 'forward-plus-lights',
        size: this.maxLights * 32, // vec3 pos + f32 range + vec3 color + f32 intensity = 32 bytes
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    if (!this.lightIndexBuffer) {
      this.lightIndexBuffer = this.device.createBuffer({
        label: 'forward-plus-light-indices',
        size: this.maxLights * 1024 * 4, // Max lights per tile * max tiles * u32
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    if (!this.lightGridBuffer) {
      this.lightGridBuffer = this.device.createBuffer({
        label: 'forward-plus-light-grid',
        size: 1024 * 1024 * 8, // Max tiles * 2 u32 (offset + count)
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'forward-plus-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // View-projection
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // Lights
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // Light indices
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // Light grid
        ],
      });
    }

    const shader = this.device.createShaderModule({
      label: 'forward-plus-cull-shader',
      code: `
        struct Light {
          position: vec3<f32>,
          range: f32,
          color: vec3<f32>,
          intensity: f32,
        }

        struct Uniforms {
          projectionMatrix: mat4x4<f32>,
          viewMatrix: mat4x4<f32>,
          cameraPos: vec3<f32>,
          screenWidth: f32,
          screenHeight: f32,
          lightCount: u32,
          _pad0: u32,
          _pad1: u32,
        }

        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        @group(0) @binding(1) var<storage, read> lights: array<Light>;
        @group(0) @binding(2) var<storage, read_write> lightIndices: array<atomic<u32>>;
        @group(0) @binding(3) var<storage, read_write> lightGrid: array<vec2<u32>>; // offset, count

        // Creates a plane passing through origin and two points (in View Space)
        // Normal points "inward" relative to the winding order of p1 -> p2
        fn createPlane(p1: vec3<f32>, p2: vec3<f32>) -> vec3<f32> {
          return normalize(cross(p1, p2));
        }

        @compute @workgroup_size(16, 16, 1)
        fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
          let tileX = globalId.x;
          let tileY = globalId.y;
          let tileSize = 16u;
          
          let tilesX = u32(ceil(uniforms.screenWidth / f32(tileSize)));
          let tilesY = u32(ceil(uniforms.screenHeight / f32(tileSize)));
          
          if (tileX >= tilesX || tileY >= tilesY) {
            return;
          }
          
          let tileIndex = tileY * tilesX + tileX;
          
          // 1. Calculate Tile Bounds in NDC [-1, 1]
          let screenWidth = uniforms.screenWidth;
          let screenHeight = uniforms.screenHeight;
          
          let minX = (f32(tileX * tileSize) / screenWidth) * 2.0 - 1.0;
          let maxX = (f32((tileX + 1) * tileSize) / screenWidth) * 2.0 - 1.0;
          // Flip Y for NDC (top is +1 in some systems, but here we map 0..H to +1..-1 usually)
          // Standard WebGPU NDC: Y is up (+1), down (-1). Screen: Y is down.
          let minY = 1.0 - (f32((tileY + 1) * tileSize) / screenHeight) * 2.0;
          let maxY = 1.0 - (f32(tileY * tileSize) / screenHeight) * 2.0;
          
          // 2. Unproject to View Space (at Z = -1.0)
          // P00 = 1/(aspect*tan(fov/2)), P11 = 1/tan(fov/2)
          let p00 = uniforms.projectionMatrix[0][0];
          let p11 = uniforms.projectionMatrix[1][1];
          
          // View space direction vectors (Z = -1.0)
          let viewBL = vec3<f32>(minX / p00, minY / p11, -1.0);
          let viewBR = vec3<f32>(maxX / p00, minY / p11, -1.0);
          let viewTR = vec3<f32>(maxX / p00, maxY / p11, -1.0);
          let viewTL = vec3<f32>(minX / p00, maxY / p11, -1.0);
          
          // 3. Create Frustum Planes (Normals pointing inward)
          let planeLeft   = createPlane(viewTL, viewBL);
          let planeRight  = createPlane(viewBR, viewTR);
          let planeBottom = createPlane(viewBL, viewBR);
          let planeTop    = createPlane(viewTR, viewTL);
          
          var lightCount = 0u;
          let maxLightsPerTile = 256u;
          
          for (var i = 0u; i < uniforms.lightCount && lightCount < maxLightsPerTile; i++) {
            let light = lights[i];
            
            // Transform light to View Space
            let viewPos4 = uniforms.viewMatrix * vec4<f32>(light.position, 1.0);
            let viewPos = viewPos4.xyz;
            let r = light.range;
            
            var visible = true;
            
            // Near plane check (approximate)
            if (viewPos.z - r > -0.1) { visible = false; }
            
            // Plane checks: dot(N, P) < -r means sphere is fully outside
            if (visible && dot(planeLeft, viewPos)   < -r) { visible = false; }
            if (visible && dot(planeRight, viewPos)  < -r) { visible = false; }
            if (visible && dot(planeTop, viewPos)    < -r) { visible = false; }
            if (visible && dot(planeBottom, viewPos) < -r) { visible = false; }
            
            if (visible) {
              let index = atomicAdd(&lightIndices[tileIndex * maxLightsPerTile + lightCount], 1u);
              if (index < maxLightsPerTile - 1u) {
                lightIndices[tileIndex * maxLightsPerTile + index] = i;
                lightCount++;
              }
            }
          }
          
          // Store light grid
          lightGrid[tileIndex] = vec2<u32>(tileIndex * maxLightsPerTile, lightCount);
        }
      `,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'forward-plus-pl',
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.lightCullPipeline = this.device.createComputePipeline({
      label: 'forward-plus-cull-pipeline',
      layout: pipelineLayout,
      compute: { module: shader, entryPoint: 'main' },
    });
  }

  /**
   * Updates light data.
   */
  updateLights(lights: PointLight[]): void {
    if (!this.lightBuffer) return;
    
    const lightData = new Float32Array(this.maxLights * 8);
    for (let i = 0; i < Math.min(lights.length, this.maxLights); i++) {
      const light = lights[i]!;
      const offset = i * 8;
      lightData[offset + 0] = light.position[0];
      lightData[offset + 1] = light.position[1];
      lightData[offset + 2] = light.position[2];
      lightData[offset + 3] = light.range;
      lightData[offset + 4] = light.color[0];
      lightData[offset + 5] = light.color[1];
      lightData[offset + 6] = light.color[2];
      lightData[offset + 7] = light.intensity;
    }
    
    this.device.queue.writeBuffer(this.lightBuffer, 0, lightData);
  }

  /**
   * Performs light culling.
   * 
   * @param encoder - Command encoder
   * @param viewProjectionMatrix - View-projection matrix
   * @param viewMatrix - View matrix
   * @param cameraPos - Camera position
   * @param screenWidth - Screen width
   * @param screenHeight - Screen height
   * @param lightCount - Number of lights
   */
  cullLights(
    encoder: GPUCommandEncoder,
    projectionMatrix: Mat4,
    viewMatrix: Mat4,
    cameraPos: Vec3,
    screenWidth: number,
    screenHeight: number,
    lightCount: number
  ): void {
    this.initialize();
    if (!this.lightCullPipeline || !this.lightBuffer || !this.lightIndexBuffer || !this.lightGridBuffer) return;

    // Create uniform buffer with correct layout
    // struct Uniforms {
    //   projectionMatrix: mat4x4<f32>, // 0-64
    //   viewMatrix: mat4x4<f32>,       // 64-128
    //   cameraPos: vec3<f32>,          // 128-140
    //   screenWidth: f32,              // 140-144
    //   screenHeight: f32,             // 144-148
    //   lightCount: u32,               // 148-152
    // }
    const uniformData = new Float32Array(40); // 160 bytes
    uniformData.set(projectionMatrix, 0);
    uniformData.set(viewMatrix, 16);
    uniformData[32] = cameraPos[0];
    uniformData[33] = cameraPos[1];
    uniformData[34] = cameraPos[2];
    uniformData[35] = screenWidth;
    uniformData[36] = screenHeight;
    const uintView = new Uint32Array(uniformData.buffer);
    uintView[37] = lightCount;
    
    const uniformBuffer = this.device.createBuffer({
      label: 'forward-plus-uniforms',
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Clear light indices and grid
    const clearData = new Uint32Array(this.maxLights * 1024);
    this.device.queue.writeBuffer(this.lightIndexBuffer, 0, clearData);
    const clearGrid = new Uint32Array(1024 * 1024 * 2);
    this.device.queue.writeBuffer(this.lightGridBuffer, 0, clearGrid);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      label: 'forward-plus-bg',
      layout: this.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: this.lightBuffer } },
        { binding: 2, resource: { buffer: this.lightIndexBuffer } },
        { binding: 3, resource: { buffer: this.lightGridBuffer } },
      ],
    });

    // Dispatch compute pass
    const pass = encoder.beginComputePass({ label: 'forward-plus-cull' });
    pass.setPipeline(this.lightCullPipeline);
    pass.setBindGroup(0, bindGroup);
    
    const tilesX = Math.ceil(screenWidth / this.tileSize);
    const tilesY = Math.ceil(screenHeight / this.tileSize);
    pass.dispatchWorkgroups(tilesX, tilesY, 1);
    pass.end();
  }

  /**
   * Gets the light grid buffer (for binding in fragment shader).
   */
  getLightGridBuffer(): GPUBuffer | null {
    return this.lightGridBuffer;
  }

  /**
   * Gets the light index buffer (for binding in fragment shader).
   */
  getLightIndexBuffer(): GPUBuffer | null {
    return this.lightIndexBuffer;
  }

  /**
   * Gets the light buffer (for binding in fragment shader).
   */
  getLightBuffer(): GPUBuffer | null {
    return this.lightBuffer;
  }

  /**
   * Disposes resources.
   */
  dispose(): void {
    try {
      this.lightBuffer?.destroy();
      this.lightIndexBuffer?.destroy();
      this.lightGridBuffer?.destroy();
    } catch {
      // ignore
    }
    this.lightBuffer = null;
    this.lightIndexBuffer = null;
    this.lightGridBuffer = null;
    this.lightCullPipeline = null;
    this.bindGroupLayout = null;
  }
}


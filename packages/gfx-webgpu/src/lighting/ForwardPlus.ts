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
          viewProjection: mat4x4<f32>,
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

        fn computeTileFrustum(tileX: u32, tileY: u32, tileSize: u32) -> array<vec4<f32>, 4> {
          // Simplified: use view-projection inverse (passed as uniform)
          // For now, compute tile bounds in screen space and convert to view space
          let screenWidth = uniforms.screenWidth;
          let screenHeight = uniforms.screenHeight;
          
          // Compute tile corners in NDC [-1, 1]
          let minX = (f32(tileX * tileSize) / screenWidth) * 2.0 - 1.0;
          let maxX = (f32((tileX + 1) * tileSize) / screenWidth) * 2.0 - 1.0;
          let minY = 1.0 - (f32((tileY + 1) * tileSize) / screenHeight) * 2.0;
          let maxY = 1.0 - (f32(tileY * tileSize) / screenHeight) * 2.0;
          
          // Use near and far plane Z for depth bounds
          let nearZ = -1.0;
          let farZ = 1.0;
          
          // Create corners in NDC, then transform (simplified - just use depth bounds)
          let corners = array<vec4<f32>, 4>(
            vec4<f32>(minX, minY, nearZ, 1.0),
            vec4<f32>(maxX, minY, nearZ, 1.0),
            vec4<f32>(maxX, maxY, farZ, 1.0),
            vec4<f32>(minX, maxY, farZ, 1.0)
          );
          
          return corners;
        }

        fn testLightSphere(lightPos: vec3<f32>, lightRange: f32, plane: vec4<f32>) -> bool {
          let dist = dot(vec4<f32>(lightPos, 1.0), plane);
          return dist >= -lightRange;
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
          
          // Compute tile frustum
          let corners = computeTileFrustum(tileX, tileY, tileSize);
          
          // Compute tile bounds in NDC
          let screenWidth = uniforms.screenWidth;
          let screenHeight = uniforms.screenHeight;
          let minX = (f32(tileX * tileSize) / screenWidth) * 2.0 - 1.0;
          let maxX = (f32((tileX + 1) * tileSize) / screenWidth) * 2.0 - 1.0;
          let minY = 1.0 - (f32((tileY + 1) * tileSize) / screenHeight) * 2.0;
          let maxY = 1.0 - (f32(tileY * tileSize) / screenHeight) * 2.0;
          
          // Cull lights for this tile (simplified frustum culling)
          var lightCount = 0u;
          let maxLightsPerTile = 256u;
          
          // Compute tile center in screen space
          let tileCenterX = (minX + maxX) * 0.5;
          let tileCenterY = (minY + maxY) * 0.5;
          
          for (var i = 0u; i < uniforms.lightCount && lightCount < maxLightsPerTile; i++) {
            let light = lights[i];
            let lightPos = light.position;
            let lightRange = light.range;
            
            // Transform light to view space
            let viewLightPos = uniforms.viewMatrix * vec4<f32>(lightPos, 1.0);
            let viewLight = viewLightPos.xyz / max(viewLightPos.w, 1e-6);
            
            // Simple visibility test: check if light sphere intersects view frustum
            // For simplicity, just check if light is within reasonable bounds
            var visible = true;
            
            // Check depth range (simplified)
            if (viewLight.z < -200.0 || viewLight.z > 2000.0) {
              visible = false;
            }
            
            // Check if light is within range of tile (simplified)
            if (visible) {
              // Project light to screen space (simplified)
              let screenPos = uniforms.viewProjection * vec4<f32>(lightPos, 1.0);
              let screen = screenPos.xy / max(screenPos.w, 1e-6);
              
              // Check if light sphere overlaps tile
              let distToTileCenter = length(screen - vec2<f32>(tileCenterX, tileCenterY));
              if (distToTileCenter > lightRange * 0.1 + 0.5) { // Rough estimate
                visible = false;
              }
            }
            
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
    viewProjectionMatrix: Mat4,
    viewMatrix: Mat4,
    cameraPos: Vec3,
    screenWidth: number,
    screenHeight: number,
    lightCount: number
  ): void {
    this.initialize();
    if (!this.lightCullPipeline || !this.lightBuffer || !this.lightIndexBuffer || !this.lightGridBuffer) return;

    // Create uniform buffer
    const uniforms = new Float32Array(20); // 16 (mat4) + 3 (vec3) + 1 (f32) + 4 (u32/f32)
    uniforms.set(viewProjectionMatrix, 0);
    uniforms.set(viewMatrix, 16);
    uniforms[28] = cameraPos[0];
    uniforms[29] = cameraPos[1];
    uniforms[30] = cameraPos[2];
    uniforms[31] = screenWidth;
    uniforms[32] = screenHeight;
    uniforms[33] = lightCount;
    
    const uniformBuffer = this.device.createBuffer({
      label: 'forward-plus-uniforms',
      size: uniforms.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniforms);

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


/**
 * Screen-Space LOD System
 * 
 * Selects LOD levels based on screen-space size (how large objects appear on screen).
 * Uses compute shaders for efficient per-instance selection with hysteresis to prevent flickering.
 */
import type { Mat4, Vec3 } from '@engine/core/math';
import { Logger } from '@engine/core/utils';

/**
 * LOD selection result for an instance.
 */
export interface LODSelection {
  instanceIndex: number;
  lodLevel: number;
  screenSize: number; // Screen-space size (pixels or normalized)
}

/**
 * LOD configuration per level.
 */
export interface LODLevelConfig {
  /** Minimum screen-space size (in pixels) to use this LOD */
  minScreenSize: number;
  /** Maximum screen-space size for this LOD (in pixels) */
  maxScreenSize: number;
  /** Hysteresis threshold (in pixels) - how much larger/smaller before switching */
  hysteresis: number;
}

/**
 * Screen-space LOD system using compute shaders.
 */
export class ScreenSpaceLOD {
  private device: GPUDevice;
  private cullPipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private lodBuffer: GPUBuffer | null = null;
  private previousLODBuffer: GPUBuffer | null = null;
  private screenSizeBuffer: GPUBuffer | null = null;
  private maxInstances = 10000;
  private lodLevels: LODLevelConfig[] = [];

  constructor(device: GPUDevice) {
    this.device = device;
    // Default LOD levels (screen size in pixels)
    // LOD 0 = highest detail, LOD 3 = lowest detail
    this.lodLevels = [
      { minScreenSize: 0, maxScreenSize: 10, hysteresis: 2.0 }, // LOD 3 (lowest detail)
      { minScreenSize: 10, maxScreenSize: 30, hysteresis: 4.0 }, // LOD 2
      { minScreenSize: 30, maxScreenSize: 80, hysteresis: 8.0 }, // LOD 1
      { minScreenSize: 80, maxScreenSize: Infinity, hysteresis: 16.0 }, // LOD 0 (highest detail)
    ];
  }

  /**
   * Sets LOD level configurations.
   */
  setLODLevels(levels: LODLevelConfig[]): void {
    this.lodLevels = levels;
  }

  /**
   * Gets current LOD level configurations.
   */
  getLODLevels(): Readonly<LODLevelConfig[]> {
    return this.lodLevels;
  }

  /**
   * Initializes compute resources.
   */
  private initialize(): void {
    if (this.cullPipeline) return;

    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'screen-lod-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // View-projection + params
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // Instance positions
          { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // Instance scales
          { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // Screen sizes (output)
          { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // LOD selections (output)
          { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // Previous LOD (for hysteresis)
        ],
      });
    }

    const shader = this.device.createShaderModule({
      label: 'screen-lod-shader',
      code: `
        struct LODParams {
          viewProjection: mat4x4<f32>,
          cameraPos: vec3<f32>,
          screenWidth: f32,
          screenHeight: f32,
          nearPlane: f32,
          lodLevel0Size: f32,
          lodLevel1Size: f32,
          lodLevel2Size: f32,
          lodLevel3Size: f32,
          hysteresis0: f32,
          hysteresis1: f32,
          hysteresis2: f32,
          hysteresis3: f32,
          instanceCount: u32,
          _pad0: u32,
          _pad1: u32,
        }

        @group(0) @binding(0) var<uniform> params: LODParams;
        @group(0) @binding(1) var<storage, read> instancePositions: array<vec3<f32>>;
        @group(0) @binding(2) var<storage, read> instanceScales: array<f32>;
        @group(0) @binding(3) var<storage, read_write> screenSizes: array<f32>;
        @group(0) @binding(4) var<storage, read_write> lodSelections: array<u32>;
        @group(0) @binding(5) var<storage, read> previousLOD: array<u32>;

        fn computeScreenSize(worldPos: vec3<f32>, scale: f32) -> f32 {
          // Transform to clip space
          let clipPos = params.viewProjection * vec4<f32>(worldPos, 1.0);
          let ndc = clipPos.xyz / max(clipPos.w, 1e-6);
          
          // Project to screen space
          let screenX = (ndc.x * 0.5 + 0.5) * params.screenWidth;
          let screenY = (1.0 - (ndc.y * 0.5 + 0.5)) * params.screenHeight;
          
          // Estimate screen-space size based on bounding box
          // For a unit cube at this distance, what size would it be?
          let distance = length(worldPos - params.cameraPos);
          let worldSize = scale;
          let screenSize = (worldSize / max(distance, 1e-6)) * params.screenHeight * 0.5;
          
          return screenSize;
        }

        fn selectLODWithHysteresis(screenSize: f32, previousLOD: u32) -> u32 {
          // LOD 0 (highest detail): screenSize >= 80
          // LOD 1: 30 <= screenSize < 80
          // LOD 2: 10 <= screenSize < 30
          // LOD 3 (lowest detail): screenSize < 10
          
          // Apply hysteresis to prevent flickering
          let lod0Min = params.lodLevel0Size - params.hysteresis0;
          let lod1Min = params.lodLevel1Size - params.hysteresis1;
          let lod1Max = params.lodLevel1Size + params.hysteresis1;
          let lod2Min = params.lodLevel2Size - params.hysteresis2;
          let lod2Max = params.lodLevel2Size + params.hysteresis2;
          let lod3Max = params.lodLevel3Size + params.hysteresis3;
          
          // If we're moving up in detail (screen size increasing), use lower thresholds
          // If we're moving down in detail (screen size decreasing), use higher thresholds
          if (previousLOD == 0u) {
            // Currently at highest detail - need larger size to stay
            if (screenSize >= lod0Min) {
              return 0u;
            } else if (screenSize >= lod1Min) {
              return 1u;
            } else if (screenSize >= lod2Min) {
              return 2u;
            } else {
              return 3u;
            }
          } else if (previousLOD == 1u) {
            // Currently at LOD 1
            if (screenSize >= lod1Max) {
              return 0u;
            } else if (screenSize >= lod2Min) {
              return 1u;
            } else if (screenSize < lod2Min) {
              return 2u;
            } else {
              return 1u;
            }
          } else if (previousLOD == 2u) {
            // Currently at LOD 2
            if (screenSize >= lod2Max) {
              return 1u;
            } else if (screenSize >= lod3Max) {
              return 2u;
            } else {
              return 3u;
            }
          } else {
            // Currently at LOD 3 (lowest)
            if (screenSize >= lod3Max) {
              return 2u;
            } else {
              return 3u;
            }
          }
        }

        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
          let instanceIndex = globalId.x;
          
          if (instanceIndex >= params.instanceCount) {
            return;
          }
          
          let position = instancePositions[instanceIndex];
          let scale = instanceScales[instanceIndex];
          let screenSize = computeScreenSize(position, scale);
          screenSizes[instanceIndex] = screenSize;
          
          // Get previous LOD for hysteresis
          let prevLOD = previousLOD[instanceIndex];
          
          // Select LOD with hysteresis
          let lod = selectLODWithHysteresis(screenSize, prevLOD);
          lodSelections[instanceIndex] = lod;
        }
      `,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'screen-lod-pl',
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.cullPipeline = this.device.createComputePipeline({
      label: 'screen-lod-pipeline',
      layout: pipelineLayout,
      compute: { module: shader, entryPoint: 'main' },
    });
  }

  /**
   * Performs screen-space LOD selection.
   * 
   * @param encoder - Command encoder
   * @param viewProjectionMatrix - View-projection matrix
   * @param cameraPos - Camera position
   * @param screenWidth - Screen width in pixels
   * @param screenHeight - Screen height in pixels
   * @param instancePositions - Buffer containing instance positions (vec3)
   * @param instanceScales - Buffer containing instance scales (f32), or null to use default (1.0)
   * @param instanceCount - Number of instances
   * @param nearPlane - Near plane distance
   * @returns Buffer containing LOD selections (array of u32)
   */
  selectLOD(
    encoder: GPUCommandEncoder,
    viewProjectionMatrix: Mat4,
    cameraPos: Vec3,
    screenWidth: number,
    screenHeight: number,
    instancePositions: GPUBuffer,
    instanceScales: GPUBuffer | null,
    instanceCount: number,
    nearPlane = 0.1
  ): GPUBuffer {
    this.initialize();
    if (!this.cullPipeline || !this.bindGroupLayout) {
      throw new Error('Screen-space LOD not initialized');
    }

    // Ensure buffers are large enough
    const bufferSize = Math.max(instanceCount, this.maxInstances);
    
    if (!this.screenSizeBuffer || this.screenSizeBuffer.size < bufferSize * 4) {
      this.screenSizeBuffer?.destroy();
      this.screenSizeBuffer = this.device.createBuffer({
        label: 'screen-lod-sizes',
        size: bufferSize * 4, // f32 per instance
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
    }

    if (!this.lodBuffer || this.lodBuffer.size < bufferSize * 4) {
      this.lodBuffer?.destroy();
      this.lodBuffer = this.device.createBuffer({
        label: 'screen-lod-selections',
        size: bufferSize * 4, // u32 per instance
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
    }

    if (!this.previousLODBuffer || this.previousLODBuffer.size < bufferSize * 4) {
      this.previousLODBuffer?.destroy();
      this.previousLODBuffer = this.device.createBuffer({
        label: 'screen-lod-previous',
        size: bufferSize * 4, // u32 per instance
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
    }

    // Copy current LOD to previous (for next frame hysteresis)
    if (this.lodBuffer && this.previousLODBuffer) {
      encoder.copyBufferToBuffer(
        this.lodBuffer,
        0,
        this.previousLODBuffer,
        0,
        Math.min(this.lodBuffer.size, this.previousLODBuffer.size)
      );
    }

    // Create uniform buffer with LOD parameters
    const lodParams = this.lodLevels;
    const uniformData = new Float32Array(64); // 16 (mat4) + 3 (vec3) + many floats
    uniformData.set(viewProjectionMatrix, 0);
    uniformData[16] = cameraPos[0];
    uniformData[17] = cameraPos[1];
    uniformData[18] = cameraPos[2];
    uniformData[19] = screenWidth;
    uniformData[20] = screenHeight;
    uniformData[21] = nearPlane;
    uniformData[22] = lodParams[0]?.maxScreenSize ?? 10;
    uniformData[23] = lodParams[1]?.maxScreenSize ?? 30;
    uniformData[24] = lodParams[2]?.maxScreenSize ?? 80;
    uniformData[25] = lodParams[3]?.maxScreenSize ?? 1000;
    uniformData[26] = lodParams[0]?.hysteresis ?? 2.0;
    uniformData[27] = lodParams[1]?.hysteresis ?? 4.0;
    uniformData[28] = lodParams[2]?.hysteresis ?? 8.0;
    uniformData[29] = lodParams[3]?.hysteresis ?? 16.0;
    uniformData[30] = instanceCount;
    
    const uniformBuffer = this.device.createBuffer({
      label: 'screen-lod-uniforms',
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Create scale buffer if needed (extract from instance data)
    // For now, assume instanceScales buffer exists or create a default one
    let scaleBuffer = instanceScales;
    if (!scaleBuffer) {
      // Create default scale buffer (all 1.0)
      const defaultScales = new Float32Array(instanceCount).fill(1.0);
      scaleBuffer = this.device.createBuffer({
        label: 'screen-lod-default-scales',
        size: defaultScales.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(scaleBuffer, 0, defaultScales);
    }

    const bindGroup = this.device.createBindGroup({
      label: 'screen-lod-bg',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: instancePositions } },
        { binding: 2, resource: { buffer: scaleBuffer } },
        { binding: 3, resource: { buffer: this.screenSizeBuffer } },
        { binding: 4, resource: { buffer: this.lodBuffer } },
        { binding: 5, resource: { buffer: this.previousLODBuffer } },
      ],
    });

    // Dispatch compute pass
    const pass = encoder.beginComputePass({ label: 'screen-lod-select' });
    pass.setPipeline(this.cullPipeline);
    pass.setBindGroup(0, bindGroup);
    
    const workgroupCount = Math.ceil(instanceCount / 64);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();

    return this.lodBuffer;
  }

  /**
   * Gets the screen size buffer (for debugging).
   */
  getScreenSizeBuffer(): GPUBuffer | null {
    return this.screenSizeBuffer;
  }

  /**
   * Disposes resources.
   */
  dispose(): void {
    try {
      this.lodBuffer?.destroy();
      this.previousLODBuffer?.destroy();
      this.screenSizeBuffer?.destroy();
    } catch {
      // ignore
    }
    this.lodBuffer = null;
    this.previousLODBuffer = null;
    this.screenSizeBuffer = null;
    this.cullPipeline = null;
    this.bindGroupLayout = null;
  }
}


/**
 * GridRenderer - Renders a 3D grid for the editor.
 * Displays a Minecraft-style ground plane grid with configurable cell size and extent.
 */

import type { GridConfig } from './GridConfig';
import { DEFAULT_GRID_CONFIG, validateGridConfig } from './GridConfig';
import { Logger } from '../../utils/logger';
import { createGridShaderCode, GridShaderEntryPoint } from './GridShader';
import type { Mat4, Vec3 } from '@engine/core/math';

/**
 * Parsed color from hex string to RGBA [0-1]
 */
function parseColorHex(hex: string): Float32Array {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return new Float32Array([1, 1, 1, 1]); // fallback to white
  }
  return new Float32Array([
    Number.parseInt(result[1]!, 16) / 255,
    Number.parseInt(result[2]!, 16) / 255,
    Number.parseInt(result[3]!, 16) / 255,
    1.0,
  ]);
}

/**
 * GridRenderer manages the rendering of a 3D grid overlay.
 */
export class GridRenderer {
  private config: GridConfig;
  private device: GPUDevice | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private uniformBindGroup: GPUBindGroup | null = null;
  private visible = true;

  constructor(config: Partial<GridConfig> = {}) {
    this.config = { ...DEFAULT_GRID_CONFIG, ...config };
    const validationErrors = validateGridConfig(this.config);
    if (validationErrors.length > 0) {
      Logger.warn('Grid config validation errors:', new Error(validationErrors.join(', ')));
    }
    this.visible = this.config.visible;
  }

  /**
   * Initializes GPU resources for grid rendering.
   * @param device - WebGPU device
   * @param format - Canvas texture format
   * @param depthFormat - Depth texture format
   */
  async initialize(
    device: GPUDevice,
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat
  ): Promise<void> {
    try {
      this.device = device;

      // Create shader module
      const shaderModule = device.createShaderModule({
        label: 'Grid Shader Module',
        code: createGridShaderCode(),
      });

      // Uniform buffer size: 256 bytes (aligned)
      // Layout:
      // 0-64: ViewProjection Matrix
      // 64-76: Eye Position
      // 80-192: Grid Params & Colors
      this.uniformBuffer = device.createBuffer({
        label: 'Grid Uniform Buffer',
        size: 256,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Create bind group layout
      const bindGroupLayout = device.createBindGroupLayout({
        label: 'Grid Bind Group Layout',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' },
          },
        ],
      });

      // Create bind group
      this.uniformBindGroup = device.createBindGroup({
        label: 'Grid Bind Group',
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      });

      // Create render pipeline for infinite grid (quad)
      this.pipeline = device.createRenderPipeline({
        label: 'Grid Render Pipeline',
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        }),
        vertex: {
          module: shaderModule,
          entryPoint: GridShaderEntryPoint.VERTEX,
          buffers: [], // No vertex buffers, we generate quad in shader
        },
        fragment: {
          module: shaderModule,
          entryPoint: GridShaderEntryPoint.FRAGMENT,
          targets: [{
            format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          }],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none',
        },
        depthStencil: {
          depthWriteEnabled: false,
          depthCompare: 'less-equal',
          format: depthFormat,
        },
        multisample: {
          count: 4, // Match MSAA from main renderer
        },
      });

      // Initialize uniforms
      this.updateUniforms();
    } catch (error) {
      Logger.error('Failed to initialize grid renderer:', error as unknown as Error);
      this.dispose();
      throw error;
    }
  }

  /**
   * Updates uniform buffer with current config and eye position.
   */
  private updateUniforms(eyePosition: Vec3 | Float32Array | number[] = [0, 0, 0]): void {
    if (!this.device || !this.uniformBuffer) return;

    const {
      cellSize,
      fadeDistance = 100,
      majorLineInterval,
      colors,
      axisColors,
      lineWidth
    } = this.config;

    // Create data buffer for everything except ViewProjection (which is updated per-frame)
    // Starting at offset 64 (16 floats)
    const data = new Float32Array(48); // 192 bytes -> 48 floats
    
    // EyePos at local index 0 (offset 64 in buffer)
    data[0] = eyePosition[0];
    data[1] = eyePosition[1];
    data[2] = eyePosition[2];
    // padding at 3
    
    // Params at local index 4 (offset 80)
    data[4] = cellSize;
    data[5] = fadeDistance;
    data[6] = majorLineInterval;
    data[7] = lineWidth.minor;
    
    // Params at local index 8 (offset 96)
    data[8] = lineWidth.major;
    // padding 9, 10, 11
    
    // Colors starting at local index 12 (offset 112)
    const minor = parseColorHex(colors.minorLine);
    const major = parseColorHex(colors.majorLine);
    const axisX = parseColorHex(axisColors?.x || '#e95959');
    const axisZ = parseColorHex(axisColors?.z || '#5959e9');
    const origin = parseColorHex(colors.origin);

    data.set(minor, 12);
    data.set(major, 16);
    data.set(axisX, 20);
    data.set(axisZ, 24);
    data.set(origin, 28);

    // Write to buffer at offset 64
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      64,
      data.buffer,
      0,
      data.byteLength
    );
  }

  /**
   * Renders the grid.
   * @param passEncoder - Render pass encoder
   * @param viewProjectionMatrix - Combined view-projection matrix
   * @param eyePosition - Camera world position (optional, defaults to 0,0,0)
   */
  render(
    passEncoder: GPURenderPassEncoder, 
    viewProjectionMatrix: Mat4 | Float32Array, 
    eyePosition?: Vec3 | Float32Array | number[]
  ): void {
    if (!this.visible || !this.pipeline || !this.uniformBindGroup) {
      return;
    }

    if (!this.device || !this.uniformBuffer) {
      return;
    }

    // Update ViewProjection Matrix (Offset 0)
    const vpBuffer = viewProjectionMatrix instanceof Float32Array 
      ? viewProjectionMatrix 
      : (viewProjectionMatrix as any).buffer;
      
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      vpBuffer,
      (viewProjectionMatrix as any).byteOffset || 0,
      64
    );

    // Update other uniforms if eye position is provided
    if (eyePosition) {
      this.updateUniforms(eyePosition);
    }

    // Draw full-screen quad (6 vertices) which is transformed in vertex shader
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.uniformBindGroup);
    passEncoder.draw(6, 1, 0, 0);
  }

  /**
   * Updates grid configuration.
   */
  setConfig(config: Partial<GridConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.visible !== undefined) {
      this.visible = config.visible;
    }
    this.updateUniforms();
  }

  /**
   * Shows the grid.
   */
  show(): void {
    this.visible = true;
  }

  /**
   * Hides the grid.
   */
  hide(): void {
    this.visible = false;
  }

  /**
   * Sets grid visibility.
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  /**
   * Gets current visibility state.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Cleans up GPU resources.
   */
  dispose(): void {
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
    this.pipeline = null;
    this.uniformBindGroup = null;
    this.device = null;
  }
}

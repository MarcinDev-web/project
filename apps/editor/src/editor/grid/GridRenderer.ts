/**
 * GridRenderer - Renders a 3D grid for the editor.
 * Displays a Minecraft-style ground plane grid with configurable cell size and extent.
 */

import type { GridConfig } from './GridConfig';
import { DEFAULT_GRID_CONFIG, validateGridConfig } from './GridConfig';
import { Logger } from '../../utils/logger';
import { createGridShaderCode, GridShaderEntryPoint } from './GridShader';
import type { Mat4 } from '@engine/core/math';

/**
 * Grid line vertex: position (vec3) + color (vec4)
 */
interface GridVertex {
  position: [number, number, number];
  color: [number, number, number, number];
}

/**
 * Parsed color from hex string to RGBA [0-1]
 */
function parseColorHex(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return [1, 1, 1, 1]; // fallback to white
  }
  return [
    Number.parseInt(result[1]!, 16) / 255,
    Number.parseInt(result[2]!, 16) / 255,
    Number.parseInt(result[3]!, 16) / 255,
    1.0,
  ];
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
  private vertexBuffer: GPUBuffer | null = null;
  private vertexCount = 0;
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

      // Create uniform buffer (4x4 matrix = 64 bytes)
      this.uniformBuffer = device.createBuffer({
        label: 'Grid Uniform Buffer',
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Create bind group layout
      const bindGroupLayout = device.createBindGroupLayout({
        label: 'Grid Bind Group Layout',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
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

      // Create render pipeline for line rendering
      this.pipeline = device.createRenderPipeline({
        label: 'Grid Render Pipeline',
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        }),
        vertex: {
          module: shaderModule,
          entryPoint: GridShaderEntryPoint.VERTEX,
          buffers: [
            {
              arrayStride: 7 * 4, // 3 floats (position) + 4 floats (color)
              attributes: [
                {
                  shaderLocation: 0, // position
                  offset: 0,
                  format: 'float32x3',
                },
                {
                  shaderLocation: 1, // color
                  offset: 12,
                  format: 'float32x4',
                },
              ],
            },
          ],
        },
        fragment: {
          module: shaderModule,
          entryPoint: GridShaderEntryPoint.FRAGMENT,
          targets: [{ format }],
        },
        primitive: {
          topology: 'line-list',
          cullMode: 'none',
        },
        depthStencil: {
          depthWriteEnabled: false, // Grid doesn't write depth
          depthCompare: 'less-equal',
          format: depthFormat,
        },
        multisample: {
          count: 4, // Match MSAA from main renderer
        },
      });

      // Generate grid geometry
      this.updateGridGeometry();
    } catch (error) {
      Logger.error('Failed to initialize grid renderer:', error as unknown as Error);
      // Clean up partially created GPU resources
      if (this.vertexBuffer) {
        this.vertexBuffer.destroy();
        this.vertexBuffer = null;
      }
      if (this.uniformBuffer) {
        this.uniformBuffer.destroy();
        this.uniformBuffer = null;
      }
      this.pipeline = null;
      this.uniformBindGroup = null;
      // keep this.device to allow retry
      throw error;
    }
  }

  /**
   * Generates grid line geometry based on current configuration.
   */
  private updateGridGeometry(): void {
    if (!this.device) return;

    const vertices = this.generateGridVertices();
    this.vertexCount = vertices.length;

    if (this.vertexCount === 0) {
      return;
    }

    // Pack vertices into Float32Array
    const vertexData = new Float32Array(this.vertexCount * 7);
    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i]!;
      const offset = i * 7;
      vertexData[offset + 0] = vertex.position[0];
      vertexData[offset + 1] = vertex.position[1];
      vertexData[offset + 2] = vertex.position[2];
      vertexData[offset + 3] = vertex.color[0];
      vertexData[offset + 4] = vertex.color[1];
      vertexData[offset + 5] = vertex.color[2];
      vertexData[offset + 6] = vertex.color[3];
    }

    // Create or recreate vertex buffer
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
    }

    this.vertexBuffer = this.device.createBuffer({
      label: 'Grid Vertex Buffer',
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexData);
    this.vertexBuffer.unmap();
  }

  /**
   * Generates grid line vertices based on configuration.
   */
  private generateGridVertices(): GridVertex[] {
    const vertices: GridVertex[] = [];
    const { cellSize, extent, planes, colors, majorLineInterval } = this.config;

    if (!planes.horizontal && !planes.vertical) {
      return vertices; // No grid to render
    }

    const minorColor = parseColorHex(colors.minorLine);
    const majorColor = parseColorHex(colors.majorLine);
    const originColor = parseColorHex(colors.origin);

    const halfExtent = extent * cellSize;
    const numLines = extent * 2 + 1;

    // Generate horizontal grid lines (XZ plane, Y=0)
    if (planes.horizontal) {
      // Lines parallel to X axis (varying Z)
      for (let i = 0; i < numLines; i++) {
        const z = (i - extent) * cellSize;
        const isMajor = i % majorLineInterval === extent % majorLineInterval;
        const isOrigin = Math.abs(z) < 0.001;

        const color = isOrigin ? originColor : isMajor ? majorColor : minorColor;

        vertices.push({
          position: [-halfExtent, 0, z],
          color,
        });
        vertices.push({
          position: [halfExtent, 0, z],
          color,
        });
      }

      // Lines parallel to Z axis (varying X)
      for (let i = 0; i < numLines; i++) {
        const x = (i - extent) * cellSize;
        const isMajor = i % majorLineInterval === extent % majorLineInterval;
        const isOrigin = Math.abs(x) < 0.001;

        const color = isOrigin ? originColor : isMajor ? majorColor : minorColor;

        vertices.push({
          position: [x, 0, -halfExtent],
          color,
        });
        vertices.push({
          position: [x, 0, halfExtent],
          color,
        });
      }
    }

    // Generate vertical grid lines (XY plane at Z=0 and YZ plane at X=0)
    if (planes.vertical) {
      // XY plane (Z=0)
      for (let i = 0; i < numLines; i++) {
        const y = (i - extent) * cellSize;
        const isMajor = i % majorLineInterval === extent % majorLineInterval;
        const isOrigin = Math.abs(y) < 0.001;
        const color = isOrigin ? originColor : isMajor ? majorColor : minorColor;

        // Lines parallel to X axis (varying Y)
        vertices.push({ position: [-halfExtent, y, 0], color });
        vertices.push({ position: [halfExtent, y, 0], color });
      }
      for (let i = 0; i < numLines; i++) {
        const x = (i - extent) * cellSize;
        const isMajor = i % majorLineInterval === extent % majorLineInterval;
        const isOrigin = Math.abs(x) < 0.001;
        const color = isOrigin ? originColor : isMajor ? majorColor : minorColor;

        // Lines parallel to Y axis (varying X)
        vertices.push({ position: [x, -halfExtent, 0], color });
        vertices.push({ position: [x, halfExtent, 0], color });
      }

      // YZ plane (X=0)
      for (let i = 0; i < numLines; i++) {
        const y = (i - extent) * cellSize;
        const isMajor = i % majorLineInterval === extent % majorLineInterval;
        const isOrigin = Math.abs(y) < 0.001;
        const color = isOrigin ? originColor : isMajor ? majorColor : minorColor;

        // Lines parallel to Z axis (varying Y)
        vertices.push({ position: [0, y, -halfExtent], color });
        vertices.push({ position: [0, y, halfExtent], color });
      }
      for (let i = 0; i < numLines; i++) {
        const z = (i - extent) * cellSize;
        const isMajor = i % majorLineInterval === extent % majorLineInterval;
        const isOrigin = Math.abs(z) < 0.001;
        const color = isOrigin ? originColor : isMajor ? majorColor : minorColor;

        // Lines parallel to Y axis (varying Z)
        vertices.push({ position: [0, -halfExtent, z], color });
        vertices.push({ position: [0, halfExtent, z], color });
      }
    }

    return vertices;
  }

  /**
   * Renders the grid.
   * @param passEncoder - Render pass encoder
   * @param viewProjectionMatrix - Combined view-projection matrix
   */
  render(passEncoder: GPURenderPassEncoder, viewProjectionMatrix: Mat4): void {
    if (!this.visible || !this.pipeline || !this.vertexBuffer || this.vertexCount === 0) {
      return;
    }

    if (!this.device || !this.uniformBuffer || !this.uniformBindGroup) {
      return;
    }

    // Update uniform buffer with view-projection matrix
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      viewProjectionMatrix.buffer,
      viewProjectionMatrix.byteOffset,
      64
    );

    // Render grid lines
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.uniformBindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.draw(this.vertexCount, 1, 0, 0);
  }

  /**
   * Updates grid configuration and regenerates geometry if needed.
   */
  setConfig(config: Partial<GridConfig>): void {
    const prevCellSize = this.config.cellSize;
    const prevExtent = this.config.extent;
    const prevPlanes = { ...this.config.planes };
    const prevColors = { ...this.config.colors };
    const prevMajorInterval = this.config.majorLineInterval;

    this.config = { ...this.config, ...config };

    const validationErrors = validateGridConfig(this.config);
    if (validationErrors.length > 0) {
      Logger.warn('Grid config validation errors:', new Error(validationErrors.join(', ')));
    }

    // Check if geometry needs regeneration
    const geometryChanged =
      prevCellSize !== this.config.cellSize ||
      prevExtent !== this.config.extent ||
      prevPlanes.horizontal !== this.config.planes.horizontal ||
      prevColors.minorLine !== this.config.colors.minorLine ||
      prevColors.majorLine !== this.config.colors.majorLine ||
      prevColors.origin !== this.config.colors.origin ||
      prevMajorInterval !== this.config.majorLineInterval;

    if (geometryChanged) {
      this.updateGridGeometry();
    }

    if (config.visible !== undefined) {
      this.visible = config.visible;
    }
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
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
    this.pipeline = null;
    this.uniformBindGroup = null;
    this.device = null;
  }
}

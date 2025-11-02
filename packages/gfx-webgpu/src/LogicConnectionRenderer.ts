/**
 * LogicConnectionRenderer - Renders 3D beams between connected logic cubes.
 */

import type { Scene } from '@engine/world';
import type { LogicConnectionManager } from '../logic/LogicConnectionManager';
import type { LogicConnection } from '../logic/cubes/types';
import type { Mat4, Vec3 } from '@engine/core/math';
import { createLineShaderCode } from './shaders/lineShader';
import { LogicCubeComponent } from '@engine/script';
// Note: LogicCubeLibrary is in apps/editor, which violates package boundaries
// For now, using fallback colors when library is unavailable
// TODO: Move LogicCubeLibrary to @engine/editor-utils or make this configurable

interface LineVertex {
  position: Vec3;
  color: Vec3;
  thickness: number;
  animationOffset: number;
}

/**
 * Renders visual connections between logic cubes
 */
export class LogicConnectionRenderer {
  private scene: Scene;
  private connectionManager: LogicConnectionManager;
  private device: GPUDevice | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private uniformBindGroup: GPUBindGroup | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private animationTime = 0;
  private lineSegments: LineVertex[] = [];

  constructor(scene: Scene, connectionManager: LogicConnectionManager) {
    this.scene = scene;
    this.connectionManager = connectionManager;
  }

  /**
   * Initializes GPU resources
   */
  async initialize(device: GPUDevice, presentationFormat: GPUTextureFormat): Promise<void> {
    this.device = device;

    // Create uniform buffer
    this.uniformBuffer = device.createBuffer({
      size: 80, // mat4x4 (64 bytes) + vec3 (12 bytes) + f32 (4 bytes)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
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
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    // Create shader module
    const shaderCode = createLineShaderCode();
    const shaderModule = device.createShaderModule({
      code: shaderCode,
    });

    // Create pipeline
    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 32, // 3 floats (pos) + 3 floats (color) + 1 float (thickness) + 1 float (anim)
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
              { shaderLocation: 1, offset: 12, format: 'float32x3' }, // color
              { shaderLocation: 2, offset: 24, format: 'float32' }, // thickness
              { shaderLocation: 3, offset: 28, format: 'float32' }, // animationOffset
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: presentationFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'line-list',
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: false,
        depthCompare: 'less',
      },
    });

    // Create initial vertex buffer
    this.updateConnectionGeometry();
  }

  /**
   * Updates connection geometry based on current connections
   */
  private updateConnectionGeometry(): void {
    if (!this.device) return;

    this.lineSegments = [];
    const connections = this.connectionManager.getAllConnections();

    for (const conn of connections) {
      const sourceEntity = this.scene.findEntityById(conn.sourceEntityId);
      const targetEntity = this.scene.findEntityById(conn.targetEntityId);

      if (!sourceEntity || !targetEntity) continue;

      const sourcePos = sourceEntity.transform.position;
      const targetPos = targetEntity.transform.position;

      // Get color based on connection type
      const color = this.getConnectionColor(conn);

      // Create line segment (2 vertices per line)
      this.lineSegments.push(
        {
          position: sourcePos,
          color,
          thickness: 0.1,
          animationOffset: Math.random() * 10,
        },
        {
          position: targetPos,
          color,
          thickness: 0.1,
          animationOffset: Math.random() * 10,
        }
      );
    }

    // Update vertex buffer
    if (this.lineSegments.length > 0) {
      const vertexData = new Float32Array(this.lineSegments.length * 8); // 8 floats per vertex
      let offset = 0;

      for (const vertex of this.lineSegments) {
        vertexData[offset++] = vertex.position[0];
        vertexData[offset++] = vertex.position[1];
        vertexData[offset++] = vertex.position[2];
        vertexData[offset++] = vertex.color[0];
        vertexData[offset++] = vertex.color[1];
        vertexData[offset++] = vertex.color[2];
        vertexData[offset++] = vertex.thickness;
        vertexData[offset++] = vertex.animationOffset;
      }

      // Destroy old buffer
      if (this.vertexBuffer) {
        this.vertexBuffer.destroy();
      }

      // Create new buffer
      this.vertexBuffer = this.device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });

      this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);
    }
  }

  /**
   * Gets color for a connection based on its type
   */
  private getConnectionColor(conn: LogicConnection): Vec3 {
    // Try to determine connection type from source cube
    const sourceEntity = this.scene.findEntityById(conn.sourceEntityId);
    if (sourceEntity) {
      const component = sourceEntity.getComponent(LogicCubeComponent);
      if (component) {
        const cubeType = component.getCubeType();
        // Fallback: Use simple color mapping based on cube type name
        // In production, this should use LogicCubeLibrary from @engine/editor-utils
        if (cubeType.includes('trigger') || cubeType.includes('Trigger')) {
          return [1, 0.8, 0.2]; // Yellow
        }
        if (cubeType.includes('action') || cubeType.includes('Action')) {
          return [0.8, 0.4, 1]; // Purple
        }
        if (cubeType.includes('condition') || cubeType.includes('Condition')) {
          return [1, 1, 0.3]; // Yellow
        }
        if (cubeType.includes('data') || cubeType.includes('Data')) {
          return [0.3, 0.8, 1]; // Blue
        }
        if (cubeType.includes('logic') || cubeType.includes('Logic')) {
          return [0.7, 0.7, 1]; // Light purple
        }
      }
    }

    // Default white
    return [1, 1, 1];
  }

  /**
   * Renders all connection beams
   */
  render(
    passEncoder: GPURenderPassEncoder,
    viewProjectionMatrix: Mat4,
    cameraPosition: [number, number, number]
  ): void {
    if (!this.pipeline || !this.uniformBindGroup || !this.vertexBuffer || this.lineSegments.length === 0) {
      return;
    }

    // Update uniforms
    if (this.device && this.uniformBuffer) {
      const uniformData = new Float32Array(20); // 16 (mat4) + 3 (vec3) + 1 (f32)
      
      // Copy view-projection matrix
      uniformData.set(viewProjectionMatrix, 0);
      
      // Camera position
      uniformData[16] = cameraPosition[0];
      uniformData[17] = cameraPosition[1];
      uniformData[18] = cameraPosition[2];
      
      // Animation time
      uniformData[19] = this.animationTime;

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }

    // Set pipeline and draw
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.uniformBindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.draw(this.lineSegments.length, 1, 0, 0);
  }

  /**
   * Updates beam animations
   */
  update(deltaTime: number): void {
    this.animationTime += deltaTime;
    
    // Periodically update geometry (in case connections changed)
    // In a production system, this would be event-driven
    if (Math.floor(this.animationTime * 2) !== Math.floor((this.animationTime - deltaTime) * 2)) {
      this.updateConnectionGeometry();
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.uniformBuffer?.destroy();
    this.vertexBuffer?.destroy();
    this.uniformBuffer = null;
    this.vertexBuffer = null;
    this.pipeline = null;
    this.uniformBindGroup = null;
    this.device = null;
  }
}


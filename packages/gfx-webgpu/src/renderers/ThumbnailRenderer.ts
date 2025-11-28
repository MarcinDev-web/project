import { mat4Perspective, mat4LookAt, mat4Multiply, type Mat4 } from '@engine/core/math';
import {
  createGeometryBuffers,
  createPipelines,
  createTextureAtlas,
  createUniformResources,
  type GeometryData,
  INSTANCE_STRIDE,
} from '../resources/resources';
import { DEFAULT_GEOMETRY } from '../resources/resources';
import {
  FOV_RADIANS,
  UNIFORM_BUFFER_SIZE,
  UNIFORM_DATA_LENGTH,
  Z_FAR,
  Z_NEAR,
  TEXTURE_SIZE,
} from '../config';
import { createVertexBufferLayouts } from '../core/FrameResourceFactory';

export interface ThumbnailOptions {
  size?: number; // square size in px
}

export interface ThumbnailRendererInit {
  device?: GPUDevice;
  presentationFormat?: GPUTextureFormat;
}

export class ThumbnailRenderer {
  private device: GPUDevice | null = null;
  private presentationFormat: GPUTextureFormat = 'rgba8unorm';

  async initialize(init?: ThumbnailRendererInit): Promise<void> {
    if (this.device) return;
    if (init?.device) {
      this.device = init.device;
      if (init.presentationFormat) this.presentationFormat = init.presentationFormat;
      return;
    }
    if (!('gpu' in navigator) || !navigator.gpu) {
      throw new Error('WebGPU not supported');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('Failed to acquire GPU adapter');
    this.device = await adapter.requestDevice({});
  }

  /**
   * Renders a single asset-like cube scaled and colored to match the preset into a data URL.
   * Note: Uses the main shader pipeline for visual parity.
   */
  async renderAsset(
    preset: { scale: [number, number, number]; color: [number, number, number, number] },
    options?: ThumbnailOptions
  ): Promise<string> {
    if (!this.device) throw new Error('ThumbnailRenderer not initialized');
    const device = this.device;
    const size = Math.max(64, Math.min(512, options?.size ?? 128));

    // Geometry: single instance of default cube using interleaved layout
    const maxScale = Math.max(preset.scale[0], preset.scale[1], preset.scale[2]);
    const instanceBoundsData = new Float32Array([0, 0, 0, Math.max(maxScale * 0.5, 0.001)]);
    
    // Create interleaved instance data (24 floats per instance)
    const instanceInterleavedData = new Float32Array(INSTANCE_STRIDE);
    // offset [0-2]
    instanceInterleavedData[0] = 0;
    instanceInterleavedData[1] = 0;
    instanceInterleavedData[2] = 0;
    // colorScale [3-6]
    instanceInterleavedData[3] = preset.color[0];
    instanceInterleavedData[4] = preset.color[1];
    instanceInterleavedData[5] = preset.color[2];
    instanceInterleavedData[6] = maxScale;
    // secondaryColor [7-10]
    instanceInterleavedData[7] = preset.color[0];
    instanceInterleavedData[8] = preset.color[1];
    instanceInterleavedData[9] = preset.color[2];
    instanceInterleavedData[10] = 1;
    // emissiveColor [11-14]
    instanceInterleavedData[11] = 0;
    instanceInterleavedData[12] = 0;
    instanceInterleavedData[13] = 0;
    instanceInterleavedData[14] = 0;
    // materialParams [15-18]
    instanceInterleavedData[15] = preset.color[3] ?? 1;
    instanceInterleavedData[16] = 0;
    instanceInterleavedData[17] = 1;
    instanceInterleavedData[18] = 0;
    // rotation [19-22] (identity quaternion)
    instanceInterleavedData[19] = 0;
    instanceInterleavedData[20] = 0;
    instanceInterleavedData[21] = 0;
    instanceInterleavedData[22] = 1;
    // materialId [23]
    instanceInterleavedData[23] = 0;
    
    const geom: GeometryData = {
      vertices: DEFAULT_GEOMETRY.vertices,
      indices: DEFAULT_GEOMETRY.indices,
      instanceCount: 1,
      opaqueCount: 1,
      instanceInterleavedData,
      instanceBoundsData,
    };
    const {
      vertexBuffer,
      indexBuffer,
      instanceInterleavedBuffer,
    } = createGeometryBuffers(device, geom);

    // Uniforms and materials (use atlas to match main pipeline)
    const { uniformBuffer, uniformBindGroupLayout } = createUniformResources(device, {
      bufferSize: UNIFORM_BUFFER_SIZE,
      dataLength: UNIFORM_DATA_LENGTH,
    });
    const { textureBindGroupLayout, textureBindGroup, atlas } = createTextureAtlas(
      device,
      undefined,
      2048,
      128
    );

    // Use the standard interleaved vertex buffer layouts
    const { renderPipeline } = await createPipelines(
      device,
      this.presentationFormat,
      uniformBindGroupLayout,
      textureBindGroupLayout,
      createVertexBufferLayouts(),
      { sampleCount: 1, statusEl: document.createElement('div') }
    );

    const uniformBindGroup = device.createBindGroup({
      label: 'thumb-uniform-bg',
      layout: uniformBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer, offset: 0, size: UNIFORM_BUFFER_SIZE } },
      ],
    });

    // Offscreen color/depth textures
    const colorTexture = device.createTexture({
      label: 'thumb-color',
      size: { width: size, height: size },
      format: this.presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
    const depthTexture = device.createTexture({
      label: 'thumb-depth',
      size: { width: size, height: size },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Camera setup: orbit slightly above and to the side; distance based on scale
    const projectionMatrix = new Float32Array(16);
    const viewMatrix = new Float32Array(16);
    const viewProjectionMatrix = new Float32Array(16);
    const eyePosition = new Float32Array(4);
    const maxHalf = Math.max(preset.scale[0], preset.scale[1], preset.scale[2]) * 0.5;
    const distance = Math.max(2.2 * maxHalf, 2.0);
    const yaw = Math.PI / 6; // 30°
    const pitch = Math.PI / 6; // 30°
    const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
    const eyeY = Math.sin(pitch) * distance;
    const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
    mat4Perspective(projectionMatrix as Mat4, FOV_RADIANS, 1, Z_NEAR, Z_FAR);
    mat4LookAt(viewMatrix as Mat4, [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);
    mat4Multiply(viewProjectionMatrix as Mat4, projectionMatrix as Mat4, viewMatrix as Mat4);

    // Write uniforms (match layout used in core.ts)
    eyePosition[0] = eyeX;
    eyePosition[1] = eyeY;
    eyePosition[2] = eyeZ;
    eyePosition[3] = 0;
    device.queue.writeBuffer(uniformBuffer, 0, viewProjectionMatrix);
    device.queue.writeBuffer(uniformBuffer, 64, eyePosition);
    // Light direction, atlas pad and shading params (static defaults)
    device.queue.writeBuffer(uniformBuffer, 80, new Float32Array([0.4, 0.8, 0.6, 0]));
    // Half-texel inset based on tile size (prevents bleeding across atlas tiles)
    const halfTexel = 0.5 / TEXTURE_SIZE;
    device.queue.writeBuffer(uniformBuffer, 96, new Float32Array([halfTexel, halfTexel, 0, 0]));
    device.queue.writeBuffer(uniformBuffer, 112, new Float32Array([0.25, 4, 24, 0]));
    // Atlas params (materialsPerRow, texSize, atlasSize, padding)
    const atlasConfig = atlas.getConfig();
    const cellSize = atlasConfig.materialTextureSize + atlasConfig.padding;
    const materialsPerRow = Math.floor(atlasConfig.atlasSize / cellSize);
    device.queue.writeBuffer(
      uniformBuffer,
      128,
      new Float32Array([
        materialsPerRow,
        atlasConfig.materialTextureSize,
        atlasConfig.atlasSize,
        atlasConfig.padding,
      ])
    );

    // Record commands
    const encoder = device.createCommandEncoder({ label: 'thumb-encoder' });
    const pass = encoder.beginRenderPass({
      label: 'thumb-pass',
      colorAttachments: [
        {
          view: colorTexture.createView(),
          clearValue: { r: 0.1, g: 0.12, b: 0.14, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });
    pass.setPipeline(renderPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, instanceInterleavedBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint16');
    pass.setBindGroup(0, uniformBindGroup);
    pass.setBindGroup(1, textureBindGroup);
    pass.drawIndexed(DEFAULT_GEOMETRY.indices.length, 1, 0, 0, 0);
    pass.end();
    device.queue.submit([encoder.finish()]);

    // Copy texture to buffer (with row padding)
    const bytesPerPixel = 4;
    const bytesPerRowUnpadded = size * bytesPerPixel;
    const bytesPerRow = Math.ceil(bytesPerRowUnpadded / 256) * 256;
    const bufferSize = bytesPerRow * size;
    const readBuffer = device.createBuffer({
      label: 'thumb-read-buffer',
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const copyEncoder = device.createCommandEncoder({ label: 'thumb-copy-encoder' });
    copyEncoder.copyTextureToBuffer(
      { texture: colorTexture },
      { buffer: readBuffer, bytesPerRow },
      { width: size, height: size }
    );
    device.queue.submit([copyEncoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    await readBuffer.mapAsync(GPUMapMode.READ);
    const mapped = readBuffer.getMappedRange();
    const data = new Uint8Array(mapped);

    // Unpad rows into ImageData
    const imageBytes = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      const srcOffset = y * bytesPerRow;
      const dstOffset = y * bytesPerRowUnpadded;
      imageBytes.set(data.subarray(srcOffset, srcOffset + bytesPerRowUnpadded), dstOffset);
    }
    readBuffer.unmap();

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    const imageData = new ImageData(imageBytes, size, size);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }
}

/**
 * @vitest-environment jsdom
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FrameResourceFactory, createVertexBufferLayouts } from '../FrameResourceFactory';
import { Logger } from '@engine/core/utils';
import type { GeometryData } from '../../resources/resources';

// Mock Logger
vi.spyOn(Logger, 'info').mockImplementation(() => {});
vi.spyOn(Logger, 'warn').mockImplementation(() => {});
vi.spyOn(Logger, 'error').mockImplementation(() => {});
vi.spyOn(Logger, 'debug').mockImplementation(() => {});

// Mock the resources module (using interleaved buffer layout)
vi.mock('../../resources/resources', () => ({
  INSTANCE_STRIDE: 24,
  INSTANCE_STRIDE_BYTES: 96,
  DEFAULT_GEOMETRY: {
    vertices: new Uint8Array(24),
    indices: new Uint16Array([0, 1, 2]),
    instanceCount: 1,
    opaqueCount: 1,
    instanceInterleavedData: new Float32Array(24), // 24 floats per instance
    instanceBoundsData: new Float32Array(4),
  },
  createGeometryBuffers: vi.fn(() => ({
    vertexBuffer: { destroy: vi.fn() },
    indexBuffer: { destroy: vi.fn() },
    instanceInterleavedBuffer: { destroy: vi.fn() },
    instanceInterleavedStagingBuffer: { destroy: vi.fn() },
    instanceBoundsBuffer: { destroy: vi.fn() },
    instanceIndirectArgsBuffer: { destroy: vi.fn() },
  })),
  createTimestampResources: vi.fn(() => ({
    querySet: { destroy: vi.fn() },
    resolveBuffer: { destroy: vi.fn() },
    readBuffer: { destroy: vi.fn() },
  })),
  createUniformResources: vi.fn(() => ({
    uniformBuffer: { destroy: vi.fn() },
    uniformBindGroupLayout: {},
    uniformData: new Float32Array(224),
  })),
  createTextureAtlas: vi.fn(() => ({
    textureBindGroupLayout: {},
    textureBindGroup: {},
    atlasTexture: { destroy: vi.fn(), createView: vi.fn() },
    normalAtlasTexture: { destroy: vi.fn(), createView: vi.fn() },
    sampler: {},
    atlas: {
      getConfig: vi.fn(() => ({ materialsPerRow: 16, maxMaterials: 256 })),
    },
    atlasMetaBuffer: { destroy: vi.fn() },
  })),
  createPipelines: vi.fn(async () => ({
    renderPipeline: {},
    transparentPipeline: {},
    overlayPipeline: {},
  })),
  createDepthTexture: vi.fn(() => ({
    destroy: vi.fn(),
    createView: vi.fn(() => ({})),
  })),
  createMsaaColorTarget: vi.fn(() => ({
    destroy: vi.fn(),
    createView: vi.fn(() => ({})),
  })),
}));

// Mock the helpers module
vi.mock('../helpers', () => ({
  getTimestampPeriod: vi.fn(() => 1),
}));

// Mock GPUBufferPool
vi.mock('../bufferPool', () => ({
  GPUBufferPool: vi.fn().mockImplementation(() => ({
    disposeAll: vi.fn(),
    getOrCreate: vi.fn(),
  })),
}));

describe('FrameResourceFactory', () => {
  let device: GPUDevice;
  let adapter: GPUAdapter;
  let canvas: HTMLCanvasElement;

  function createMockGeometry(): GeometryData {
    return {
      vertices: new Uint8Array(24),
      indices: new Uint16Array([0, 1, 2]),
      instanceCount: 1,
      opaqueCount: 1,
      instanceInterleavedData: new Float32Array(24), // 24 floats per instance
      instanceBoundsData: new Float32Array(4),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock device
    device = {
      createBindGroup: vi.fn(() => ({})),
      createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
      createTexture: vi.fn(() => ({
        destroy: vi.fn(),
        createView: vi.fn(() => ({})),
      })),
      queue: {},
    } as unknown as GPUDevice;

    // Mock adapter
    adapter = {
      limits: {},
    } as unknown as GPUAdapter;

    // Mock canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createVertexBufferLayouts', () => {
    it('returns correct number of buffer layouts (vertex + interleaved instance)', () => {
      const layouts = createVertexBufferLayouts();
      // New interleaved layout: 1 vertex buffer + 1 interleaved instance buffer
      expect(layouts).toHaveLength(2);
    });

    it('configures vertex buffer with correct stride', () => {
      const layouts = createVertexBufferLayouts();
      expect(layouts[0].arrayStride).toBe(24); // VERTEX_STRIDE
      expect(layouts[0].stepMode).toBe('vertex');
    });

    it('configures vertex buffer attributes correctly', () => {
      const layouts = createVertexBufferLayouts();
      const vertexLayout = layouts[0];
      expect(vertexLayout.attributes).toHaveLength(4);
      // position, normal, uv, AO
      expect(vertexLayout.attributes[0].shaderLocation).toBe(0);
      expect(vertexLayout.attributes[1].shaderLocation).toBe(1);
      expect(vertexLayout.attributes[2].shaderLocation).toBe(2);
      expect(vertexLayout.attributes[3].shaderLocation).toBe(3);
    });

    it('configures interleaved instance buffer with 96-byte stride', () => {
      const layouts = createVertexBufferLayouts();
      // Interleaved instance buffer: 96 bytes per instance
      expect(layouts[1].arrayStride).toBe(96);
      expect(layouts[1].stepMode).toBe('instance');
    });

    it('configures all instance attributes in interleaved buffer', () => {
      const layouts = createVertexBufferLayouts();
      const instanceLayout = layouts[1];
      // Should have 7 attributes: offset, colorScale, secondaryColor, emissiveColor, materialParams, rotation, materialId
      expect(instanceLayout.attributes).toHaveLength(7);
      // Check shader locations 4-10
      expect(instanceLayout.attributes[0].shaderLocation).toBe(4);  // offset
      expect(instanceLayout.attributes[1].shaderLocation).toBe(5);  // colorScale
      expect(instanceLayout.attributes[2].shaderLocation).toBe(6);  // secondaryColor
      expect(instanceLayout.attributes[3].shaderLocation).toBe(7);  // emissiveColor
      expect(instanceLayout.attributes[4].shaderLocation).toBe(8);  // materialParams
      expect(instanceLayout.attributes[5].shaderLocation).toBe(9);  // rotation
      expect(instanceLayout.attributes[6].shaderLocation).toBe(10); // materialId
    });
  });

  describe('constructor', () => {
    it('creates a factory instance', () => {
      const factory = new FrameResourceFactory(device, adapter);
      expect(factory).toBeInstanceOf(FrameResourceFactory);
    });
  });

  describe('createAll', () => {
    it('creates all frame resources', async () => {
      const factory = new FrameResourceFactory(device, adapter);
      const geometry = createMockGeometry();

      const result = await factory.createAll({
        geometry,
        presentationFormat: 'bgra8unorm',
        msaaSampleCount: 4,
        timestampQuerySupported: true,
      });

      expect(result.resources).toBeDefined();
      expect(result.atlas).toBeDefined();
      expect(result.bufferPool).toBeDefined();
    });

    it('creates uniform bind group', async () => {
      const factory = new FrameResourceFactory(device, adapter);
      const geometry = createMockGeometry();

      await factory.createAll({
        geometry,
        presentationFormat: 'bgra8unorm',
        msaaSampleCount: 4,
        timestampQuerySupported: true,
      });

      expect(device.createBindGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'frame-uniform-bg',
        })
      );
    });

    it('passes timestamp support to resource creation', async () => {
      const { createTimestampResources } = await import('../../resources/resources');
      const factory = new FrameResourceFactory(device, adapter);
      const geometry = createMockGeometry();

      await factory.createAll({
        geometry,
        presentationFormat: 'bgra8unorm',
        msaaSampleCount: 4,
        timestampQuerySupported: true,
      });

      expect(createTimestampResources).toHaveBeenCalledWith(
        device,
        true,
        expect.any(Object)
      );
    });
  });

  describe('createRenderTargets', () => {
    it('creates depth and MSAA textures', async () => {
      const { createDepthTexture, createMsaaColorTarget } = await import('../../resources/resources');
      const factory = new FrameResourceFactory(device, adapter);

      const result = factory.createRenderTargets(canvas, 'bgra8unorm', 4);

      expect(createDepthTexture).toHaveBeenCalledWith(device, canvas, 4);
      expect(createMsaaColorTarget).toHaveBeenCalledWith(device, canvas, 'bgra8unorm', 4);
      expect(result.depthTexture).toBeDefined();
      expect(result.depthTextureView).toBeDefined();
      expect(result.msaaColorTexture).toBeDefined();
      expect(result.msaaColorView).toBeDefined();
    });
  });

  describe('dispose', () => {
    it('disposes all resources safely', async () => {
      const factory = new FrameResourceFactory(device, adapter);
      const geometry = createMockGeometry();

      const { resources } = await factory.createAll({
        geometry,
        presentationFormat: 'bgra8unorm',
        msaaSampleCount: 4,
        timestampQuerySupported: true,
      });

      // Should not throw
      expect(() => factory.dispose(resources)).not.toThrow();
    });

    it('handles null resources gracefully', () => {
      const factory = new FrameResourceFactory(device, adapter);
      expect(() => factory.dispose(null)).not.toThrow();
    });

    it('handles already disposed resources gracefully', async () => {
      const factory = new FrameResourceFactory(device, adapter);
      const geometry = createMockGeometry();

      const { resources } = await factory.createAll({
        geometry,
        presentationFormat: 'bgra8unorm',
        msaaSampleCount: 4,
        timestampQuerySupported: true,
      });

      // First dispose
      factory.dispose(resources);

      // Second dispose should not throw
      expect(() => factory.dispose(resources)).not.toThrow();
    });

    it('disposes buffer pool for extended resources', async () => {
      const factory = new FrameResourceFactory(device, adapter);
      const geometry = createMockGeometry();

      const { resources, bufferPool } = await factory.createAll({
        geometry,
        presentationFormat: 'bgra8unorm',
        msaaSampleCount: 4,
        timestampQuerySupported: true,
      });

      factory.dispose(resources);

      expect(bufferPool.disposeAll).toHaveBeenCalled();
    });
  });

  describe('getDefaultGeometry', () => {
    it('returns default geometry data', () => {
      const geometry = FrameResourceFactory.getDefaultGeometry();
      
      expect(geometry).toBeDefined();
      expect(geometry.vertices).toBeDefined();
      expect(geometry.indices).toBeDefined();
      expect(geometry.instanceCount).toBeGreaterThan(0);
    });

    it('returns a copy (not the original)', () => {
      const geometry1 = FrameResourceFactory.getDefaultGeometry();
      const geometry2 = FrameResourceFactory.getDefaultGeometry();

      expect(geometry1).not.toBe(geometry2);
    });
  });
});


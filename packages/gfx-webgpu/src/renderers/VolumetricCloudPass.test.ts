import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { VolumetricCloudPass, type VolumetricCloudParams } from './VolumetricCloudPass';

// Mock WebGPU constants that aren't available in test environment
beforeAll(() => {
  (globalThis as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
  (globalThis as any).GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };
  (globalThis as any).GPUShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
  };
  (globalThis as any).GPUColorWrite = {
    RED: 0x1,
    GREEN: 0x2,
    BLUE: 0x4,
    ALPHA: 0x8,
    ALL: 0xF,
  };
  (globalThis as any).GPUMapMode = {
    READ: 0x0001,
    WRITE: 0x0002,
  };
});

// Mock buffer and texture with destroy tracking
function createMockBuffer() {
  return {
    destroy: vi.fn(),
    getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(256)),
    unmap: vi.fn(),
    mapAsync: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockTexture() {
  return {
    createView: vi.fn().mockReturnValue({}),
    destroy: vi.fn(),
  };
}

function createMockGPUDevice() {
  const mockBuffer = createMockBuffer();
  const mockTexture = createMockTexture();
  const mockPipeline = {} as GPURenderPipeline;
  const mockBindGroup = {} as GPUBindGroup;

  return {
    createBuffer: vi.fn().mockReturnValue(mockBuffer),
    createTexture: vi.fn().mockReturnValue(mockTexture),
    createSampler: vi.fn().mockReturnValue({}),
    createBindGroupLayout: vi.fn().mockReturnValue({}),
    createPipelineLayout: vi.fn().mockReturnValue({}),
    createShaderModule: vi.fn().mockReturnValue({}),
    createRenderPipeline: vi.fn().mockReturnValue(mockPipeline),
    createRenderPipelineAsync: vi.fn().mockResolvedValue(mockPipeline),
    createComputePipeline: vi.fn().mockReturnValue({}),
    createBindGroup: vi.fn().mockReturnValue(mockBindGroup),
    createCommandEncoder: vi.fn().mockReturnValue({
      beginRenderPass: vi.fn().mockReturnValue({
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        setVertexBuffer: vi.fn(),
        setIndexBuffer: vi.fn(),
        draw: vi.fn(),
        drawIndexed: vi.fn(),
        setViewport: vi.fn(),
        setScissorRect: vi.fn(),
        end: vi.fn(),
      }),
      beginComputePass: vi.fn().mockReturnValue({
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        dispatchWorkgroups: vi.fn(),
        end: vi.fn(),
      }),
      finish: vi.fn().mockReturnValue({}),
      copyBufferToBuffer: vi.fn(),
      copyTextureToTexture: vi.fn(),
    }),
    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
      writeTexture: vi.fn(),
      onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined),
    },
    destroy: vi.fn(),
    features: new Set(),
    limits: {},
    _mockBuffer: mockBuffer,
    _mockTexture: mockTexture,
  } as unknown as GPUDevice & { _mockBuffer: ReturnType<typeof createMockBuffer>; _mockTexture: ReturnType<typeof createMockTexture> };
}

function createMockPassEncoder() {
  return {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    draw: vi.fn(),
    end: vi.fn(),
  } as unknown as GPURenderPassEncoder;
}

function createMockParams(): VolumetricCloudParams {
  return {
    cloudAltitude: 800,
    cloudThickness: 400,
    cloudDensity: 0.5,
    cloudSpeed: 0.02,
    sunDirection: [0.5, 0.8, 0.3],
    sunColor: [1, 0.9, 0.8],
    skyColor: [0.5, 0.7, 1],
    time: 0,
    nearPlane: 0.1,
    farPlane: 10000,
  };
}

// Create an identity matrix (invertible) for testing
function createIdentityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

describe('VolumetricCloudPass', () => {
  let device: ReturnType<typeof createMockGPUDevice>;
  let cloudPass: VolumetricCloudPass;

  beforeEach(() => {
    device = createMockGPUDevice();
    cloudPass = new VolumetricCloudPass();
  });

  afterEach(() => {
    cloudPass.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('initializes successfully with valid parameters', async () => {
      await expect(
        cloudPass.initialize(device, 'bgra8unorm', 4)
      ).resolves.not.toThrow();

      expect(cloudPass.isInitialized()).toBe(true);
    });

    it('isInitialized() returns false before init', () => {
      expect(cloudPass.isInitialized()).toBe(false);
    });

    it('creates uniform buffer with correct size (256 bytes)', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);

      expect(device.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 256,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: 'Volumetric Cloud Uniforms',
        })
      );
    });

    it('creates bind group layout with 4 bindings', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);

      expect(device.createBindGroupLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Volumetric Cloud Bind Group Layout',
          entries: expect.arrayContaining([
            expect.objectContaining({ binding: 0 }), // uniforms
            expect.objectContaining({ binding: 1 }), // depth texture
            expect.objectContaining({ binding: 2 }), // blue noise texture
            expect.objectContaining({ binding: 3 }), // sampler
          ]),
        })
      );
    });

    it('creates blue noise texture', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);

      // Blue noise texture is created via createBlueNoiseTexture which calls createTexture
      expect(device.createTexture).toHaveBeenCalled();
    });

    it('creates sampler for blue noise', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);

      expect(device.createSampler).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Blue Noise Sampler',
          magFilter: 'nearest',
          minFilter: 'nearest',
          addressModeU: 'repeat',
          addressModeV: 'repeat',
        })
      );
    });

    it('creates render pipeline with MSAA support', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);

      expect(device.createRenderPipelineAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Volumetric Cloud Pipeline',
          multisample: expect.objectContaining({
            count: 4,
          }),
        })
      );
    });

    it('handles different sampleCount values', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);

      expect(device.createRenderPipelineAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          multisample: expect.objectContaining({
            count: 1,
          }),
        })
      );
    });

    it('works with different GPUTextureFormat values', async () => {
      await cloudPass.initialize(device, 'rgba16float', 4);

      expect(device.createRenderPipelineAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          fragment: expect.objectContaining({
            targets: expect.arrayContaining([
              expect.objectContaining({
                format: 'rgba16float',
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('Dispose', () => {
    it('disposes resources correctly', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      
      expect(() => cloudPass.dispose()).not.toThrow();
      expect(cloudPass.isInitialized()).toBe(false);
    });

    it('can dispose multiple times safely (idempotent)', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      
      expect(() => cloudPass.dispose()).not.toThrow();
      expect(() => cloudPass.dispose()).not.toThrow();
      expect(() => cloudPass.dispose()).not.toThrow();
    });

    it('isInitialized() returns false after dispose', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      expect(cloudPass.isInitialized()).toBe(true);
      
      cloudPass.dispose();
      expect(cloudPass.isInitialized()).toBe(false);
    });

    it('destroys uniformBuffer and blueNoiseTexture', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      
      cloudPass.dispose();
      
      // Buffer and texture destroy should have been called
      expect(device._mockBuffer.destroy).toHaveBeenCalled();
      expect(device._mockTexture.destroy).toHaveBeenCalled();
    });

    it('can dispose without initialization', () => {
      expect(() => cloudPass.dispose()).not.toThrow();
    });
  });

  describe('updateDepthTexture', () => {
    it('does nothing when not initialized', () => {
      const mockDepthView = {} as GPUTextureView;
      
      // Should not throw
      expect(() => cloudPass.updateDepthTexture(mockDepthView)).not.toThrow();
      
      // Should not create bind group
      expect(device.createBindGroup).not.toHaveBeenCalled();
    });

    it('creates bindGroup with depth texture view', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      
      const mockDepthView = { label: 'depth-view-1' } as unknown as GPUTextureView;
      cloudPass.updateDepthTexture(mockDepthView);
      
      expect(device.createBindGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Volumetric Cloud Bind Group',
          entries: expect.arrayContaining([
            expect.objectContaining({ binding: 1, resource: mockDepthView }),
          ]),
        })
      );
    });

    it('does not recreate bindGroup if same texture view', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      
      const mockDepthView = {} as GPUTextureView;
      cloudPass.updateDepthTexture(mockDepthView);
      const callCount = (device.createBindGroup as ReturnType<typeof vi.fn>).mock.calls.length;
      
      cloudPass.updateDepthTexture(mockDepthView);
      expect(device.createBindGroup).toHaveBeenCalledTimes(callCount);
    });

    it('recreates bindGroup when texture view changes', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      
      const mockDepthView1 = { id: 1 } as unknown as GPUTextureView;
      const mockDepthView2 = { id: 2 } as unknown as GPUTextureView;
      
      cloudPass.updateDepthTexture(mockDepthView1);
      const callCountAfterFirst = (device.createBindGroup as ReturnType<typeof vi.fn>).mock.calls.length;
      
      cloudPass.updateDepthTexture(mockDepthView2);
      expect(device.createBindGroup).toHaveBeenCalledTimes(callCountAfterFirst + 1);
    });
  });

  describe('Render', () => {
    it('does not render when not initialized', () => {
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      const viewProj = new Float32Array(16);
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();

      expect(passEncoder.setPipeline).not.toHaveBeenCalled();
      expect(passEncoder.draw).not.toHaveBeenCalled();
    });

    it('does not render when bindGroup not set (no depth texture)', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      const viewProj = new Float32Array(16);
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();

      // Should not render without depth texture set
      expect(passEncoder.draw).not.toHaveBeenCalled();
    });

    it('renders successfully with all resources set', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();

      expect(passEncoder.setPipeline).toHaveBeenCalled();
      expect(passEncoder.setBindGroup).toHaveBeenCalledWith(0, expect.anything());
      expect(passEncoder.draw).toHaveBeenCalledWith(3, 1, 0, 0);
    });

    it('writes uniform data to buffer', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);

      expect(device.queue.writeBuffer).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('accepts VolumetricCloudParams with all required fields', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params: VolumetricCloudParams = {
        cloudAltitude: 1200,
        cloudThickness: 800,
        cloudDensity: 0.7,
        cloudSpeed: 0.05,
        sunDirection: [0, 1, 0],
        sunColor: [1, 1, 1],
        skyColor: [0.4, 0.6, 1],
        time: 123.456,
        nearPlane: 0.5,
        farPlane: 5000,
      };
      const viewProj = createIdentityMatrix();
      const cameraPos = [100, 500, 200] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();
    });

    it('handles Float32Array viewProjectionMatrix', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      const viewProj = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]);
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles array-like viewProjectionMatrix (Mat4)', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      // Mat4 is array-like with indexed access
      const viewProj = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ] as any;
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles Vec3 cameraPosition', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      const viewProj = createIdentityMatrix();
      // Vec3 is [number, number, number]
      const cameraPos: [number, number, number] = [50, 200, -100];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles Float32Array cameraPosition', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      const viewProj = createIdentityMatrix();
      const cameraPos = new Float32Array([50, 200, -100]);

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('uses default screen dimensions when not provided', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      // Call without screen dimensions - should use defaults (1920x1080)
      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });
  });

  describe('Parameter Validation', () => {
    it('handles zero-length sunDirection (prevents NaN from normalization)', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.sunDirection = [0, 0, 0]; // Zero vector would cause NaN after normalization
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles NaN in sunDirection', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.sunDirection = [NaN, 1, 0];
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles Infinity in sunDirection', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.sunDirection = [Infinity, -Infinity, 1];
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles negative cloudThickness', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.cloudThickness = -100; // Negative thickness is invalid
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles zero cloudThickness', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.cloudThickness = 0; // Zero thickness is invalid
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles NaN cloudThickness', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.cloudThickness = NaN;
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('clamps cloudDensity below 0', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.cloudDensity = -0.5; // Negative density should be clamped to 0
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('clamps cloudDensity above 1', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.cloudDensity = 2.5; // Above 1 should be clamped to 1
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles NaN cloudDensity', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.cloudDensity = NaN;
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles Infinity cloudDensity', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params = createMockParams();
      params.cloudDensity = Infinity;
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('handles all invalid parameters at once', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 4);
      cloudPass.updateDepthTexture({} as GPUTextureView);
      
      const passEncoder = createMockPassEncoder();
      const params: VolumetricCloudParams = {
        cloudAltitude: 800,
        cloudThickness: -100, // Invalid
        cloudDensity: NaN, // Invalid
        cloudSpeed: 0.02,
        sunDirection: [0, 0, 0], // Invalid (zero vector)
        sunColor: [1, 0.9, 0.8],
        skyColor: [0.5, 0.7, 1],
        time: 0,
        nearPlane: 0.1,
        farPlane: 10000,
      };
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0] as [number, number, number];

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();

      expect(passEncoder.draw).toHaveBeenCalled();
    });
  });
});


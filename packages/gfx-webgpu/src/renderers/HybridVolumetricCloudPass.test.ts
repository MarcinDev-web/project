import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { HybridVolumetricCloudPass, type HybridVolumetricCloudParams, type CloudType } from './HybridVolumetricCloudPass';

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
  const mockView = {};
  return {
    createView: vi.fn().mockReturnValue(mockView),
    destroy: vi.fn(),
    _mockView: mockView,
  };
}

function createMockGPUDevice() {
  const mockBuffer = createMockBuffer();
  const mockTexture = createMockTexture();
  const mockPipeline = {} as GPURenderPipeline;
  const mockComputePipeline = {} as GPUComputePipeline;
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
    createComputePipeline: vi.fn().mockReturnValue(mockComputePipeline),
    createComputePipelineAsync: vi.fn().mockResolvedValue(mockComputePipeline),
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
  } as unknown as GPUDevice & { 
    _mockBuffer: ReturnType<typeof createMockBuffer>; 
    _mockTexture: ReturnType<typeof createMockTexture>;
  };
}

function createMockPassEncoder() {
  return {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    draw: vi.fn(),
    end: vi.fn(),
  } as unknown as GPURenderPassEncoder;
}

function createMockParams(): HybridVolumetricCloudParams {
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
    // Hybrid-specific parameters
    cloudType: 'auto',
    weatherSpeed: 0.01,
    erosionStrength: 0.5,
    temporalBlend: 0.95,
    enableTemporal: true,
    weatherMapScale: 1.0,
    windDirection: 0,
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

describe('HybridVolumetricCloudPass', () => {
  let device: ReturnType<typeof createMockGPUDevice>;
  let cloudPass: HybridVolumetricCloudPass;

  beforeEach(() => {
    device = createMockGPUDevice();
    cloudPass = new HybridVolumetricCloudPass();
  });

  afterEach(() => {
    cloudPass.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('initializes successfully with valid parameters', async () => {
      await expect(
        cloudPass.initialize(device, 'bgra8unorm', 1)
      ).resolves.not.toThrow();

      expect(cloudPass.isInitialized()).toBe(true);
    });

    it('isInitialized() returns false before init', () => {
      expect(cloudPass.isInitialized()).toBe(false);
    });

    it('creates uniform buffers with correct sizes', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);

      // Cloud uniform buffer (352 bytes)
      expect(device.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 352,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: 'Hybrid Cloud Uniforms',
        })
      );

      // Temporal uniform buffer (32 bytes)
      expect(device.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 32,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          label: 'Temporal Reprojection Uniforms',
        })
      );
    });

    it('creates cloud and temporal bind group layouts', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);

      expect(device.createBindGroupLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Hybrid Cloud Bind Group Layout',
        })
      );

      expect(device.createBindGroupLayout).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Temporal Reprojection Bind Group Layout',
        })
      );
    });

    it('creates both cloud and temporal pipelines', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);

      expect(device.createRenderPipelineAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Hybrid Cloud Pipeline',
        })
      );

      expect(device.createRenderPipelineAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Temporal Reprojection Pipeline',
        })
      );
    });

    it('creates blue noise texture and samplers', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);

      // Blue noise texture created by BlueNoiseTexture helper
      expect(device.createTexture).toHaveBeenCalled();
      
      // Two samplers: blue noise (nearest) and linear
      expect(device.createSampler).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Hybrid Cloud Blue Noise Sampler',
          magFilter: 'nearest',
        })
      );

      expect(device.createSampler).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Hybrid Cloud Linear Sampler',
          magFilter: 'linear',
        })
      );
    });
  });

  describe('Dispose', () => {
    it('cleans up all resources on dispose', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      expect(cloudPass.isInitialized()).toBe(true);

      expect(() => cloudPass.dispose()).not.toThrow();
      expect(cloudPass.isInitialized()).toBe(false);
    });

    it('can dispose before initialization', () => {
      expect(() => cloudPass.dispose()).not.toThrow();
      expect(cloudPass.isInitialized()).toBe(false);
    });

    it('can dispose multiple times safely', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      
      expect(() => cloudPass.dispose()).not.toThrow();
      expect(() => cloudPass.dispose()).not.toThrow();
      expect(() => cloudPass.dispose()).not.toThrow();
    });
  });

  describe('Depth Texture Management', () => {
    it('does not throw when updating depth texture before init', () => {
      const mockDepthView = {} as GPUTextureView;
      expect(() => cloudPass.updateDepthTexture(mockDepthView)).not.toThrow();
    });

    it('accepts depth texture view after init', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      const mockDepthView = {} as GPUTextureView;

      expect(() => cloudPass.updateDepthTexture(mockDepthView)).not.toThrow();
    });
  });

  describe('Rendering', () => {
    it('does not render before initialization', () => {
      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];
      const params = createMockParams();

      cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);

      expect(passEncoder.setPipeline).not.toHaveBeenCalled();
      expect(passEncoder.draw).not.toHaveBeenCalled();
    });

    it('does not render without depth texture', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      
      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];
      const params = createMockParams();

      cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);

      // Without depth texture, render should not proceed
      expect(passEncoder.draw).not.toHaveBeenCalled();
    });

    it('renders after full setup', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];
      const params = createMockParams();

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();
    });
  });

  describe('Weather Map', () => {
    it('initializes weather map during setup', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      
      const weatherMap = cloudPass.getWeatherMap();
      expect(weatherMap).not.toBeNull();
      expect(weatherMap?.isInitialized()).toBe(true);
    });

    it('weather map is disposed with pass', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      const weatherMap = cloudPass.getWeatherMap();
      expect(weatherMap).not.toBeNull();

      cloudPass.dispose();
      expect(cloudPass.getWeatherMap()).toBeNull();
    });
  });

  describe('Cloud Type Parameter', () => {
    it('accepts all valid cloud types', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];

      const cloudTypes: CloudType[] = ['auto', 'cumulus', 'stratus', 'stratocumulus'];
      
      for (const cloudType of cloudTypes) {
        const params = { ...createMockParams(), cloudType };
        expect(() => {
          cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
        }).not.toThrow();
      }
    });
  });

  describe('Parameter Handling', () => {
    it('uses default parameters when partial params provided', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];

      // Only provide partial parameters
      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, { time: 5 }, 1920, 1080);
      }).not.toThrow();
    });

    it('validates sun direction - normalizes vectors', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];

      // Zero vector should fallback to default
      const params = { ...createMockParams(), sunDirection: [0, 0, 0] as [number, number, number] };
      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();
    });

    it('handles NaN and Infinity in parameters', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];

      const params = {
        ...createMockParams(),
        sunDirection: [NaN, Infinity, -Infinity] as [number, number, number],
        cloudDensity: NaN,
        cloudThickness: Infinity,
      };

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();
    });
  });

  describe('Temporal Parameters', () => {
    it('accepts valid temporal blend values', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];

      const temporalBlendValues = [0.9, 0.95, 0.98, 0.5, 1.0];
      
      for (const temporalBlend of temporalBlendValues) {
        const params = { ...createMockParams(), temporalBlend };
        expect(() => {
          cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
        }).not.toThrow();
      }
    });

    it('accepts enableTemporal toggle', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];

      // Test with temporal disabled
      const paramsDisabled = { ...createMockParams(), enableTemporal: false };
      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, paramsDisabled, 1920, 1080);
      }).not.toThrow();

      // Test with temporal enabled
      const paramsEnabled = { ...createMockParams(), enableTemporal: true };
      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, paramsEnabled, 1920, 1080);
      }).not.toThrow();
    });
  });

  describe('Erosion Strength', () => {
    it('accepts valid erosion strength values', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];

      const erosionValues = [0, 0.25, 0.5, 0.75, 1.0];
      
      for (const erosionStrength of erosionValues) {
        const params = { ...createMockParams(), erosionStrength };
        expect(() => {
          cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
        }).not.toThrow();
      }
    });
  });

  describe('Matrix Handling', () => {
    it('accepts Float32Array view projection matrix', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];
      const params = createMockParams();

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();
    });

    it('accepts regular array view projection matrix', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ] as unknown as Float32Array;
      const cameraPos = [0, 100, 0];
      const params = createMockParams();

      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params, 1920, 1080);
      }).not.toThrow();
    });
  });

  describe('Screen Size Handling', () => {
    it('handles various screen sizes', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];
      const params = createMockParams();

      const screenSizes = [
        [640, 480],
        [1280, 720],
        [1920, 1080],
        [2560, 1440],
        [3840, 2160],
      ];

      for (const [width, height] of screenSizes) {
        expect(() => {
          cloudPass.render(passEncoder, viewProj, cameraPos, params, width, height);
        }).not.toThrow();
      }
    });

    it('handles default screen size', async () => {
      await cloudPass.initialize(device, 'bgra8unorm', 1);
      cloudPass.updateDepthTexture({} as GPUTextureView);

      const passEncoder = createMockPassEncoder();
      const viewProj = createIdentityMatrix();
      const cameraPos = [0, 100, 0];
      const params = createMockParams();

      // Call without screen size parameters (uses defaults)
      expect(() => {
        cloudPass.render(passEncoder, viewProj, cameraPos, params);
      }).not.toThrow();
    });
  });
});


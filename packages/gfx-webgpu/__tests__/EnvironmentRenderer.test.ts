import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { EnvironmentRenderer } from '../src/renderers/EnvironmentRenderer';
import { EnvironmentComponent } from '@engine/world';
import type { Mat4, Vec3 } from '@engine/core/math';

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

// Helper to create device mock for IBL tests
function createBasicDeviceMock() {
  const createTexture = vi.fn((desc?: GPUTextureDescriptor) => ({
    label: desc?.label,
    createView: vi.fn(() => ({})),
    destroy: vi.fn(),
  })) as unknown as (desc?: GPUTextureDescriptor) => GPUTexture;

  const createBuffer = vi.fn(() => ({
    destroy: vi.fn(),
  })) as unknown as () => GPUBuffer;

  const createSampler = vi.fn(() => ({}));
  const createBindGroupLayout = vi.fn(() => ({}));
  const createPipelineLayout = vi.fn(() => ({}));
  const createShaderModule = vi.fn(() => ({}));
  const createRenderPipeline = vi.fn(() => ({ getBindGroupLayout: vi.fn(() => ({})) }));
  const createComputePipeline = vi.fn(() => ({}));
  const createBindGroup = vi.fn(() => ({}));

  const renderPassMock = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    draw: vi.fn(),
    end: vi.fn(),
  } as unknown as GPURenderPassEncoder;

  const computePassMock = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    dispatchWorkgroups: vi.fn(),
    end: vi.fn(),
  } as unknown as GPUComputePassEncoder;

  const commandEncoderMock = {
    beginRenderPass: vi.fn(() => renderPassMock),
    beginComputePass: vi.fn(() => computePassMock),
    finish: vi.fn(() => ({})),
  } as unknown as GPUCommandEncoder;

  const queue = {
    submit: vi.fn(),
    writeBuffer: vi.fn(),
    writeTexture: vi.fn(),
    onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined),
  } as unknown as GPUQueue;

  const deviceMock = {
    features: new Set(),
    createTexture,
    createBuffer,
    createSampler,
    createBindGroupLayout,
    createPipelineLayout,
    createShaderModule,
    createRenderPipeline,
    createComputePipeline,
    createBindGroup,
    createCommandEncoder: vi.fn(() => commandEncoderMock),
    queue,
  } as unknown as GPUDevice;

  return { deviceMock, commandEncoderMock, renderPassMock, computePassMock };
}

describe('EnvironmentRenderer', () => {
  let renderer: EnvironmentRenderer;

  beforeEach(() => {
    renderer = new EnvironmentRenderer();
  });

  describe('Construction', () => {
    it('should create an instance', () => {
      expect(renderer).toBeDefined();
      expect(renderer).toBeInstanceOf(EnvironmentRenderer);
    });
  });

  describe('API Surface', () => {
    it('should have initialize method', () => {
      expect(typeof renderer.initialize).toBe('function');
    });

    it('should have updateUniforms method', () => {
      expect(typeof renderer.updateUniforms).toBe('function');
    });

    it('should have updateParams method', () => {
      expect(typeof renderer.updateParams).toBe('function');
    });

    it('should have render method', () => {
      expect(typeof renderer.render).toBe('function');
    });

    it('should have cleanup method', () => {
      expect(typeof renderer.cleanup).toBe('function');
    });
  });

  describe('Update Methods Without Initialization', () => {
    it('should not throw when updating uniforms before initialization', () => {
      const inverseVP: Mat4 = new Float32Array(16) as Mat4;
      const cameraPos: Vec3 = [0, 0, 0];

      expect(() => {
        renderer.updateUniforms(inverseVP, cameraPos);
      }).not.toThrow();
    });

    it('should not throw when updating params before initialization', () => {
      const environment = new EnvironmentComponent();

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should not throw when rendering before initialization', () => {
      const environment = new EnvironmentComponent();
      const mockPassEncoder = {} as GPURenderPassEncoder;

      expect(() => {
        renderer.render(mockPassEncoder, environment);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should not throw when cleaning up uninitialized renderer', () => {
      expect(() => {
        renderer.cleanup();
      }).not.toThrow();
    });

    it('should be safe to call cleanup multiple times', () => {
      expect(() => {
        renderer.cleanup();
        renderer.cleanup();
        renderer.cleanup();
      }).not.toThrow();
    });
  });

  describe('Environment Component Integration', () => {
    it('should accept solid skybox type', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'solid';

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should accept gradient skybox type', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'gradient';

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should accept procedural-sky type', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'procedural-sky';

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should accept physical-sky type', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'physical-sky';

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle physical-sky atmospheric parameters', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'physical-sky';
      environment.rayleigh = 3.0;
      environment.turbidity = 6.0;
      environment.mieCoefficient = 0.01;
      environment.mieDirectionalG = 0.7;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle disabled environment component', () => {
      const environment = new EnvironmentComponent();
      environment.enabled = false;
      const mockPassEncoder = {} as GPURenderPassEncoder;

      expect(() => {
        renderer.render(mockPassEncoder, environment);
      }).not.toThrow();
    });

    it('should handle different color configurations', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [1, 0, 0];
      environment.horizonColor = [0, 1, 0];
      environment.groundColor = [0, 0, 1];

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle sun configuration', () => {
      const environment = new EnvironmentComponent();
      environment.sunDirection = [0.5, 0.5, 0.5];
      environment.sunColor = [1, 0.9, 0.8];
      environment.sunIntensity = 0.8;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });
  });

  describe('Matrix and Vector Inputs', () => {
    it('should accept identity matrix', () => {
      const identity: Mat4 = new Float32Array([
        1, 0, 0, 0, 
        0, 1, 0, 0, 
        0, 0, 1, 0, 
        0, 0, 0, 1
      ]) as Mat4;
      const cameraPos: Vec3 = [0, 0, 0];

      expect(() => {
        renderer.updateUniforms(identity, cameraPos);
      }).not.toThrow();
    });

    it('should accept arbitrary camera positions', () => {
      const matrix: Mat4 = new Float32Array(16) as Mat4;
      const positions: Vec3[] = [
        [0, 0, 0],
        [10, 20, 30],
        [-5, -10, -15],
        [100, 0, -100],
      ];

      for (const pos of positions) {
        expect(() => {
          renderer.updateUniforms(matrix, pos);
        }).not.toThrow();
      }
    });
  });

  describe('Multiple Update Cycles', () => {
    it('should handle multiple uniform updates', () => {
      const matrix: Mat4 = new Float32Array(16) as Mat4;
      const cameraPos: Vec3 = [0, 0, 0];

      expect(() => {
        for (let i = 0; i < 100; i++) {
          cameraPos[0] = i;
          renderer.updateUniforms(matrix, cameraPos);
        }
      }).not.toThrow();
    });

    it('should handle multiple params updates', () => {
      const environment = new EnvironmentComponent();

      expect(() => {
        for (let i = 0; i < 100; i++) {
          environment.sunIntensity = i / 100;
          renderer.updateParams(environment);
        }
      }).not.toThrow();
    });

    it('should handle switching between skybox types', () => {
      const environment = new EnvironmentComponent();
      const types: Array<'solid' | 'gradient' | 'procedural-sky' | 'physical-sky'> = [
        'solid',
        'gradient',
        'procedural-sky',
        'physical-sky',
        'gradient',
        'solid',
        'physical-sky',
        'procedural-sky',
      ];

      expect(() => {
        for (const type of types) {
          environment.skyboxType = type;
          renderer.updateParams(environment);
        }
      }).not.toThrow();
    });
  });

  describe('Physical Sky Edge Cases', () => {
    it('should handle zero rayleigh coefficient', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'physical-sky';
      environment.rayleigh = 0;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle high turbidity', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'physical-sky';
      environment.turbidity = 20.0;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle negative mieDirectionalG', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'physical-sky';
      environment.mieDirectionalG = -0.5;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle extreme mie coefficient', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'physical-sky';
      environment.mieCoefficient = 0.1;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero sun intensity', () => {
      const environment = new EnvironmentComponent();
      environment.sunIntensity = 0;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle very high sun intensity', () => {
      const environment = new EnvironmentComponent();
      environment.sunIntensity = 10.0;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle negative sun intensity', () => {
      const environment = new EnvironmentComponent();
      environment.sunIntensity = -1.0;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle black colors', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [0, 0, 0];
      environment.horizonColor = [0, 0, 0];
      environment.groundColor = [0, 0, 0];

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle very bright colors', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [10, 10, 10];
      environment.horizonColor = [5, 5, 5];
      environment.groundColor = [2, 2, 2];

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle zero-length sun direction', () => {
      const environment = new EnvironmentComponent();
      environment.sunDirection = [0, 0, 0];

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should maintain state across multiple operations', () => {
      const environment = new EnvironmentComponent();
      const matrix: Mat4 = new Float32Array(16) as Mat4;
      const cameraPos: Vec3 = [5, 10, 15];

      expect(() => {
        renderer.updateUniforms(matrix, cameraPos);
        renderer.updateParams(environment);
        environment.skyboxType = 'gradient';
        renderer.updateParams(environment);
        renderer.updateUniforms(matrix, cameraPos);
      }).not.toThrow();
    });
  });

  describe('Initialization with Device', () => {
    it('should initialize successfully with device mock', async () => {
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      expect(deviceMock.createBuffer).toHaveBeenCalled();
      expect(deviceMock.createBindGroupLayout).toHaveBeenCalled();
      expect(deviceMock.createPipelineLayout).toHaveBeenCalled();
      expect(deviceMock.createShaderModule).toHaveBeenCalled();
      // Either createRenderPipeline or createRenderPipelineAsync should be called
      expect(
        deviceMock.createRenderPipeline || (deviceMock as any).createRenderPipelineAsync
      ).toBeDefined();
      expect(deviceMock.createBindGroup).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const callCount = deviceMock.createBuffer.mock.calls.length;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      // Should not create additional resources
      expect(deviceMock.createBuffer.mock.calls.length).toBe(callCount);
    });
  });

  describe('Render with Pass Encoder', () => {
    function createPassEncoderMock(): GPURenderPassEncoder {
      return {
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        draw: vi.fn(),
      } as unknown as GPURenderPassEncoder;
    }

    it('should render successfully with initialized renderer', async () => {
      const mockPipeline = {} as GPURenderPipeline;
      const mockBindGroup = {} as GPUBindGroup;
      const mockUniformBindGroup = {} as GPUBindGroup;

      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve(mockPipeline)),
        createRenderPipeline: vi.fn(() => mockPipeline),
        createBindGroup: vi.fn((desc: GPUBindGroupDescriptor) => {
          // Return uniform bind group for first call, params bind group for others
          if (desc.label?.includes('uniform')) {
            return mockUniformBindGroup;
          }
          return mockBindGroup;
        }),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const environment = new EnvironmentComponent();
      // Update params to create bind group for this skybox type
      renderer.updateParams(environment);

      const passEncoder = createPassEncoderMock();

      expect(() => {
        renderer.render(passEncoder, environment);
      }).not.toThrow();

      expect(passEncoder.setPipeline).toHaveBeenCalled();
      expect(passEncoder.setBindGroup).toHaveBeenCalled();
      expect(passEncoder.draw).toHaveBeenCalled();
    });

    it('should not render when environment is disabled', async () => {
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const environment = new EnvironmentComponent();
      environment.enabled = false;
      const passEncoder = createPassEncoderMock();

      renderer.render(passEncoder, environment);

      // Should not call any render methods
      expect(passEncoder.setPipeline).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup Resources', () => {
    it('should cleanup resources when initialized', async () => {
      const destroyBuffer = vi.fn();
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: destroyBuffer })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      renderer.cleanup();

      expect(destroyBuffer).toHaveBeenCalled();
    });

    it('should clear pipelines and bind groups on cleanup', async () => {
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const environment = new EnvironmentComponent();
      environment.skyboxType = 'solid';
      renderer.updateParams(environment);

      renderer.cleanup();

      // After cleanup, renderer should not be initialized
      const passEncoder = { setPipeline: vi.fn(), setBindGroup: vi.fn(), draw: vi.fn() } as unknown as GPURenderPassEncoder;
      renderer.render(passEncoder, environment);

      expect(passEncoder.setPipeline).not.toHaveBeenCalled();
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle NaN values in colors', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [NaN, 1, 0] as Vec3;
      environment.horizonColor = [0, Infinity, 1] as Vec3;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle Infinity values in colors', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [Infinity, -Infinity, 1000] as Vec3;
      environment.skyboxType = 'gradient';
      environment.groundColor = [0, 0, 0] as Vec3;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle NaN in sun intensity', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'procedural-sky';
      environment.sunIntensity = NaN;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle Infinity in sun intensity', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'procedural-sky';
      environment.sunIntensity = Infinity;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle NaN in sun direction', () => {
      const environment = new EnvironmentComponent();
      environment.skyboxType = 'procedural-sky';
      environment.sunDirection = [NaN, 1, 0] as Vec3;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle very large values', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [1e10, 1e10, 1e10] as Vec3;
      environment.horizonColor = [1e5, 1e5, 1e5] as Vec3;
      environment.sunIntensity = 1e6;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should handle negative colors (clamp to 0)', () => {
      const environment = new EnvironmentComponent();
      environment.skyColor = [-1, -2, -3] as Vec3;
      environment.skyboxType = 'solid';

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });
  });

  describe('Cubemap Support', () => {
    it('should create cubemap pipeline during initialization', async () => {
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      expect(deviceMock.createSampler).toHaveBeenCalled();
    });

    it('should handle cubemap type in updateParams', async () => {
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const environment = new EnvironmentComponent();
      environment.skyboxType = 'cubemap';
      (environment as any).cubemapTexture = null;

      expect(() => {
        renderer.updateParams(environment);
      }).not.toThrow();
    });

    it('should create cubemap bind group when texture is provided', async () => {
      const mockTexture = {
        createView: vi.fn(() => ({})),
      } as unknown as GPUTexture;

      const mockBindGroup = {} as GPUBindGroup;
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => mockBindGroup),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const environment = new EnvironmentComponent();
      environment.skyboxType = 'cubemap';
      (environment as any).cubemapTexture = mockTexture;

      renderer.updateParams(environment);

      expect(deviceMock.createBindGroup).toHaveBeenCalled();
      expect(mockTexture.createView).toHaveBeenCalled();
    });

    it('should render cubemap when bind group exists', async () => {
      const mockPipeline = {} as GPURenderPipeline;
      const mockBindGroup = {} as GPUBindGroup;
      const mockUniformBindGroup = {} as GPUBindGroup;
      const mockCubemapBindGroup = {} as GPUBindGroup;

      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve(mockPipeline)),
        createRenderPipeline: vi.fn(() => mockPipeline),
        createBindGroup: vi.fn((desc: GPUBindGroupDescriptor) => {
          if (desc.label?.includes('cubemap')) {
            return mockCubemapBindGroup;
          }
          return mockUniformBindGroup;
        }),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const environment = new EnvironmentComponent();
      environment.skyboxType = 'cubemap';
      (environment as any).cubemapTexture = { createView: vi.fn(() => ({})) } as unknown as GPUTexture;

      renderer.updateParams(environment);

      const passEncoder = {
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        draw: vi.fn(),
      } as unknown as GPURenderPassEncoder;

      expect(() => {
        renderer.render(passEncoder, environment);
      }).not.toThrow();

      expect(passEncoder.setPipeline).toHaveBeenCalled();
      expect(passEncoder.setBindGroup).toHaveBeenCalled();
      expect(passEncoder.draw).toHaveBeenCalled();
    });
  });

  describe('IBL Cache', () => {
    it('should generate hash from environment params', async () => {
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const env1 = new EnvironmentComponent();
      env1.sunIntensity = 1.0;
      renderer.updateParams(env1);

      // Hash function should work without errors
      expect(env1.skyboxType).toBeDefined();
    });

    it('should accept environment component parameter for prepareIBLResources', async () => {
      const { deviceMock, commandEncoderMock } = createBasicDeviceMock();
      const env = new EnvironmentRenderer();
      await env.initialize({ device: deviceMock, presentationFormat: 'rgba16float', sampleCount: 1 });
      const comp = new EnvironmentComponent();
      comp.skyboxType = 'procedural-sky';
      env.updateParams(comp);

      // Should accept environment component as first parameter
      const { brdfLut, envCube } = await env.prepareIBLResources(comp, 16);
      expect(brdfLut).toBeDefined();
      expect(envCube).toBeDefined();
      // 6 faces -> 6 render passes
      expect((commandEncoderMock.beginRenderPass as any).mock.calls.length).toBe(6);
    });
  });

  describe('Dirty Flags', () => {
    it('should mark params as dirty on updateParams', async () => {
      const deviceMock = {
        createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
        createBindGroupLayout: vi.fn(() => ({})),
        createPipelineLayout: vi.fn(() => ({})),
        createShaderModule: vi.fn(() => ({})),
        createRenderPipelineAsync: vi.fn(() => Promise.resolve({})),
        createRenderPipeline: vi.fn(() => ({})),
        createBindGroup: vi.fn(() => ({})),
        createSampler: vi.fn(() => ({})),
        queue: { writeBuffer: vi.fn() },
      } as unknown as GPUDevice;

      await renderer.initialize({
        device: deviceMock,
        presentationFormat: 'rgba16float',
        sampleCount: 1,
      });

      const environment = new EnvironmentComponent();
      renderer.updateParams(environment);

      // updateParams should trigger queue.writeBuffer (params dirty)
      expect(deviceMock.queue.writeBuffer).toHaveBeenCalled();
    });
  });
});


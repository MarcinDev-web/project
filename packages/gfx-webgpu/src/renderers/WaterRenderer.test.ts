import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { WaterRenderer } from './WaterRenderer';

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

// Inline mock functions to avoid @engine/test-utils resolution issues
function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
  const canvas = {
    width,
    height,
    clientWidth: width,
    clientHeight: height,
    getContext: vi.fn().mockReturnValue({
      configure: vi.fn(),
      unconfigure: vi.fn(),
      getCurrentTexture: vi.fn().mockReturnValue({
        createView: vi.fn().mockReturnValue({}),
        destroy: vi.fn(),
      }),
    }),
    getBoundingClientRect: vi.fn().mockReturnValue({
      width,
      height,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return canvas as unknown as HTMLCanvasElement;
}

function createMockGPUDevice(): GPUDevice {
  return {
    createBuffer: vi.fn().mockReturnValue({
      destroy: vi.fn(),
      getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(256)),
      unmap: vi.fn(),
      mapAsync: vi.fn().mockResolvedValue(undefined),
    }),
    createTexture: vi.fn().mockReturnValue({
      createView: vi.fn().mockReturnValue({}),
      destroy: vi.fn(),
    }),
    createSampler: vi.fn().mockReturnValue({}),
    createBindGroupLayout: vi.fn().mockReturnValue({}),
    createPipelineLayout: vi.fn().mockReturnValue({}),
    createShaderModule: vi.fn().mockReturnValue({}),
    createRenderPipeline: vi.fn().mockReturnValue({
      getBindGroupLayout: vi.fn().mockReturnValue({}),
    }),
    createComputePipeline: vi.fn().mockReturnValue({}),
    createBindGroup: vi.fn().mockReturnValue({}),
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
  } as unknown as GPUDevice;
}

describe('WaterRenderer', () => {
  let device: GPUDevice;
  let canvas: HTMLCanvasElement;

  beforeEach(async () => {
    device = createMockGPUDevice();
    canvas = createMockCanvas();
  });

  afterEach(() => {
    device?.destroy();
  });

  it('initializes successfully', async () => {
    const renderer = new WaterRenderer();
    await expect(
      renderer.initialize({
        device,
        presentationFormat: 'bgra8unorm',
        sampleCount: 1,
      })
    ).resolves.not.toThrow();

    renderer.dispose();
  });

  it('disposes resources correctly', async () => {
    const renderer = new WaterRenderer();
    await renderer.initialize({
      device,
      presentationFormat: 'bgra8unorm',
      sampleCount: 1,
    });

    // Should not throw when disposing
    expect(() => renderer.dispose()).not.toThrow();
    
    // Can dispose multiple times safely
    expect(() => renderer.dispose()).not.toThrow();
  });

  it('does not render when not initialized', () => {
    const renderer = new WaterRenderer();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
    });

    // Should not throw, just return early
    expect(() => {
      renderer.render(
        pass,
        null,
        new Float32Array(16) as any,
        [0, 0, 0],
        0,
        null,
        null,
        null
      );
    }).not.toThrow();

    pass.end();
    encoder.finish();
  });

  it('renders without errors when initialized', async () => {
    const renderer = new WaterRenderer();
    await renderer.initialize({
      device,
      presentationFormat: 'bgra8unorm',
      sampleCount: 1,
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
    });

    // Should not throw with valid inputs
    expect(() => {
      renderer.render(
        pass,
        null,
        new Float32Array(16) as any,
        [0, 0, 0],
        0,
        null,
        null,
        null
      );
    }).not.toThrow();

    pass.end();
    encoder.finish();

    renderer.dispose();
  });
});


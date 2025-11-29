/**
 * Test setup for @engine/gfx-webgpu
 * Mocks WebGPU globals that are not available in Node.js/jsdom
 */

import { vi } from 'vitest';

// Mock @engine/wasm-animation to avoid WASM loading issues
vi.mock('@engine/wasm-animation', () => ({
  AnimationWorld: class {
    constructor() {}
    free() {}
    add_skeleton() {}
    create_instance() { return true; }
    remove_instance() {}
    get_output_buffer() { return new Float32Array(0); }
    set_instance_bone() {}
    set_instance_state() {}
    get_output_buffer_len() { return 0; }
    get_output_buffer_ptr() { return 0; }
    get_instance_joint_count() { return 0; }
    get_instance_local_scales_ptr() { return 0; }
    get_instance_local_rotations_ptr() { return 0; }
    get_instance_local_translations_ptr() { return 0; }
    step() {}
    add_clip() {}
  },
  init: vi.fn().mockResolvedValue({}),
}));

// Mock navigator.gpu for WebGPU tests
if (typeof navigator !== 'undefined') {
  const mockGpu = {
    requestAdapter: async () => ({
      limits: {
        maxBindGroups: 4,
        maxTextureDimension2D: 8192,
      },
      features: {
        has: () => true,
      },
      requestDevice: async () => ({
        queue: {
          submit: () => {},
        },
        createCommandEncoder: () => ({
          beginRenderPass: () => ({
            setPipeline: () => {},
            setBindGroup: () => {},
            setVertexBuffer: () => {},
            setIndexBuffer: () => {},
            draw: () => {},
            drawIndexed: () => {},
            end: () => {},
          }),
          finish: () => {},
        }),
        createRenderPipeline: () => ({}),
        createRenderPipelineAsync: async () => ({}),
        createComputePipelineAsync: async () => ({}),
        createBindGroup: () => ({}),
        createBuffer: () => ({
          destroy: () => {},
        }),
        createTexture: () => ({
          createView: () => ({}),
          destroy: () => {},
        }),
        createSampler: () => ({}),
        createShaderModule: () => ({}),
      }),
    }),
  };

  if (!(globalThis as any).navigator) {
    (globalThis as any).navigator = {};
  }
  
  // Force overwrite or define
  try {
    (globalThis as any).navigator.gpu = mockGpu;
  } catch (e) {
    // If read-only (jsdom), try Object.defineProperty
    Object.defineProperty(globalThis.navigator, 'gpu', {
      value: mockGpu,
      writable: true,
      configurable: true,
    });
  }
}

// Polyfill ImageData if not available (for Node.js/jsdom)
if (typeof ImageData === 'undefined') {
  (globalThis as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;

    constructor(widthOrData: number | Uint8ClampedArray, height?: number) {
      if (typeof widthOrData === 'number') {
        this.width = widthOrData;
        this.height = height || widthOrData;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = widthOrData;
        this.width = height || Math.sqrt(widthOrData.length / 4);
        this.height = height || Math.sqrt(widthOrData.length / 4);
      }
    }
  };
}

// Mock HTMLCanvasElement.getContext for 2D canvas
if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(
    contextId: string,
    options?: any
  ): any {
    if (contextId === '2d') {
      // Create a minimal mock 2D context
      const canvas = this as HTMLCanvasElement;
      return {
        canvas,
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        font: '10px sans-serif',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        arcTo: () => {},
        bezierCurveTo: () => {},
        rect: () => {},
        stroke: () => {},
        fill: () => {},
        clip: () => {},
        save: () => {},
        restore: () => {},
        scale: () => {},
        rotate: () => {},
        translate: () => {},
        transform: () => {},
        setTransform: () => {},
        resetTransform: () => {},
        setLineDash: () => {},
        getLineDash: () => [],
        measureText: () => ({ width: 0 }),
        fillText: () => {},
        strokeText: () => {},
        drawImage: () => {},
        createLinearGradient: () => ({
          addColorStop: () => {},
        }),
        createRadialGradient: () => ({
          addColorStop: () => {},
        }),
        createPattern: () => null,
        createImageData: (width: number, height: number) => {
          return new ImageData(width, height);
        },
        getImageData: (sx: number, sy: number, sw: number, sh: number) => {
          return new ImageData(sw, sh);
        },
        putImageData: () => {},
        quadraticCurveTo: () => {},
        isPointInPath: () => false,
        isPointInStroke: () => false,
      } as unknown as CanvasRenderingContext2D;
    }
    // For other context types, use original implementation
    return originalGetContext.call(this, contextId, options);
  };
}

// WebGPU Buffer Usage Flags
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

// WebGPU Texture Usage Flags
(globalThis as any).GPUTextureUsage = {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  STORAGE_BINDING: 0x08,
  RENDER_ATTACHMENT: 0x10,
};

// WebGPU Shader Stage Flags
(globalThis as any).GPUShaderStage = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
};

// WebGPU Color Write Flags
(globalThis as any).GPUColorWrite = {
  RED: 0x1,
  GREEN: 0x2,
  BLUE: 0x4,
  ALPHA: 0x8,
  ALL: 0xF,
};

// WebGPU Map Mode Flags
(globalThis as any).GPUMapMode = {
  READ: 0x0001,
  WRITE: 0x0002,
};

// Additional WebGPU constants that might be needed
(globalThis as any).GPUTextureFormat = {
  // Common formats
  RGBA8Unorm: 'rgba8unorm',
  RGBA8UnormSRGB: 'rgba8unorm-srgb',
  BGRA8Unorm: 'bgra8unorm',
  BGRA8UnormSRGB: 'bgra8unorm-srgb',
  Depth24Plus: 'depth24plus',
  Depth24PlusStencil8: 'depth24plus-stencil8',
};


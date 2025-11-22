/**
 * Test setup with lazy-loaded polyfills for better performance
 * Only loads polyfills when actually needed by tests
 */

import { afterEach, vi } from 'vitest';

// Mock WASM collision package to avoid ESM integration errors in tests
// This prevents Vite from trying to load WASM files during test execution

// 1. Mock the package module itself (if aliased correctly or resolved via node)
vi.mock('@engine/wasm-collision', () => ({
  init: vi.fn().mockResolvedValue({}),
  getTrsBuffers: () => ({ positions: new Float32Array(0), rotations: new Float32Array(0), scales: new Float32Array(0) }),
  releaseTrsBuffers: vi.fn(),
}));

// 2. Mock the specific internal file that might be imported by the package
vi.mock('@engine/wasm-collision/pkg/collision.js', () => ({
  default: {
    init: vi.fn().mockResolvedValue(undefined),
    init_panic_hook: vi.fn(),
  },
  init: vi.fn().mockResolvedValue(undefined),
  init_panic_hook: vi.fn(),
}));

// 3. (Removed regex mock as it is not supported)

// 4. Mock @engine/wasm-animation to avoid WASM loading issues
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


// Check if we're in a browser-like environment (jsdom)
const isBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';

// Lazy initialization flag
let browserPolyfillsInitialized = false;

/**
 * Lazy load browser/DOM polyfills only when needed
 * Call this from tests that require DOM APIs
 */
export function initBrowserPolyfills() {
  // Check again at call time in case jsdom wasn't ready at module load
  // In jsdom environment, document should be available, but check dynamically
  const envReady = typeof window !== 'undefined' && typeof document !== 'undefined';
  if (browserPolyfillsInitialized) return;
  
  // If environment not ready yet, skip initialization (will be retried if needed)
  if (!envReady) return;
  
  browserPolyfillsInitialized = true;

  // ResizeObserver polyfill
  if (typeof (globalThis as any).ResizeObserver === 'undefined') {
    class ResizeObserverPolyfill {
      constructor(_callback: ResizeObserverCallback) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as any).ResizeObserver = ResizeObserverPolyfill as any;
  }

  // HTMLCanvasElement polyfills for jsdom
  if (typeof HTMLCanvasElement !== 'undefined') {
    // Polyfill CanvasRenderingContext2D methods if missing (JSDOM)
    if (typeof CanvasRenderingContext2D !== 'undefined') {
      if (!CanvasRenderingContext2D.prototype.setLineDash) {
        CanvasRenderingContext2D.prototype.setLineDash = function() {};
      }
    }

    // Override getContext to support any context type (including 'webgpu')
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextType: string, ...args: any[]) {
      // Try original implementation first (for standard contexts like '2d')
      if (originalGetContext) {
        const ctx = originalGetContext.call(this, contextType, ...args);
        if (ctx) return ctx;
      }
      
      // Fallback mock for WebGPU and other contexts
      return {
        canvas: this,
        configure: () => {},
        unconfigure: () => {},
        getCurrentTexture: () => ({
          createView: () => ({}),
          destroy: () => {},
        }),
      };
    };
    
    // Override getBoundingClientRect to use canvas dimensions
    const originalGetBoundingClientRect = HTMLCanvasElement.prototype.getBoundingClientRect;
    HTMLCanvasElement.prototype.getBoundingClientRect = function () {
      // Try original if available
      if (originalGetBoundingClientRect) {
        const rect = originalGetBoundingClientRect.call(this);
        // If rect has valid dimensions, use it
        if (rect.width > 0 || rect.height > 0) {
          return rect;
        }
      }
      
      // Fallback to canvas dimensions
      return {
        left: 0,
        top: 0,
        right: this.width || 0,
        bottom: this.height || 0,
        width: this.width || 0,
        height: this.height || 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
      get() {
        return this.width || 800;
      },
      configurable: true,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
      get() {
        return this.height || 600;
      },
      configurable: true,
    });
  }
}

// WebGPU polyfills - lazy loaded
let webgpuPolyfillsInitialized = false;

/**
 * Lazy load WebGPU polyfills only when needed
 * Call this from tests that require WebGPU APIs
 */
export function initWebGPUPolyfills() {
  if (webgpuPolyfillsInitialized) return;
  webgpuPolyfillsInitialized = true;

  // Mock navigator.gpu for WebGPU tests
  if (typeof navigator !== 'undefined' && !(globalThis as any).navigator?.gpu) {
    if (!(globalThis as any).navigator) {
      (globalThis as any).navigator = {};
    }
    (globalThis as any).navigator.gpu = {
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
  }

  // Minimal WebGPU constants for tests (jsdom doesn't provide them)
  if (typeof (globalThis as any).GPUBufferUsage === 'undefined') {
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
    } as const;
  }

  if (typeof (globalThis as any).GPUTextureUsage === 'undefined') {
    (globalThis as any).GPUTextureUsage = {
      COPY_SRC: 0x01,
      COPY_DST: 0x02,
      TEXTURE_BINDING: 0x04,
      STORAGE_BINDING: 0x08,
      RENDER_ATTACHMENT: 0x10,
    } as const;
  }

  if (typeof (globalThis as any).GPUMapMode === 'undefined') {
    (globalThis as any).GPUMapMode = {
      READ: 0x0001,
      WRITE: 0x0002,
    } as const;
  }

  if (typeof (globalThis as any).GPUShaderStage === 'undefined') {
    (globalThis as any).GPUShaderStage = {
      VERTEX: 0x1,
      FRAGMENT: 0x2,
      COMPUTE: 0x4,
    } as const;
  }
}

// Animation polyfills - always needed for timing in tests
if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 16) as any;
  };
  (globalThis as any).cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
}

// Device pixel ratio - lightweight, always load
if (typeof (globalThis as any).devicePixelRatio === 'undefined') {
  Object.defineProperty(globalThis, 'devicePixelRatio', {
    value: 1,
    writable: true,
    configurable: true,
  });
}

// Auto-initialize browser polyfills in jsdom environment
// Check dynamically since jsdom might initialize after module load
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initBrowserPolyfills();
  
  // Polyfill Pointer Events methods which are missing in JSDOM
  if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.hasPointerCapture = () => false;
  }
}

// Global cleanup: Clear all timers after each test to prevent hanging processes
// This ensures that any intervals/timeouts created during tests are cleaned up

// Use fake timers to track and clean up all timers
// This prevents tests from hanging due to uncleaned intervals/timeouts
afterEach(() => {
  // Clear all real timers that might have been created
  // This is a safety net for tests that don't use fake timers
  try {
    // Vitest provides clearAllTimers through vi
    if (vi.clearAllTimers) {
      vi.clearAllTimers();
    }
  } catch {
    // Ignore if clearAllTimers is not available
  }
  
  // Also clear all mocks to prevent state leakage between tests
  vi.clearAllMocks();
});
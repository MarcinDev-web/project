/**
 * Test setup with lazy-loaded polyfills for better performance
 * Only loads polyfills when actually needed by tests
 */

// Check if we're in a browser-like environment (jsdom)
const isBrowserEnv = typeof window !== 'undefined' && typeof document !== 'undefined';

// Lazy initialization flag
let browserPolyfillsInitialized = false;

/**
 * Lazy load browser/DOM polyfills only when needed
 * Call this from tests that require DOM APIs
 */
export function initBrowserPolyfills() {
  if (browserPolyfillsInitialized || !isBrowserEnv) return;
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
    HTMLCanvasElement.prototype.getContext ??= function () {
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
    HTMLCanvasElement.prototype.getBoundingClientRect ??= function () {
      return {
        left: 0,
        top: 0,
        right: this.width ?? 0,
        bottom: this.height ?? 0,
        width: this.width ?? 0,
        height: this.height ?? 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
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
        requestDevice: async () => ({
          queue: {
            submit: () => {},
          },
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

// Auto-initialize browser polyfills only in jsdom environment
if (isBrowserEnv) {
  initBrowserPolyfills();
}

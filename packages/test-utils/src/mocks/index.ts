/**
 * Reusable mock objects and utilities
 */

import { vi } from 'vitest';

/**
 * Creates a mock HTMLCanvasElement with common methods and properties
 */
export function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  // Mock style object
  Object.defineProperty(canvas, 'style', {
    value: { cursor: '' },
    writable: true,
    configurable: true,
  });

  // Mock getBoundingClientRect
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));

  // Mock getContext
  const contextMock = {
    canvas,
    configure: vi.fn(),
    unconfigure: vi.fn(),
    getCurrentTexture: vi.fn(() => ({
      createView: vi.fn(() => ({})),
      destroy: vi.fn(),
    })),
  } as unknown as RenderingContext;

  const getContextMock: typeof canvas.getContext = vi.fn(() => contextMock);
  canvas.getContext = getContextMock;

  return canvas;
}

/**
 * Creates a mock WebGPU adapter
 */
function createMockAdapter() {
  return {
    requestDevice: vi.fn(() => Promise.resolve(createMockGPUDevice())),
  };
}

/**
 * Creates a mock WebGPU device with common methods
 */
export function createMockGPUDevice() {
  return {
    createBuffer: vi.fn(() => ({
      destroy: vi.fn(),
      getMappedRange: vi.fn(),
      mapAsync: vi.fn(() => Promise.resolve()),
      unmap: vi.fn(),
    })),
    createTexture: vi.fn(() => ({
      destroy: vi.fn(),
      createView: vi.fn(() => ({})),
    })),
    createShaderModule: vi.fn(() => ({
      getCompilationInfo: vi.fn(() => Promise.resolve({ messages: [] })),
    })),
    createRenderPipeline: vi.fn(() => ({})),
    createComputePipeline: vi.fn(() => ({})),
    createCommandEncoder: vi.fn(() => ({
      beginRenderPass: vi.fn(() => ({
        end: vi.fn(),
        setPipeline: vi.fn(),
        draw: vi.fn(),
      })),
      finish: vi.fn(() => ({})),
    })),
    createBindGroup: vi.fn(() => ({})),
    createBindGroupLayout: vi.fn(() => ({})),
    createPipelineLayout: vi.fn(() => ({})),
    createSampler: vi.fn(() => ({})),
    destroy: vi.fn(),
    queue: {
      submit: vi.fn(),
      writeBuffer: vi.fn(),
      writeTexture: vi.fn(),
    },
  };
}

/**
 * Creates a mock WebGPU navigator with adapter support
 */
export function createMockGPU() {
  return {
    requestAdapter: vi.fn(() => Promise.resolve(createMockAdapter())),
  };
}

/**
 * Creates a mock ResizeObserver
 */
export function createMockResizeObserver() {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();

  const ResizeObserver = vi.fn(() => ({
    observe,
    unobserve,
    disconnect,
  }));

  return { ResizeObserver, observe, unobserve, disconnect };
}

/**
 * Creates a mock performance timer
 */
export function createMockPerformance() {
  let currentTime = 0;

  return {
    now: vi.fn(() => currentTime),
    advance: (ms: number) => {
      currentTime += ms;
    },
    reset: () => {
      currentTime = 0;
    },
  };
}

/**
 * Creates a mock requestAnimationFrame
 */
export function createMockAnimationFrame() {
  let frameId = 0;
  let currentTime = 0;
  const callbacks = new Map<number, FrameRequestCallback>();

  return {
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const id = ++frameId;
      callbacks.set(id, callback);
      return id;
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      callbacks.delete(id);
    }),
    tick: (deltaTime = 16) => {
      currentTime += deltaTime;
      const cbs = Array.from(callbacks.values());
      callbacks.clear();
      cbs.forEach((cb) => cb(currentTime));
    },
    getCurrentTime: () => currentTime,
    reset: () => {
      frameId = 0;
      currentTime = 0;
      callbacks.clear();
    },
  };
}

/**
 * Creates a mock event dispatcher
 */
export function createMockEventDispatcher<T extends Event = Event>() {
  const listeners = new Map<string, Set<EventListener>>();

  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)!.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    }),
    dispatchEvent: vi.fn((event: T) => {
      const typeListeners = listeners.get(event.type);
      if (typeListeners) {
        typeListeners.forEach((listener) => listener(event));
      }
      return true;
    }),
    clearListeners: () => {
      listeners.clear();
    },
  };
}

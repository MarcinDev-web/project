import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initRenderer } from '../rendering/index';

function mockStatusElement(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function mockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'width', { value: 640, writable: true });
  Object.defineProperty(canvas, 'height', { value: 480, writable: true });
  document.body.appendChild(canvas);
  return canvas;
}

describe('initRenderer', () => {
  let originalNavigatorGpu: (typeof navigator)['gpu'];
  let originalResizeObserver: typeof ResizeObserver;
  let canvas: HTMLCanvasElement;
  let statusEl: HTMLElement;
  let resizeObserverCallbacks: ResizeObserverCallback[];
  let resizeObserverInstances: Array<{
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }>;

  beforeEach(() => {
    originalNavigatorGpu = navigator.gpu;
    originalResizeObserver = (globalThis as any).ResizeObserver;
    resizeObserverCallbacks = [];
    resizeObserverInstances = [];

    (globalThis as any).ResizeObserver = vi.fn(function (
      this: any,
      callback: ResizeObserverCallback
    ) {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
      resizeObserverCallbacks.push(callback);
      resizeObserverInstances.push({ observe: this.observe, disconnect: this.disconnect });
    }) as unknown as typeof ResizeObserver;

    canvas = mockCanvas();
    statusEl = mockStatusElement();
  });

  afterEach(() => {
    try {
      canvas?.remove();
    } catch {}
    try {
      statusEl?.remove();
    } catch {}
    (navigator as any).gpu = originalNavigatorGpu;
    if (originalResizeObserver) {
      (globalThis as any).ResizeObserver = originalResizeObserver;
    } else {
      delete (globalThis as any).ResizeObserver;
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('throws when navigator.gpu is missing', async () => {
    (navigator as any).gpu = undefined as any;
    await expect(() =>
      initRenderer({
        canvas,
        statusEl,
        getOrbitState: () => ({ yaw: 0, pitch: 0, distance: 3 }),
      })
    ).rejects.toThrow('WebGPU not supported');
  });

  it('throws when requestAdapter returns null', async () => {
    (navigator as any).gpu = {
      requestAdapter: vi.fn().mockResolvedValue(null),
    };
    await expect(
      initRenderer({
        canvas,
        statusEl,
        getOrbitState: () => ({ yaw: 0, pitch: 0, distance: 3 }),
      })
    ).rejects.toThrow('Failed to acquire GPU adapter.');
  });

  function createCommandEncoderMock() {
    const renderPassMock = {
      setPipeline: vi.fn(),
      setVertexBuffer: vi.fn(),
      setIndexBuffer: vi.fn(),
      setBindGroup: vi.fn(),
      draw: vi.fn(),
      drawIndexed: vi.fn(),
      writeTimestamp: vi.fn(),
      end: vi.fn(),
    };

    const computePassMock = {
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      dispatchWorkgroups: vi.fn(),
      writeTimestamp: vi.fn(),
      end: vi.fn(),
    };

    const commandEncoderMock = {
      beginRenderPass: vi.fn(() => renderPassMock),
      beginComputePass: typeof GPUCommandEncoder !== 'undefined'
        ? vi.fn(() => computePassMock)
        : undefined,
      writeTimestamp: vi.fn(),
      resolveQuerySet: vi.fn(),
      copyBufferToBuffer: vi.fn(),
      finish: vi.fn(() => ({})),
    } as unknown as GPUCommandEncoder;

    return { commandEncoderMock, renderPassMock, computePassMock };
  }

  function createCanvasContextMock(canvasEl: HTMLCanvasElement) {
    const currentTexture = { createView: vi.fn(() => ({})) };
    const ctxMock = {
      configure: vi.fn(),
      getCurrentTexture: vi.fn(() => currentTexture),
    } as unknown as GPUCanvasContext;
    (canvasEl as any).getContext = vi.fn((type: string) => (type === 'webgpu' ? ctxMock : null));

    return { ctxMock };
  }

  function createDeviceMock({
    useTimestamps,
    commandEncoderMock,
  }: {
    useTimestamps: boolean;
    commandEncoderMock: GPUCommandEncoder;
  }) {
    const buffersByLabel = new Map<string, any>();
    const createBuffer = vi.fn((descriptor?: GPUBufferDescriptor) => {
      const label = descriptor?.label ?? `buffer-${createBuffer.mock.calls.length}`;
      const buffer: any = { label, destroy: vi.fn() };
      if (label === 'frame-timestamp-read-buffer') {
        const range = new ArrayBuffer(16);
        const big = new BigUint64Array(range);
        big[0] = BigInt(1);
        big[1] = BigInt(4);
        buffer.mapAsync = vi.fn().mockResolvedValue(undefined);
        buffer.getMappedRange = vi.fn(() => range);
        buffer.unmap = vi.fn();
      }
      buffersByLabel.set(label, buffer);
      return buffer;
    });

    const texturesByLabel = new Map<string, any>();
    const createTexture = vi.fn((descriptor?: GPUTextureDescriptor) => {
      const label = descriptor?.label ?? `texture-${createTexture.mock.calls.length}`;
      const texture = {
        label,
        destroy: vi.fn(),
        createView: vi.fn(() => ({})),
      };
      texturesByLabel.set(label, texture);
      return texture as unknown as GPUTexture;
    });

    const timestampQuerySet = useTimestamps ? { destroy: vi.fn() } : null;

    const deviceMock = {
      features: useTimestamps ? new Set(['timestamp-query']) : new Set(),
      lost: new Promise(() => {}),
      createQuerySet: vi.fn(() => timestampQuerySet),
      createBuffer,
      createSampler: vi.fn(() => ({})),
      createTexture,
      createBindGroupLayout: vi.fn(() => ({})),
      createPipelineLayout: vi.fn(() => ({})),
      createShaderModule: vi.fn(() => ({
        getCompilationInfo: vi.fn().mockResolvedValue({ messages: [] }),
      })),
      createRenderPipeline: vi.fn(() => ({})),
      pushErrorScope: vi.fn(),
      popErrorScope: vi.fn().mockResolvedValue(null),
      createBindGroup: vi.fn(() => ({})),
      createCommandEncoder: vi.fn(() => commandEncoderMock),
      queue: {
        submit: vi.fn(),
        writeBuffer: vi.fn(),
        writeTexture: vi.fn(),
        onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined),
      },
      destroy: vi.fn(),
    } as unknown as GPUDevice;

    return { deviceMock, buffersByLabel, texturesByLabel, timestampQuerySet };
  }

  function setupSuccessfulInitMocks({ useTimestamps = false }: { useTimestamps?: boolean } = {}) {
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(((cb: FrameRequestCallback) => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    }) as any);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(((handle: number) => {
      frameCallbacks[handle - 1] = (() => {}) as any;
    }) as any);

    const { commandEncoderMock, renderPassMock, computePassMock } = createCommandEncoderMock();
    const { ctxMock } = createCanvasContextMock(canvas);
    const { deviceMock, buffersByLabel, texturesByLabel, timestampQuerySet } = createDeviceMock({
      useTimestamps,
      commandEncoderMock,
    });
    const adapterMock = {
      features: new Set(useTimestamps ? ['timestamp-query'] : []),
      requestDevice: vi.fn().mockResolvedValue(deviceMock),
      requestAdapterInfo: vi.fn().mockResolvedValue({ name: 'mock adapter' }),
    } as unknown as GPUAdapter;

    (navigator as any).gpu = {
      requestAdapter: vi.fn().mockResolvedValue(adapterMock),
      getPreferredCanvasFormat: vi.fn(() => 'bgra8unorm'),
    };

    return {
      frameCallbacks,
      ctxMock,
      renderPassMock,
      computePassMock,
      commandEncoderMock,
      deviceMock,
      buffersByLabel,
      texturesByLabel,
      timestampQuerySet,
      resizeObserverCallbacks,
      resizeObserverInstances,
    };
  }

  it('initializes renderer and exposes cleanup/abort', async () => {
    const mocks = setupSuccessfulInitMocks();
    const getOrbitState = vi.fn(() => ({ yaw: 0, pitch: 0, distance: 3 }));
    const renderer = await initRenderer({ canvas, statusEl, getOrbitState });

    expect(renderer).toHaveProperty('cleanup');
    expect(renderer).toHaveProperty('abort');
    expect(typeof renderer.cleanup).toBe('function');
    expect(typeof renderer.abort).toBe('function');

    expect(getOrbitState).not.toHaveBeenCalled();

    renderer.abort();
    renderer.cleanup();

    expect(mocks.ctxMock.configure).toHaveBeenCalled();
  });

  it('renders frames and updates orbit state each tick without timestamps', async () => {
    const mocks = setupSuccessfulInitMocks();
    const getOrbitState = vi.fn(() => ({ yaw: 0.5, pitch: 0.3, distance: 4 }));
    const renderer = await initRenderer({ canvas, statusEl, getOrbitState });

    expect(mocks.frameCallbacks).toHaveLength(1);

    const frame = mocks.frameCallbacks[0]!;
    frame(16);
    frame(32);

    expect(getOrbitState).toHaveBeenCalledTimes(2);
    expect(mocks.commandEncoderMock.beginRenderPass).toHaveBeenCalled();
    if (typeof (mocks.commandEncoderMock as any).beginComputePass === 'function') {
      expect((mocks.commandEncoderMock as any).beginComputePass).toHaveBeenCalled();
      expect(mocks.computePassMock?.dispatchWorkgroups).toHaveBeenCalled();
    }
    expect(mocks.commandEncoderMock.writeTimestamp).not.toHaveBeenCalled();
    expect(mocks.commandEncoderMock.resolveQuerySet).not.toHaveBeenCalled();
    expect(mocks.commandEncoderMock.copyBufferToBuffer).not.toHaveBeenCalled();
    expect(mocks.deviceMock.queue.submit).toHaveBeenCalledTimes(2);

    renderer.cleanup();
  });

  it('resizes canvas and recreates depth/MSAA textures when client size changes', async () => {
    const mocks = setupSuccessfulInitMocks();
    const getOrbitState = vi.fn(() => ({ yaw: 0, pitch: 0, distance: 3 }));
    const renderer = await initRenderer({ canvas, statusEl, getOrbitState });

    expect(canvas.width).toBeGreaterThan(0);

    Object.defineProperty(canvas, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 240, configurable: true });

    resizeObserverCallbacks.forEach((cb) =>
      cb(
        [{ contentRect: new DOMRect(0, 0, 320, 240) } as ResizeObserverEntry],
        resizeObserverInstances[0] as unknown as ResizeObserver
      )
    );

    expect(canvas.width).toBe(Math.max(1, Math.round((window.devicePixelRatio ?? 1) * 320)));
    expect(canvas.height).toBe(Math.max(1, Math.round((window.devicePixelRatio ?? 1) * 240)));

    const depthTexture = mocks.texturesByLabel.get('frame-depth-texture');
    const msaaTexture = mocks.texturesByLabel.get('frame-msaa-color-texture');
    expect(depthTexture?.createView).toHaveBeenCalled();
    expect(msaaTexture?.createView).toHaveBeenCalled();

    renderer.cleanup();
  });

  it('emits GPU timestamps when supported and cleans up resources', async () => {
    const mocks = setupSuccessfulInitMocks({ useTimestamps: true });
    const getOrbitState = vi.fn(() => ({ yaw: 0, pitch: 0, distance: 3 }));
    const renderer = await initRenderer({ canvas, statusEl, getOrbitState });

    expect(mocks.frameCallbacks).toHaveLength(1);

    const frame = mocks.frameCallbacks[0]!;
    frame(16);

    expect(mocks.commandEncoderMock.writeTimestamp).toHaveBeenCalled();
    expect(mocks.commandEncoderMock.resolveQuerySet).toHaveBeenCalled();
    expect(mocks.commandEncoderMock.copyBufferToBuffer).toHaveBeenCalled();

    renderer.cleanup();

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(mocks.resizeObserverInstances[0]?.disconnect).toHaveBeenCalled();
    expect(mocks.timestampQuerySet?.destroy).toHaveBeenCalled();
    expect(mocks.buffersByLabel.get('frame-timestamp-resolve-buffer')?.destroy).toHaveBeenCalled();
    expect(mocks.buffersByLabel.get('frame-timestamp-read-buffer')?.destroy).toHaveBeenCalled();
    expect(mocks.deviceMock.destroy).toHaveBeenCalled();
  });
});

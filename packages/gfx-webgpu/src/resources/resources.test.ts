/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeometryData } from './resources';
import { createPipelines, createTimestampResources, validateGeometryData } from './resources';
import { Logger } from '@engine/core/utils';

vi.mock('@engine/core/utils', () => {
  const warn = vi.fn();
  const error = vi.fn();
  const info = vi.fn();
  return {
    Logger: {
      warn,
      error,
      info,
    },
  };
});

const makeVertex = (
  position: [number, number, number],
  normal: [number, number, number] = [0, 0, 1],
  ao = 1.0
) => {
  const out = new Uint8Array(24);
  const view = new DataView(out.buffer);
  view.setFloat32(0, position[0], true);
  view.setFloat32(4, position[1], true);
  view.setFloat32(8, position[2], true);
  out[12] = Math.round(normal[0] * 127) & 0xff;
  out[13] = Math.round(normal[1] * 127) & 0xff;
  out[14] = Math.round(normal[2] * 127) & 0xff;
  out[15] = 0;
  view.setUint16(16, 0, true);
  view.setUint16(18, 0, true);
  out[20] = Math.max(0, Math.min(255, Math.round(ao * 255)));
  out[21] = 0;
  out[22] = 0;
  out[23] = 0;
  return out;
};

const combineVertices = (verts: Uint8Array[]): Uint8Array => {
  const buffer = new Uint8Array(verts.length * 24);
  verts.forEach((vert, index) => buffer.set(vert, index * 24));
  return buffer;
};

const baseGeometry: GeometryData = {
  vertices: combineVertices([makeVertex([0, 0, 0]), makeVertex([1, 0, 0]), makeVertex([0, 1, 0])]),
  indices: new Uint16Array([0, 1, 2]),
  instanceCount: 1,
  opaqueCount: 1,
  instanceOffsetData: new Float32Array([0, 0, 0]),
  instanceColorScaleData: new Float32Array([1, 1, 1, 1]),
  instanceSecondaryColorData: new Float32Array([1, 1, 1, 1]),
  instanceEmissiveColorData: new Float32Array([0, 0, 0, 0]),
  instanceMaterialParamsData: new Float32Array([1, 0, 1, 0]),
  instanceRotationData: new Float32Array([0, 0, 0, 1]),
};

const cloneGeometry = (overrides: Partial<GeometryData>): GeometryData => ({
  vertices: overrides.vertices ?? new Uint8Array(baseGeometry.vertices),
  indices: overrides.indices ?? new Uint16Array(baseGeometry.indices),
  instanceCount: overrides.instanceCount ?? baseGeometry.instanceCount,
  opaqueCount: overrides.opaqueCount ?? baseGeometry.opaqueCount,
  instanceOffsetData:
    overrides.instanceOffsetData ?? new Float32Array(baseGeometry.instanceOffsetData),
  instanceColorScaleData:
    overrides.instanceColorScaleData ?? new Float32Array(baseGeometry.instanceColorScaleData),
  instanceSecondaryColorData:
    overrides.instanceSecondaryColorData ??
    new Float32Array(baseGeometry.instanceSecondaryColorData),
  instanceEmissiveColorData:
    overrides.instanceEmissiveColorData ??
    new Float32Array(baseGeometry.instanceEmissiveColorData),
  instanceMaterialParamsData:
    overrides.instanceMaterialParamsData ??
    new Float32Array(baseGeometry.instanceMaterialParamsData),
  instanceRotationData:
    overrides.instanceRotationData ?? new Float32Array(baseGeometry.instanceRotationData),
});

describe('validateGeometryData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs an error when vertex buffer length is not a multiple of 24 bytes', () => {
    const geometry = cloneGeometry({ vertices: new Uint8Array(10) });

    validateGeometryData(geometry);

    expect(Logger.error).toHaveBeenCalledWith(
      'Vertex buffer byteLength must be a multiple of 24 bytes'
    );
  });

  it('logs an error when indices length is not divisible by 3', () => {
    const geometry = cloneGeometry({ indices: new Uint16Array([0, 1]) });

    validateGeometryData(geometry);

    expect(Logger.error).toHaveBeenCalledWith('Indices length should be a multiple of 3');
  });

  it('logs an error when indices reference out-of-range vertices', () => {
    const geometry = cloneGeometry({ indices: new Uint16Array([0, 1, 5]) });

    validateGeometryData(geometry);

    expect(Logger.error).toHaveBeenCalledWith('Invalid index: references out-of-range vertex');
  });

  it('warns and errors when a degenerate triangle is detected', () => {
    const duplicateVertex = makeVertex([0, 0, 0]);
    const geometry = cloneGeometry({
      vertices: combineVertices([duplicateVertex, duplicateVertex, duplicateVertex]),
      indices: new Uint16Array([0, 1, 2]),
    });

    validateGeometryData(geometry);

    expect(Logger.warn).toHaveBeenCalledWith('Degenerate triangle detected at tri index', 0, {
      i0: 0,
      i1: 1,
      i2: 2,
    });
    expect(Logger.error).toHaveBeenCalledWith('Degenerate triangle found in index buffer');
  });
});

describe('createTimestampResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null handles when timestamp queries are unsupported', () => {
    const device = {} as unknown as GPUDevice;

    const result = createTimestampResources(device, false, { queryCount: 2, bufferSize: 32 });

    expect(result).toEqual({ querySet: null, resolveBuffer: null, readBuffer: null });
  });

  it('creates query set and buffers when supported', () => {
    const querySet = {} as GPUQuerySet;
    const resolveBuffer = {} as GPUBuffer;
    const readBuffer = {} as GPUBuffer;

    const createQuerySet = vi.fn(() => querySet);
    const createBuffer = vi.fn().mockReturnValueOnce(resolveBuffer).mockReturnValueOnce(readBuffer);
    const device = {
      createQuerySet,
      createBuffer,
    } as unknown as GPUDevice;

    const result = createTimestampResources(device, true, { queryCount: 4, bufferSize: 128 });

    expect(createQuerySet).toHaveBeenCalledWith({
      label: 'frame-timestamp-query-set',
      type: 'timestamp',
      count: 4,
    });
    expect(createBuffer).toHaveBeenNthCalledWith(1, {
      label: 'frame-timestamp-resolve-buffer',
      size: 128,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    expect(createBuffer).toHaveBeenNthCalledWith(2, {
      label: 'frame-timestamp-read-buffer',
      size: 128,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    expect(result).toEqual({ querySet, resolveBuffer, readBuffer });
  });
});

describe('createPipelines error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const layoutStub = {} as GPUPipelineLayout;

  const sharedArgs: [
    GPUTextureFormat,
    GPUBindGroupLayout,
    GPUBindGroupLayout,
    GPUVertexBufferLayout[],
    { sampleCount: number; statusEl: HTMLElement },
  ] = [
    'rgba8unorm',
    {} as GPUBindGroupLayout,
    {} as GPUBindGroupLayout,
    [],
    { sampleCount: 4, statusEl: document.createElement('div') },
  ];

  it('throws when shader compilation reports errors and updates status', async () => {
    const statusEl = document.createElement('div');
    const shaderModule = {
      getCompilationInfo: vi.fn(() =>
        Promise.resolve({
          messages: [
            { type: 'warning', message: 'Unused variable' },
            { type: 'error', message: 'Syntax error' },
          ],
        })
      ),
    };
    const device = {
      createShaderModule: vi.fn(() => shaderModule),
    } as unknown as GPUDevice;

    await expect(
      createPipelines(device, 'rgba8unorm', sharedArgs[1], sharedArgs[2], [], {
        sampleCount: 1,
        statusEl,
      })
    ).rejects.toThrow('Shader compilation error');

    expect(Logger.warn).toHaveBeenCalledWith('WGSL warnings:', [
      { type: 'warning', message: 'Unused variable' },
    ]);
    expect(Logger.error).toHaveBeenCalledWith('WGSL compilation errors:', [
      { type: 'error', message: 'Syntax error' },
    ]);
    expect(statusEl.textContent).toBe('Shader compilation error. See console for details.');
  });

  it('throws when render pipeline validation fails', async () => {
    const statusEl = document.createElement('div');
    const shaderModule = {
      getCompilationInfo: vi.fn(() => Promise.resolve({ messages: [] })),
    };
    const device = {
      createShaderModule: vi.fn(() => shaderModule),
      createPipelineLayout: vi.fn(() => layoutStub),
      createRenderPipeline: vi.fn(() => ({}) as GPURenderPipeline),
      pushErrorScope: vi.fn(),
      popErrorScope: vi.fn().mockResolvedValueOnce({ message: 'invalid pipeline' }),
    } as unknown as GPUDevice;

    await expect(
      createPipelines(device, 'rgba8unorm', sharedArgs[1], sharedArgs[2], [], {
        sampleCount: 1,
        statusEl,
      })
    ).rejects.toThrow('Render pipeline creation failed');

    expect(Logger.error).toHaveBeenCalledWith('Pipeline validation error:', {
      message: 'invalid pipeline',
    });
    expect(statusEl.textContent).toBe('Pipeline error. See console for details.');
    expect(device.createRenderPipeline).toHaveBeenCalledTimes(1);
  });

  it('throws when overlay pipeline validation fails', async () => {
    const statusEl = document.createElement('div');
    const shaderModule = {
      getCompilationInfo: vi.fn(() => Promise.resolve({ messages: [] })),
    };
    const device = {
      createShaderModule: vi.fn(() => shaderModule),
      createPipelineLayout: vi.fn(() => layoutStub),
      createRenderPipeline: vi
        .fn()
        .mockReturnValueOnce({} as GPURenderPipeline) // render pipeline
        .mockReturnValueOnce({} as GPURenderPipeline) // transparent pipeline
        .mockReturnValueOnce({} as GPURenderPipeline), // overlay pipeline
      pushErrorScope: vi.fn(),
      popErrorScope: vi
        .fn()
        .mockResolvedValueOnce(null) // render pipeline OK
        .mockResolvedValueOnce(null) // transparent pipeline OK
        .mockResolvedValueOnce({ message: 'overlay invalid' }), // overlay pipeline error
    } as unknown as GPUDevice;

    await expect(
      createPipelines(device, 'rgba8unorm', sharedArgs[1], sharedArgs[2], [], {
        sampleCount: 1,
        statusEl,
      })
    ).rejects.toThrow('Overlay pipeline creation failed');

    expect(Logger.error).toHaveBeenCalledWith('Overlay pipeline validation error:', {
      message: 'overlay invalid',
    });
    expect(statusEl.textContent).toBe('Overlay pipeline error. See console for details.');
    expect(device.createRenderPipeline).toHaveBeenCalledTimes(3);
  });
});

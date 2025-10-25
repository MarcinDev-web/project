import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../logger', () => {
    const warn = vi.fn();
    const error = vi.fn();
    const info = vi.fn();
    return { logger: { warn, error, info } };
});
import { createPipelines, createTimestampResources, validateGeometryData } from './resources';
import { logger } from '@engine/core/utils';
const makeVertex = (position, normal = [0, 0, 1], ao = 1.0) => {
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
const combineVertices = (verts) => {
    const buffer = new Uint8Array(verts.length * 24);
    verts.forEach((vert, index) => buffer.set(vert, index * 24));
    return buffer;
};
const baseGeometry = {
    vertices: combineVertices([makeVertex([0, 0, 0]), makeVertex([1, 0, 0]), makeVertex([0, 1, 0])]),
    indices: new Uint16Array([0, 1, 2]),
    instanceCount: 1,
    instanceOffsetData: new Float32Array([0, 0, 0]),
    instanceColorScaleData: new Float32Array([1, 1, 1, 1]),
    instanceRotationData: new Float32Array([0, 0, 0, 1]),
};
const cloneGeometry = (overrides) => ({
    vertices: overrides.vertices ?? new Uint8Array(baseGeometry.vertices),
    indices: overrides.indices ?? new Uint16Array(baseGeometry.indices),
    instanceCount: overrides.instanceCount ?? baseGeometry.instanceCount,
    instanceOffsetData: overrides.instanceOffsetData ?? new Float32Array(baseGeometry.instanceOffsetData),
    instanceColorScaleData: overrides.instanceColorScaleData ?? new Float32Array(baseGeometry.instanceColorScaleData),
    instanceRotationData: overrides.instanceRotationData ?? new Float32Array(baseGeometry.instanceRotationData),
});
describe('validateGeometryData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('logs an error when vertex buffer length is not a multiple of 24 bytes', () => {
        const geometry = cloneGeometry({ vertices: new Uint8Array(10) });
        validateGeometryData(geometry);
        expect(logger.error).toHaveBeenCalledWith('Vertex buffer byteLength must be a multiple of 24 bytes');
    });
    it('logs an error when indices length is not divisible by 3', () => {
        const geometry = cloneGeometry({ indices: new Uint16Array([0, 1]) });
        validateGeometryData(geometry);
        expect(logger.error).toHaveBeenCalledWith('Indices length should be a multiple of 3');
    });
    it('logs an error when indices reference out-of-range vertices', () => {
        const geometry = cloneGeometry({ indices: new Uint16Array([0, 1, 5]) });
        validateGeometryData(geometry);
        expect(logger.error).toHaveBeenCalledWith('Invalid index: references out-of-range vertex');
    });
    it('warns and errors when a degenerate triangle is detected', () => {
        const duplicateVertex = makeVertex([0, 0, 0]);
        const geometry = cloneGeometry({
            vertices: combineVertices([duplicateVertex, duplicateVertex, duplicateVertex]),
            indices: new Uint16Array([0, 1, 2]),
        });
        validateGeometryData(geometry);
        expect(logger.warn).toHaveBeenCalledWith('Degenerate triangle detected at tri index', 0, {
            i0: 0,
            i1: 1,
            i2: 2,
        });
        expect(logger.error).toHaveBeenCalledWith('Degenerate triangle found in index buffer');
    });
});
describe('createTimestampResources', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('returns null handles when timestamp queries are unsupported', () => {
        const device = {};
        const result = createTimestampResources(device, false, { queryCount: 2, bufferSize: 32 });
        expect(result).toEqual({ querySet: null, resolveBuffer: null, readBuffer: null });
    });
    it('creates query set and buffers when supported', () => {
        const querySet = {};
        const resolveBuffer = {};
        const readBuffer = {};
        const createQuerySet = vi.fn(() => querySet);
        const createBuffer = vi.fn().mockReturnValueOnce(resolveBuffer).mockReturnValueOnce(readBuffer);
        const device = {
            createQuerySet,
            createBuffer,
        };
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
    const layoutStub = {};
    const sharedArgs = [
        'rgba8unorm',
        {},
        {},
        [],
        { sampleCount: 4, statusEl: document.createElement('div') },
    ];
    it('throws when shader compilation reports errors and updates status', async () => {
        const statusEl = document.createElement('div');
        const shaderModule = {
            getCompilationInfo: vi.fn(() => Promise.resolve({
                messages: [
                    { type: 'warning', message: 'Unused variable' },
                    { type: 'error', message: 'Syntax error' },
                ],
            })),
        };
        const device = {
            createShaderModule: vi.fn(() => shaderModule),
        };
        await expect(createPipelines(device, 'rgba8unorm', sharedArgs[1], sharedArgs[2], [], {
            sampleCount: 1,
            statusEl,
        })).rejects.toThrow('Shader compilation error');
        expect(logger.warn).toHaveBeenCalledWith('WGSL warnings:', [
            { type: 'warning', message: 'Unused variable' },
        ]);
        expect(logger.error).toHaveBeenCalledWith('WGSL compilation errors:', [
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
            createRenderPipeline: vi.fn(() => ({})),
            pushErrorScope: vi.fn(),
            popErrorScope: vi.fn().mockResolvedValueOnce({ message: 'invalid pipeline' }),
        };
        await expect(createPipelines(device, 'rgba8unorm', sharedArgs[1], sharedArgs[2], [], {
            sampleCount: 1,
            statusEl,
        })).rejects.toThrow('Render pipeline creation failed');
        expect(logger.error).toHaveBeenCalledWith('Pipeline validation error:', {
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
                .mockReturnValueOnce({})
                .mockReturnValueOnce({}),
            pushErrorScope: vi.fn(),
            popErrorScope: vi
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ message: 'overlay invalid' }),
        };
        await expect(createPipelines(device, 'rgba8unorm', sharedArgs[1], sharedArgs[2], [], {
            sampleCount: 1,
            statusEl,
        })).rejects.toThrow('Overlay pipeline creation failed');
        expect(logger.error).toHaveBeenCalledWith('Overlay pipeline validation error:', {
            message: 'overlay invalid',
        });
        expect(statusEl.textContent).toBe('Overlay pipeline error. See console for details.');
        expect(device.createRenderPipeline).toHaveBeenCalledTimes(2);
    });
});
//# sourceMappingURL=resources.test.js.map
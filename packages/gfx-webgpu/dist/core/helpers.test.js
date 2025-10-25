import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../logger', () => {
    const warn = vi.fn();
    const error = vi.fn();
    const info = vi.fn();
    return { logger: { warn, error, info } };
});
import { Logger } from '@engine/core/utils';
import { asBytes, getTimestampPeriod, updateCanvasSize } from './helpers';
const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
};
describe('getTimestampPeriod', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('uses queue.getTimestampPeriod when it returns a valid number', () => {
        const queue = {
            getTimestampPeriod: vi.fn(() => 2.5),
        };
        const device = { queue };
        const adapter = {};
        const result = getTimestampPeriod(device, adapter);
        expect(result).toBe(2.5);
        expect(queue.getTimestampPeriod).toHaveBeenCalledTimes(1);
        expect(Logger.warn).not.toHaveBeenCalled();
    });
    it('falls back to queue.timestampPeriod when getter returns invalid value', async () => {
        const queue = {
            getTimestampPeriod: vi.fn(() => Number.NaN),
            timestampPeriod: 3.75,
        };
        const device = { queue };
        const adapter = {};
        const result = getTimestampPeriod(device, adapter);
        await flushMicrotasks();
        expect(result).toBe(3.75);
    });
    it('falls back to adapter limits.timestampPeriod when queue has no info', () => {
        const queue = {};
        const device = { queue };
        const adapter = { limits: { timestampPeriod: 4.5 } };
        const result = getTimestampPeriod(device, adapter);
        expect(result).toBe(4.5);
    });
    it('returns 1 when no sources available', async () => {
        const queue = {};
        const device = { queue };
        const adapter = {};
        const result = getTimestampPeriod(device, adapter);
        await flushMicrotasks();
        expect(result).toBe(1);
    });
});
describe('updateCanvasSize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('resizes the drawing buffer to match device pixel ratio and client size', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 50;
        canvas.height = 25;
        Object.defineProperty(canvas, 'clientWidth', { value: 200, configurable: true });
        Object.defineProperty(canvas, 'clientHeight', { value: 100, configurable: true });
        const originalDpr = window.devicePixelRatio;
        Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
        const resized = updateCanvasSize(canvas);
        expect(resized).toBe(true);
        expect(canvas.width).toBe(400);
        expect(canvas.height).toBe(200);
        Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true });
    });
    it('returns false when canvas dimensions already match', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 150;
        Object.defineProperty(canvas, 'clientWidth', { value: 300, configurable: true });
        Object.defineProperty(canvas, 'clientHeight', { value: 150, configurable: true });
        const originalDpr = window.devicePixelRatio;
        Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
        const resized = updateCanvasSize(canvas);
        expect(resized).toBe(false);
        expect(canvas.width).toBe(300);
        expect(canvas.height).toBe(150);
        Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true });
    });
});
describe('asBytes', () => {
    it('creates a Uint8Array view over the same buffer and range', () => {
        const floatView = new Float32Array([1, 2, 3, 4]);
        const subView = new Float32Array(floatView.buffer, Float32Array.BYTES_PER_ELEMENT, 2);
        const bytes = asBytes(subView);
        expect(bytes.byteOffset).toBe(Float32Array.BYTES_PER_ELEMENT);
        expect(bytes.byteLength).toBe(subView.byteLength);
        expect(bytes.buffer).toBe(subView.buffer);
    });
});
//# sourceMappingURL=helpers.test.js.map
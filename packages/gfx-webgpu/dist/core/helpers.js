import { Logger } from '@engine/core/utils';
/**
 * Determines the GPU timestamp period in nanoseconds using queue- or adapter-provided data.
 *
 * @param device - Active GPU device whose queue may expose timestamp metadata.
 * @param adapter - GPU adapter providing fallback timestamp information.
 * @returns The timestamp period value reported by the implementation, or 1 when unknown.
 */
export function getTimestampPeriod(device, adapter) {
    let determined = false;
    let timestampPeriod = 1;
    const queueInfo = device.queue;
    if (typeof queueInfo.getTimestampPeriod === 'function') {
        try {
            const value = queueInfo.getTimestampPeriod();
            if (typeof value === 'number' && !Number.isNaN(value)) {
                timestampPeriod = value;
                determined = true;
            }
            else {
                Logger.warn('Timestamp period: getTimestampPeriod returned invalid; trying next source');
            }
        }
        catch (err) {
            Logger.warn('Timestamp period: getTimestampPeriod threw; trying next source', err);
        }
    }
    if (!determined && typeof queueInfo.timestampPeriod === 'number') {
        timestampPeriod = queueInfo.timestampPeriod;
        determined = true;
    }
    if (!determined) {
        const adapterInfo = adapter;
        if (typeof adapterInfo.limits?.timestampPeriod === 'number') {
            timestampPeriod = adapterInfo.limits.timestampPeriod;
            determined = true;
        }
    }
    if (!determined) {
        Logger.warn('Timestamp period: no source available; defaulting to 1');
        timestampPeriod = 1;
    }
    return timestampPeriod;
}
/**
 * Updates the canvas resolution to match CSS pixels multiplied by device pixel ratio.
 *
 * @param canvas - Canvas element whose drawing buffer will be resized.
 * @returns `true` when a resize occurred; otherwise `false`.
 */
export function updateCanvasSize(canvas) {
    const dpr = window.devicePixelRatio ?? 1;
    const logicalWidthNow = canvas.clientWidth || canvas.width;
    const logicalHeightNow = canvas.clientHeight || canvas.height;
    const nextWidth = Math.max(1, Math.round(logicalWidthNow * dpr));
    const nextHeight = Math.max(1, Math.round(logicalHeightNow * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        return true;
    }
    return false;
}
/**
 * Returns a byte-level `Uint8Array` view over any typed array or DataView.
 *
 * @param view - Source view exposing `buffer`, `byteOffset`, and `byteLength`.
 * @returns A `Uint8Array` sharing the underlying memory region.
 */
export function asBytes(view) {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}
//# sourceMappingURL=helpers.js.map
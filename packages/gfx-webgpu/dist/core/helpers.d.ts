/**
 * Determines the GPU timestamp period in nanoseconds using queue- or adapter-provided data.
 *
 * @param device - Active GPU device whose queue may expose timestamp metadata.
 * @param adapter - GPU adapter providing fallback timestamp information.
 * @returns The timestamp period value reported by the implementation, or 1 when unknown.
 */
export declare function getTimestampPeriod(device: GPUDevice, adapter: GPUAdapter): number;
/**
 * Updates the canvas resolution to match CSS pixels multiplied by device pixel ratio.
 *
 * @param canvas - Canvas element whose drawing buffer will be resized.
 * @returns `true` when a resize occurred; otherwise `false`.
 */
export declare function updateCanvasSize(canvas: HTMLCanvasElement): boolean;
/**
 * Returns a byte-level `Uint8Array` view over any typed array or DataView.
 *
 * @param view - Source view exposing `buffer`, `byteOffset`, and `byteLength`.
 * @returns A `Uint8Array` sharing the underlying memory region.
 */
export declare function asBytes(view: ArrayBufferView): Uint8Array;
//# sourceMappingURL=helpers.d.ts.map
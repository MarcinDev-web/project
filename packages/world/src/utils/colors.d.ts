export type RgbaColor = [number, number, number, number];
export declare function lightenColor(color: RgbaColor, amount: number): RgbaColor;
/**
 * Lightens a color in-place by the given amount, clamping to 1.0 for RGB.
 */
export declare function lightenColorInPlace(color: RgbaColor, amount: number): void;
/**
 * Copies RGBA values from `src` to `dst` without allocating.
 */
export declare function copyRgba(dst: RgbaColor, src: RgbaColor): void;
export declare function rgbaToHex(color: RgbaColor): string;
export declare function hexToRgba(hex: string): RgbaColor;
//# sourceMappingURL=colors.d.ts.map
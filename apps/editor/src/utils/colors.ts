export type RgbaColor = [number, number, number, number];

export function lightenColor(color: RgbaColor, amount: number): RgbaColor {
  return [
    Math.min(color[0] + amount, 1),
    Math.min(color[1] + amount, 1),
    Math.min(color[2] + amount, 1),
    color[3],
  ];
}

/**
 * Lightens a color in-place by the given amount, clamping to 1.0 for RGB.
 */
export function lightenColorInPlace(color: RgbaColor, amount: number): void {
  const r = color[0] + amount;
  const g = color[1] + amount;
  const b = color[2] + amount;
  color[0] = r > 1 ? 1 : r;
  color[1] = g > 1 ? 1 : g;
  color[2] = b > 1 ? 1 : b;
}

/**
 * Copies RGBA values from `src` to `dst` without allocating.
 */
export function copyRgba(dst: RgbaColor, src: RgbaColor): void {
  dst[0] = src[0];
  dst[1] = src[1];
  dst[2] = src[2];
  dst[3] = src[3];
}

export function rgbaToHex(color: RgbaColor): string {
  const toHex = (value: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(value * 255)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(color[0])}${toHex(color[1])}${toHex(color[2])}`;
}

export function hexToRgba(hex: string): RgbaColor {
  if (typeof hex !== 'string') return [1, 1, 1, 1];
  const normalized = hex.trim().replace(/^#/, '');
  // Support 3, 4, 6, or 8 hex digits; expand shorthand if needed
  let hexBody = normalized.toLowerCase();
  const isValidLength =
    hexBody.length === 3 || hexBody.length === 4 || hexBody.length === 6 || hexBody.length === 8;
  if (!isValidLength || /[^0-9a-f]/i.test(hexBody)) {
    return [1, 1, 1, 1];
  }
  if (hexBody.length === 3 || hexBody.length === 4) {
    // Expand #rgb or #rgba to #rrggbb or #rrggbbaa
    hexBody = hexBody
      .split('')
      .map((c) => c + c)
      .join('');
  }
  // Now hexBody is 6 or 8 chars
  const hasAlpha = hexBody.length === 8;
  const r = Number.parseInt(hexBody.slice(0, 2), 16);
  const g = Number.parseInt(hexBody.slice(2, 4), 16);
  const b = Number.parseInt(hexBody.slice(4, 6), 16);
  const a = hasAlpha ? Number.parseInt(hexBody.slice(6, 8), 16) : 255;
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || !Number.isFinite(a)) {
    return [1, 1, 1, 1];
  }
  return [r / 255, g / 255, b / 255, a / 255];
}

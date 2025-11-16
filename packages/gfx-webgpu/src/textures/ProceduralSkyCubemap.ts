export interface CloudySkyHdrOptions {
  width?: number;
  height?: number;
  cloudDensity?: number;
  cloudScale?: number;
  exposure?: number;
  sunDirection?: readonly [number, number, number];
}

export interface HdrImageData {
  width: number;
  height: number;
  data: Float32Array;
}

/**
 * Generates a procedural HDR equirectangular image representing a cloudy sky.
 * The data can be passed directly into EnvironmentRenderer.convertHdrToCubemap.
 */
export function createProceduralCloudyHdr(options?: CloudySkyHdrOptions): HdrImageData {
  const width = clamp(Math.floor(options?.width ?? 256), 32, 1024);
  const height = clamp(Math.floor(options?.height ?? 128), 16, 512);
  const cloudDensity = clamp(options?.cloudDensity ?? 0.65, 0.2, 0.95);
  const cloudScale = clamp(options?.cloudScale ?? 6.0, 1.0, 16.0);
  const exposure = clamp(options?.exposure ?? 1.4, 0.5, 4.0);
  const sunDir = normalizeVec(options?.sunDirection ?? [0.15, 0.8, 0.35]);

  const data = new Float32Array(width * height * 4);

  const skyZenith: Vec3 = [0.12, 0.23, 0.55];
  const skyHorizon: Vec3 = [0.35, 0.45, 0.65];
  const duskTint: Vec3 = [0.8, 0.45, 0.35];
  const cloudColor: Vec3 = [1.1, 1.08, 1.05];
  const sunColor: Vec3 = [2.5, 2.35, 2.0];

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const skyBlend = Math.pow(v, 0.85);
    const baseSky = mixVec(
      mixVec(duskTint, skyHorizon, smoothstep(0.0, 0.35, v)),
      skyZenith,
      skyBlend
    );

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const dir = equirectToDirection(u, v);

      const fbmValue = fbm(u * cloudScale, v * cloudScale * 0.8);
      const detail = fbm((u + 4.123) * cloudScale * 1.7, (v - 1.37) * cloudScale * 1.9);
      const ridge = 1.0 - Math.abs(fbmValue * 2.0 - 1.0);
      const cloudMask = smoothstep(
        cloudDensity - 0.15,
        cloudDensity + 0.18,
        fbmValue * 0.65 + detail * 0.25 + ridge * 0.1
      );

      const sunAlignment = dot(dir, sunDir);
      const sunDisc = Math.pow(Math.max(sunAlignment, 0), 1024);
      const sunHalo = Math.pow(Math.max(sunAlignment, 0), 32);
      const sunGlow = Math.pow(Math.max(sunAlignment, 0), 6) * 0.25;

      const cloudBase = mixVec(baseSky, cloudColor, cloudMask);
      const glowTint = mixVec(baseSky, sunColor, sunGlow);
      const color = addVec(
        mixVec(cloudBase, glowTint, 0.35 * cloudMask + sunGlow * 0.4),
        scaleVec(sunColor, sunDisc * 6 + sunHalo * 1.5)
      );

      const idx = (y * width + x) * 4;
      data[idx] = color[0] * exposure;
      data[idx + 1] = color[1] * exposure;
      data[idx + 2] = color[2] * exposure;
      data[idx + 3] = 1.0;
    }
  }

  return { width, height, data };
}

type Vec3 = readonly [number, number, number];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function mixVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleVec(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalizeVec(vec: Vec3): Vec3 {
  const len = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
  if (len === 0) {
    return [0, 1, 0];
  }
  return [vec[0] / len, vec[1] / len, vec[2] / len];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function equirectToDirection(u: number, v: number): Vec3 {
  const theta = u * Math.PI * 2 - Math.PI; // longitude (-π .. π)
  const phi = v * Math.PI; // latitude (0 .. π)
  const sinPhi = Math.sin(phi);
  return [
    Math.cos(theta) * sinPhi,
    Math.cos(phi),
    Math.sin(theta) * sinPhi,
  ];
}

function fbm(x: number, y: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  for (let i = 0; i < 5; i++) {
    value += amplitude * valueNoise(x * frequency, y * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const topLeft = hash(xi, yi);
  const topRight = hash(xi + 1, yi);
  const bottomLeft = hash(xi, yi + 1);
  const bottomRight = hash(xi + 1, yi + 1);

  const u = fade(xf);
  const v = fade(yf);

  const top = lerp(topLeft, topRight, u);
  const bottom = lerp(bottomLeft, bottomRight, u);
  return lerp(top, bottom, v);
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}


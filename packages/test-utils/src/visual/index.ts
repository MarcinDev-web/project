/**
 * Visual Regression Test Framework
 *
 * Provides utilities for:
 * - Golden master image testing
 * - Pixel-level diff analysis
 * - Threshold-based comparison
 * - CI-friendly reporting with artifacts
 */

import { expect } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * RGBA pixel data
 */
export interface PixelData {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Image data for comparison
 */
export interface ImageData {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Visual diff result
 */
export interface VisualDiffResult {
  passed: boolean;
  diffPixels: number;
  diffPercent: number;
  totalPixels: number;
  maxChannelDiff: number;
  meanChannelDiff: number;
  diffImage?: ImageData;
  regions: DiffRegion[];
}

/**
 * Region of difference in image
 */
export interface DiffRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelCount: number;
}

/**
 * Visual comparison options
 */
export interface VisualCompareOptions {
  /** Maximum allowed diff percentage (0-100) */
  maxDiffPercent?: number;
  /** Per-pixel threshold (0-255) */
  pixelThreshold?: number;
  /** Whether to generate diff image */
  generateDiffImage?: boolean;
  /** Ignore anti-aliasing differences */
  ignoreAntialiasing?: boolean;
  /** Regions to ignore (e.g., timestamps) */
  ignoreRegions?: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Golden master configuration
 */
export interface GoldenMasterConfig {
  /** Path to golden images directory */
  goldenDir: string;
  /** Path to actual images directory */
  actualDir: string;
  /** Path to diff images directory */
  diffDir: string;
  /** Default comparison options */
  defaultOptions?: VisualCompareOptions;
  /** Whether to update goldens when missing */
  updateOnMissing?: boolean;
  /** Whether to update all goldens (CI override) */
  forceUpdate?: boolean;
}

/**
 * Visual test result
 */
export interface VisualTestResult {
  name: string;
  passed: boolean;
  diff: VisualDiffResult | null;
  goldenPath: string;
  actualPath: string;
  diffPath?: string;
  error?: string;
}

// ============================================================================
// Pixel Comparison Utilities
// ============================================================================

/**
 * Get pixel at position
 */
export function getPixel(image: ImageData, x: number, y: number): PixelData {
  const idx = (y * image.width + x) * 4;
  return {
    r: image.data[idx]!,
    g: image.data[idx + 1]!,
    b: image.data[idx + 2]!,
    a: image.data[idx + 3]!,
  };
}

/**
 * Set pixel at position
 */
export function setPixel(image: ImageData, x: number, y: number, pixel: PixelData): void {
  const idx = (y * image.width + x) * 4;
  image.data[idx] = pixel.r;
  image.data[idx + 1] = pixel.g;
  image.data[idx + 2] = pixel.b;
  image.data[idx + 3] = pixel.a;
}

/**
 * Calculate pixel difference
 */
export function pixelDiff(p1: PixelData, p2: PixelData): number {
  return Math.max(
    Math.abs(p1.r - p2.r),
    Math.abs(p1.g - p2.g),
    Math.abs(p1.b - p2.b),
    Math.abs(p1.a - p2.a)
  );
}

/**
 * Calculate color distance (Euclidean)
 */
export function colorDistance(p1: PixelData, p2: PixelData): number {
  const dr = p1.r - p2.r;
  const dg = p1.g - p2.g;
  const db = p1.b - p2.b;
  const da = p1.a - p2.a;
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

/**
 * Check if pixel is anti-aliased
 */
export function isAntialiased(
  image: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const center = getPixel(image, x, y);
  let hasLight = false;
  let hasDark = false;
  let hasSimilar = false;

  const neighbors: [number, number][] = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

  for (const [dx, dy] of neighbors) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

    const neighbor = getPixel(image, nx, ny);
    const brightness = (p: PixelData) => (p.r + p.g + p.b) / 3;

    const centerBrightness = brightness(center);
    const neighborBrightness = brightness(neighbor);

    if (neighborBrightness > centerBrightness + 30) hasLight = true;
    if (neighborBrightness < centerBrightness - 30) hasDark = true;
    if (Math.abs(neighborBrightness - centerBrightness) < 10) hasSimilar = true;
  }

  // Anti-aliased pixels typically have both lighter and darker neighbors
  return hasLight && hasDark && !hasSimilar;
}

// ============================================================================
// Image Comparison
// ============================================================================

/**
 * Compare two images pixel by pixel
 */
export function compareImages(
  expected: ImageData,
  actual: ImageData,
  options: VisualCompareOptions = {}
): VisualDiffResult {
  const {
    maxDiffPercent = 0.1,
    pixelThreshold = 0,
    generateDiffImage = true,
    ignoreAntialiasing = true,
    ignoreRegions = [],
  } = options;

  // Validate dimensions
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      passed: false,
      diffPixels: expected.width * expected.height,
      diffPercent: 100,
      totalPixels: expected.width * expected.height,
      maxChannelDiff: 255,
      meanChannelDiff: 255,
      regions: [],
    };
  }

  const width = expected.width;
  const height = expected.height;
  const totalPixels = width * height;

  let diffPixels = 0;
  let maxChannelDiff = 0;
  let totalChannelDiff = 0;
  let diffCount = 0;

  // Create diff image
  let diffImage: ImageData | undefined;
  if (generateDiffImage) {
    diffImage = {
      width,
      height,
      data: new Uint8Array(width * height * 4),
    };
  }

  // Check if pixel is in ignore region
  const isIgnored = (x: number, y: number): boolean => {
    return ignoreRegions.some(
      (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
    );
  };

  // Track diff regions
  const diffMap = new Map<string, boolean>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isIgnored(x, y)) {
        if (diffImage) {
          setPixel(diffImage, x, y, { r: 128, g: 128, b: 128, a: 255 }); // Gray for ignored
        }
        continue;
      }

      const p1 = getPixel(expected, x, y);
      const p2 = getPixel(actual, x, y);
      const diff = pixelDiff(p1, p2);

      if (diff > pixelThreshold) {
        // Check for anti-aliasing
        if (ignoreAntialiasing) {
          const isAA1 = isAntialiased(expected, x, y, width, height);
          const isAA2 = isAntialiased(actual, x, y, width, height);
          if (isAA1 || isAA2) {
            if (diffImage) {
              setPixel(diffImage, x, y, { r: 255, g: 255, b: 0, a: 255 }); // Yellow for AA
            }
            continue;
          }
        }

        diffPixels++;
        maxChannelDiff = Math.max(maxChannelDiff, diff);
        totalChannelDiff += diff;
        diffCount++;
        diffMap.set(`${x},${y}`, true);

        if (diffImage) {
          // Red channel shows diff intensity
          const intensity = Math.min(255, diff * 3);
          setPixel(diffImage, x, y, { r: 255, g: 0, b: intensity, a: 255 });
        }
      } else if (diffImage) {
        // Dimmed original for non-diff pixels
        setPixel(diffImage, x, y, {
          r: Math.floor(p1.r * 0.3),
          g: Math.floor(p1.g * 0.3),
          b: Math.floor(p1.b * 0.3),
          a: 255,
        });
      }
    }
  }

  const diffPercent = (diffPixels / totalPixels) * 100;
  const meanChannelDiff = diffCount > 0 ? totalChannelDiff / diffCount : 0;

  // Find diff regions (simple connected component labeling)
  const regions = findDiffRegions(diffMap, width, height);

  return {
    passed: diffPercent <= maxDiffPercent,
    diffPixels,
    diffPercent,
    totalPixels,
    maxChannelDiff,
    meanChannelDiff,
    diffImage,
    regions,
  };
}

/**
 * Find connected regions of differences
 */
function findDiffRegions(
  diffMap: Map<string, boolean>,
  width: number,
  height: number
): DiffRegion[] {
  const regions: DiffRegion[] = [];
  const visited = new Set<string>();

  for (const [key] of diffMap) {
    if (visited.has(key)) continue;

    const [x, y] = key.split(',').map(Number) as [number, number];
    const region = floodFillRegion(diffMap, visited, x, y, width, height);
    if (region.pixelCount > 0) {
      regions.push(region);
    }
  }

  return regions;
}

/**
 * Flood fill to find connected diff region
 */
function floodFillRegion(
  diffMap: Map<string, boolean>,
  visited: Set<string>,
  startX: number,
  startY: number,
  width: number,
  height: number
): DiffRegion {
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;
  let pixelCount = 0;

  const stack: [number, number][] = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const key = `${x},${y}`;

    if (visited.has(key) || !diffMap.has(key)) continue;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    visited.add(key);
    pixelCount++;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    pixelCount,
  };
}

// ============================================================================
// Golden Master Testing
// ============================================================================

/**
 * Create a golden master test runner
 */
export function createGoldenMasterRunner(config: GoldenMasterConfig) {
  const {
    goldenDir,
    actualDir,
    diffDir,
    defaultOptions = {},
    updateOnMissing = true,
    forceUpdate = process.env.UPDATE_GOLDENS === 'true',
  } = config;

  // Ensure directories exist
  [goldenDir, actualDir, diffDir].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  return {
    /**
     * Compare actual image against golden master
     */
    compare: (
      name: string,
      actualImage: ImageData,
      options?: VisualCompareOptions
    ): VisualTestResult => {
      const opts = { ...defaultOptions, ...options };
      const goldenPath = join(goldenDir, `${name}.raw`);
      const actualPath = join(actualDir, `${name}.raw`);
      const diffPath = join(diffDir, `${name}-diff.raw`);

      // Save actual image
      saveRawImage(actualPath, actualImage);

      // Check if golden exists
      if (!existsSync(goldenPath)) {
        if (updateOnMissing || forceUpdate) {
          saveRawImage(goldenPath, actualImage);
          return {
            name,
            passed: true,
            diff: null,
            goldenPath,
            actualPath,
            error: 'Golden created (no previous baseline)',
          };
        }

        return {
          name,
          passed: false,
          diff: null,
          goldenPath,
          actualPath,
          error: 'Golden master not found',
        };
      }

      // Load golden
      const goldenImage = loadRawImage(goldenPath);
      if (!goldenImage) {
        return {
          name,
          passed: false,
          diff: null,
          goldenPath,
          actualPath,
          error: 'Failed to load golden master',
        };
      }

      // Compare
      const diff = compareImages(goldenImage, actualImage, opts);

      // Save diff image if generated
      if (diff.diffImage) {
        saveRawImage(diffPath, diff.diffImage);
      }

      // Update golden if force update is enabled
      if (forceUpdate && !diff.passed) {
        saveRawImage(goldenPath, actualImage);
      }

      return {
        name,
        passed: diff.passed,
        diff,
        goldenPath,
        actualPath,
        diffPath: diff.diffImage ? diffPath : undefined,
      };
    },

    /**
     * List all golden masters
     */
    listGoldens: (): string[] => {
      if (!existsSync(goldenDir)) return [];
      return readdirSync(goldenDir)
        .filter((f) => f.endsWith('.raw'))
        .map((f) => basename(f, '.raw'));
    },

    /**
     * Delete a golden master
     */
    deleteGolden: (name: string): boolean => {
      const goldenPath = join(goldenDir, `${name}.raw`);
      if (existsSync(goldenPath)) {
        const { unlinkSync } = require('node:fs');
        unlinkSync(goldenPath);
        return true;
      }
      return false;
    },

    /**
     * Get configuration
     */
    getConfig: () => config,
  };
}

// ============================================================================
// Image I/O (Raw Format)
// ============================================================================

/**
 * Save image as raw RGBA data with header
 * Format: width(4 bytes) + height(4 bytes) + RGBA data
 */
export function saveRawImage(path: string, image: ImageData): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const header = new Uint8Array(8);
  const view = new DataView(header.buffer);
  view.setUint32(0, image.width, true);
  view.setUint32(4, image.height, true);

  const combined = new Uint8Array(8 + image.data.length);
  combined.set(header);
  combined.set(image.data, 8);

  writeFileSync(path, combined);
}

/**
 * Load image from raw RGBA format
 */
export function loadRawImage(path: string): ImageData | null {
  try {
    const buffer = readFileSync(path);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);
    // Create a copy of the data, not a view, to avoid buffer issues
    const expectedLength = width * height * 4;
    const data = new Uint8Array(expectedLength);
    data.set(new Uint8Array(buffer.buffer, buffer.byteOffset + 8, expectedLength));

    return { width, height, data };
  } catch {
    return null;
  }
}

// ============================================================================
// Visual Test Assertions
// ============================================================================

/**
 * Assert visual match with golden master
 */
export function expectVisualMatch(result: VisualTestResult): void {
  if (!result.passed) {
    const messages = [`Visual regression detected for "${result.name}"`];

    if (result.error) {
      messages.push(`  Error: ${result.error}`);
    }

    if (result.diff) {
      messages.push(
        `  Diff: ${result.diff.diffPercent.toFixed(4)}% (${result.diff.diffPixels} pixels)`,
        `  Max channel diff: ${result.diff.maxChannelDiff}`,
        `  Diff regions: ${result.diff.regions.length}`
      );
    }

    messages.push(`  Golden: ${result.goldenPath}`, `  Actual: ${result.actualPath}`);

    if (result.diffPath) {
      messages.push(`  Diff image: ${result.diffPath}`);
    }

    throw new Error(messages.join('\n'));
  }
}

/**
 * Assert images are identical (strict comparison)
 */
export function expectImagesIdentical(expected: ImageData, actual: ImageData): void {
  const result = compareImages(expected, actual, {
    maxDiffPercent: 0,
    pixelThreshold: 0,
    generateDiffImage: false,
  });

  expect(result.diffPixels).toBe(0);
}

/**
 * Assert images are similar (within threshold)
 */
export function expectImagesSimilar(
  expected: ImageData,
  actual: ImageData,
  maxDiffPercent: number = 1
): void {
  const result = compareImages(expected, actual, {
    maxDiffPercent,
    pixelThreshold: 5,
    generateDiffImage: false,
  });

  expect(result.passed).toBe(true);
}

// ============================================================================
// Visual Test Report
// ============================================================================

/**
 * Visual regression report
 */
export interface VisualRegressionReport {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  newGoldens: number;
  results: VisualTestResult[];
}

/**
 * Generate visual regression report
 */
export function generateVisualReport(results: VisualTestResult[]): VisualRegressionReport {
  return {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.passed && !r.error?.includes('created')).length,
    failed: results.filter((r) => !r.passed).length,
    newGoldens: results.filter((r) => r.error?.includes('created')).length,
    results,
  };
}

/**
 * Print visual regression report
 */
export function printVisualReport(report: VisualRegressionReport): void {
  console.log('\n=== Visual Regression Report ===');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total: ${report.total}`);
  console.log(`Passed: ${report.passed}`);
  console.log(`Failed: ${report.failed}`);
  console.log(`New goldens: ${report.newGoldens}`);
  console.log('');

  for (const result of report.results) {
    const status = result.passed ? '✓' : '✗';
    console.log(`${status} ${result.name}`);

    if (result.diff) {
      console.log(`    Diff: ${result.diff.diffPercent.toFixed(4)}%`);
    }

    if (result.error) {
      console.log(`    Note: ${result.error}`);
    }
  }

  console.log('\n================================\n');
}

// ============================================================================
// WebGPU Texture Capture
// ============================================================================

/**
 * Configuration for WebGPU texture capture
 */
export interface TextureCaptureConfig {
  device: GPUDevice;
  texture: GPUTexture;
  width: number;
  height: number;
  format?: GPUTextureFormat;
}

/**
 * Capture WebGPU texture to ImageData (for Playwright tests)
 * This is a helper that generates the code to run in page.evaluate
 */
export function generateTextureCaptureCode(width: number, height: number): string {
  return `
    async function captureTexture(device, texture) {
      const bytesPerPixel = 4;
      const bytesPerRow = Math.ceil((${width} * bytesPerPixel) / 256) * 256;
      
      const readback = device.createBuffer({
        size: bytesPerRow * ${height},
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        { texture },
        { buffer: readback, bytesPerRow },
        { width: ${width}, height: ${height} }
      );
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      
      await readback.mapAsync(GPUMapMode.READ);
      const data = new Uint8Array(readback.getMappedRange().slice(0));
      readback.unmap();
      readback.destroy();
      
      // Remove row padding
      const result = new Uint8Array(${width} * ${height} * 4);
      for (let y = 0; y < ${height}; y++) {
        const srcOffset = y * bytesPerRow;
        const dstOffset = y * ${width} * 4;
        result.set(data.slice(srcOffset, srcOffset + ${width} * 4), dstOffset);
      }
      
      return Array.from(result);
    }
  `;
}

// ============================================================================
// Common Visual Test Patterns
// ============================================================================

/**
 * Pre-configured visual comparison options
 */
export const visualPresets = {
  /** Exact match (no tolerance) */
  exact: {
    maxDiffPercent: 0,
    pixelThreshold: 0,
    ignoreAntialiasing: false,
  } as VisualCompareOptions,

  /** Strict match (very low tolerance) */
  strict: {
    maxDiffPercent: 0.01,
    pixelThreshold: 1,
    ignoreAntialiasing: true,
  } as VisualCompareOptions,

  /** Standard match (reasonable tolerance) */
  standard: {
    maxDiffPercent: 0.1,
    pixelThreshold: 5,
    ignoreAntialiasing: true,
  } as VisualCompareOptions,

  /** Lenient match (higher tolerance for dynamic content) */
  lenient: {
    maxDiffPercent: 1,
    pixelThreshold: 10,
    ignoreAntialiasing: true,
  } as VisualCompareOptions,

  /** Cloud rendering (high tolerance for noise) */
  clouds: {
    maxDiffPercent: 5,
    pixelThreshold: 15,
    ignoreAntialiasing: true,
  } as VisualCompareOptions,
};

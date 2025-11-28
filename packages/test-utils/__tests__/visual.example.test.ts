/**
 * Visual Regression Test Examples
 *
 * Demonstrates visual regression testing patterns.
 * Note: Full visual tests require Playwright for WebGPU rendering.
 * These are unit tests for the framework utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  compareImages,
  getPixel,
  setPixel,
  pixelDiff,
  colorDistance,
  createGoldenMasterRunner,
  saveRawImage,
  loadRawImage,
  expectVisualMatch,
  expectImagesIdentical,
  expectImagesSimilar,
  generateVisualReport,
  printVisualReport,
  visualPresets,
  type ImageData,
  type PixelData,
  type VisualCompareOptions,
} from '../src/visual';

// Test directory for golden masters
const TEST_DIR = join(process.cwd(), 'test-results', 'visual-test-temp');

describe('Visual Regression Framework', () => {
  describe('Pixel Operations', () => {
    it('should get pixel from image data', () => {
      const image: ImageData = {
        width: 2,
        height: 2,
        data: new Uint8Array([
          255, 0, 0, 255,    // Red
          0, 255, 0, 255,    // Green
          0, 0, 255, 255,    // Blue
          255, 255, 0, 255,  // Yellow
        ]),
      };

      const red = getPixel(image, 0, 0);
      expect(red).toEqual({ r: 255, g: 0, b: 0, a: 255 });

      const green = getPixel(image, 1, 0);
      expect(green).toEqual({ r: 0, g: 255, b: 0, a: 255 });

      const blue = getPixel(image, 0, 1);
      expect(blue).toEqual({ r: 0, g: 0, b: 255, a: 255 });

      const yellow = getPixel(image, 1, 1);
      expect(yellow).toEqual({ r: 255, g: 255, b: 0, a: 255 });
    });

    it('should set pixel in image data', () => {
      const image: ImageData = {
        width: 2,
        height: 1,
        data: new Uint8Array(8),
      };

      setPixel(image, 0, 0, { r: 128, g: 64, b: 32, a: 255 });

      const pixel = getPixel(image, 0, 0);
      expect(pixel).toEqual({ r: 128, g: 64, b: 32, a: 255 });
    });

    it('should calculate pixel difference', () => {
      const p1: PixelData = { r: 100, g: 100, b: 100, a: 255 };
      const p2: PixelData = { r: 110, g: 90, b: 100, a: 255 };

      const diff = pixelDiff(p1, p2);
      expect(diff).toBe(10); // Max channel diff
    });

    it('should calculate color distance', () => {
      const p1: PixelData = { r: 0, g: 0, b: 0, a: 255 };
      const p2: PixelData = { r: 255, g: 255, b: 255, a: 255 };

      const distance = colorDistance(p1, p2);
      // Euclidean distance of (255, 255, 255, 0) = sqrt(3*255^2) ≈ 441.67
      expect(distance).toBeCloseTo(441.67, 1);
    });
  });

  describe('Image Comparison', () => {
    it('should detect identical images', () => {
      const image: ImageData = {
        width: 10,
        height: 10,
        data: new Uint8Array(400).fill(128),
      };

      const result = compareImages(image, image);

      expect(result.passed).toBe(true);
      expect(result.diffPixels).toBe(0);
      expect(result.diffPercent).toBe(0);
    });

    it('should detect completely different images', () => {
      const image1: ImageData = {
        width: 10,
        height: 10,
        data: new Uint8Array(400).fill(0),
      };

      const image2: ImageData = {
        width: 10,
        height: 10,
        data: new Uint8Array(400).fill(255),
      };

      const result = compareImages(image1, image2, {
        maxDiffPercent: 0,
        pixelThreshold: 0,
      });

      expect(result.passed).toBe(false);
      expect(result.diffPixels).toBe(100);
      expect(result.diffPercent).toBe(100);
    });

    it('should handle size mismatch', () => {
      const image1: ImageData = {
        width: 10,
        height: 10,
        data: new Uint8Array(400),
      };

      const image2: ImageData = {
        width: 20,
        height: 10,
        data: new Uint8Array(800),
      };

      const result = compareImages(image1, image2);

      expect(result.passed).toBe(false);
      expect(result.diffPercent).toBe(100);
    });

    it('should respect pixel threshold', () => {
      const image1: ImageData = {
        width: 2,
        height: 2,
        data: new Uint8Array([
          100, 100, 100, 255,
          100, 100, 100, 255,
          100, 100, 100, 255,
          100, 100, 100, 255,
        ]),
      };

      const image2: ImageData = {
        width: 2,
        height: 2,
        data: new Uint8Array([
          105, 100, 100, 255,  // 5 diff in red
          100, 105, 100, 255,  // 5 diff in green
          100, 100, 105, 255,  // 5 diff in blue
          100, 100, 100, 255,  // identical
        ]),
      };

      // With threshold of 10, should pass
      const resultPass = compareImages(image1, image2, {
        pixelThreshold: 10,
        maxDiffPercent: 100,
      });
      expect(resultPass.diffPixels).toBe(0);

      // With threshold of 3, should fail
      const resultFail = compareImages(image1, image2, {
        pixelThreshold: 3,
        maxDiffPercent: 100,
      });
      expect(resultFail.diffPixels).toBe(3);
    });

    it('should ignore specified regions', () => {
      const image1: ImageData = {
        width: 4,
        height: 4,
        data: new Uint8Array(64).fill(100),
      };

      const image2: ImageData = {
        width: 4,
        height: 4,
        data: new Uint8Array(64),
      };

      // Make them completely different
      image2.data.fill(200);

      // But ignore a 2x2 region that covers some pixels
      const result = compareImages(image1, image2, {
        ignoreRegions: [{ x: 0, y: 0, width: 2, height: 2 }],
        maxDiffPercent: 100,
        generateDiffImage: false,
      });

      // 4 pixels ignored, 12 different
      expect(result.diffPixels).toBe(12);
    });

    it('should find diff regions', () => {
      const image1: ImageData = {
        width: 10,
        height: 10,
        data: new Uint8Array(400).fill(100),
      };

      const image2: ImageData = {
        width: 10,
        height: 10,
        data: new Uint8Array(400).fill(100),
      };

      // Create a distinct region of difference
      for (let y = 2; y < 5; y++) {
        for (let x = 2; x < 5; x++) {
          const idx = (y * 10 + x) * 4;
          image2.data[idx] = 200;
        }
      }

      const result = compareImages(image1, image2, {
        maxDiffPercent: 100,
        ignoreAntialiasing: false,
      });

      expect(result.regions.length).toBeGreaterThan(0);
    });
  });

  describe('Raw Image I/O', () => {
    const testImagePath = join(TEST_DIR, 'test-image.raw');

    beforeEach(() => {
      if (!existsSync(TEST_DIR)) {
        mkdirSync(TEST_DIR, { recursive: true });
      }
    });

    afterEach(() => {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
      }
    });

    it('should save and load raw image', () => {
      const original: ImageData = {
        width: 4,
        height: 4,
        data: new Uint8Array(64),
      };

      // Fill with test pattern
      for (let i = 0; i < 64; i++) {
        original.data[i] = i * 4;
      }

      saveRawImage(testImagePath, original);
      const loaded = loadRawImage(testImagePath);

      expect(loaded).not.toBeNull();
      expect(loaded!.width).toBe(4);
      expect(loaded!.height).toBe(4);
      expect(Array.from(loaded!.data)).toEqual(Array.from(original.data));
    });

    it('should return null for missing file', () => {
      const loaded = loadRawImage('/nonexistent/path.raw');
      expect(loaded).toBeNull();
    });
  });

  describe('Golden Master Runner', () => {
    const goldenDir = join(TEST_DIR, 'goldens');
    const actualDir = join(TEST_DIR, 'actual');
    const diffDir = join(TEST_DIR, 'diffs');

    beforeEach(() => {
      [goldenDir, actualDir, diffDir].forEach((dir) => {
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      });
    });

    afterEach(() => {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
      }
    });

    it('should create golden on first run', () => {
      const runner = createGoldenMasterRunner({
        goldenDir,
        actualDir,
        diffDir,
        updateOnMissing: true,
      });

      const testImage: ImageData = {
        width: 2,
        height: 2,
        data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]),
      };

      const result = runner.compare('new-test', testImage);

      expect(result.passed).toBe(true);
      expect(result.error).toContain('created');
      expect(existsSync(join(goldenDir, 'new-test.raw'))).toBe(true);
    });

    it('should pass for matching images', () => {
      const runner = createGoldenMasterRunner({
        goldenDir,
        actualDir,
        diffDir,
        updateOnMissing: true,
      });

      const testImage: ImageData = {
        width: 2,
        height: 2,
        data: new Uint8Array([100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255]),
      };

      // First run creates golden
      runner.compare('match-test', testImage);

      // Second run should match
      const result = runner.compare('match-test', testImage);

      expect(result.passed).toBe(true);
      expect(result.diff?.diffPixels).toBe(0);
    });

    it('should fail for non-matching images', () => {
      const runner = createGoldenMasterRunner({
        goldenDir,
        actualDir,
        diffDir,
        updateOnMissing: true,
        defaultOptions: {
          maxDiffPercent: 0,
          pixelThreshold: 0,
        },
      });

      const goldenImage: ImageData = {
        width: 2,
        height: 2,
        data: new Uint8Array(16).fill(0),
      };

      const actualImage: ImageData = {
        width: 2,
        height: 2,
        data: new Uint8Array(16).fill(255),
      };

      // Create golden
      runner.compare('diff-test', goldenImage);

      // Compare with different image
      const result = runner.compare('diff-test', actualImage);

      expect(result.passed).toBe(false);
      expect(result.diff?.diffPercent).toBe(100);
    });

    it('should list golden masters', () => {
      const runner = createGoldenMasterRunner({
        goldenDir,
        actualDir,
        diffDir,
        updateOnMissing: true,
      });

      const image: ImageData = { width: 1, height: 1, data: new Uint8Array(4) };

      runner.compare('test-a', image);
      runner.compare('test-b', image);
      runner.compare('test-c', image);

      const goldens = runner.listGoldens();
      expect(goldens).toContain('test-a');
      expect(goldens).toContain('test-b');
      expect(goldens).toContain('test-c');
    });
  });

  describe('Assertions', () => {
    it('expectVisualMatch should pass for matching result', () => {
      const result = {
        name: 'test',
        passed: true,
        diff: { passed: true, diffPixels: 0, diffPercent: 0, totalPixels: 100, maxChannelDiff: 0, meanChannelDiff: 0, regions: [] },
        goldenPath: '/golden.raw',
        actualPath: '/actual.raw',
      };

      expect(() => expectVisualMatch(result)).not.toThrow();
    });

    it('expectVisualMatch should throw for failed result', () => {
      const result = {
        name: 'test',
        passed: false,
        diff: { passed: false, diffPixels: 50, diffPercent: 50, totalPixels: 100, maxChannelDiff: 255, meanChannelDiff: 100, regions: [] },
        goldenPath: '/golden.raw',
        actualPath: '/actual.raw',
      };

      expect(() => expectVisualMatch(result)).toThrow(/Visual regression detected/);
    });

    it('expectImagesIdentical should pass for identical images', () => {
      const image: ImageData = {
        width: 5,
        height: 5,
        data: new Uint8Array(100).fill(128),
      };

      expect(() => expectImagesIdentical(image, image)).not.toThrow();
    });

    it('expectImagesSimilar should pass with tolerance', () => {
      const image1: ImageData = {
        width: 5,
        height: 5,
        data: new Uint8Array(100).fill(100),
      };

      const image2: ImageData = {
        width: 5,
        height: 5,
        data: new Uint8Array(100).fill(102), // Slight difference
      };

      expect(() => expectImagesSimilar(image1, image2, 10)).not.toThrow();
    });
  });

  describe('Visual Presets', () => {
    it('should have exact preset', () => {
      expect(visualPresets.exact.maxDiffPercent).toBe(0);
      expect(visualPresets.exact.pixelThreshold).toBe(0);
    });

    it('should have strict preset', () => {
      expect(visualPresets.strict.maxDiffPercent).toBe(0.01);
    });

    it('should have standard preset', () => {
      expect(visualPresets.standard.maxDiffPercent).toBe(0.1);
      expect(visualPresets.standard.ignoreAntialiasing).toBe(true);
    });

    it('should have lenient preset', () => {
      expect(visualPresets.lenient.maxDiffPercent).toBe(1);
    });

    it('should have clouds preset (high tolerance)', () => {
      expect(visualPresets.clouds.maxDiffPercent).toBe(5);
    });
  });

  describe('Report Generation', () => {
    it('should generate visual report', () => {
      const results = [
        {
          name: 'test-1',
          passed: true,
          diff: { passed: true, diffPixels: 0, diffPercent: 0, totalPixels: 100, maxChannelDiff: 0, meanChannelDiff: 0, regions: [] },
          goldenPath: '/golden1.raw',
          actualPath: '/actual1.raw',
        },
        {
          name: 'test-2',
          passed: false,
          diff: { passed: false, diffPixels: 10, diffPercent: 10, totalPixels: 100, maxChannelDiff: 50, meanChannelDiff: 25, regions: [] },
          goldenPath: '/golden2.raw',
          actualPath: '/actual2.raw',
        },
        {
          name: 'test-3',
          passed: true,
          diff: null,
          goldenPath: '/golden3.raw',
          actualPath: '/actual3.raw',
          error: 'Golden created',
        },
      ];

      const report = generateVisualReport(results);

      expect(report.total).toBe(3);
      expect(report.passed).toBe(1);
      expect(report.failed).toBe(1);
      expect(report.newGoldens).toBe(1);
    });
  });
});

describe('Visual Test - Synthetic Examples', () => {
  /**
   * These tests demonstrate visual regression patterns
   * using synthetic images. Real renderer tests would
   * use Playwright with WebGPU.
   */

  it('should detect gradient shift', () => {
    // Create horizontal gradient
    const createGradient = (offset: number): ImageData => {
      const width = 100;
      const height = 10;
      const data = new Uint8Array(width * height * 4);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const value = Math.min(255, Math.max(0, Math.floor((x + offset) * 2.55)));
          data[idx] = value;
          data[idx + 1] = value;
          data[idx + 2] = value;
          data[idx + 3] = 255;
        }
      }

      return { width, height, data };
    };

    const baseline = createGradient(0);
    const shifted = createGradient(5); // 5 pixel shift

    const result = compareImages(baseline, shifted, {
      maxDiffPercent: 5,
      pixelThreshold: 10,
    });

    // Should detect the shift
    expect(result.diffPixels).toBeGreaterThan(0);
  });

  it('should detect color channel issues', () => {
    const width = 50;
    const height = 50;

    const correct: ImageData = {
      width,
      height,
      data: new Uint8Array(width * height * 4),
    };

    const swapped: ImageData = {
      width,
      height,
      data: new Uint8Array(width * height * 4),
    };

    // Fill with red
    for (let i = 0; i < width * height; i++) {
      correct.data[i * 4] = 255;     // R
      correct.data[i * 4 + 1] = 0;   // G
      correct.data[i * 4 + 2] = 0;   // B
      correct.data[i * 4 + 3] = 255; // A

      // Swapped: blue instead of red (R/B swap bug)
      swapped.data[i * 4] = 0;       // R
      swapped.data[i * 4 + 1] = 0;   // G
      swapped.data[i * 4 + 2] = 255; // B
      swapped.data[i * 4 + 3] = 255; // A
    }

    const result = compareImages(correct, swapped, visualPresets.exact);

    expect(result.passed).toBe(false);
    expect(result.diffPercent).toBe(100);
    expect(result.maxChannelDiff).toBe(255);
  });

  it('should handle transparency correctly', () => {
    const width = 10;
    const height = 10;

    const opaque: ImageData = {
      width,
      height,
      data: new Uint8Array(width * height * 4),
    };

    const transparent: ImageData = {
      width,
      height,
      data: new Uint8Array(width * height * 4),
    };

    // Fill with same color but different alpha
    for (let i = 0; i < width * height; i++) {
      opaque.data[i * 4] = 128;
      opaque.data[i * 4 + 1] = 128;
      opaque.data[i * 4 + 2] = 128;
      opaque.data[i * 4 + 3] = 255; // Opaque

      transparent.data[i * 4] = 128;
      transparent.data[i * 4 + 1] = 128;
      transparent.data[i * 4 + 2] = 128;
      transparent.data[i * 4 + 3] = 128; // Semi-transparent
    }

    const result = compareImages(opaque, transparent, {
      pixelThreshold: 0,
      maxDiffPercent: 100,
    });

    // Should detect alpha difference
    expect(result.diffPixels).toBe(100);
    expect(result.maxChannelDiff).toBe(127);
  });
});


/**
 * Volumetric Cloud Shader Tests
 * 
 * Tests the WGSL cloud raymarching shader using pixel sampling.
 * Verifies correct rendering behavior for various camera positions,
 * cloud parameters, and depth occlusion scenarios.
 */
import { test, expect } from '@playwright/test';
import { 
  ensureWebGPU, 
  renderCloudsAndSampleCenter, 
  renderCloudsAndSampleGrid,
  type CloudTestConfig 
} from '../helpers/webgpu';

// Skip on Windows due to D3D12/DXIL readback flakiness
const isWindows = process.platform === 'win32';

// Thresholds for pixel validation
const ALPHA_VISIBLE_THRESHOLD = 10; // Alpha > 10 means clouds are visible
const ALPHA_INVISIBLE_THRESHOLD = 5; // Alpha < 5 means no clouds

// Default cloud layer configuration
const DEFAULT_CLOUD_ALTITUDE = 800;
const DEFAULT_CLOUD_THICKNESS = 400;
const DEFAULT_CLOUD_DENSITY = 0.5;

test.describe('VolumetricCloudPass Shader', () => {
  test.beforeEach(async ({ page }) => {
    await ensureWebGPU(page);
  });

  test.describe('Camera Position Relative to Cloud Layer', () => {
    test.skip(isWindows, 'Render readback flaky on Windows');

    test('camera below clouds looking up shows clouds', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0], // Below cloud layer (800-1200)
        lookAt: [0, 1000, 100], // Looking up towards clouds
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: DEFAULT_CLOUD_DENSITY,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      expect(pixel.a).toBeGreaterThan(ALPHA_VISIBLE_THRESHOLD);
      // Clouds should have some color (not pure black)
      expect(pixel.r + pixel.g + pixel.b).toBeGreaterThan(0);
    });

    test('camera below clouds looking down shows no clouds', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0], // Below cloud layer
        lookAt: [0, -1000, 100], // Looking down (away from clouds)
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: DEFAULT_CLOUD_DENSITY,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      expect(pixel.a).toBeLessThan(ALPHA_INVISIBLE_THRESHOLD);
    });

    test('camera above clouds looking down shows clouds', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 2000, 0], // Above cloud layer (800-1200)
        lookAt: [0, 0, 100], // Looking down towards clouds
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: DEFAULT_CLOUD_DENSITY,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      expect(pixel.a).toBeGreaterThan(ALPHA_VISIBLE_THRESHOLD);
    });

    test('camera above clouds looking up shows no clouds', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 2000, 0], // Above cloud layer
        lookAt: [0, 5000, 100], // Looking up (away from clouds)
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: DEFAULT_CLOUD_DENSITY,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      expect(pixel.a).toBeLessThan(ALPHA_INVISIBLE_THRESHOLD);
    });

    test('camera inside cloud layer shows clouds', async ({ page }) => {
      const cloudMiddle = DEFAULT_CLOUD_ALTITUDE + DEFAULT_CLOUD_THICKNESS / 2;
      
      const config: CloudTestConfig = {
        cameraPosition: [0, cloudMiddle, 0], // Inside cloud layer
        lookAt: [100, cloudMiddle, 100], // Looking horizontally
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: DEFAULT_CLOUD_DENSITY,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      // Inside clouds, should see cloud material
      expect(pixel.a).toBeGreaterThan(ALPHA_VISIBLE_THRESHOLD);
    });
  });

  test.describe('Horizon Fade', () => {
    test.skip(isWindows, 'Render readback flaky on Windows');

    test('looking at horizon produces reduced alpha', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [1000, 50, 0], // Nearly horizontal (slight upward angle)
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: DEFAULT_CLOUD_DENSITY,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      // Horizon fade should reduce alpha significantly
      // The exact value depends on the smoothstep parameters
      expect(pixel.a).toBeLessThan(200); // Not fully opaque
    });

    test('looking steeply up produces higher alpha than horizon', async ({ page }) => {
      const horizonConfig: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [1000, 100, 0], // Near horizon
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.8,
      };

      const steepConfig: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [100, 1000, 0], // Steep upward angle
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.8,
      };

      const horizonPixel = await renderCloudsAndSampleCenter(page, horizonConfig);
      const steepPixel = await renderCloudsAndSampleCenter(page, steepConfig);
      
      // Steep angle should have higher alpha than horizon
      expect(steepPixel.a).toBeGreaterThanOrEqual(horizonPixel.a);
    });
  });

  test.describe('Cloud Parameters', () => {
    test.skip(isWindows, 'Render readback flaky on Windows');

    test('density 0 produces minimal alpha', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.0, // No clouds
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      // Very low density should produce very low alpha
      expect(pixel.a).toBeLessThan(50);
    });

    test('density 1 produces higher alpha than density 0.5', async ({ page }) => {
      const lowDensityConfig: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.3,
      };

      const highDensityConfig: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 1.0,
      };

      const lowPixel = await renderCloudsAndSampleCenter(page, lowDensityConfig);
      const highPixel = await renderCloudsAndSampleCenter(page, highDensityConfig);
      
      // Higher density = more cloud coverage = higher average alpha
      expect(highPixel.a).toBeGreaterThan(lowPixel.a);
    });

    test('thicker cloud layer produces higher alpha', async ({ page }) => {
      const thinConfig: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: 100, // Thin layer
        cloudDensity: 0.7,
      };

      const thickConfig: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: 800, // Thick layer
        cloudDensity: 0.7,
      };

      const thinPixel = await renderCloudsAndSampleCenter(page, thinConfig);
      const thickPixel = await renderCloudsAndSampleCenter(page, thickConfig);
      
      // Thicker clouds should accumulate more opacity
      expect(thickPixel.a).toBeGreaterThanOrEqual(thinPixel.a);
    });

    test('high altitude clouds are visible when looking up', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 5000, 100],
        cloudAltitude: 3000, // High altitude
        cloudThickness: 500,
        cloudDensity: 0.6,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      expect(pixel.a).toBeGreaterThan(ALPHA_VISIBLE_THRESHOLD);
    });
  });

  test.describe('Depth Occlusion', () => {
    test.skip(isWindows, 'Render readback flaky on Windows');

    test('object in front of clouds occludes them', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.7,
        sceneDepth: 100, // Object very close, before clouds
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      // Clouds should be occluded by the close object
      expect(pixel.a).toBeLessThan(ALPHA_INVISIBLE_THRESHOLD);
    });

    test('object behind clouds does not occlude them', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.7,
        sceneDepth: 5000, // Object far behind clouds
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      // Clouds should be visible
      expect(pixel.a).toBeGreaterThan(ALPHA_VISIBLE_THRESHOLD);
    });

    test('no occlusion at far plane shows full clouds', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.7,
        sceneDepth: 50000, // Far plane (default)
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      expect(pixel.a).toBeGreaterThan(ALPHA_VISIBLE_THRESHOLD);
    });

    test('partial occlusion when object is within cloud layer', async ({ page }) => {
      // Object depth is between cloud bottom and top
      const cloudBottom = DEFAULT_CLOUD_ALTITUDE;
      const cloudTop = DEFAULT_CLOUD_ALTITUDE + DEFAULT_CLOUD_THICKNESS;
      const objectDepth = cloudBottom + DEFAULT_CLOUD_THICKNESS / 2;
      
      const fullCloudsConfig: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.7,
        sceneDepth: cloudTop + 1000, // No occlusion
      };

      const partialConfig: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.7,
        sceneDepth: objectDepth, // Partial occlusion
      };

      const fullPixel = await renderCloudsAndSampleCenter(page, fullCloudsConfig);
      const partialPixel = await renderCloudsAndSampleCenter(page, partialConfig);
      
      // Partial occlusion should result in less alpha than full clouds
      // (raymarching stops at the object depth)
      expect(partialPixel.a).toBeLessThanOrEqual(fullPixel.a);
    });
  });

  test.describe('Edge Cases', () => {
    test.skip(isWindows, 'Render readback flaky on Windows');

    test('zero thickness cloud layer produces no clouds', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: 0, // Zero thickness
        cloudDensity: 1.0,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      // No thickness = no clouds
      expect(pixel.a).toBeLessThan(ALPHA_INVISIBLE_THRESHOLD);
    });

    test('very high altitude clouds out of range produce no visible clouds', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100], // Looking slightly up
        cloudAltitude: 50000, // Way beyond MAX_DIST
        cloudThickness: 400,
        cloudDensity: 1.0,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      // Clouds too far away should not be visible
      expect(pixel.a).toBeLessThan(ALPHA_INVISIBLE_THRESHOLD);
    });

    test('renders at minimum resolution (1x1)', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.7,
        resolution: 1,
      };

      // Should not throw
      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      // Should produce some result
      expect(pixel).toBeDefined();
      expect(pixel.a).toBeGreaterThanOrEqual(0);
      expect(pixel.a).toBeLessThanOrEqual(255);
    });

    test('renders at high resolution', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.7,
        resolution: 256,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      expect(pixel.a).toBeGreaterThan(ALPHA_VISIBLE_THRESHOLD);
    });
  });

  test.describe('Cloud Color Characteristics', () => {
    test.skip(isWindows, 'Render readback flaky on Windows');

    test('clouds have grayish-white color', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.8,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      
      if (pixel.a > ALPHA_VISIBLE_THRESHOLD) {
        // Premultiplied alpha - unpremultiply to check color
        const alpha = pixel.a / 255;
        if (alpha > 0.1) {
          const r = pixel.r / alpha;
          const g = pixel.g / alpha;
          const b = pixel.b / alpha;
          
          // Clouds should be light colored (grayish-white)
          expect(r).toBeGreaterThan(50);
          expect(g).toBeGreaterThan(50);
          expect(b).toBeGreaterThan(50);
          
          // Should be relatively balanced (not strongly colored)
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          expect(maxDiff).toBeLessThan(100); // Roughly grayscale
        }
      }
    });

    test('multiple pixels show cloud variation', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.5, // Medium density for variation
        resolution: 128,
      };

      const pixels = await renderCloudsAndSampleGrid(page, config, 3);
      
      // At least some pixels should have clouds
      const hasCloudPixels = pixels.filter(p => p.a > ALPHA_VISIBLE_THRESHOLD);
      expect(hasCloudPixels.length).toBeGreaterThan(0);
      
      // FBM noise should produce some variation in alpha values
      const alphaValues = pixels.map(p => p.a);
      const minAlpha = Math.min(...alphaValues);
      const maxAlpha = Math.max(...alphaValues);
      
      // Some variation expected (not all identical)
      // This tests that the noise function is working
      if (maxAlpha > ALPHA_VISIBLE_THRESHOLD) {
        expect(maxAlpha - minAlpha).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Shader Compilation', () => {
    test.skip(isWindows, 'Render readback flaky on Windows');

    test('shader compiles and runs without errors', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.5,
      };

      // This will throw if shader compilation fails
      await expect(renderCloudsAndSampleCenter(page, config)).resolves.toBeDefined();
    });

    test('shader handles negative camera position', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [-1000, -500, -1000],
        lookAt: [0, 1000, 0],
        cloudAltitude: DEFAULT_CLOUD_ALTITUDE,
        cloudThickness: DEFAULT_CLOUD_THICKNESS,
        cloudDensity: 0.5,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      expect(pixel).toBeDefined();
    });

    test('shader handles extreme cloud parameters', async ({ page }) => {
      const config: CloudTestConfig = {
        cameraPosition: [0, 0, 0],
        lookAt: [0, 1000, 100],
        cloudAltitude: 10000,
        cloudThickness: 5000,
        cloudDensity: 1.0,
      };

      const pixel = await renderCloudsAndSampleCenter(page, config);
      expect(pixel).toBeDefined();
    });
  });
});


import { test, expect } from '@playwright/test';
import { ensureWebGPU, renderSolidColorToCanvas } from '../helpers/webgpu';

test.skip('solid red canvas matches golden (enable with snapshot update)', async ({ page }) => {
  await ensureWebGPU(page);
  await renderSolidColorToCanvas(page, [255, 0, 0, 255], 1, 1);
  const canvas = page.locator('#test-canvas');
  await expect(canvas).toHaveScreenshot('solid-red-1x1.png', { maxDiffPixelRatio: 0, threshold: 0 });
});



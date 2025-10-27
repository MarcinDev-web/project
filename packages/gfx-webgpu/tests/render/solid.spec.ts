import { test, expect } from '@playwright/test';
import { ensureWebGPU, renderSolidColorToCanvas } from '../helpers/webgpu';

// Keep this test active only on platforms where readback is reliable
const isWindows = process.platform === 'win32';
test.skip(isWindows, 'Render readback flaky on Windows D3D12/DXIL; runs on macOS/Linux.');

test('render pipeline outputs solid red pixel', async ({ page }) => {
  await ensureWebGPU(page);
  await renderSolidColorToCanvas(page, [255, 0, 0, 255], 1, 1);
  const rgba = await page.evaluate(() => {
    const canvas = document.getElementById('test-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2], data[3]];
  });
  expect(rgba).toEqual([255, 0, 0, 255]);
});



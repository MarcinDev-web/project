/**
 * Visual regression tests for editor UI
 * 
 * Ensures UI changes don't break visual appearance
 */

import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('editor canvas should match baseline screenshot', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Wait for initial render
    await page.waitForTimeout(1000);
    
    const canvas = page.locator('canvas').first();
    
    // Take screenshot for visual regression testing
    // Note: This requires baseline images to be committed
    await expect(canvas).toHaveScreenshot('editor-canvas-baseline.png', {
      maxDiffPixelRatio: 0.01, // Allow 1% pixel difference
    });
  });

  test('editor UI should match baseline', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    await page.waitForTimeout(1000);
    
    // Screenshot of full page including UI
    await expect(page).toHaveScreenshot('editor-ui-baseline.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});


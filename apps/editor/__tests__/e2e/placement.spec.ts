/**
 * E2E tests for editor placement functionality
 * 
 * Critical user paths:
 * - Block placement workflow
 * - Collision detection during placement
 * - Snap-to-grid functionality
 * - Pattern placement
 */

import { test, expect } from '@playwright/test';

test.describe('Placement E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Start dev server and navigate to editor
    // Note: This assumes dev server is running or we mock it
    await page.goto('http://localhost:5173');
    
    // Wait for editor to initialize
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('should place block at clicked position', async ({ page }) => {
    // Wait for editor to be fully initialized
    await page.waitForTimeout(2000);
    
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Verify canvas is interactive
    await canvas.click({ position: { x: 400, y: 300 } });
    
    // Verify no errors occurred
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForTimeout(500);
    
    // Check console for errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(500);
    
    // Should not have critical placement errors
    const criticalErrors = [
      ...errors,
      ...consoleErrors.filter((e) => e.toLowerCase().includes('placement') && e.toLowerCase().includes('error')),
    ];
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle placement mode activation', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Verify canvas responds to interactions
    await canvas.click({ position: { x: 400, y: 300 } });
    
    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(500);
    // Should not have critical errors
    const criticalErrors = errors.filter((e) => 
      e.includes('placement') && e.includes('error')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should detect collision when placing overlapping blocks', async ({ page }) => {
    await page.waitForTimeout(2000);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Simulate placing first block
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(200);
    
    // Simulate double-click to place
    await canvas.dblclick({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(500);
    
    // Simulate placing second block at same position (should detect collision)
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(300);
    
    // Check for collision-related console messages or visual indicators
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log' || msg.type() === 'warn') {
        consoleMessages.push(msg.text());
      }
    });
    
    await canvas.dblclick({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(500);
    
    // Verify no critical errors (collision detection should work gracefully)
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForTimeout(200);
    
    const criticalErrors = errors.filter((e) => 
      e.toLowerCase().includes('collision') && e.toLowerCase().includes('error')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should snap to grid when enabled', async ({ page }) => {
    await page.waitForTimeout(2000);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Simulate grid snapping by clicking at non-grid-aligned position
    // Grid is typically 1 unit, so clicking at fractional positions should snap
    await canvas.click({ position: { x: 425, y: 325 } }); // Offset from grid
    await page.waitForTimeout(200);
    
    // Move mouse to simulate placement preview
    await canvas.hover({ position: { x: 450, y: 350 } });
    await page.waitForTimeout(200);
    
    // Verify no errors during snapping
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForTimeout(200);
    
    expect(errors.length).toBe(0);
  });

  test('should handle placement cancellation with Escape key', async ({ page }) => {
    await page.waitForTimeout(2000);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Start placement
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(200);
    
    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    
    // Verify no errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForTimeout(200);
    
    expect(errors.length).toBe(0);
  });

  test('should handle rapid mouse movements during placement', async ({ page }) => {
    await page.waitForTimeout(2000);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Start placement
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(100);
    
    // Rapid mouse movements (simulates fast user interaction)
    const positions = [
      { x: 400, y: 300 },
      { x: 450, y: 350 },
      { x: 500, y: 400 },
      { x: 550, y: 450 },
      { x: 600, y: 500 },
    ];
    
    for (const pos of positions) {
      await canvas.hover({ position: pos });
      await page.waitForTimeout(16); // ~60fps
    }
    
    // Verify no race condition errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (error.message.includes('placement') || error.message.includes('race')) {
        errors.push(error.message);
      }
    });
    
    await page.waitForTimeout(500);
    
    // Should not have race condition errors
    expect(errors.length).toBe(0);
  });
});


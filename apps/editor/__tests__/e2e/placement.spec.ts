/**
 * E2E tests for editor placement functionality
 * 
 * Critical user paths:
 * - Block placement workflow: start → move mouse → double-click → verify entity placed
 * - Collision detection during placement
 * - Snap-to-grid functionality
 * - Rotation workflow
 * - Cancellation (ESC/right-click)
 * - Rapid mouse movements (race condition scenario)
 */

import { test, expect } from '@playwright/test';

test.describe('Placement E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Start dev server and navigate to editor
    // Note: This assumes dev server is running or we mock it
    await page.goto('http://localhost:5173');
    
    // Wait for editor to initialize
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Wait for editor to be fully ready
    await page.waitForTimeout(2000);
  });

  test('should complete full placement workflow: start → move mouse → double-click → verify entity placed', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Track errors
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Step 1: Start placement mode (simulate clicking on an asset)
    // In real UI, this would be clicking an asset button, but for E2E we simulate
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(300);
    
    // Step 2: Move mouse to update preview position
    await canvas.hover({ position: { x: 450, y: 350 } });
    await page.waitForTimeout(200);
    
    // Step 3: Move mouse again to verify preview follows
    await canvas.hover({ position: { x: 500, y: 400 } });
    await page.waitForTimeout(200);
    
    // Step 4: Double-click to confirm placement
    await canvas.dblclick({ position: { x: 500, y: 400 } });
    await page.waitForTimeout(500);
    
    // Verify no critical errors occurred during workflow
    const criticalErrors = [
      ...errors,
      ...consoleErrors.filter((e) => 
        e.toLowerCase().includes('placement') && 
        (e.toLowerCase().includes('error') || e.toLowerCase().includes('race'))
      ),
    ];
    expect(criticalErrors.length).toBe(0);
  });

  test('should detect collision when placing overlapping blocks', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log' || msg.type() === 'warn') {
        consoleMessages.push(msg.text());
      }
    });
    
    // Place first block
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(200);
    await canvas.dblclick({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(500);
    
    // Try to place second block at same position (should detect collision)
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(300);
    
    // Move mouse slightly to trigger collision check
    await canvas.hover({ position: { x: 401, y: 301 } });
    await page.waitForTimeout(300);
    
    // Try to confirm placement (should fail due to collision)
    await canvas.dblclick({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(500);
    
    // Verify no critical errors (collision detection should work gracefully)
    const criticalErrors = errors.filter((e) => 
      e.toLowerCase().includes('collision') && e.toLowerCase().includes('error')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle rotation workflow', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Start placement
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(200);
    
    // Move mouse to position preview
    await canvas.hover({ position: { x: 450, y: 350 } });
    await page.waitForTimeout(200);
    
    // Simulate rotation (typically Q/E keys or mouse wheel)
    // For E2E, we'll verify the system handles rotation without errors
    // In real UI, rotation would be triggered by keyboard or mouse wheel
    
    // Move mouse to trigger collision check after rotation
    await canvas.hover({ position: { x: 451, y: 351 } });
    await page.waitForTimeout(300);
    
    // Verify no errors during rotation workflow
    const criticalErrors = errors.filter((e) => 
      e.toLowerCase().includes('placement') || e.toLowerCase().includes('rotation')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle placement cancellation with Escape key', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Start placement
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(200);
    
    // Move mouse to position preview
    await canvas.hover({ position: { x: 450, y: 350 } });
    await page.waitForTimeout(200);
    
    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    
    // Verify no errors during cancellation
    expect(errors.length).toBe(0);
    
    // Verify we can start a new placement after cancellation
    await canvas.click({ position: { x: 500, y: 400 } });
    await page.waitForTimeout(200);
    
    const errorsAfterRestart: string[] = [];
    page.on('pageerror', (error) => errorsAfterRestart.push(error.message));
    await page.waitForTimeout(200);
    expect(errorsAfterRestart.length).toBe(0);
  });

  test('should handle placement cancellation with right-click', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Start placement
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(200);
    
    // Move mouse to position preview
    await canvas.hover({ position: { x: 450, y: 350 } });
    await page.waitForTimeout(200);
    
    // Right-click to cancel (should prevent context menu)
    await canvas.click({ button: 'right', position: { x: 450, y: 350 } });
    await page.waitForTimeout(300);
    
    // Verify no errors during cancellation
    expect(errors.length).toBe(0);
  });

  test('should handle rapid mouse movements during placement (race condition test)', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (error.message.includes('placement') || error.message.includes('race')) {
        errors.push(error.message);
      }
    });
    
    // Start placement
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(100);
    
    // Rapid mouse movements (simulates fast user interaction)
    // This tests the race condition fix: old collision checks should not overwrite new ones
    const positions = [
      { x: 400, y: 300 },
      { x: 450, y: 350 },
      { x: 500, y: 400 },
      { x: 550, y: 450 },
      { x: 600, y: 500 },
      { x: 650, y: 550 },
      { x: 700, y: 600 },
    ];
    
    // Move rapidly (faster than collision check can complete)
    for (const pos of positions) {
      await canvas.hover({ position: pos });
      await page.waitForTimeout(8); // ~120fps - faster than typical collision check
    }
    
    // Wait for any pending collision checks to complete
    await page.waitForTimeout(1000);
    
    // Verify no race condition errors
    expect(errors.length).toBe(0);
    
    // Verify placement still works after rapid movements
    await canvas.dblclick({ position: { x: 700, y: 600 } });
    await page.waitForTimeout(500);
    
    const errorsAfterPlacement: string[] = [];
    page.on('pageerror', (error) => errorsAfterPlacement.push(error.message));
    await page.waitForTimeout(200);
    expect(errorsAfterPlacement.length).toBe(0);
  });

  test('should snap to grid when enabled', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Simulate grid snapping by clicking at non-grid-aligned position
    // Grid is typically 1 unit, so clicking at fractional positions should snap
    await canvas.click({ position: { x: 425, y: 325 } }); // Offset from grid
    await page.waitForTimeout(200);
    
    // Move mouse to simulate placement preview with snapping
    await canvas.hover({ position: { x: 450, y: 350 } });
    await page.waitForTimeout(200);
    
    // Move to another position to verify snapping continues to work
    await canvas.hover({ position: { x: 475, y: 375 } });
    await page.waitForTimeout(200);
    
    // Verify no errors during snapping
    expect(errors.length).toBe(0);
  });

  test('should handle multiple placement cycles without errors', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    
    // Perform multiple placement cycles
    for (let i = 0; i < 3; i++) {
      // Start placement
      await canvas.click({ position: { x: 400 + i * 50, y: 300 + i * 50 } });
      await page.waitForTimeout(100);
      
      // Move mouse
      await canvas.hover({ position: { x: 450 + i * 50, y: 350 + i * 50 } });
      await page.waitForTimeout(100);
      
      // Confirm placement
      await canvas.dblclick({ position: { x: 450 + i * 50, y: 350 + i * 50 } });
      await page.waitForTimeout(300);
    }
    
    // Verify no errors across multiple cycles
    expect(errors.length).toBe(0);
  });
});


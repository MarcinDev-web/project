import { test, expect } from '@playwright/test';

test.describe('Player E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the API response for build data
    await page.route('**/api/marketplace/*/build-data', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sceneJSON: {
            entities: [], // Empty scene for basic test
            environment: {},
          },
          manifest: {
            version: 1,
            playerStart: {
              position: [0, 2, 0],
              rotation: 0,
              controllerMode: 'fps',
              enableCollisions: true,
              pawnArchetype: 'character',
            },
            simulation: {
              fixedDeltaTime: 0.016,
              enablePhysics: true,
              enableMultiplayer: false,
            },
            pawn: {
              type: 'character',
              physics: {
                rigidbody: { type: 'kinematic', mass: 75, useGravity: true },
                collider: { shape: 'capsule', radius: 0.35, height: 1.7, center: [0, 0.85, 0] },
                material: { friction: 0.7, restitution: 0 },
              },
              kcc: {
                moveSpeed: 5.0,
                jumpForce: 8.0,
              },
              cameraTarget: {
                offset: [0, 1.6, 0],
                collisionRadius: 0.3,
              }
            },
            controller: {
              preferences: { fov: 90, sensitivity: 0.0025, invertY: false },
              input: {
                movement: { forward: ['KeyW'], backward: ['KeyS'], left: ['KeyA'], right: ['KeyD'] },
                actions: { jump: ['Space'], sprint: ['ShiftLeft'], interact: ['KeyE'], crouch: ['KeyC'] }
              }
            }
          }
        }),
      });
    });

    // Mock auth
    await page.route('**/api/auth/token', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'mock-token' }),
      });
    });
  });

  test('loads game and spawns player', async ({ page }) => {
    // Navigate to player with a dummy buildId
    await page.goto('http://localhost:5175/?buildId=test-build');

    // Wait for canvas
    await expect(page.locator('canvas')).toBeVisible();

    // Check if loading screen disappears
    await expect(page.locator('#loading')).toBeHidden({ timeout: 15000 });

    // Verify player is initialized (using internal state or HUD existence)
    // HUD should be mounted
    await expect(page.locator('#hud-root')).toBeVisible();
    
    // Check if health bar is visible (part of HUD)
    await expect(page.getByText('100 / 100')).toBeVisible();
  });

  test('pause menu functionality', async ({ page }) => {
    await page.goto('http://localhost:5175/?buildId=test-build');
    
    // Wait for game to load
    await expect(page.locator('#loading')).toBeHidden({ timeout: 15000 });

    // Press Escape to pause
    await page.keyboard.press('Escape');

    // Check for Pause title
    await expect(page.getByText('Paused', { exact: true })).toBeVisible();

    // Check buttons
    await expect(page.getByText('Resume')).toBeVisible();
    await expect(page.getByText('Settings')).toBeVisible();
    await expect(page.getByText('Exit Game')).toBeVisible();

    // Resume
    await page.getByText('Resume').click();
    await expect(page.getByText('Paused')).toBeHidden();
  });
});


import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages/gfx-webgpu/tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      threshold: 0.1,
    },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  snapshotPathTemplate: '{testDir}/{testFile}-snapshots/{arg}{ext}',
  projects: [
    {
      name: 'chrome',
      use: {
        // Use system Chrome channel to ensure DXC/DXIL availability on Windows
        channel: 'chrome',
        headless: true,
        launchOptions: {
          args: ['--enable-unsafe-webgpu'],
        },
        viewport: { width: 256, height: 256 },
        // Use a secure context by default
        baseURL: 'https://example.com',
      },
    },
  ],
  // Exclude perf-tagged tests by default; run with `--grep @perf` when needed
  grepInvert: /@perf/,
});



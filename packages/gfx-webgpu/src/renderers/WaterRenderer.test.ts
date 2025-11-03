import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WaterRenderer } from './WaterRenderer';
import { createMockCanvas, createMockGPU } from '@engine/test-utils';

describe('WaterRenderer', () => {
  let device: GPUDevice;
  let canvas: HTMLCanvasElement;

  beforeEach(async () => {
    const mock = createMockGPU();
    const adapter = await mock.requestAdapter();
    device = (await adapter!.requestDevice()) as unknown as GPUDevice;
    canvas = createMockCanvas();
  });

  afterEach(() => {
    device?.destroy();
  });

  it('initializes successfully', async () => {
    const renderer = new WaterRenderer();
    await expect(
      renderer.initialize({
        device,
        presentationFormat: 'bgra8unorm',
        sampleCount: 1,
      })
    ).resolves.not.toThrow();

    renderer.dispose();
  });

  it('disposes resources correctly', async () => {
    const renderer = new WaterRenderer();
    await renderer.initialize({
      device,
      presentationFormat: 'bgra8unorm',
      sampleCount: 1,
    });

    // Should not throw when disposing
    expect(() => renderer.dispose()).not.toThrow();
    
    // Can dispose multiple times safely
    expect(() => renderer.dispose()).not.toThrow();
  });

  it('does not render when not initialized', () => {
    const renderer = new WaterRenderer();
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
    });

    // Should not throw, just return early
    expect(() => {
      renderer.render(
        pass,
        null,
        new Float32Array(16) as any,
        [0, 0, 0],
        0,
        null,
        null,
        null
      );
    }).not.toThrow();

    pass.end();
    encoder.finish();
  });

  it('renders without errors when initialized', async () => {
    const renderer = new WaterRenderer();
    await renderer.initialize({
      device,
      presentationFormat: 'bgra8unorm',
      sampleCount: 1,
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
    });

    // Should not throw with valid inputs
    expect(() => {
      renderer.render(
        pass,
        null,
        new Float32Array(16) as any,
        [0, 0, 0],
        0,
        null,
        null,
        null
      );
    }).not.toThrow();

    pass.end();
    encoder.finish();

    renderer.dispose();
  });
});


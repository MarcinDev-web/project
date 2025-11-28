/**
 * Visual Regression Tests - Basic Shapes
 *
 * Tests rendering of basic geometric shapes.
 * Uses golden master comparison for pixel-accurate validation.
 */

import { test, expect } from '@playwright/test';
import { ensureWebGPU } from '../helpers/webgpu';

test.describe('Basic Shape Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await ensureWebGPU(page);
  });

  test('renders solid triangle', async ({ page }) => {
    await page.evaluate(async () => {
      if (!navigator.gpu) throw new Error('WebGPU not available');

      const canvas = document.createElement('canvas');
      canvas.id = 'test-canvas';
      canvas.width = 256;
      canvas.height = 256;
      document.body.appendChild(canvas);

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No GPU adapter');
      const device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu')!;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });

      const module = device.createShaderModule({
        code: `
          struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) color: vec3<f32>,
          };

          @vertex
          fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
            var positions = array<vec2<f32>, 3>(
              vec2<f32>(0.0, 0.5),
              vec2<f32>(-0.5, -0.5),
              vec2<f32>(0.5, -0.5)
            );
            var colors = array<vec3<f32>, 3>(
              vec3<f32>(1.0, 0.0, 0.0),
              vec3<f32>(0.0, 1.0, 0.0),
              vec3<f32>(0.0, 0.0, 1.0)
            );
            var output: VertexOutput;
            output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
            output.color = colors[vertexIndex];
            return output;
          }

          @fragment
          fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
          }
        `,
      });

      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs_main' },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    });

    const canvas = page.locator('#test-canvas');
    await expect(canvas).toHaveScreenshot('triangle-rgb.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('renders quad with uniform color', async ({ page }) => {
    await page.evaluate(async () => {
      if (!navigator.gpu) throw new Error('WebGPU not available');

      const canvas = document.createElement('canvas');
      canvas.id = 'test-canvas';
      canvas.width = 256;
      canvas.height = 256;
      document.body.appendChild(canvas);

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No GPU adapter');
      const device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu')!;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });

      const module = device.createShaderModule({
        code: `
          @vertex
          fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 6>(
              vec2<f32>(-0.5, 0.5),
              vec2<f32>(-0.5, -0.5),
              vec2<f32>(0.5, -0.5),
              vec2<f32>(-0.5, 0.5),
              vec2<f32>(0.5, -0.5),
              vec2<f32>(0.5, 0.5)
            );
            return vec4<f32>(pos[vi], 0.0, 1.0);
          }

          @fragment
          fn fs_main() -> @location(0) vec4<f32> {
            return vec4<f32>(0.2, 0.6, 0.9, 1.0);
          }
        `,
      });

      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs_main' },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.05, g: 0.05, b: 0.05, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.draw(6);
      pass.end();
      device.queue.submit([encoder.finish()]);
    });

    const canvas = page.locator('#test-canvas');
    await expect(canvas).toHaveScreenshot('quad-blue.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('renders circle approximation', async ({ page }) => {
    await page.evaluate(async () => {
      if (!navigator.gpu) throw new Error('WebGPU not available');

      const canvas = document.createElement('canvas');
      canvas.id = 'test-canvas';
      canvas.width = 256;
      canvas.height = 256;
      document.body.appendChild(canvas);

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No GPU adapter');
      const device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu')!;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });

      // Generate circle vertices
      const segments = 64;
      const radius = 0.4;
      const vertices: number[] = [];

      for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;

        // Center
        vertices.push(0, 0);
        // Point 1
        vertices.push(Math.cos(angle1) * radius, Math.sin(angle1) * radius);
        // Point 2
        vertices.push(Math.cos(angle2) * radius, Math.sin(angle2) * radius);
      }

      const vertexBuffer = device.createBuffer({
        size: vertices.length * 4,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(vertexBuffer, 0, new Float32Array(vertices));

      const module = device.createShaderModule({
        code: `
          @vertex
          fn vs_main(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
            return vec4<f32>(position, 0.0, 1.0);
          }

          @fragment
          fn fs_main() -> @location(0) vec4<f32> {
            return vec4<f32>(0.9, 0.3, 0.2, 1.0);
          }
        `,
      });

      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module,
          entryPoint: 'vs_main',
          buffers: [{
            arrayStride: 8,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' as GPUVertexFormat }],
          }],
        },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(segments * 3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    });

    const canvas = page.locator('#test-canvas');
    await expect(canvas).toHaveScreenshot('circle-red.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Depth Testing', () => {
  test.beforeEach(async ({ page }) => {
    await ensureWebGPU(page);
  });

  test('renders overlapping triangles with depth', async ({ page }) => {
    await page.evaluate(async () => {
      if (!navigator.gpu) throw new Error('WebGPU not available');

      const canvas = document.createElement('canvas');
      canvas.id = 'test-canvas';
      canvas.width = 256;
      canvas.height = 256;
      document.body.appendChild(canvas);

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('No GPU adapter');
      const device = await adapter.requestDevice();
      const context = canvas.getContext('webgpu')!;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'opaque' });

      // Create depth texture
      const depthTexture = device.createTexture({
        size: { width: 256, height: 256 },
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const module = device.createShaderModule({
        code: `
          struct VertexInput {
            @location(0) position: vec3<f32>,
            @location(1) color: vec3<f32>,
          };

          struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) color: vec3<f32>,
          };

          @vertex
          fn vs_main(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            output.position = vec4<f32>(input.position, 1.0);
            output.color = input.color;
            return output;
          }

          @fragment
          fn fs_main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(color, 1.0);
          }
        `,
      });

      // Vertices: position (x, y, z) + color (r, g, b)
      const vertices = new Float32Array([
        // Back triangle (red) - deeper
        -0.3, 0.5, 0.5,   1.0, 0.0, 0.0,
        -0.5, -0.5, 0.5,  1.0, 0.0, 0.0,
        0.5, -0.3, 0.5,   1.0, 0.0, 0.0,

        // Front triangle (blue) - closer
        0.3, 0.5, 0.2,    0.0, 0.0, 1.0,
        -0.5, -0.3, 0.2,  0.0, 0.0, 1.0,
        0.5, -0.5, 0.2,   0.0, 0.0, 1.0,
      ]);

      const vertexBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(vertexBuffer, 0, vertices);

      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module,
          entryPoint: 'vs_main',
          buffers: [{
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' as GPUVertexFormat },
              { shaderLocation: 1, offset: 12, format: 'float32x3' as GPUVertexFormat },
            ],
          }],
        },
        fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus',
        },
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      });
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(6);
      pass.end();
      device.queue.submit([encoder.finish()]);
    });

    const canvas = page.locator('#test-canvas');
    await expect(canvas).toHaveScreenshot('depth-overlap.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});


import { test, expect } from '@playwright/test';

test('@perf compute throughput within budget', async ({ page }) => {
  await page.goto('about:blank');
  test.skip(!!process.env.CI, 'Perf budgets are soft in CI');

  const ms = await page.evaluate(async () => {
    if (!navigator.gpu) throw new Error('WebGPU not available');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter');
    const device = await adapter.requestDevice();

    const N = 1 << 20; // 1M floats
    const wgsl = `
      @group(0) @binding(0) var<storage, read> a : array<f32>;
      @group(0) @binding(1) var<storage, read> b : array<f32>;
      @group(0) @binding(2) var<storage, read_write> out : array<f32>;
      @compute @workgroup_size(256)
      fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
        let i = gid.x; if (i < ${N}u) { out[i] = a[i] + b[i]; }
      }
    `;
    const module = device.createShaderModule({ code: wgsl });
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });

    const size = N * 4;
    const a = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const b = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const out = device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(a, 0, new Float32Array(N).fill(1));
    device.queue.writeBuffer(b, 0, new Float32Array(N).fill(2));

    const entries = [0, 1, 2].map((binding) => ({ binding, resource: { buffer: [a, b, out][binding] as GPUBuffer } }));
    const bg = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    const wgs = 256;
    const count = Math.ceil(N / wgs);
    const t0 = performance.now();
    pass.dispatchWorkgroups(count);
    pass.end();
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    const t1 = performance.now();
    return t1 - t0;
  });

  // Soft budget example: under 200ms locally for 1M adds (very lenient)
  expect(ms).toBeLessThan(200);
});



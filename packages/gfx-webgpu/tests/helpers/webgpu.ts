import { Page, test, expect } from '@playwright/test';

export type FloatArray = Float32Array | number[];

export interface ComputeDispatchConfig {
  wgslSource: string;
  length: number;
  bindings: Array<{
    binding: number;
    role: 'read' | 'read_write' | 'write';
    data?: FloatArray; // required for 'read' and optional for 'read_write'
  }>;
  workgroupSize?: number;
}

export async function ensureWebGPU(page: Page): Promise<void> {
  // WebGPU is only exposed in secure contexts; navigate to a secure origin.
  await page.goto('https://example.com');
  const hasGPU = await page.evaluate(() => typeof navigator !== 'undefined' && !!(navigator as any).gpu);
  expect(hasGPU, 'navigator.gpu should be available in Chromium with --enable-unsafe-webgpu').toBeTruthy();
}

export async function runCompute(
  page: Page,
  config: ComputeDispatchConfig,
): Promise<Float32Array> {
  const result = await page.evaluate(async (cfg) => {
    if (!navigator.gpu) throw new Error('WebGPU not available');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter');
    const device = await adapter.requestDevice();

    const module = device.createShaderModule({ code: cfg.wgslSource });
    const pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    });

    const encoder = device.createCommandEncoder();

    // Create buffers per binding
    const buffers: Record<number, GPUBuffer> = {};
    const createStorageBuffer = (init: Float32Array | null, writable: boolean) => {
      const sizeBytes = (cfg.length * 4) | 0;
      if (init) {
        const buffer = device.createBuffer({
          size: sizeBytes,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | (writable ? GPUBufferUsage.COPY_SRC : 0),
          mappedAtCreation: true,
        });
        new Float32Array(buffer.getMappedRange()).set(init);
        buffer.unmap();
        return buffer;
      } else {
        return device.createBuffer({
          size: sizeBytes,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
      }
    };

    for (const b of cfg.bindings) {
      const writable = b.role !== 'read';
      const init = b.data ? new Float32Array(b.data) : null;
      buffers[b.binding] = createStorageBuffer(init, writable);
    }

    const entries = cfg.bindings.map((b) => ({ binding: b.binding, resource: { buffer: buffers[b.binding] } }));
    const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });

    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    const workgroupSize = cfg.workgroupSize ?? 64;
    const workgroupCount = Math.ceil(cfg.length / workgroupSize);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();

    // Prepare readback for the first write/read_write binding as output
    const outBinding = cfg.bindings.find((b) => b.role !== 'read')?.binding;
    if (outBinding === undefined) throw new Error('At least one output binding required');
    const outBuffer = buffers[outBinding];
    const readback = device.createBuffer({
      size: cfg.length * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyBufferToBuffer(outBuffer, 0, readback, 0, cfg.length * 4);
    device.queue.submit([encoder.finish()]);

    await readback.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(readback.getMappedRange().slice(0));
    readback.unmap();
    return Array.from(out);
  }, config as any);

  return new Float32Array(result);
}

export async function renderSolidColorToCanvas(page: Page, rgba: [number, number, number, number], width = 1, height = 1): Promise<void> {
  await page.evaluate(async ([r, g, b, a, w, h]) => {
    if (!navigator.gpu) throw new Error('WebGPU not available');
    const canvas = document.createElement('canvas');
    canvas.id = 'test-canvas';
    canvas.width = w;
    canvas.height = h;
    Object.assign(canvas.style, { width: `${w}px`, height: `${h}px` });
    document.body.appendChild(canvas);

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu')!;
    const format = (navigator.gpu as any).getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque' });

    const module = device.createShaderModule({
      code: `
        struct VSOut { @builtin(position) pos: vec4<f32>; };
        @vertex fn vs(@builtin(vertex_index) i: u32) -> VSOut {
          var p = array<vec2<f32>, 3>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 3.0, -1.0),
            vec2<f32>(-1.0,  3.0)
          );
          var o: VSOut; o.pos = vec4<f32>(p[i], 0.0, 1.0); return o;
        }
        @fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(${(r/255).toFixed(6)}, ${(g/255).toFixed(6)}, ${(b/255).toFixed(6)}, ${(a/255).toFixed(6)}); }
      `,
    });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }, [rgba[0], rgba[1], rgba[2], rgba[3], width, height]);
}

export async function renderSolidColorToRGBA(
  page: Page,
  rgba: [number, number, number, number],
  width = 1,
  height = 1,
): Promise<Uint8Array> {
  const data = await page.evaluate(async ([r, g, b, a, w, h]) => {
    if (!navigator.gpu) throw new Error('WebGPU not available');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter');
    const device = await adapter.requestDevice();

    const format: GPUTextureFormat = 'rgba8unorm';
    const module = device.createShaderModule({
      code: `
        struct VSOut { @builtin(position) pos: vec4<f32>; };
        @vertex fn vs(@builtin(vertex_index) i: u32) -> VSOut {
          var p = array<vec2<f32>, 3>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 3.0, -1.0),
            vec2<f32>(-1.0,  3.0)
          );
          var o: VSOut; o.pos = vec4<f32>(p[i], 0.0, 1.0); return o;
        }
        @fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(${(r/255).toFixed(6)}, ${(g/255).toFixed(6)}, ${(b/255).toFixed(6)}, ${(a/255).toFixed(6)}); }
      `,
    });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });

    const texture = device.createTexture({
      size: { width: w, height: h },
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();

    const bytesPerPixel = 4;
    const bytesPerRow = Math.ceil((w * bytesPerPixel) / 256) * 256;
    const readback = device.createBuffer({
      size: bytesPerRow * h,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow },
      { width: w, height: h },
    );
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    await readback.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(readback.getMappedRange().slice(0));
    const row0 = mapped.slice(0, w * bytesPerPixel);
    readback.unmap();
    return Array.from(row0);
  }, [rgba[0], rgba[1], rgba[2], rgba[3], width, height]);

  return Uint8Array.from(data);
}



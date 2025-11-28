import { Page, test, expect } from '@playwright/test';

export type FloatArray = Float32Array | number[];

/**
 * Configuration for volumetric cloud rendering tests
 */
export interface CloudTestConfig {
  /** Camera world position [x, y, z] */
  cameraPosition: [number, number, number];
  /** Target point the camera looks at [x, y, z] */
  lookAt: [number, number, number];
  /** Cloud layer altitude in world units */
  cloudAltitude: number;
  /** Cloud layer thickness in world units */
  cloudThickness: number;
  /** Cloud density 0-1 */
  cloudDensity: number;
  /** Scene depth for occlusion testing (default: far plane = no occlusion) */
  sceneDepth?: number;
  /** Render resolution (default: 64x64) */
  resolution?: number;
}

/**
 * Result of cloud rendering pixel sampling
 */
export interface CloudPixelSample {
  /** Red channel 0-255 */
  r: number;
  /** Green channel 0-255 */
  g: number;
  /** Blue channel 0-255 */
  b: number;
  /** Alpha channel 0-255 */
  a: number;
  /** Alpha as float 0-1 */
  alphaFloat: number;
}

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

/**
 * Simplified cloud shader for testing - uses direct ray direction calculation
 * and simplified noise to make tests more deterministic
 */
const CLOUD_TEST_SHADER = /* wgsl */ `
struct CloudUniforms {
  cameraPosition: vec3<f32>,
  cloudAltitude: f32,
  lookAt: vec3<f32>,
  cloudThickness: f32,
  cloudDensity: f32,
  sceneDepth: f32,
  screenSize: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> u: CloudUniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

const MAX_STEPS: i32 = 32;
const MAX_DIST: f32 = 12000.0;
const MIN_TRANSMITTANCE: f32 = 0.01;

// Simple deterministic hash for testing
fn hash3(p: vec3<f32>) -> f32 {
  var p3 = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn noise3D(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  
  let c000 = hash3(i + vec3<f32>(0.0, 0.0, 0.0));
  let c100 = hash3(i + vec3<f32>(1.0, 0.0, 0.0));
  let c010 = hash3(i + vec3<f32>(0.0, 1.0, 0.0));
  let c110 = hash3(i + vec3<f32>(1.0, 1.0, 0.0));
  let c001 = hash3(i + vec3<f32>(0.0, 0.0, 1.0));
  let c101 = hash3(i + vec3<f32>(1.0, 0.0, 1.0));
  let c011 = hash3(i + vec3<f32>(0.0, 1.0, 1.0));
  let c111 = hash3(i + vec3<f32>(1.0, 1.0, 1.0));
  
  return mix(
    mix(mix(c000, c100, u.x), mix(c010, c110, u.x), u.y),
    mix(mix(c001, c101, u.x), mix(c011, c111, u.x), u.y),
    u.z
  );
}

fn fbm(p: vec3<f32>) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var pos = p;
  var totalAmplitude = 0.0;
  
  for (var i = 0; i < 4; i++) {
    value += amplitude * noise3D(pos);
    totalAmplitude += amplitude;
    pos *= 2.0;
    amplitude *= 0.5;
  }
  return value / totalAmplitude;
}

fn cloudDensity(p: vec3<f32>) -> f32 {
  let heightFraction = saturate((p.y - u.cloudAltitude) / u.cloudThickness);
  let heightGradient = smoothstep(0.0, 0.2, heightFraction) * smoothstep(1.0, 0.7, heightFraction);
  if (heightGradient < 0.01) { return 0.0; }
  
  let np = p * 0.001;
  var n = fbm(np * 1.0) * 0.5;
  n += fbm(np * 2.5) * 0.25;
  n += fbm(np * 6.0) * 0.125;
  
  var density = n * heightGradient;
  let coverage = u.cloudDensity;
  let threshold = 0.3 * (1.0 - coverage);
  density = smoothstep(threshold, threshold + 0.25, density);
  
  return density;
}

fn rayPlaneIntersect(ro: vec3<f32>, rd: vec3<f32>, planeY: f32) -> f32 {
  if (abs(rd.y) < 0.0001) { return -1.0; }
  return (planeY - ro.y) / rd.y;
}

fn raymarchClouds(ro: vec3<f32>, rd: vec3<f32>, sceneDepth: f32) -> vec4<f32> {
  let cloudBottom = u.cloudAltitude;
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  var tEnter: f32;
  var tExit: f32;
  
  if (ro.y < cloudBottom) {
    if (rd.y <= 0.0) { return vec4<f32>(0.0); }
    tEnter = rayPlaneIntersect(ro, rd, cloudBottom);
    tExit = rayPlaneIntersect(ro, rd, cloudTop);
  } else if (ro.y > cloudTop) {
    if (rd.y >= 0.0) { return vec4<f32>(0.0); }
    tEnter = rayPlaneIntersect(ro, rd, cloudTop);
    tExit = rayPlaneIntersect(ro, rd, cloudBottom);
  } else {
    tEnter = 0.0;
    if (rd.y > 0.0) {
      tExit = rayPlaneIntersect(ro, rd, cloudTop);
    } else if (rd.y < 0.0) {
      tExit = rayPlaneIntersect(ro, rd, cloudBottom);
    } else {
      tExit = MAX_DIST;
    }
  }
  
  if (tExit < 0.0 || tEnter > MAX_DIST) { return vec4<f32>(0.0); }
  
  tEnter = max(tEnter, 0.0);
  tExit = min(tExit, MAX_DIST);
  
  // Depth occlusion
  if (sceneDepth < tEnter) { return vec4<f32>(0.0); }
  if (sceneDepth < tExit) { tExit = sceneDepth; }
  
  let rayLength = tExit - tEnter;
  if (rayLength <= 0.0) { return vec4<f32>(0.0); }
  
  let stepSize = rayLength / f32(MAX_STEPS);
  var transmittance = 1.0;
  var lightAccum = vec3<f32>(0.0);
  var t = tEnter;

  for (var i = 0; i < MAX_STEPS; i++) {
    if (transmittance < MIN_TRANSMITTANCE) { break; }
    
    let pos = ro + rd * t;
    let density = cloudDensity(pos);
    
    if (density > 0.0) {
      let heightFrac = saturate((pos.y - cloudBottom) / (cloudTop - cloudBottom));
      let lightAmount = 0.4 + heightFrac * 0.6;
      let sampleColor = vec3<f32>(lightAmount);
      lightAccum += sampleColor * density * transmittance * stepSize * 2.0;
      transmittance *= exp(-density * stepSize * 1.0);
    }
    
    t += stepSize;
  }
  
  let cloudAlpha = 1.0 - transmittance;
  var cloudColor = vec3<f32>(0.9, 0.92, 0.95) * (lightAccum + vec3<f32>(0.3));
  cloudColor = clamp(cloudColor, vec3<f32>(0.2), vec3<f32>(1.0));
  
  return vec4<f32>(cloudColor, cloudAlpha);
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  output.position = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
  output.uv = vec2<f32>(x, 1.0 - y);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Calculate ray direction from camera to pixel
  let forward = normalize(u.lookAt - u.cameraPosition);
  let right = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), forward));
  let up = cross(forward, right);
  
  let ndc = vec2<f32>(input.uv.x * 2.0 - 1.0, input.uv.y * 2.0 - 1.0);
  let fov = 1.0; // ~90 degree FOV
  let rayDir = normalize(forward + right * ndc.x * fov + up * ndc.y * fov);
  
  // Horizon fade
  let horizonFade = smoothstep(-0.05, 0.15, rayDir.y);
  if (horizonFade <= 0.0) { return vec4<f32>(0.0); }
  
  let cloudResult = raymarchClouds(u.cameraPosition, rayDir, u.sceneDepth);
  
  let fadedAlpha = cloudResult.a * horizonFade;
  return vec4<f32>(cloudResult.rgb * fadedAlpha, fadedAlpha);
}
`;

/**
 * Renders volumetric clouds and samples the center pixel.
 * Uses a simplified shader for deterministic testing.
 */
export async function renderCloudsAndSampleCenter(
  page: Page,
  config: CloudTestConfig
): Promise<CloudPixelSample> {
  const resolution = config.resolution ?? 64;
  const sceneDepth = config.sceneDepth ?? 50000.0; // Far plane = no occlusion
  
  const data = await page.evaluate(async (params) => {
    const { 
      cameraPosition, lookAt, cloudAltitude, cloudThickness, 
      cloudDensity, sceneDepth, resolution, shaderCode 
    } = params;
    
    if (!navigator.gpu) throw new Error('WebGPU not available');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter');
    const device = await adapter.requestDevice();

    const format: GPUTextureFormat = 'rgba8unorm';
    const module = device.createShaderModule({ code: shaderCode });
    
    // Create uniform buffer (32 bytes, padded to 48 for alignment)
    const uniformBuffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    // Pack uniforms
    const uniformData = new Float32Array([
      cameraPosition[0], cameraPosition[1], cameraPosition[2], cloudAltitude,
      lookAt[0], lookAt[1], lookAt[2], cloudThickness,
      cloudDensity, sceneDepth, resolution, 0, // padding
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    });
    
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });
    
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs_main' },
      fragment: { 
        module, 
        entryPoint: 'fs_main', 
        targets: [{ 
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }] 
      },
      primitive: { topology: 'triangle-list' },
    });

    const texture = device.createTexture({
      size: { width: resolution, height: resolution },
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();

    // Read center pixel
    const bytesPerPixel = 4;
    const bytesPerRow = Math.ceil((resolution * bytesPerPixel) / 256) * 256;
    const readback = device.createBuffer({
      size: bytesPerRow * resolution,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow },
      { width: resolution, height: resolution },
    );
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    await readback.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(readback.getMappedRange());
    
    // Sample center pixel
    const centerY = Math.floor(resolution / 2);
    const centerX = Math.floor(resolution / 2);
    const offset = centerY * bytesPerRow + centerX * bytesPerPixel;
    const pixel = [mapped[offset], mapped[offset + 1], mapped[offset + 2], mapped[offset + 3]];
    
    readback.unmap();
    uniformBuffer.destroy();
    texture.destroy();
    readback.destroy();
    
    return pixel;
  }, {
    cameraPosition: config.cameraPosition,
    lookAt: config.lookAt,
    cloudAltitude: config.cloudAltitude,
    cloudThickness: config.cloudThickness,
    cloudDensity: config.cloudDensity,
    sceneDepth,
    resolution,
    shaderCode: CLOUD_TEST_SHADER,
  });

  return {
    r: data[0],
    g: data[1],
    b: data[2],
    a: data[3],
    alphaFloat: data[3] / 255,
  };
}

/**
 * Samples multiple pixels from cloud rendering for more robust testing
 */
export async function renderCloudsAndSampleGrid(
  page: Page,
  config: CloudTestConfig,
  gridSize = 3
): Promise<CloudPixelSample[]> {
  const resolution = config.resolution ?? 64;
  const sceneDepth = config.sceneDepth ?? 50000.0;
  
  const data = await page.evaluate(async (params) => {
    const { 
      cameraPosition, lookAt, cloudAltitude, cloudThickness, 
      cloudDensity, sceneDepth, resolution, shaderCode, gridSize 
    } = params;
    
    if (!navigator.gpu) throw new Error('WebGPU not available');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter');
    const device = await adapter.requestDevice();

    const format: GPUTextureFormat = 'rgba8unorm';
    const module = device.createShaderModule({ code: shaderCode });
    
    const uniformBuffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    const uniformData = new Float32Array([
      cameraPosition[0], cameraPosition[1], cameraPosition[2], cloudAltitude,
      lookAt[0], lookAt[1], lookAt[2], cloudThickness,
      cloudDensity, sceneDepth, resolution, 0,
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    });
    
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });
    
    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs_main' },
      fragment: { 
        module, 
        entryPoint: 'fs_main', 
        targets: [{ 
          format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }] 
      },
      primitive: { topology: 'triangle-list' },
    });

    const texture = device.createTexture({
      size: { width: resolution, height: resolution },
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: texture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();

    const bytesPerPixel = 4;
    const bytesPerRow = Math.ceil((resolution * bytesPerPixel) / 256) * 256;
    const readback = device.createBuffer({
      size: bytesPerRow * resolution,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyTextureToBuffer(
      { texture },
      { buffer: readback, bytesPerRow },
      { width: resolution, height: resolution },
    );
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    await readback.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(readback.getMappedRange());
    
    // Sample grid of pixels
    const samples: number[][] = [];
    const step = Math.floor(resolution / (gridSize + 1));
    for (let gy = 1; gy <= gridSize; gy++) {
      for (let gx = 1; gx <= gridSize; gx++) {
        const y = gy * step;
        const x = gx * step;
        const offset = y * bytesPerRow + x * bytesPerPixel;
        samples.push([mapped[offset], mapped[offset + 1], mapped[offset + 2], mapped[offset + 3]]);
      }
    }
    
    readback.unmap();
    uniformBuffer.destroy();
    texture.destroy();
    readback.destroy();
    
    return samples;
  }, {
    cameraPosition: config.cameraPosition,
    lookAt: config.lookAt,
    cloudAltitude: config.cloudAltitude,
    cloudThickness: config.cloudThickness,
    cloudDensity: config.cloudDensity,
    sceneDepth,
    resolution,
    shaderCode: CLOUD_TEST_SHADER,
    gridSize,
  });

  return data.map(pixel => ({
    r: pixel[0],
    g: pixel[1],
    b: pixel[2],
    a: pixel[3],
    alphaFloat: pixel[3] / 255,
  }));
}



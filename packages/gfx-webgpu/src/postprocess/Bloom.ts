export class BloomPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private cachedBindGroup: GPUBindGroup | null = null;
  private cachedSrcView: GPUTextureView | null = null;
  private cachedDstView: GPUTextureView | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  initialize(format: GPUTextureFormat): void {
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear',
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
      });
    }
    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'bloom-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        ],
      });
    }
    if (!this.pipeline) {
      const layout = this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });
      this.pipeline = this.device.createRenderPipeline({
        label: 'bloom-pipeline',
        layout,
        vertex: {
          module: this.device.createShaderModule({ code: `
struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs_fullscreen(@builtin(vertex_index) vid:u32)->VSOut{ var o:VSOut; let x=f32((vid<<1u)&2u); let y=f32(vid&2u); o.pos=vec4<f32>(x*2.0-1.0, y*-2.0+1.0, 0.0, 1.0); o.uv=vec2<f32>(x,y); return o; }
` }),
          entryPoint: 'vs_fullscreen',
        },
        fragment: {
          module: this.device.createShaderModule({ code: `
@group(0) @binding(0) var hdrTex : texture_2d<f32>;
@group(0) @binding(1) var smp : sampler;
@fragment fn fs_main(@location(0) v_uv:vec2<f32>) -> @location(0) vec4<f32> {
  // Bright-pass filter
  let col = vec3<f32>(textureSample(hdrTex, smp, v_uv).xyz);
  let lum = dot(col, vec3<f32>(0.2126, 0.7152, 0.0722));
  var bright = max(lum - 1.0, 0.0);
  bright = bright / (bright + 1.0);
  let thresholded = col * bright;
  // Cheap 9-tap blur in a single pass
  let texel = vec2<f32>(1.0) / vec2<f32>(textureDimensions(hdrTex));
  var sum = vec3<f32>(0.0);
  var wsum = 0.0;
  let kernel = array<f32,9>(0.05,0.09,0.12,0.15,0.18,0.15,0.12,0.09,0.05);
  let offs = array<vec2<f32>,9>(
    vec2<f32>(-1,-1), vec2<f32>(0,-1), vec2<f32>(1,-1),
    vec2<f32>(-1, 0), vec2<f32>(0, 0), vec2<f32>(1, 0),
    vec2<f32>(-1, 1), vec2<f32>(0, 1), vec2<f32>(1, 1)
  );
  for (var i=0; i<9; i++) {
    let c = vec3<f32>(textureSample(hdrTex, smp, v_uv + offs[i]*texel).xyz);
    sum += c * kernel[i];
    wsum += kernel[i];
  }
  let blurred = sum / max(wsum, 1e-5);
  return vec4<f32>(max(blurred, thresholded), 1.0);
}
` }),
          entryPoint: 'fs_main',
          targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
      });
    }
  }

  render(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    dstView: GPUTextureView,
    opts?: { querySet?: GPUQuerySet; begin?: number; end?: number }
  ): void {
    if (!this.pipeline || !this.bindGroupLayout || !this.sampler) return;
    // Cache bind group across frames; recreate when views change (resize)
    if (!this.cachedBindGroup || this.cachedSrcView !== srcView || this.cachedDstView !== dstView) {
      this.cachedBindGroup = this.device.createBindGroup({
        label: 'bloom-bg',
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: srcView },
          { binding: 1, resource: this.sampler },
        ],
      });
      this.cachedSrcView = srcView;
      this.cachedDstView = dstView;
    }
    const passDesc: GPURenderPassDescriptor = {
      label: 'bloom-pass',
      colorAttachments: [{ view: dstView, loadOp: 'clear', storeOp: 'store' }],
      ...(opts?.querySet && typeof opts.begin === 'number' && typeof opts.end === 'number'
        ? {
            timestampWrites: {
              querySet: opts.querySet,
              beginningOfPassWriteIndex: opts.begin!,
              endOfPassWriteIndex: opts.end!,
            },
          }
        : {}),
    } as GPURenderPassDescriptor;
    const pass = encoder.beginRenderPass(passDesc);
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.cachedBindGroup!);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }
}



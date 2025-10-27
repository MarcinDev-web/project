export class TonemapLutPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private lutTexture: GPUTexture | null = null;
  private cachedBindGroup: GPUBindGroup | null = null;
  private cachedSrcView: GPUTextureView | null = null;
  private cachedBloomView: GPUTextureView | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  private createIdentityLUT(size = 16): Uint8Array {
    const data = new Uint8Array(size * size * size * 4);
    let i = 0;
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const r = (x / (size - 1)) * 255;
          const g = (y / (size - 1)) * 255;
          const b = (z / (size - 1)) * 255;
          data[i++] = r & 0xff;
          data[i++] = g & 0xff;
          data[i++] = b & 0xff;
          data[i++] = 255;
        }
      }
    }
    return data;
  }

  initialize(presentationFormat: GPUTextureFormat): void {
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'post-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    if (!this.lutTexture) {
      const size = 16;
      const data = this.createIdentityLUT(size);
      this.lutTexture = this.device.createTexture({
        label: 'lut3d-16',
        size: { width: size, height: size, depthOrArrayLayers: size },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        dimension: '3d',
      });
      // Write 3D via writeTexture with rowsPerImage=height and depth=layers
      this.device.queue.writeTexture(
        { texture: this.lutTexture },
        data as unknown as GPUAllowSharedBufferSource,
        { bytesPerRow: size * 4, rowsPerImage: size },
        { width: size, height: size, depthOrArrayLayers: size }
      );
    }

    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'tonemap-lut-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '3d' } },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        ],
      });
    }

    if (!this.pipeline) {
      const shader = this.device.createShaderModule({
        label: 'tonemap-lut-shader',
        code: (/* wgsl */ `
${''}
` as unknown) as string,
      });
      // Load code from file path in build systems; here we inline compile by importing via bundler
      // In this environment, we expect bundler to resolve shader code from file system.
      const layout = this.device.createPipelineLayout({
        label: 'tonemap-lut-pl',
        bindGroupLayouts: [this.bindGroupLayout],
      });
      this.pipeline = this.device.createRenderPipeline({
        label: 'tonemap-lut-pipeline',
        layout,
        vertex: {
          module: this.device.createShaderModule({ code: `
struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs_fullscreen(@builtin(vertex_index) vid:u32)->VSOut{ var o:VSOut; let x=f32((vid<<1u)&2u); let y=f32(vid&2u); o.pos=vec4<f32>(x*2.0-1.0, y*-2.0+1.0, 0.0, 1.0); o.uv=vec2<f32>(x,y); return o; }
` }),
          entryPoint: 'vs_fullscreen',
        },
        fragment: {
          module: this.device.createShaderModule({
            code: `
@group(0) @binding(0) var srcTex : texture_2d<f32>;
@group(0) @binding(1) var srcSmp : sampler;
@group(0) @binding(2) var lut3d : texture_3d<f32>;
@group(0) @binding(3) var bloomTex : texture_2d<f32>;
@fragment fn fs_main(@location(0) v_uv:vec2<f32>) -> @location(0) vec4<f32> {
  var hdr = vec3<f32>(textureSample(srcTex, srcSmp, v_uv).xyz);
  let bloom = vec3<f32>(textureSample(bloomTex, srcSmp, v_uv).xyz);
  hdr += bloom;
  let lutc = textureSampleLevel(lut3d, srcSmp, clamp(hdr, vec3(0.0), vec3(1.0)), 0.0).xyz;
  let a=2.51; let b=0.03; let c=2.43; let d=0.59; let e=0.14;
  let aces = clamp((lutc*(a*lutc+b))/(lutc*(c*lutc+d)+e), vec3(0.0), vec3(1.0));
  return vec4<f32>(pow(aces, vec3(1.0/2.2)), 1.0);
}
`,
          }),
          entryPoint: 'fs_main',
          targets: [{ format: presentationFormat }],
        },
        primitive: { topology: 'triangle-list' },
      });
    }
  }

  render(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    bloomView: GPUTextureView,
    dstView: GPUTextureView,
    opts?: { querySet?: GPUQuerySet; begin?: number; end?: number }
  ): void {
    if (!this.pipeline || !this.bindGroupLayout || !this.sampler || !this.lutTexture) return;
    if (!this.cachedBindGroup || this.cachedSrcView !== srcView || this.cachedBloomView !== bloomView) {
      this.cachedBindGroup = this.device.createBindGroup({
        label: 'tonemap-lut-bg',
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: srcView },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: this.lutTexture.createView({ dimension: '3d' }) },
          { binding: 3, resource: bloomView },
        ],
      });
      this.cachedSrcView = srcView;
      this.cachedBloomView = bloomView;
    }
    const passDesc: GPURenderPassDescriptor = {
      label: 'tonemap-pass',
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



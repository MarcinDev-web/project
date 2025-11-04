/**
 * Prefilter Environment Map
 * 
 * Generates a prefiltered environment cubemap for specular IBL.
 * Uses GGX importance sampling to create mip chain for different roughness levels.
 */

/**
 * Prefiltered environment map generator.
 * 
 * Generates mip levels for specular IBL using GGX importance sampling.
 */
export class PrefilterEnvPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private uniformBuffer: GPUBuffer | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Generates prefiltered environment map from source cubemap.
   * 
   * @param encoder - Command encoder
   * @param sourceCubemap - Source environment cubemap (HDR)
   * @param resolution - Base resolution (will generate mip chain)
   * @returns Prefiltered cubemap with mip chain
   */
  generate(
    encoder: GPUCommandEncoder,
    sourceCubemap: GPUTexture,
    resolution = 128
  ): GPUTexture {
    this.initialize();

    // Create prefiltered cubemap with mip chain
    const mipCount = Math.floor(Math.log2(resolution)) + 1;
    const prefilteredEnv = this.device.createTexture({
      label: 'prefiltered-env-cubemap',
      size: { width: resolution, height: resolution, depthOrArrayLayers: 6 },
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      mipLevelCount: mipCount,
    });

    // Generate each mip level
    for (let mip = 0; mip < mipCount; mip++) {
      const mipResolution = resolution >> mip;
      const roughness = mip / (mipCount - 1);

      // Update uniform buffer with roughness
      if (this.uniformBuffer) {
        const uniformData = new Float32Array([roughness, 0, 0, 0]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
      }

      // Render each face
      for (let face = 0; face < 6; face++) {
        const view = prefilteredEnv.createView({
          baseArrayLayer: face,
          arrayLayerCount: 1,
          mipLevel: mip,
        });

        const pass = encoder.beginRenderPass({
          label: `prefilter-env-mip${mip}-face${face}`,
          colorAttachments: [
            {
              view,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });

        if (this.pipeline) {
          pass.setPipeline(this.pipeline);
          // Create bind group for this mip level
          const bindGroup = this.device.createBindGroup({
            label: `prefilter-bg-mip${mip}-face${face}`,
            layout: this.bindGroupLayout!,
            entries: [
              { binding: 0, resource: { buffer: this.uniformBuffer! } },
              { binding: 1, resource: this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' }) },
              { binding: 2, resource: sourceCubemap.createView({ dimension: 'cube' }) },
              { binding: 3, resource: { buffer: this.createFaceUniformBuffer(face) } },
            ],
          });
          pass.setBindGroup(0, bindGroup);
          pass.draw(3, 1, 0, 0);
        }

        pass.end();
      }
    }

    return prefilteredEnv;
  }

  /**
   * Initializes the prefilter pipeline.
   */
  private initialize(): void {
    if (this.pipeline) return;

    const shaderCode = this.getPrefilterShaderCode();

    const shader = this.device.createShaderModule({
      label: 'prefilter-env-shader',
      code: shaderCode,
    });

    this.bindGroupLayout = this.device.createBindGroupLayout({
      label: 'prefilter-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: 'cube' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.uniformBuffer = this.device.createBuffer({
      label: 'prefilter-roughness-uniform',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'prefilter-pipeline-layout',
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'prefilter-pipeline',
      layout: pipelineLayout,
      vertex: {
        module: shader,
        entryPoint: 'vs',
      },
      fragment: {
        module: shader,
        entryPoint: 'fs',
        targets: [{ format: 'rgba16float' }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
    });
  }

  /**
   * Creates face uniform buffer.
   */
  private createFaceUniformBuffer(faceIndex: number): GPUBuffer {
    const buffer = this.device.createBuffer({
      label: `prefilter-face-${faceIndex}`,
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const data = new Uint32Array(4);
    data[0] = faceIndex;
    this.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  /**
   * Gets the prefilter shader code.
   */
  private getPrefilterShaderCode(): string {
    return `
      struct PrefilterParams {
        roughness: f32,
        _pad0: f32,
        _pad1: f32,
        _pad2: f32,
      }

      struct FaceInfo {
        faceIndex: u32,
        _pad: vec3<u32>,
      }

      @group(0) @binding(0) var<uniform> params: PrefilterParams;
      @group(0) @binding(1) var envSampler: sampler;
      @group(0) @binding(2) var envCube: texture_cube<f32>;
      @group(0) @binding(3) var<uniform> faceInfo: FaceInfo;

      fn faceUVToDir(faceIndex: u32, uv: vec2<f32>) -> vec3<f32> {
        let a = uv * 2.0 - vec2<f32>(1.0, 1.0);
        switch(i32(faceIndex)) {
          case 0: { return normalize(vec3<f32>( 1.0, -a.y, -a.x)); }
          case 1: { return normalize(vec3<f32>(-1.0, -a.y,  a.x)); }
          case 2: { return normalize(vec3<f32>( a.x,  1.0,  a.y)); }
          case 3: { return normalize(vec3<f32>( a.x, -1.0, -a.y)); }
          case 4: { return normalize(vec3<f32>( a.x, -a.y,  1.0)); }
          default: { return normalize(vec3<f32>(-a.x, -a.y, -1.0)); }
        }
      }

      fn hammersley(i: u32, n: u32) -> vec2<f32> {
        var bits = i;
        bits = (bits << 16u) | (bits >> 16u);
        bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
        bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
        bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
        bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
        let rdi = f32(bits) * 2.3283064365386963e-10;
        return vec2<f32>(f32(i) / f32(n), rdi);
      }

      fn ggxSampleHemisphere(u: vec2<f32>, roughness: f32) -> vec3<f32> {
        let a = roughness * roughness;
        let phi = 6.2831853 * u.x;
        let cosTheta = sqrt((1.0 - u.y) / (1.0 + (a * a - 1.0) * u.y));
        let sinTheta = sqrt(max(1.0 - cosTheta * cosTheta, 0.0));
        return vec3<f32>(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
      }

      @vertex
      fn vs(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
        let x = f32((vid << 1u) & 2u);
        let y = f32(vid & 2u);
        return vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
      }

      @fragment
      fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
        let uv = pos.xy / vec2<f32>(textureDimensions(envCube, 0));
        let N = faceUVToDir(faceInfo.faceIndex, uv);
        let R = N;
        let V = R;

        var prefilteredColor = vec3<f32>(0.0);
        var totalWeight = 0.0;
        let sampleCount = 1024u;

        for (var i = 0u; i < sampleCount; i++) {
          let Xi = hammersley(i, sampleCount);
          let H = ggxSampleHemisphere(Xi, params.roughness);
          let L = normalize(2.0 * dot(V, H) * H - V);
          
          let NdotL = max(dot(N, L), 0.0);
          if (NdotL > 0.0) {
            prefilteredColor += textureSample(envCube, envSampler, L).rgb * NdotL;
            totalWeight += NdotL;
          }
        }

        prefilteredColor = prefilteredColor / max(totalWeight, 1e-4);
        return vec4<f32>(prefilteredColor, 1.0);
      }
    `;
  }

  /**
   * Disposes resources.
   */
  dispose(): void {
    try {
      this.uniformBuffer?.destroy();
    } catch {
      // ignore
    }
    this.uniformBuffer = null;
    this.pipeline = null;
    this.bindGroupLayout = null;
  }
}


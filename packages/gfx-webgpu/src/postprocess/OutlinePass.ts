/**
 * Outline Post-Processing Pass
 * 
 * Detects edges using normal and depth information, then composites stylized outlines.
 * Supports half-resolution rendering for better performance on iGPU.
 */

export interface OutlineConfig {
  /** Outline thickness (0.0 - 2.0) */
  thickness?: number;
  /** Outline color (RGB, 0-1) */
  color?: [number, number, number];
  /** Use half-resolution rendering for performance */
  halfRes?: boolean;
}

export class OutlinePass {
  private device: GPUDevice;
  private edgeDetectPipeline: GPURenderPipeline | null = null;
  private compositePipeline: GPURenderPipeline | null = null;
  private edgeDetectLayout: GPUBindGroupLayout | null = null;
  private compositeLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private configBuffer: GPUBuffer | null = null;
  private halfResTexture: GPUTexture | null = null;
  private halfResView: GPUTextureView | null = null;
  private halfResWidth: number = 0;
  private halfResHeight: number = 0;

  // Default configuration
  private config: Required<OutlineConfig> = {
    thickness: 1.0,
    color: [0.0, 0.0, 0.0], // Black outlines
    halfRes: true, // Default to half-res for performance
  };

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Sets outline configuration
   */
  setConfig(config: OutlineConfig): void {
    this.config = { ...this.config, ...config };
    this.updateConfigBuffer();
  }

  /**
   * Gets current configuration
   */
  getConfig(): Readonly<Required<OutlineConfig>> {
    return this.config;
  }

  /**
   * Initializes outline resources
   */
  private initialize(): void {
    if (this.edgeDetectPipeline && this.compositePipeline) return;

    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'outline-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    // Create config buffer
    if (!this.configBuffer) {
      this.configBuffer = this.device.createBuffer({
        label: 'outline-config',
        size: 16, // vec3 color + f32 thickness
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.updateConfigBuffer();
    }

    // Edge detection bind group layout
    if (!this.edgeDetectLayout) {
      this.edgeDetectLayout = this.device.createBindGroupLayout({
        label: 'outline-edge-detect-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // Normal texture
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } }, // Depth texture
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Config
        ],
      });
    }

    // Composite bind group layout
    if (!this.compositeLayout) {
      this.compositeLayout = this.device.createBindGroupLayout({
        label: 'outline-composite-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // Scene texture
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } }, // Edge texture
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // Config
        ],
      });
    }

    // Edge detection shader
    const edgeDetectShader = this.device.createShaderModule({
      label: 'outline-edge-detect-shader',
      code: /* wgsl */ `
        struct VSOut {
          @builtin(position) pos: vec4<f32>,
          @location(0) uv: vec2<f32>,
        }

        @vertex
        fn vs(@builtin(vertex_index) vid: u32) -> VSOut {
          var o: VSOut;
          let x = f32((vid << 1u) & 2u);
          let y = f32(vid & 2u);
          o.pos = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
          o.uv = vec2<f32>(x, y);
          return o;
        }

        @group(0) @binding(0) var normalTex: texture_2d<f32>;
        @group(0) @binding(1) var depthTex: texture_depth_2d;
        @group(0) @binding(2) var smp: sampler;
        @group(0) @binding(3) var<uniform> config: OutlineConfig;

        struct OutlineConfig {
          color: vec3<f32>,
          thickness: f32,
        }

        // Sample depth and normal, detect edges
        @fragment
        fn fs(input: VSOut) -> @location(0) vec4<f32> {
          let texSize = vec2<f32>(textureDimensions(normalTex, 0));
          let texelSize = 1.0 / texSize;
          
          // Sample center
          let centerDepth = textureSample(depthTex, smp, input.uv).r;
          let centerNormal = textureSample(normalTex, smp, input.uv).rgb;
          
          // Sample neighbors
          let depthN = textureSample(depthTex, smp, input.uv + vec2<f32>(0.0, texelSize.y)).r;
          let depthS = textureSample(depthTex, smp, input.uv - vec2<f32>(0.0, texelSize.y)).r;
          let depthE = textureSample(depthTex, smp, input.uv + vec2<f32>(texelSize.x, 0.0)).r;
          let depthW = textureSample(depthTex, smp, input.uv - vec2<f32>(texelSize.x, 0.0)).r;
          
          let normalN = textureSample(normalTex, smp, input.uv + vec2<f32>(0.0, texelSize.y)).rgb;
          let normalS = textureSample(normalTex, smp, input.uv - vec2<f32>(0.0, texelSize.y)).rgb;
          let normalE = textureSample(normalTex, smp, input.uv + vec2<f32>(texelSize.x, 0.0)).rgb;
          let normalW = textureSample(normalTex, smp, input.uv - vec2<f32>(texelSize.x, 0.0)).rgb;
          
          // Depth-based edge detection
          let depthDiff = abs(depthN - centerDepth) + abs(depthS - centerDepth) + 
                          abs(depthE - centerDepth) + abs(depthW - centerDepth);
          
          // Normal-based edge detection
          let normalDiff = dot(centerNormal, normalN) + dot(centerNormal, normalS) + 
                          dot(centerNormal, normalE) + dot(centerNormal, normalW);
          normalDiff = 1.0 - (normalDiff * 0.25); // Invert: low dot = edge
          
          // Combine depth and normal edges
          let edge = max(depthDiff * 10.0, normalDiff);
          edge = smoothstep(0.1, 0.5, edge);
          
          // Apply thickness
          edge = pow(edge, 1.0 / max(config.thickness, 0.1));
          
          return vec4<f32>(config.color * edge, edge);
        }
      `,
    });

    // Composite shader
    const compositeShader = this.device.createShaderModule({
      label: 'outline-composite-shader',
      code: /* wgsl */ `
        struct VSOut {
          @builtin(position) pos: vec4<f32>,
          @location(0) uv: vec2<f32>,
        }

        @vertex
        fn vs(@builtin(vertex_index) vid: u32) -> VSOut {
          var o: VSOut;
          let x = f32((vid << 1u) & 2u);
          let y = f32(vid & 2u);
          o.pos = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
          o.uv = vec2<f32>(x, y);
          return o;
        }

        @group(0) @binding(0) var sceneTex: texture_2d<f32>;
        @group(0) @binding(1) var edgeTex: texture_2d<f32>;
        @group(0) @binding(2) var smp: sampler;
        @group(0) @binding(3) var<uniform> config: OutlineConfig;

        struct OutlineConfig {
          color: vec3<f32>,
          thickness: f32,
        }

        @fragment
        fn fs(input: VSOut) -> @location(0) vec4<f32> {
          let scene = textureSample(sceneTex, smp, input.uv).rgb;
          let edge = textureSample(edgeTex, smp, input.uv).a;
          
          // Composite: overlay edge on scene
          let outlineColor = mix(scene, config.color, edge);
          
          return vec4<f32>(outlineColor, 1.0);
        }
      `,
    });

    // Create pipelines
    const edgeDetectPipelineLayout = this.device.createPipelineLayout({
      label: 'outline-edge-detect-pl',
      bindGroupLayouts: [this.edgeDetectLayout],
    });

    this.edgeDetectPipeline = this.device.createRenderPipeline({
      label: 'outline-edge-detect-pipeline',
      layout: edgeDetectPipelineLayout,
      vertex: { module: edgeDetectShader, entryPoint: 'vs' },
      fragment: {
        module: edgeDetectShader,
        entryPoint: 'fs',
        targets: [{ format: 'rgba16float' }],
      },
      primitive: { topology: 'triangle-list' },
    });

    const compositePipelineLayout = this.device.createPipelineLayout({
      label: 'outline-composite-pl',
      bindGroupLayouts: [this.compositeLayout],
    });

    this.compositePipeline = this.device.createRenderPipeline({
      label: 'outline-composite-pipeline',
      layout: compositePipelineLayout,
      vertex: { module: compositeShader, entryPoint: 'vs' },
      fragment: {
        module: compositeShader,
        entryPoint: 'fs',
        targets: [{ format: 'bgra8unorm' }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /**
   * Updates config buffer with current settings
   */
  private updateConfigBuffer(): void {
    if (!this.configBuffer) return;
    const data = new Float32Array(4);
    data[0] = this.config.color[0];
    data[1] = this.config.color[1];
    data[2] = this.config.color[2];
    data[3] = this.config.thickness;
    this.device.queue.writeBuffer(this.configBuffer, 0, data);
  }

  /**
   * Ensures half-res texture exists for given dimensions
   */
  private ensureHalfResTexture(width: number, height: number): void {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);

    if (
      !this.halfResTexture ||
      this.halfResWidth !== halfWidth ||
      this.halfResHeight !== halfHeight
    ) {
      if (this.halfResTexture) {
        this.halfResTexture.destroy();
      }

      this.halfResTexture = this.device.createTexture({
        label: 'outline-halfres',
        size: [halfWidth, halfHeight, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });

      this.halfResView = this.halfResTexture.createView();
      this.halfResWidth = halfWidth;
      this.halfResHeight = halfHeight;
    }
  }

  /**
   * Applies outline detection and compositing
   * 
   * @param encoder - Command encoder
   * @param sceneView - Scene color texture (after tonemap)
   * @param dstView - Destination texture view
   * @param normalView - Normal texture view
   * @param depthView - Depth texture view
   * @param width - Scene texture width
   * @param height - Scene texture height
   */
  apply(
    encoder: GPUCommandEncoder,
    sceneView: GPUTextureView,
    dstView: GPUTextureView,
    normalView: GPUTextureView | null,
    depthView: GPUTextureView | null,
    width: number,
    height: number
  ): void {
    this.initialize();
    if (!this.edgeDetectPipeline || !this.compositePipeline || !this.sampler || !this.configBuffer) {
      return;
    }

    if (!normalView || !depthView) {
      // No normals/depth available, skip outline
      return;
    }

    // Step 1: Edge detection (optionally at half-res)
    let edgeTargetView: GPUTextureView;
    let edgeWidth = width;
    let edgeHeight = height;

    if (this.config.halfRes) {
      this.ensureHalfResTexture(width, height);
      edgeTargetView = this.halfResView!;
      edgeWidth = this.halfResWidth;
      edgeHeight = this.halfResHeight;
    } else {
      // Use intermediate texture at full res (would need to be created by caller)
      // For now, use half-res path
      this.ensureHalfResTexture(width, height);
      edgeTargetView = this.halfResView!;
      edgeWidth = this.halfResWidth;
      edgeHeight = this.halfResHeight;
    }

    // Edge detection pass
    const edgeDetectBindGroup = this.device.createBindGroup({
      label: 'outline-edge-detect-bg',
      layout: this.edgeDetectLayout!,
      entries: [
        { binding: 0, resource: normalView },
        { binding: 1, resource: depthView },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: { buffer: this.configBuffer } },
      ],
    });

    const edgePass = encoder.beginRenderPass({
      label: 'outline-edge-detect',
      colorAttachments: [
        {
          view: edgeTargetView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    edgePass.setPipeline(this.edgeDetectPipeline);
    edgePass.setBindGroup(0, edgeDetectBindGroup);
    edgePass.draw(3, 1, 0, 0);
    edgePass.end();

    // Step 2: Composite outlines onto scene
    const compositeBindGroup = this.device.createBindGroup({
      label: 'outline-composite-bg',
      layout: this.compositeLayout!,
      entries: [
        { binding: 0, resource: sceneView },
        { binding: 1, resource: edgeTargetView },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: { buffer: this.configBuffer } },
      ],
    });

    const compositePass = encoder.beginRenderPass({
      label: 'outline-composite',
      colorAttachments: [
        {
          view: dstView,
          loadOp: 'load', // Preserve existing content
          storeOp: 'store',
        },
      ],
    });

    compositePass.setPipeline(this.compositePipeline);
    compositePass.setBindGroup(0, compositeBindGroup);
    compositePass.draw(3, 1, 0, 0);
    compositePass.end();
  }

  /**
   * Disposes resources
   */
  dispose(): void {
    this.edgeDetectPipeline = null;
    this.compositePipeline = null;
    this.edgeDetectLayout = null;
    this.compositeLayout = null;
    this.sampler = null;
    this.configBuffer?.destroy();
    this.configBuffer = null;
    this.halfResTexture?.destroy();
    this.halfResTexture = null;
    this.halfResView = null;
  }
}


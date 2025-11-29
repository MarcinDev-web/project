import { createPostProcessPipeline } from './PostProcessUtils';

/**
 * Enhanced Outline Post-Processing Pass
 * 
 * Detects edges using normal and depth information, then composites stylized outlines.
 * Features:
 * - Distance-based thickness (thicker when closer)
 * - Silhouette vs interior edge differentiation
 * - Colored outline support
 * - Smooth anti-aliased edges
 * - Half-resolution rendering for performance
 */

export interface OutlineConfig {
  /** Base outline thickness (0.5 - 3.0) */
  thickness?: number;
  /** Primary outline color (RGB, 0-1) - used for silhouettes */
  color?: [number, number, number];
  /** Secondary outline color for interior edges (RGB, 0-1) */
  innerColor?: [number, number, number];
  /** Use half-resolution rendering for performance */
  halfRes?: boolean;
  /** Enable distance-based thickness scaling */
  distanceScale?: boolean;
  /** Minimum thickness multiplier at far distance (0.0 - 1.0) */
  minThicknessScale?: number;
  /** Maximum thickness multiplier at near distance (1.0 - 3.0) */
  maxThicknessScale?: number;
  /** Depth sensitivity for edge detection (0.1 - 10.0) */
  depthSensitivity?: number;
  /** Normal sensitivity for edge detection (0.1 - 2.0) */
  normalSensitivity?: number;
  /** Edge softness for anti-aliasing (0.0 - 1.0) */
  softness?: number;
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

  // Enhanced default configuration for cartoon style
  private config: Required<OutlineConfig> = {
    thickness: 1.2,
    color: [0.1, 0.08, 0.12], // Dark purple-ish (softer than pure black)
    innerColor: [0.2, 0.18, 0.22], // Lighter for interior edges
    halfRes: true,
    distanceScale: true,
    minThicknessScale: 0.3,
    maxThicknessScale: 2.0,
    depthSensitivity: 5.0,
    normalSensitivity: 0.8,
    softness: 0.3,
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

    // Create config buffer (expanded for new parameters)
    // Layout: vec3 color (12) + f32 thickness (4) + vec3 innerColor (12) + f32 depthSens (4)
    //       + f32 normalSens (4) + f32 softness (4) + f32 minScale (4) + f32 maxScale (4) + f32 distanceScale (4) + padding (4)
    // Total: 56 bytes, padded to 64 bytes
    if (!this.configBuffer) {
      this.configBuffer = this.device.createBuffer({
        label: 'outline-config',
        size: 64,
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

    // Enhanced edge detection shader with distance-based thickness
    const edgeDetectShader = this.device.createShaderModule({
      label: 'outline-edge-detect-shader',
      code: /* wgsl */ `
        @group(0) @binding(0) var normalTex: texture_2d<f32>;
        @group(0) @binding(1) var depthTex: texture_depth_2d;
        @group(0) @binding(2) var smp: sampler;
        @group(0) @binding(3) var<uniform> config: OutlineConfig;

        struct OutlineConfig {
          color: vec3<f32>,
          thickness: f32,
          innerColor: vec3<f32>,
          depthSensitivity: f32,
          normalSensitivity: f32,
          softness: f32,
          minThicknessScale: f32,
          maxThicknessScale: f32,
          distanceScaleEnabled: f32,
          _pad: f32,
        }

        // Convert depth buffer value to linear depth
        fn linearizeDepth(depth: f32, near: f32, far: f32) -> f32 {
          return near * far / (far - depth * (far - near));
        }

        // Sobel-like edge detection with configurable kernel
        fn detectEdge(uv: vec2<f32>, texelSize: vec2<f32>, thickness: f32) -> vec4<f32> {
          let offset = texelSize * thickness;
          
          // Sample 8 neighbors + center for better edge detection
          let c = textureSample(depthTex, smp, uv).r;
          let n = textureSample(depthTex, smp, uv + vec2<f32>(0.0, offset.y)).r;
          let s = textureSample(depthTex, smp, uv - vec2<f32>(0.0, offset.y)).r;
          let e = textureSample(depthTex, smp, uv + vec2<f32>(offset.x, 0.0)).r;
          let w = textureSample(depthTex, smp, uv - vec2<f32>(offset.x, 0.0)).r;
          let ne = textureSample(depthTex, smp, uv + vec2<f32>(offset.x, offset.y)).r;
          let nw = textureSample(depthTex, smp, uv + vec2<f32>(-offset.x, offset.y)).r;
          let se = textureSample(depthTex, smp, uv + vec2<f32>(offset.x, -offset.y)).r;
          let sw = textureSample(depthTex, smp, uv + vec2<f32>(-offset.x, -offset.y)).r;
          
          // Sobel operators
          let sobelX = (ne + 2.0 * e + se) - (nw + 2.0 * w + sw);
          let sobelY = (nw + 2.0 * n + ne) - (sw + 2.0 * s + se);
          let depthEdge = sqrt(sobelX * sobelX + sobelY * sobelY);
          
          // Normal-based edge detection
          let nc = textureSample(normalTex, smp, uv).rgb;
          let nn = textureSample(normalTex, smp, uv + vec2<f32>(0.0, offset.y)).rgb;
          let ns = textureSample(normalTex, smp, uv - vec2<f32>(0.0, offset.y)).rgb;
          let nE = textureSample(normalTex, smp, uv + vec2<f32>(offset.x, 0.0)).rgb;
          let nW = textureSample(normalTex, smp, uv - vec2<f32>(offset.x, 0.0)).rgb;
          
          // Normal discontinuity
          let normalEdge = (1.0 - dot(nc, nn)) + (1.0 - dot(nc, ns)) + 
                          (1.0 - dot(nc, nE)) + (1.0 - dot(nc, nW));
          normalEdge = normalEdge * 0.25;
          
          // Silhouette detection (large depth differences = object boundary)
          let maxDepthDiff = max(max(abs(c - n), abs(c - s)), max(abs(c - e), abs(c - w)));
          let isSilhouette = step(0.01, maxDepthDiff);
          
          return vec4<f32>(depthEdge, normalEdge, isSilhouette, c);
        }

        @fragment
        fn fs(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          let texSize = vec2<f32>(textureDimensions(normalTex, 0));
          let texelSize = 1.0 / texSize;
          
          // Sample center depth for distance-based scaling
          let centerDepth = textureSample(depthTex, smp, uv).r;
          
          // Calculate distance-based thickness scale
          var thicknessScale = 1.0;
          if (config.distanceScaleEnabled > 0.5) {
            // Linearize depth (assuming typical near/far planes)
            let linearDepth = linearizeDepth(centerDepth, 0.1, 1000.0);
            // Scale inversely with distance
            let distanceFactor = clamp(1.0 - (linearDepth - 1.0) / 50.0, 0.0, 1.0);
            thicknessScale = mix(config.minThicknessScale, config.maxThicknessScale, distanceFactor);
          }
          
          let effectiveThickness = config.thickness * thicknessScale;
          
          // Detect edges
          let edges = detectEdge(uv, texelSize, effectiveThickness);
          let depthEdge = edges.x * config.depthSensitivity;
          let normalEdge = edges.y * config.normalSensitivity;
          let isSilhouette = edges.z;
          
          // Combine edges with softness control
          let edgeLow = 0.1 + config.softness * 0.2;
          let edgeHigh = 0.5 - config.softness * 0.2;
          
          let depthMask = smoothstep(edgeLow, edgeHigh, depthEdge);
          let normalMask = smoothstep(edgeLow * 0.5, edgeHigh * 0.5, normalEdge);
          
          // Stronger outline for silhouettes
          let silhouetteStrength = depthMask * isSilhouette;
          let interiorStrength = max(depthMask * (1.0 - isSilhouette), normalMask) * 0.7;
          
          // Output: rgb = edge type (for color selection), a = edge strength
          // r = silhouette strength, g = interior strength, b = reserved
          return vec4<f32>(silhouetteStrength, interiorStrength, 0.0, max(silhouetteStrength, interiorStrength));
        }
      `,
    });

    // Enhanced composite shader with dual-color support
    const compositeShader = this.device.createShaderModule({
      label: 'outline-composite-shader',
      code: /* wgsl */ `
        @group(0) @binding(0) var sceneTex: texture_2d<f32>;
        @group(0) @binding(1) var edgeTex: texture_2d<f32>;
        @group(0) @binding(2) var smp: sampler;
        @group(0) @binding(3) var<uniform> config: OutlineConfig;

        struct OutlineConfig {
          color: vec3<f32>,
          thickness: f32,
          innerColor: vec3<f32>,
          depthSensitivity: f32,
          normalSensitivity: f32,
          softness: f32,
          minThicknessScale: f32,
          maxThicknessScale: f32,
          distanceScaleEnabled: f32,
          _pad: f32,
        }

        @fragment
        fn fs(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          let scene = textureSample(sceneTex, smp, uv).rgb;
          let edge = textureSample(edgeTex, smp, uv);
          
          let silhouetteStrength = edge.r;
          let interiorStrength = edge.g;
          let totalEdge = edge.a;
          
          // Blend between silhouette color and interior color based on edge type
          let edgeColorMix = silhouetteStrength / max(totalEdge, 0.001);
          let outlineColor = mix(config.innerColor, config.color, edgeColorMix);
          
          // Apply outline with smooth blending
          let result = mix(scene, outlineColor, totalEdge);
          
          return vec4<f32>(result, 1.0);
        }
      `,
    });

    // Create pipelines
    this.edgeDetectPipeline = createPostProcessPipeline(
      this.device,
      'outline-edge-detect-pipeline',
      [this.edgeDetectLayout],
      edgeDetectShader,
      'fs',
      [{ format: 'rgba16float' }]
    );

    this.compositePipeline = createPostProcessPipeline(
      this.device,
      'outline-composite-pipeline',
      [this.compositeLayout],
      compositeShader,
      'fs',
      [{ format: 'bgra8unorm' }]
    );
  }

  /**
   * Updates config buffer with current settings
   */
  private updateConfigBuffer(): void {
    if (!this.configBuffer) return;
    const data = new Float32Array(16); // 64 bytes
    // vec3 color + thickness
    data[0] = this.config.color[0];
    data[1] = this.config.color[1];
    data[2] = this.config.color[2];
    data[3] = this.config.thickness;
    // vec3 innerColor + depthSensitivity
    data[4] = this.config.innerColor[0];
    data[5] = this.config.innerColor[1];
    data[6] = this.config.innerColor[2];
    data[7] = this.config.depthSensitivity;
    // normalSensitivity + softness + minScale + maxScale
    data[8] = this.config.normalSensitivity;
    data[9] = this.config.softness;
    data[10] = this.config.minThicknessScale;
    data[11] = this.config.maxThicknessScale;
    // distanceScaleEnabled + padding
    data[12] = this.config.distanceScale ? 1.0 : 0.0;
    data[13] = 0.0;
    data[14] = 0.0;
    data[15] = 0.0;
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

    if (this.config.halfRes) {
      this.ensureHalfResTexture(width, height);
      edgeTargetView = this.halfResView!;
    } else {
      // Use intermediate texture at full res (would need to be created by caller)
      // For now, use half-res path
      this.ensureHalfResTexture(width, height);
      edgeTargetView = this.halfResView!;
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

import { createPostProcessPipeline } from './PostProcessUtils';

/**
 * Stylized Color Grading Post-Processing Pass
 * 
 * Applies cartoon-friendly color adjustments:
 * - Saturation boost for vibrant colors
 * - Shadow color tinting (cool/warm shadows)
 * - Highlight color shift
 * - Optional posterization for cel-shaded look
 * - Vibrance control (selective saturation)
 */

export interface StylizedColorGradingConfig {
  /** Global saturation multiplier (0.0 - 2.0, default: 1.2) */
  saturation?: number;
  /** Vibrance - boosts less saturated colors more (0.0 - 1.0, default: 0.3) */
  vibrance?: number;
  /** Shadow tint color (RGB, 0-1) */
  shadowTint?: [number, number, number];
  /** Shadow tint strength (0.0 - 1.0, default: 0.15) */
  shadowTintStrength?: number;
  /** Highlight tint color (RGB, 0-1) */
  highlightTint?: [number, number, number];
  /** Highlight tint strength (0.0 - 1.0, default: 0.1) */
  highlightTintStrength?: number;
  /** Midtone contrast boost (0.0 - 1.0, default: 0.1) */
  midtoneContrast?: number;
  /** Posterization levels (0 = disabled, 4-32 for effect, default: 0) */
  posterizeLevels?: number;
  /** Color lift in shadows (adds brightness to darks, 0.0 - 0.2, default: 0.02) */
  shadowLift?: number;
  /** Enable cartoon color palette quantization */
  enableColorQuantization?: boolean;
  /** Number of color levels when quantization enabled (default: 32) */
  colorLevels?: number;
}

export class StylizedColorGradingPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;
  private configBuffer: GPUBuffer | null = null;

  // Default configuration for cartoon-style color grading
  private config: Required<StylizedColorGradingConfig> = {
    saturation: 1.25,
    vibrance: 0.35,
    shadowTint: [0.6, 0.55, 0.75], // Cool purple-ish shadows
    shadowTintStrength: 0.18,
    highlightTint: [1.0, 0.95, 0.85], // Warm yellowish highlights
    highlightTintStrength: 0.12,
    midtoneContrast: 0.08,
    posterizeLevels: 0, // Disabled by default
    shadowLift: 0.025,
    enableColorQuantization: false,
    colorLevels: 32,
  };

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Sets color grading configuration
   */
  setConfig(config: StylizedColorGradingConfig): void {
    this.config = { ...this.config, ...config };
    this.updateConfigBuffer();
  }

  /**
   * Gets current configuration
   */
  getConfig(): Readonly<Required<StylizedColorGradingConfig>> {
    return this.config;
  }

  /**
   * Initialize GPU resources
   */
  initialize(presentationFormat: GPUTextureFormat): void {
    if (this.pipeline) return;

    // Create sampler
    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'stylized-grading-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    // Create config buffer (80 bytes, padded to 96)
    if (!this.configBuffer) {
      this.configBuffer = this.device.createBuffer({
        label: 'stylized-grading-config',
        size: 96,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.updateConfigBuffer();
    }

    // Create bind group layout
    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'stylized-grading-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        ],
      });
    }

    // Create shader module
    const shaderModule = this.device.createShaderModule({
      label: 'stylized-grading-shader',
      code: /* wgsl */ `
        @group(0) @binding(0) var srcTex: texture_2d<f32>;
        @group(0) @binding(1) var smp: sampler;
        @group(0) @binding(2) var<uniform> config: ColorGradingConfig;

        struct ColorGradingConfig {
          // vec4: saturation, vibrance, midtoneContrast, shadowLift
          params0: vec4<f32>,
          // vec4: shadowTint.rgb, shadowTintStrength
          shadowTint: vec4<f32>,
          // vec4: highlightTint.rgb, highlightTintStrength
          highlightTint: vec4<f32>,
          // vec4: posterizeLevels, colorLevels, enableQuantization, pad
          params1: vec4<f32>,
        }

        // Convert RGB to HSL
        fn rgb_to_hsl(rgb: vec3<f32>) -> vec3<f32> {
          let maxC = max(max(rgb.r, rgb.g), rgb.b);
          let minC = min(min(rgb.r, rgb.g), rgb.b);
          let l = (maxC + minC) * 0.5;
          
          if (maxC == minC) {
            return vec3<f32>(0.0, 0.0, l);
          }
          
          let d = maxC - minC;
          let s = select(d / (2.0 - maxC - minC), d / (maxC + minC), l > 0.5);
          
          var h: f32;
          if (maxC == rgb.r) {
            h = (rgb.g - rgb.b) / d + select(0.0, 6.0, rgb.g < rgb.b);
          } else if (maxC == rgb.g) {
            h = (rgb.b - rgb.r) / d + 2.0;
          } else {
            h = (rgb.r - rgb.g) / d + 4.0;
          }
          h = h / 6.0;
          
          return vec3<f32>(h, s, l);
        }

        // Convert HSL to RGB
        fn hsl_to_rgb(hsl: vec3<f32>) -> vec3<f32> {
          if (hsl.y == 0.0) {
            return vec3<f32>(hsl.z);
          }
          
          let q = select(hsl.z + hsl.y - hsl.z * hsl.y, hsl.z * (1.0 + hsl.y), hsl.z < 0.5);
          let p = 2.0 * hsl.z - q;
          
          let r = hue_to_rgb(p, q, hsl.x + 1.0 / 3.0);
          let g = hue_to_rgb(p, q, hsl.x);
          let b = hue_to_rgb(p, q, hsl.x - 1.0 / 3.0);
          
          return vec3<f32>(r, g, b);
        }

        fn hue_to_rgb(p: f32, q: f32, t_in: f32) -> f32 {
          var t = t_in;
          if (t < 0.0) { t = t + 1.0; }
          if (t > 1.0) { t = t - 1.0; }
          if (t < 1.0 / 6.0) { return p + (q - p) * 6.0 * t; }
          if (t < 1.0 / 2.0) { return q; }
          if (t < 2.0 / 3.0) { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
          return p;
        }

        // Calculate luminance
        fn luminance(rgb: vec3<f32>) -> f32 {
          return dot(rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
        }

        // Apply saturation
        fn apply_saturation(color: vec3<f32>, amount: f32) -> vec3<f32> {
          let lum = luminance(color);
          return mix(vec3<f32>(lum), color, amount);
        }

        // Apply vibrance (smart saturation that affects less saturated colors more)
        fn apply_vibrance(color: vec3<f32>, amount: f32) -> vec3<f32> {
          let maxC = max(max(color.r, color.g), color.b);
          let minC = min(min(color.r, color.g), color.b);
          let sat = (maxC - minC) / max(maxC, 0.001);
          
          // Apply more saturation to less saturated colors
          let adjustedAmount = amount * (1.0 - sat);
          let lum = luminance(color);
          return mix(vec3<f32>(lum), color, 1.0 + adjustedAmount);
        }

        // Apply shadow/highlight tinting
        fn apply_tint(color: vec3<f32>, shadowTint: vec3<f32>, shadowStrength: f32,
                      highlightTint: vec3<f32>, highlightStrength: f32) -> vec3<f32> {
          let lum = luminance(color);
          
          // Shadow region (dark areas)
          let shadowMask = 1.0 - smoothstep(0.0, 0.4, lum);
          let shadowContrib = mix(color, color * shadowTint, shadowStrength * shadowMask);
          
          // Highlight region (bright areas)
          let highlightMask = smoothstep(0.6, 1.0, lum);
          let highlightContrib = mix(shadowContrib, shadowContrib * highlightTint, highlightStrength * highlightMask);
          
          return highlightContrib;
        }

        // Apply midtone contrast
        fn apply_contrast(color: vec3<f32>, amount: f32) -> vec3<f32> {
          // S-curve contrast centered on midtones
          let midpoint = 0.5;
          let adjusted = (color - midpoint) * (1.0 + amount) + midpoint;
          return clamp(adjusted, vec3<f32>(0.0), vec3<f32>(1.0));
        }

        // Apply posterization
        fn apply_posterize(color: vec3<f32>, levels: f32) -> vec3<f32> {
          if (levels < 2.0) {
            return color;
          }
          return floor(color * levels) / (levels - 1.0);
        }

        // Apply shadow lift (brightens shadows without affecting highlights)
        fn apply_shadow_lift(color: vec3<f32>, lift: f32) -> vec3<f32> {
          let lum = luminance(color);
          let shadowMask = 1.0 - smoothstep(0.0, 0.3, lum);
          return color + vec3<f32>(lift * shadowMask);
        }

        @fragment
        fn fs(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          var color = textureSample(srcTex, smp, uv).rgb;
          
          let saturation = config.params0.x;
          let vibrance = config.params0.y;
          let midtoneContrast = config.params0.z;
          let shadowLift = config.params0.w;
          
          let shadowTint = config.shadowTint.rgb;
          let shadowTintStrength = config.shadowTint.a;
          let highlightTint = config.highlightTint.rgb;
          let highlightTintStrength = config.highlightTint.a;
          
          let posterizeLevels = config.params1.x;
          let colorLevels = config.params1.y;
          let enableQuantization = config.params1.z;
          
          // 1. Apply shadow lift first (prevents crushing blacks)
          color = apply_shadow_lift(color, shadowLift);
          
          // 2. Apply shadow/highlight tinting
          color = apply_tint(color, shadowTint, shadowTintStrength, highlightTint, highlightTintStrength);
          
          // 3. Apply midtone contrast
          color = apply_contrast(color, midtoneContrast);
          
          // 4. Apply vibrance (selective saturation)
          color = apply_vibrance(color, vibrance);
          
          // 5. Apply global saturation
          color = apply_saturation(color, saturation);
          
          // 6. Apply color quantization (for cartoon palette)
          if (enableQuantization > 0.5) {
            color = apply_posterize(color, colorLevels);
          }
          
          // 7. Apply final posterization (for cel-shaded look)
          if (posterizeLevels > 1.0) {
            color = apply_posterize(color, posterizeLevels);
          }
          
          // Clamp final result
          color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
          
          return vec4<f32>(color, 1.0);
        }
      `,
    });

    // Create pipeline
    this.pipeline = createPostProcessPipeline(
      this.device,
      'stylized-grading-pipeline',
      [this.bindGroupLayout],
      shaderModule,
      'fs',
      [{ format: presentationFormat }]
    );
  }

  /**
   * Updates config buffer with current settings
   */
  private updateConfigBuffer(): void {
    if (!this.configBuffer) return;
    
    const data = new Float32Array(24); // 96 bytes
    
    // params0: saturation, vibrance, midtoneContrast, shadowLift
    data[0] = this.config.saturation;
    data[1] = this.config.vibrance;
    data[2] = this.config.midtoneContrast;
    data[3] = this.config.shadowLift;
    
    // shadowTint: rgb, strength
    data[4] = this.config.shadowTint[0];
    data[5] = this.config.shadowTint[1];
    data[6] = this.config.shadowTint[2];
    data[7] = this.config.shadowTintStrength;
    
    // highlightTint: rgb, strength
    data[8] = this.config.highlightTint[0];
    data[9] = this.config.highlightTint[1];
    data[10] = this.config.highlightTint[2];
    data[11] = this.config.highlightTintStrength;
    
    // params1: posterizeLevels, colorLevels, enableQuantization, pad
    data[12] = this.config.posterizeLevels;
    data[13] = this.config.colorLevels;
    data[14] = this.config.enableColorQuantization ? 1.0 : 0.0;
    data[15] = 0.0;
    
    // Padding
    for (let i = 16; i < 24; i++) {
      data[i] = 0.0;
    }
    
    this.device.queue.writeBuffer(this.configBuffer, 0, data);
  }

  /**
   * Renders the color grading pass
   * 
   * @param encoder - Command encoder
   * @param srcView - Source texture view (tonemapped scene)
   * @param dstView - Destination texture view
   */
  render(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    dstView: GPUTextureView
  ): void {
    if (!this.pipeline || !this.sampler || !this.configBuffer || !this.bindGroupLayout) {
      return;
    }

    const bindGroup = this.device.createBindGroup({
      label: 'stylized-grading-bg',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: srcView },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: this.configBuffer } },
      ],
    });

    const pass = encoder.beginRenderPass({
      label: 'stylized-grading',
      colorAttachments: [
        {
          view: dstView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  /**
   * Disposes GPU resources
   */
  dispose(): void {
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.sampler = null;
    this.configBuffer?.destroy();
    this.configBuffer = null;
  }
}


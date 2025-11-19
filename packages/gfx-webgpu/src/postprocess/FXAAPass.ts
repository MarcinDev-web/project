import { createPostProcessPipeline } from './PostProcessUtils';

/**
 * FXAA (Fast Approximate Anti-Aliasing) Post-Processing Pass
 * 
 * High-quality edge anti-aliasing without MSAA.
 */

/**
 * FXAA pass for edge anti-aliasing.
 */
export class FXAAPass {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private sampler: GPUSampler | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Initializes FXAA resources.
   */
  private initialize(): void {
    if (this.pipeline) return;

    if (!this.sampler) {
      this.sampler = this.device.createSampler({
        label: 'fxaa-sampler',
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });
    }

    if (!this.bindGroupLayout) {
      this.bindGroupLayout = this.device.createBindGroupLayout({
        label: 'fxaa-bgl',
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        ],
      });
    }

    const shader = this.device.createShaderModule({
      label: 'fxaa-shader',
      code: `
        @group(0) @binding(0) var srcTex: texture_2d<f32>;
        @group(0) @binding(1) var srcSmp: sampler;

        fn fxaaLuma(rgb: vec3<f32>) -> f32 {
          return dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
        }

        @fragment
        fn fs(@builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          let texSize = vec2<f32>(textureDimensions(srcTex, 0));
          let texelSize = 1.0 / texSize;
          
          // Sample center and neighbors
          let center = textureSample(srcTex, srcSmp, uv).rgb;
          let n = textureSample(srcTex, srcSmp, uv + vec2<f32>(0.0, texelSize.y)).rgb;
          let s = textureSample(srcTex, srcSmp, uv - vec2<f32>(0.0, texelSize.y)).rgb;
          let e = textureSample(srcTex, srcSmp, uv + vec2<f32>(texelSize.x, 0.0)).rgb;
          let w = textureSample(srcTex, srcSmp, uv - vec2<f32>(texelSize.x, 0.0)).rgb;
          let ne = textureSample(srcTex, srcSmp, uv + texelSize).rgb;
          let nw = textureSample(srcTex, srcSmp, uv + vec2<f32>(-texelSize.x, texelSize.y)).rgb;
          let se = textureSample(srcTex, srcSmp, uv + vec2<f32>(texelSize.x, -texelSize.y)).rgb;
          let sw = textureSample(srcTex, srcSmp, uv - texelSize).rgb;

          // Calculate luma
          let lumaCenter = fxaaLuma(center);
          let lumaDown = fxaaLuma(s);
          let lumaUp = fxaaLuma(n);
          let lumaLeft = fxaaLuma(w);
          let lumaRight = fxaaLuma(e);
          
          let lumaDownLeft = fxaaLuma(sw);
          let lumaUpRight = fxaaLuma(ne);
          let lumaUpLeft = fxaaLuma(nw);
          let lumaDownRight = fxaaLuma(se);

          // Calculate edge direction
          let edgeVert = abs((lumaDownLeft + lumaDown * 2.0 + lumaDownRight) - 
                            (lumaUpLeft + lumaUp * 2.0 + lumaUpRight));
          let edgeHorz = abs((lumaDownLeft + lumaLeft * 2.0 + lumaUpLeft) - 
                            (lumaDownRight + lumaRight * 2.0 + lumaUpRight));
          
          let isHorizontal = edgeHorz >= edgeVert;

          // Determine gradient
          var luma1: f32;
          var luma2: f32;
          if (isHorizontal) {
            luma1 = lumaDown;
            luma2 = lumaUp;
          } else {
            luma1 = lumaLeft;
            luma2 = lumaRight;
          }
          let gradient1 = luma1 - lumaCenter;
          let gradient2 = luma2 - lumaCenter;
          
          let is1Steepest = abs(gradient1) >= abs(gradient2);
          let gradientScaled = 0.25 * max(abs(gradient1), abs(gradient2));
          
          // Calculate step size
          var stepLength: f32;
          if (isHorizontal) {
            stepLength = texelSize.y;
          } else {
            stepLength = texelSize.x;
          }
          let lumaLocalAverage = 0.0;
          if (is1Steepest) {
            stepLength = -stepLength;
            lumaLocalAverage = 0.5 * (luma1 + lumaCenter);
          } else {
            lumaLocalAverage = 0.5 * (luma2 + lumaCenter);
          }

          // Calculate UV offset
          var uvOffset: vec2<f32>;
          if (isHorizontal) {
            uvOffset = vec2<f32>(0.0, stepLength);
          } else {
            uvOffset = vec2<f32>(stepLength, 0.0);
          }
          
          // Sample along edge
          let uv1 = uv - uvOffset;
          let uv2 = uv + uvOffset;
          
          let lumaEnd1 = fxaaLuma(textureSample(srcTex, srcSmp, uv1).rgb);
          let lumaEnd2 = fxaaLuma(textureSample(srcTex, srcSmp, uv2).rgb);
          lumaEnd1 -= lumaLocalAverage;
          lumaEnd2 -= lumaLocalAverage;
          
          let reached1 = abs(lumaEnd1) >= gradientScaled;
          let reached2 = abs(lumaEnd2) >= gradientScaled;
          let reachedBoth = reached1 && reached2;
          
          if (!reachedBoth) {
            if (!reached1) {
              uv1 -= uvOffset;
              lumaEnd1 = fxaaLuma(textureSample(srcTex, srcSmp, uv1).rgb) - lumaLocalAverage;
            }
            if (!reached2) {
              uv2 += uvOffset;
              lumaEnd2 = fxaaLuma(textureSample(srcTex, srcSmp, uv2).rgb) - lumaLocalAverage;
            }
          }

          // Calculate distance
          var distance1: f32;
          var distance2: f32;
          if (isHorizontal) {
            distance1 = uv.x - uv1.x;
            distance2 = uv2.x - uv.x;
          } else {
            distance1 = uv.y - uv1.y;
            distance2 = uv2.y - uv.y;
          }
          
          let distance = min(distance1, distance2);
          let edgeSpan = distance1 + distance2;
          
          // Calculate blend factor
          let pixelOffset = -distance / edgeSpan + 0.5;
          let goodSpan = 0.5 * (1.0 / (1.0 + abs(lumaEnd1 - lumaEnd2) / gradientScaled));
          let subpixBlend = max(0.0, 1.0 - (abs(lumaUp - lumaDown) + abs(lumaLeft - lumaRight)) / gradientScaled) * 0.5;
          let blendFactor = max(goodSpan, subpixBlend);

          // Blend samples
          let uvBlend = uv;
          if (isHorizontal) {
            uvBlend.y += pixelOffset * stepLength;
          } else {
            uvBlend.x += pixelOffset * stepLength;
          }

          let color1 = textureSample(srcTex, srcSmp, uvBlend).rgb;
          let color2 = textureSample(srcTex, srcSmp, uv).rgb;
          let color = mix(color1, color2, blendFactor);
          
          return vec4<f32>(color, 1.0);
        }
      `,
    });

    this.pipeline = createPostProcessPipeline(
      this.device,
      'fxaa-pipeline',
      [this.bindGroupLayout],
      shader,
      'fs',
      [{ format: 'bgra8unorm' }]
    );
  }

  /**
   * Applies FXAA to the source texture.
   * 
   * @param encoder - Command encoder
   * @param srcView - Source texture view
   * @param dstView - Destination texture view
   */
  apply(encoder: GPUCommandEncoder, srcView: GPUTextureView, dstView: GPUTextureView): void {
    this.initialize();
    if (!this.pipeline || !this.sampler) return;

    const bindGroup = this.device.createBindGroup({
      label: 'fxaa-bg',
      layout: this.bindGroupLayout!,
      entries: [
        { binding: 0, resource: srcView },
        { binding: 1, resource: this.sampler },
      ],
    });

    const pass = encoder.beginRenderPass({
      label: 'fxaa',
      colorAttachments: [{ view: dstView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  /**
   * Disposes resources.
   */
  dispose(): void {
    this.pipeline = null;
    this.bindGroupLayout = null;
    this.sampler = null;
  }
}


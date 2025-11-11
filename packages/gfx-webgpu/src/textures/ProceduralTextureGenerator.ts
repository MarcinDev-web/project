/**
 * Procedural Texture Generator
 *
 * Generates cartoon-style block textures procedurally
 * Supports both CPU (Canvas 2D API) and GPU (WebGPU Compute Shaders) generation
 * Features: flatter shading, controlled noise, color quantization for toon look
 * 
 * GPU acceleration is optional and falls back to CPU if unavailable.
 */

import type { BlockFaceTexture } from '@engine/blocks';
import { PerlinNoise, SimplexNoise, WorleyNoise, NoiseUtils } from './NoiseGenerator';
import type { PipelineCache } from '../pipeline/PipelineCache';

// Shader code for GPU texture generation (loaded from file or inline)
// For now, we'll load it dynamically or use inline string
const TEXTURE_GENERATOR_SHADER_CODE = `
/**
 * Texture Generator Compute Shader
 * 
 * Generates procedural block textures on GPU using WebGPU compute shaders.
 * Implements full Perlin noise (with permutation table simulation via hash),
 * Worley noise (cellular/Voronoi), and all texture patterns.
 */

struct TextureParams {
  color: vec4<f32>,
  brightness: f32,
  pattern: u32,
  size: u32,
  seed: f32,
  quantizeLevels: u32,
  noiseScale: f32,
  noiseOctaves: u32,
  noisePersistence: f32,
  noiseLacunarity: f32,
  worleyScale: f32,
  worleyContrast: f32,
  _padding: f32,
}

@group(0) @binding(0) var<uniform> params: TextureParams;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;

fn hash2(p: vec2<f32>) -> u32 {
  let h = u32(params.seed) + u32(p.x * 374761393.0) + u32(p.y * 668265263.0);
  let h1 = h ^ (h >> 13u);
  let h2 = h1 * 1274126177u;
  return h2 ^ (h2 >> 16u);
}

fn permHash(x: u32, y: u32) -> u32 {
  let h = u32(params.seed) + x * 374761393u + y * 668265263u;
  let h1 = h ^ (h >> 13u);
  let h2 = h1 * 1274126177u;
  return (h2 ^ (h2 >> 16u)) & 255u;
}

fn fade(t: f32) -> f32 {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn lerp(t: f32, a: f32, b: f32) -> f32 {
  return a + t * (b - a);
}

fn grad2D(hash: u32, x: f32, y: f32) -> f32 {
  let h = hash & 3u;
  let u = select(y, x, h < 2u);
  let v = select(x, y, h < 2u);
  let signU = select(-1.0, 1.0, (h & 1u) == 0u);
  let signV = select(-1.0, 1.0, (h & 2u) == 0u);
  return signU * u + signV * v;
}

fn perlinNoise2D(x: f32, y: f32) -> f32 {
  let X = u32(floor(x)) & 255u;
  let Y = u32(floor(y)) & 255u;
  let xf = x - floor(x);
  let yf = y - floor(y);
  let u = fade(xf);
  let v = fade(yf);
  let A = permHash(X, Y);
  let AA = permHash(A & 255u, 0u);
  let AB = permHash(A & 255u, 1u);
  let B = permHash((X + 1u) & 255u, Y);
  let BA = permHash(B & 255u, 0u);
  let BB = permHash(B & 255u, 1u);
  return lerp(
    v,
    lerp(u, grad2D(AA, xf, yf), grad2D(BA, xf - 1.0, yf)),
    lerp(u, grad2D(AB, xf, yf - 1.0), grad2D(BB, xf - 1.0, yf - 1.0))
  );
}

fn perlinOctaveNoise(x: f32, y: f32, octaves: u32, persistence: f32, lacunarity: f32) -> f32 {
  var total: f32 = 0.0;
  var frequency: f32 = 1.0;
  var amplitude: f32 = 1.0;
  var maxValue: f32 = 0.0;
  for (var i = 0u; i < octaves; i++) {
    total += perlinNoise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return select(0.0, total / maxValue, maxValue > 0.0);
}

fn getFeaturePoint(cellX: i32, cellY: i32) -> vec2<f32> {
  let hash = hash2(vec2<f32>(f32(cellX), f32(cellY)));
  let fx = f32(cellX) + f32(hash & 0xFFFFu) / 65535.0;
  let fy = f32(cellY) + f32((hash >> 16u) & 0xFFFFu) / 65535.0;
  return vec2<f32>(fx, fy);
}

fn distanceEuclidean(p1: vec2<f32>, p2: vec2<f32>) -> f32 {
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  return sqrt(dx * dx + dy * dy);
}

fn worleyNoiseN(x: f32, y: f32, n: u32) -> array<f32, 9> {
  let cellX = i32(floor(x));
  let cellY = i32(floor(y));
  var distances: array<f32, 9>;
  var count: u32 = 0u;
  let pos = vec2<f32>(x, y);
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (count < 9u) {
        let featurePoint = getFeaturePoint(cellX + dx, cellY + dy);
        let dist = distanceEuclidean(pos, featurePoint);
        distances[count] = dist;
        count++;
      }
    }
  }
  for (var i = 0u; i < count; i++) {
    for (var j = 0u; j < count - 1u - i; j++) {
      if (distances[j] > distances[j + 1u]) {
        let temp = distances[j];
        distances[j] = distances[j + 1u];
        distances[j + 1u] = temp;
      }
    }
  }
  return distances;
}

fn normalizeNoise(value: f32) -> f32 {
  return (value + 1.0) * 0.5;
}

fn clamp01(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn quantize(value: f32, levels: u32) -> f32 {
  if (levels <= 1u) {
    return value;
  }
  return floor(value * f32(levels)) / f32(levels);
}

fn patternSolid() -> vec4<f32> {
  return params.color;
}

fn patternSmooth(x: f32, y: f32) -> vec4<f32> {
  let baseColor = params.color;
  let gradient = 1.0 - (y / f32(params.size)) * 0.08;
  let noise = perlinNoise2D(x * 0.02, y * 0.02) * 0.015;
  return baseColor * (gradient + noise);
}

fn patternNoise(x: f32, y: f32) -> vec4<f32> {
  let uv = vec2<f32>(x, y) * params.noiseScale;
  let noise = perlinOctaveNoise(uv.x, uv.y, params.noiseOctaves, params.noisePersistence, params.noiseLacunarity);
  let normalized = normalizeNoise(noise);
  var variation = 0.85 + normalized * 0.15;
  variation = quantize(variation, params.quantizeLevels);
  return params.color * variation;
}

fn patternCobble(x: f32, y: f32) -> vec4<f32> {
  let uv = vec2<f32>(x, y) * params.worleyScale;
  let distances = worleyNoiseN(uv.x, uv.y, 2u);
  let d1 = distances[0];
  let d2 = distances[1];
  let edge = (d2 - d1) * params.worleyContrast;
  var stone = clamp01(1.0 - d1 * 1.3);
  let perlinNoise = perlinNoise2D(x * 0.04, y * 0.04);
  var variation = 0.9 + normalizeNoise(perlinNoise) * 0.1;
  variation = quantize(variation, params.quantizeLevels);
  let edgeMask = select(0.6, 1.0, edge >= 0.2);
  var final = stone * variation * edgeMask;
  final = quantize(final, params.quantizeLevels);
  return params.color * final;
}

fn patternBricks(x: f32, y: f32) -> vec4<f32> {
  let brickHeight = f32(params.size) / 4.0;
  let brickWidth = f32(params.size) / 2.0;
  let mortarSize = 2.0;
  let row = u32(floor(y / brickHeight));
  let localX = fract((x - f32((row % 2u) * u32(brickWidth)) / 2.0) / brickWidth);
  let localY = fract(y / brickHeight);
  let inMortar = localX < (mortarSize / brickWidth) || localY < (mortarSize / brickHeight);
  let mortarColor = vec4<f32>(0.35, 0.35, 0.35, 1.0) * params.brightness;
  return select(params.color, mortarColor, inMortar);
}

fn patternPlanks(x: f32, y: f32) -> vec4<f32> {
  let plankHeight = f32(params.size) / 4.0;
  let localY = fract(y / plankHeight);
  let inSeparator = localY < 0.05;
  let separatorColor = params.color * 0.7;
  return select(params.color, separatorColor, inSeparator);
}

fn patternGrid(x: f32, y: f32) -> vec4<f32> {
  let center = vec2<f32>(f32(params.size) / 2.0);
  let pos = vec2<f32>(x, y) - center;
  let dist = length(pos);
  let ring = fract(dist / (f32(params.size) / 10.0));
  let inRing = ring < 0.1;
  return select(params.color, params.color * 0.8, inRing);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= params.size || y >= params.size) {
    return;
  }
  let idx = y * params.size + x;
  var finalColor: vec4<f32>;
  if (params.pattern == 0u) {
    finalColor = patternSolid();
  } else if (params.pattern == 1u) {
    finalColor = patternSmooth(f32(x), f32(y));
  } else if (params.pattern == 2u) {
    finalColor = patternNoise(f32(x), f32(y));
  } else if (params.pattern == 3u) {
    finalColor = patternCobble(f32(x), f32(y));
  } else if (params.pattern == 4u) {
    finalColor = patternBricks(f32(x), f32(y));
  } else if (params.pattern == 5u) {
    finalColor = patternPlanks(f32(x), f32(y));
  } else if (params.pattern == 6u) {
    finalColor = patternGrid(f32(x), f32(y));
  } else {
    finalColor = patternSolid();
  }
  finalColor *= params.brightness;
  finalColor = clamp(finalColor, vec4<f32>(0.0), vec4<f32>(1.0));
  let r = u32(finalColor.r * 255.0);
  let g = u32(finalColor.g * 255.0);
  let b = u32(finalColor.b * 255.0);
  let a = u32(finalColor.a * 255.0);
  output[idx] = r | (g << 8u) | (b << 16u) | (a << 24u);
}
`;

export interface PBRTextureData {
  /** Base color/albedo texture */
  albedo: ImageData;
  /** Normal map (tangent space) */
  normal?: ImageData;
  /** Roughness map (0 = smooth, 1 = rough) */
  roughness?: ImageData;
  /** Metallic map (0 = dielectric, 1 = metallic) */
  metallic?: ImageData;
  /** Ambient occlusion map */
  ao?: ImageData;
}

export class ProceduralTextureGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private perlin: PerlinNoise;
  private simplex: SimplexNoise;
  private worley: WorleyNoise;

  // GPU resources (optional)
  private device: GPUDevice | null = null;
  private pipelineCache: PipelineCache | null = null;
  private computePipeline: GPUComputePipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private pipelineLayout: GPUPipelineLayout | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private isGPUInitialized: boolean = false;

  constructor(private readonly textureSize: number = 64, seed?: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = textureSize;
    this.canvas.height = textureSize;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    
    // Initialize noise generators with seed
    this.perlin = new PerlinNoise(seed);
    this.simplex = new SimplexNoise(seed);
    this.worley = new WorleyNoise(seed);
  }

  /**
   * Initialize GPU compute shader support
   * @param device WebGPU device
   * @param pipelineCache Optional pipeline cache for optimization
   * @param shaderCode Optional shader code (defaults to TEXTURE_GENERATOR_SHADER_CODE)
   */
  public initializeGPU(
    device: GPUDevice,
    pipelineCache?: PipelineCache,
    shaderCode: string = TEXTURE_GENERATOR_SHADER_CODE
  ): void {
    try {
      this.device = device;
      this.pipelineCache = pipelineCache || null;

      // Create shader module
      const shaderModule = device.createShaderModule({
        label: 'texture-generator-compute-shader',
        code: shaderCode,
      });

      // Create bind group layout
      this.bindGroupLayout = device.createBindGroupLayout({
        label: 'texture-generator-bgl',
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
              type: 'uniform',
            },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
              type: 'storage',
            },
          },
        ],
      });

      // Create pipeline layout
      this.pipelineLayout = device.createPipelineLayout({
        label: 'texture-generator-pipeline-layout',
        bindGroupLayouts: [this.bindGroupLayout],
      });

      // Create compute pipeline (use cache if available)
      const pipelineDescriptor: GPUComputePipelineDescriptor = {
        label: 'texture-generator-compute-pipeline',
        layout: this.pipelineLayout,
        compute: {
          module: shaderModule,
          entryPoint: 'main',
        },
      };

      if (this.pipelineCache) {
        this.computePipeline = this.pipelineCache.getComputePipeline(pipelineDescriptor);
      } else {
        this.computePipeline = device.createComputePipeline(pipelineDescriptor);
      }

      // Create uniform buffer (reusable, will be updated per texture)
      // TextureParams struct size: vec4(16) + f32(4) + u32(4) + u32(4) + f32(4) + u32(4) + f32(4) + u32(4) + f32(4) + f32(4) + f32(4) + f32(4) + f32(4) = 64 bytes
      this.uniformBuffer = device.createBuffer({
        label: 'texture-generator-uniforms',
        size: 64, // Aligned to 16 bytes (vec4 alignment)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      this.isGPUInitialized = true;
      console.info('[ProceduralTextureGenerator] GPU compute shaders initialized successfully');
    } catch (error) {
      console.warn('[ProceduralTextureGenerator] GPU initialization failed, falling back to CPU', error);
      this.device = null;
      this.computePipeline = null;
      this.bindGroupLayout = null;
      this.pipelineLayout = null;
      this.uniformBuffer = null;
      this.isGPUInitialized = false;
    }
  }

  /**
   * Generate texture using GPU compute shader (if available)
   * @param face BlockFaceTexture definition
   * @param seed Optional seed for deterministic generation (defaults to hash of face properties)
   * @returns ImageData or null if GPU unavailable
   */
  public async generateTextureGPU(face: BlockFaceTexture, seed?: number): Promise<ImageData | null> {
    if (!this.device || !this.computePipeline || !this.uniformBuffer || !this.bindGroupLayout) {
      return null; // Fall back to CPU
    }

    const pattern = face.pattern || 'solid';
    const brightness = face.brightness || 1.0;
    const [r, g, b, a] = face.color;

    // Map pattern to enum
    const patternMap: Record<string, number> = {
      'solid': 0,
      'smooth': 1,
      'noise': 2,
      'cobble': 3,
      'bricks': 4,
      'planks': 5,
      'grid': 6,
    };

    const patternId = patternMap[pattern] ?? 0;
    
    // Determine quantization levels based on pattern
    let quantizeLevels = 1;
    if (pattern === 'noise' || pattern === 'cobble') {
      quantizeLevels = pattern === 'noise' ? 4 : 3;
    }

    // Noise parameters based on pattern
    let noiseScale = 0.08;
    let noiseOctaves = 3;
    let noisePersistence = 0.5;
    let noiseLacunarity = 2.0;
    let worleyScale = 4.0 / this.textureSize;
    let worleyContrast = 2.5;

    if (pattern === 'noise') {
      noiseScale = 0.08;
      noiseOctaves = 3;
    } else if (pattern === 'cobble') {
      worleyScale = 4.0 / this.textureSize;
      worleyContrast = 2.5;
    }

    // Create output buffer
    const outputSize = this.textureSize * this.textureSize * 4; // RGBA8Unorm = 4 bytes per pixel
    const outputBuffer = this.device.createBuffer({
      label: 'texture-generator-output',
      size: outputSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // Create staging buffer for readback
    const stagingBuffer = this.device.createBuffer({
      label: 'texture-generator-staging',
      size: outputSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Update uniform buffer
    // TextureParams structure (64 bytes, aligned to vec4):
    // vec4 color (16 bytes) - offset 0
    // f32 brightness (4 bytes) - offset 16
    // u32 pattern (4 bytes) - offset 20
    // u32 size (4 bytes) - offset 24
    // f32 seed (4 bytes) - offset 28
    // u32 quantizeLevels (4 bytes) - offset 32
    // f32 noiseScale (4 bytes) - offset 36
    // u32 noiseOctaves (4 bytes) - offset 40
    // f32 noisePersistence (4 bytes) - offset 44
    // f32 noiseLacunarity (4 bytes) - offset 48
    // f32 worleyScale (4 bytes) - offset 52
    // f32 worleyContrast (4 bytes) - offset 56
    // f32 _padding (4 bytes) - offset 60
    const uniformBuffer = new ArrayBuffer(64);
    const uniformView = new DataView(uniformBuffer);
    
    // vec4 color (f32 x 4)
    uniformView.setFloat32(0, r, true);
    uniformView.setFloat32(4, g, true);
    uniformView.setFloat32(8, b, true);
    uniformView.setFloat32(12, a, true);
    
    // f32 brightness
    uniformView.setFloat32(16, brightness, true);
    
    // u32 pattern
    uniformView.setUint32(20, patternId, true);
    
    // u32 size
    uniformView.setUint32(24, this.textureSize, true);
    
    // f32 seed (use deterministic seed for consistent results, prevents flickering)
    const textureSeed = seed ?? this.generateDeterministicSeed(face);
    uniformView.setFloat32(28, textureSeed, true);
    
    // u32 quantizeLevels
    uniformView.setUint32(32, quantizeLevels, true);
    
    // f32 noiseScale
    uniformView.setFloat32(36, noiseScale, true);
    
    // u32 noiseOctaves
    uniformView.setUint32(40, noiseOctaves, true);
    
    // f32 noisePersistence
    uniformView.setFloat32(44, noisePersistence, true);
    
    // f32 noiseLacunarity
    uniformView.setFloat32(48, noiseLacunarity, true);
    
    // f32 worleyScale
    uniformView.setFloat32(52, worleyScale, true);
    
    // f32 worleyContrast
    uniformView.setFloat32(56, worleyContrast, true);
    
    // f32 _padding
    uniformView.setFloat32(60, 0.0, true);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformBuffer);

    // Create bind group
    const bindGroup = this.device.createBindGroup({
      label: 'texture-generator-bg',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
      ],
    });

    // Dispatch compute shader
    const encoder = this.device.createCommandEncoder({ label: 'texture-generator-encoder' });
    const pass = encoder.beginComputePass({ label: 'texture-generator-pass' });
    pass.setPipeline(this.computePipeline);
    pass.setBindGroup(0, bindGroup);

    const workgroupSize = 8;
    const workgroupsX = Math.ceil(this.textureSize / workgroupSize);
    const workgroupsY = Math.ceil(this.textureSize / workgroupSize);
    pass.dispatchWorkgroups(workgroupsX, workgroupsY);
    pass.end();

    // Copy to staging buffer
    encoder.copyBufferToBuffer(outputBuffer, 0, stagingBuffer, 0, outputSize);

    // Submit and wait
    this.device.queue.submit([encoder.finish()]);
    
    try {
      await stagingBuffer.mapAsync(GPUMapMode.READ);
    } catch (error) {
      console.warn('[ProceduralTextureGenerator] Failed to map staging buffer', error);
      outputBuffer.destroy();
      stagingBuffer.destroy();
      return null;
    }

    // Read back data
    const mappedRange = stagingBuffer.getMappedRange();
    const data = new Uint32Array(mappedRange); // Read as u32 array (packed RGBA)

    // Convert to ImageData
    const imageData = new ImageData(this.textureSize, this.textureSize);
    for (let i = 0; i < data.length; i++) {
      const packed = data[i]!;
      // Unpack RGBA8Unorm from u32: R=bits 0-7, G=bits 8-15, B=bits 16-23, A=bits 24-31
      const r = (packed & 0xFF);
      const g = ((packed >> 8) & 0xFF);
      const b = ((packed >> 16) & 0xFF);
      const a = ((packed >> 24) & 0xFF);
      
      const pixelIdx = i * 4;
      imageData.data[pixelIdx] = r;
      imageData.data[pixelIdx + 1] = g;
      imageData.data[pixelIdx + 2] = b;
      imageData.data[pixelIdx + 3] = a;
    }

    stagingBuffer.unmap();
    outputBuffer.destroy();
    stagingBuffer.destroy();

    return imageData;
  }

  /**
   * Generate deterministic seed from face properties
   * Ensures same face always generates same texture (prevents flickering)
   */
  private generateDeterministicSeed(face: BlockFaceTexture): number {
    // Hash face properties to create deterministic seed
    const [r, g, b, a] = face.color;
    const pattern = face.pattern || 'solid';
    const brightness = face.brightness || 1.0;
    
    // Simple hash function for deterministic seed
    let hash = 0;
    hash = ((hash << 5) - hash) + r * 1000;
    hash = ((hash << 5) - hash) + g * 1000;
    hash = ((hash << 5) - hash) + b * 1000;
    hash = ((hash << 5) - hash) + a * 1000;
    hash = ((hash << 5) - hash) + pattern.charCodeAt(0);
    hash = ((hash << 5) - hash) + brightness * 1000;
    
    // Convert to float in [0, 1000] range for seed
    return Math.abs(hash) % 1000;
  }

  /**
   * Generate texture (tries GPU first, falls back to CPU)
   * @param face BlockFaceTexture definition
   * @returns ImageData
   */
  public async generateTextureAsync(face: BlockFaceTexture): Promise<ImageData> {
    if (this.isGPUInitialized) {
      // Use deterministic seed for consistent results
      const seed = this.generateDeterministicSeed(face);
      const gpuResult = await this.generateTextureGPU(face, seed);
      if (gpuResult) {
        return gpuResult;
      }
    }
    // Fallback to CPU
    return this.generateTextureCPU(face);
  }

  /**
   * Generate texture from BlockFaceTexture definition (CPU implementation)
   * This is the original synchronous CPU method, kept for backward compatibility
   */
  public generateTexture(face: BlockFaceTexture): ImageData {
    const pattern = face.pattern || 'solid';
    const brightness = face.brightness || 1.0;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.textureSize, this.textureSize);

    // Apply base color
    const [r, g, b, a] = face.color;
    const baseColor = `rgba(${Math.round(r * 255 * brightness)}, ${Math.round(g * 255 * brightness)}, ${Math.round(b * 255 * brightness)}, ${a})`;

    switch (pattern) {
      case 'solid':
        this.drawSolid(baseColor);
        break;
      case 'smooth':
        this.drawSmooth(baseColor, brightness);
        break;
      case 'grid':
        this.drawGrid(baseColor, brightness);
        break;
      case 'noise':
        this.drawNoise(baseColor, brightness);
        break;
      case 'bricks':
        this.drawBricks(baseColor, brightness);
        break;
      case 'planks':
        this.drawPlanks(baseColor, brightness);
        break;
      case 'cobble':
        this.drawCobble(baseColor, brightness);
        break;
      default:
        this.drawSolid(baseColor);
    }

    return this.ctx.getImageData(0, 0, this.textureSize, this.textureSize);
  }

  /**
   * Generate texture from BlockFaceTexture definition (CPU implementation)
   * Alias for generateTexture() for clarity when calling from async methods
   */
  public generateTextureCPU(face: BlockFaceTexture): ImageData {
    return this.generateTexture(face);
  }

  /**
   * Solid color fill
   */
  private drawSolid(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);
  }

  /**
   * Smooth gradient (Cartoon style - flatter shading)
   */
  private drawSmooth(color: string, brightness: number): void {
    // Base fill
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);

    // Add very subtle gradient for cartoon flat shading (reduced intensity)
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.textureSize);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.05 * brightness})`);
    gradient.addColorStop(0.5, `rgba(255, 255, 255, 0)`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${0.08})`);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);

    // Add minimal noise for cartoon style (reduced from 0.03 to 0.015)
    this.addNoise(0.015);
  }

  /**
   * Grid pattern (wood log cross-section)
   */
  private drawGrid(color: string, brightness: number): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);

    // Draw concentric circles
    const centerX = this.textureSize / 2;
    const centerY = this.textureSize / 2;
    const rings = 5;

    this.ctx.strokeStyle = `rgba(0, 0, 0, ${0.2 * brightness})`;
    this.ctx.lineWidth = 1;

    for (let i = 1; i <= rings; i++) {
      const radius = (this.textureSize / 2) * (i / rings);
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Add radial lines
    const lines = 6;
    for (let i = 0; i < lines; i++) {
      const angle = (Math.PI * 2 * i) / lines;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.lineTo(
        centerX + (Math.cos(angle) * this.textureSize) / 2,
        centerY + (Math.sin(angle) * this.textureSize) / 2
      );
      this.ctx.stroke();
    }
  }

  /**
   * Noise texture (dirt, grass) - cartoon style with controlled variation
   */
  private drawNoise(color: string, brightness: number): void {
    const imageData = this.ctx.createImageData(this.textureSize, this.textureSize);
    const data = imageData.data;
    
    // Parse base color
    const [r, g, b, a] = this.parseColor(color);
    
    // Use Perlin noise with reduced variation for cartoon style
    const scale = 0.08; // Slightly larger scale for smoother look
    const octaves = 3; // Fewer octaves for less detail
    
    // Color quantization levels for toon shading (4 levels)
    const quantizeLevels = 4;
    
    for (let y = 0; y < this.textureSize; y++) {
      for (let x = 0; x < this.textureSize; x++) {
        const idx = (y * this.textureSize + x) * 4;
        
        // Multi-octave Perlin noise
        const noise = this.perlin.octaveNoise(x * scale, y * scale, octaves, 0.5, 2.0);
        const normalized = NoiseUtils.normalize(noise);
        
        // Reduced variation range for cartoon (0.85 to 1.0 instead of 0.7 to 1.0)
        let variation = 0.85 + normalized * 0.15;
        
        // Quantize for toon shading effect
        variation = Math.round(variation * quantizeLevels) / quantizeLevels;
        
        data[idx + 0] = Math.round(r * variation * brightness);
        data[idx + 1] = Math.round(g * variation * brightness);
        data[idx + 2] = Math.round(b * variation * brightness);
        data[idx + 3] = Math.round(a * 255);
      }
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Brick pattern
   */
  private drawBricks(color: string, brightness: number): void {
    const brickHeight = this.textureSize / 4;
    const brickWidth = this.textureSize / 2;
    const mortarSize = 2;

    // Fill with mortar color
    this.ctx.fillStyle = `rgba(90, 90, 90, ${brightness})`;
    this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);

    // Draw bricks
    this.ctx.fillStyle = color;

    for (let row = 0; row < 4; row++) {
      const y = row * brickHeight;
      const offset = ((row % 2) * brickWidth) / 2;

      for (let col = -1; col < 3; col++) {
        const x = col * brickWidth + offset;
        this.ctx.fillRect(
          x + mortarSize / 2,
          y + mortarSize / 2,
          brickWidth - mortarSize,
          brickHeight - mortarSize
        );
      }
    }

    this.addNoise(0.04); // Reduced noise for cleaner cartoon look
  }

  /**
   * Wood planks pattern
   */
  private drawPlanks(color: string, brightness: number): void {
    const plankHeight = this.textureSize / 4;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.textureSize, this.textureSize);

    // Draw plank separators
    this.ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 * brightness})`;
    this.ctx.lineWidth = 2;

    for (let i = 1; i < 4; i++) {
      const y = i * plankHeight;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.textureSize, y);
      this.ctx.stroke();
    }

    // Add wood grain
    this.ctx.strokeStyle = `rgba(0, 0, 0, ${0.1 * brightness})`;
    this.ctx.lineWidth = 1;

    for (let i = 0; i < 4; i++) {
      const y = i * plankHeight + plankHeight / 2;
      const grainLines = 3;

      for (let j = 0; j < grainLines; j++) {
        const offset = (Math.random() - 0.5) * plankHeight * 0.3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, y + offset);
        this.ctx.quadraticCurveTo(
          this.textureSize / 2,
          y + offset + (Math.random() - 0.5) * 5,
          this.textureSize,
          y + offset
        );
        this.ctx.stroke();
      }
    }

    this.addNoise(0.03); // Reduced noise for cleaner cartoon look
  }

  /**
   * Cobblestone pattern - cartoon style with stylized cells
   */
  private drawCobble(color: string, brightness: number): void {
    const imageData = this.ctx.createImageData(this.textureSize, this.textureSize);
    const data = imageData.data;
    
    const [r, g, b, a] = this.parseColor(color);
    
    // Use Worley noise for cellular stone pattern
    const scale = 4.0 / this.textureSize;
    
    // Quantization for cartoon look
    const quantizeLevels = 3;
    
    for (let y = 0; y < this.textureSize; y++) {
      for (let x = 0; x < this.textureSize; x++) {
        const idx = (y * this.textureSize + x) * 4;
        
        // Get distances to nearest cells
        const distances = this.worley.noiseN(x * scale, y * scale, 2);
        const d1 = distances[0]!;
        const d2 = distances[1]!;
        
        // Create stone edges (more defined for cartoon)
        const edge = (d2 - d1) * 2.5; // Increased contrast
        const stone = NoiseUtils.clamp01(1 - d1 * 1.3);
        
        // Reduced Perlin variation for flatter look
        const perlinNoise = this.perlin.noise(x * 0.04, y * 0.04);
        let variation = 0.9 + NoiseUtils.normalize(perlinNoise) * 0.1;
        
        // Quantize variation
        variation = Math.round(variation * quantizeLevels) / quantizeLevels;
        
        // More defined edges for cartoon style
        const edgeMask = edge < 0.2 ? 0.6 : 1.0; // Softer edge transition
        let final = stone * variation * edgeMask;
        
        // Quantize final value for toon shading
        final = Math.round(final * quantizeLevels) / quantizeLevels;
        
        data[idx + 0] = Math.round(r * final * brightness);
        data[idx + 1] = Math.round(g * final * brightness);
        data[idx + 2] = Math.round(b * final * brightness);
        data[idx + 3] = Math.round(a * 255);
      }
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Add random noise to current canvas
   */
  private addNoise(intensity: number): void {
    const imageData = this.ctx.getImageData(0, 0, this.textureSize, this.textureSize);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity * 255;
      data[i] = Math.max(0, Math.min(255, data[i]! + noise)); // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + noise)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + noise)); // B
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Parse color string to RGBA values
   */
  private parseColor(color: string): [number, number, number, number] {
    // Simple rgba() parser
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return [
        parseInt(match[1]!),
        parseInt(match[2]!),
        parseInt(match[3]!),
        match[4] ? parseFloat(match[4]) : 1.0
      ];
    }
    return [255, 255, 255, 1.0];
  }

  /**
   * Generate normal map from height map
   * Uses Sobel operator for edge detection
   */
  public generateNormalMap(heightMap: ImageData, strength: number = 1.0): ImageData {
    const width = heightMap.width;
    const height = heightMap.height;
    const normalMap = new ImageData(width, height);
    
    const heightData = heightMap.data;
    const normalData = normalMap.data;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Sample surrounding heights (using red channel as height)
        const tl = this.getHeight(heightData, x - 1, y - 1, width, height);
        const t = this.getHeight(heightData, x, y - 1, width, height);
        const tr = this.getHeight(heightData, x + 1, y - 1, width, height);
        const l = this.getHeight(heightData, x - 1, y, width, height);
        const r = this.getHeight(heightData, x + 1, y, width, height);
        const bl = this.getHeight(heightData, x - 1, y + 1, width, height);
        const b = this.getHeight(heightData, x, y + 1, width, height);
        const br = this.getHeight(heightData, x + 1, y + 1, width, height);
        
        // Sobel operator
        const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);
        
        // Calculate normal vector
        const nX = -dX * strength;
        const nY = -dY * strength;
        const nZ = 1.0;
        
        // Normalize
        const length = Math.sqrt(nX * nX + nY * nY + nZ * nZ);
        const normX = nX / length;
        const normY = nY / length;
        const normZ = nZ / length;
        
        // Convert to [0, 255] range
        normalData[idx + 0] = Math.round((normX * 0.5 + 0.5) * 255);
        normalData[idx + 1] = Math.round((normY * 0.5 + 0.5) * 255);
        normalData[idx + 2] = Math.round((normZ * 0.5 + 0.5) * 255);
        normalData[idx + 3] = 255;
      }
    }
    
    return normalMap;
  }

  /**
   * Get height value at position (with wrapping)
   */
  private getHeight(data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number {
    x = (x + width) % width;
    y = (y + height) % height;
    const idx = (y * width + x) * 4;
    return data[idx]! / 255.0;
  }

  /**
   * Generate full PBR texture set
   */
  public generatePBRTexture(face: BlockFaceTexture): PBRTextureData {
    // Generate albedo (base color)
    const albedo = this.generateTexture(face);
    
    // Generate height map for normal generation
    const heightMap = this.generateHeightMap(face);
    
    // Generate normal map from height
    const normal = this.generateNormalMap(heightMap, 2.0);
    
    // Generate roughness map
    const roughness = this.generateRoughnessMap(face);
    
    // Generate metallic map (most blocks are non-metallic)
    const metallic = this.generateMetallicMap(face);
    
    // Generate ambient occlusion
    const ao = this.generateAOMap(face);
    
    return {
      albedo,
      normal,
      roughness,
      metallic,
      ao
    };
  }

  /**
   * Generate height map for normal map generation
   */
  private generateHeightMap(face: BlockFaceTexture): ImageData {
    const imageData = new ImageData(this.textureSize, this.textureSize);
    const data = imageData.data;
    
    const pattern = face.pattern || 'solid';
    const scale = 0.1;
    
    for (let y = 0; y < this.textureSize; y++) {
      for (let x = 0; x < this.textureSize; x++) {
        const idx = (y * this.textureSize + x) * 4;
        
        let height = 0.5;
        
        switch (pattern) {
          case 'noise':
          case 'cobble':
            height = NoiseUtils.normalize(this.perlin.octaveNoise(x * scale, y * scale, 4));
            break;
          case 'bricks':
          case 'planks':
            height = this.getBrickHeight(x, y, pattern === 'bricks');
            break;
          case 'smooth':
            height = 0.5 + this.perlin.noise(x * 0.02, y * 0.02) * 0.1;
            break;
          default:
            height = 0.5;
        }
        
        const h = Math.round(height * 255);
        data[idx + 0] = h;
        data[idx + 1] = h;
        data[idx + 2] = h;
        data[idx + 3] = 255;
      }
    }
    
    return imageData;
  }

  /**
   * Get brick/plank height for normal maps
   */
  private getBrickHeight(x: number, y: number, isBrick: boolean): number {
    if (isBrick) {
      const brickHeight = this.textureSize / 4;
      const brickWidth = this.textureSize / 2;
      const mortarSize = 2;
      
      const row = Math.floor(y / brickHeight);
      const localX = (x - ((row % 2) * brickWidth) / 2) % brickWidth;
      const localY = y % brickHeight;
      
      // Check if in mortar
      if (localX < mortarSize || localY < mortarSize) {
        return 0.3;
      }
      return 0.7;
    } else {
      // Planks
      const plankHeight = this.textureSize / 4;
      const localY = y % plankHeight;
      
      if (localY < 2) {
        return 0.4;
      }
      return 0.6;
    }
  }

  /**
   * Generate roughness map (cartoon style - reduced variation)
   */
  private generateRoughnessMap(face: BlockFaceTexture): ImageData {
    const imageData = new ImageData(this.textureSize, this.textureSize);
    const data = imageData.data;
    
    const pattern = face.pattern || 'solid';
    const baseRoughness = pattern === 'smooth' ? 0.2 : 0.7;
    
    for (let y = 0; y < this.textureSize; y++) {
      for (let x = 0; x < this.textureSize; x++) {
        const idx = (y * this.textureSize + x) * 4;
        
        // Reduced variation for cartoon flat look
        const noise = this.simplex.noise(x * 0.1, y * 0.1);
        let roughness = baseRoughness + NoiseUtils.normalize(noise) * 0.1; // Reduced from 0.2
        
        // Quantize for cartoon consistency
        roughness = Math.round(roughness * 5) / 5;
        
        const r = Math.round(NoiseUtils.clamp01(roughness) * 255);
        data[idx + 0] = r;
        data[idx + 1] = r;
        data[idx + 2] = r;
        data[idx + 3] = 255;
      }
    }
    
    return imageData;
  }

  /**
   * Generate metallic map
   */
  private generateMetallicMap(_face: BlockFaceTexture): ImageData {
    const imageData = new ImageData(this.textureSize, this.textureSize);
    const data = imageData.data;
    
    // Most blocks are non-metallic (0)
    // Could be extended to check material type
    data.fill(0);
    
    // Set alpha to 255
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 255;
    }
    
    return imageData;
  }

  /**
   * Generate ambient occlusion map
   */
  private generateAOMap(face: BlockFaceTexture): ImageData {
    const imageData = new ImageData(this.textureSize, this.textureSize);
    const data = imageData.data;
    
    const pattern = face.pattern || 'solid';
    
    for (let y = 0; y < this.textureSize; y++) {
      for (let x = 0; x < this.textureSize; x++) {
        const idx = (y * this.textureSize + x) * 4;
        
        // Darken edges and corners slightly
        const edgeX = Math.min(x, this.textureSize - x) / (this.textureSize / 2);
        const edgeY = Math.min(y, this.textureSize - y) / (this.textureSize / 2);
        const edgeFactor = Math.min(edgeX, edgeY);
        
        // Add pattern-specific AO
        let ao = 0.7 + edgeFactor * 0.3;
        
        if (pattern === 'bricks' || pattern === 'cobble') {
          // Add variation for crevices
          const noise = this.worley.noise(x * 0.05, y * 0.05);
          ao *= 0.8 + noise * 0.2;
        }
        
        const aoValue = Math.round(NoiseUtils.clamp01(ao) * 255);
        data[idx + 0] = aoValue;
        data[idx + 1] = aoValue;
        data[idx + 2] = aoValue;
        data[idx + 3] = 255;
      }
    }
    
    return imageData;
  }

  /**
   * Export canvas as blob (for debugging/preview)
   */
  public async exportAsBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to export canvas as blob'));
        }
      });
    });
  }

  /**
   * Get canvas element (for debugging)
   */
  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

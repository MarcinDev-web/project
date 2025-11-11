/**
 * Texture Generator Compute Shader
 * 
 * Generates procedural block textures on GPU using WebGPU compute shaders.
 * Implements full Perlin noise (with permutation table simulation via hash),
 * Worley noise (cellular/Voronoi), and all texture patterns.
 * 
 * Features:
 * - Full Perlin noise with octave support (Fractal Brownian Motion)
 * - Worley noise for cellular patterns (stone, cobble)
 * - All texture patterns: solid, smooth, noise, cobble, bricks, planks, grid
 * - Cartoon-style quantization for toon shading
 * - Deterministic results with seed support
 */

// Uniform buffer with texture generation parameters
struct TextureParams {
  // Base color (RGBA)
  color: vec4<f32>,
  // Brightness multiplier
  brightness: f32,
  // Pattern type: 0=solid, 1=smooth, 2=noise, 3=cobble, 4=bricks, 5=planks, 6=grid
  pattern: u32,
  // Texture size (width/height, assumed square)
  size: u32,
  // Seed for noise generation
  seed: f32,
  // Quantization levels for cartoon style (1 = no quantization)
  quantizeLevels: u32,
  // Perlin noise parameters
  noiseScale: f32,        // Scale for noise coordinates
  noiseOctaves: u32,      // Number of octaves for FBM
  noisePersistence: f32,  // Amplitude multiplier per octave
  noiseLacunarity: f32,   // Frequency multiplier per octave
  // Worley noise parameters
  worleyScale: f32,       // Scale for Worley coordinates
  worleyContrast: f32,    // Edge contrast multiplier
  // Padding to align to 16 bytes (vec4 alignment)
  _padding: f32,
}

@group(0) @binding(0) var<uniform> params: TextureParams;
@group(0) @binding(1) var<storage, read_write> output: array<u32>; // RGBA8Unorm packed as u32

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * Hash function for pseudo-random values
 * Compatible with CPU implementation for deterministic results
 */
fn hash2(p: vec2<f32>) -> u32 {
  let h = u32(params.seed) + u32(p.x * 374761393.0) + u32(p.y * 668265263.0);
  let h1 = h ^ (h >> 13u);
  let h2 = h1 * 1274126177u;
  return h2 ^ (h2 >> 16u);
}

/**
 * Hash function returning f32 in [0, 1] range
 */
fn hash2f(p: vec2<f32>) -> f32 {
  return f32(hash2(p)) / 4294967295.0;
}

/**
 * Hash function for Perlin permutation table simulation
 * Generates deterministic permutation-like values from coordinates
 */
fn permHash(x: u32, y: u32) -> u32 {
  let h = u32(params.seed) + x * 374761393u + y * 668265263u;
  let h1 = h ^ (h >> 13u);
  let h2 = h1 * 1274126177u;
  return (h2 ^ (h2 >> 16u)) & 255u;
}

// ============================================================================
// Perlin Noise Implementation
// ============================================================================

/**
 * Fade function (6t^5 - 15t^4 + 10t^3)
 * Smooth interpolation curve for Perlin noise
 */
fn fade(t: f32) -> f32 {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/**
 * Linear interpolation
 */
fn lerp(t: f32, a: f32, b: f32) -> f32 {
  return a + t * (b - a);
}

/**
 * Gradient function for 2D Perlin noise
 * Returns dot product of gradient vector with position vector
 * Uses 4 gradient directions based on hash value
 */
fn grad2D(hash: u32, x: f32, y: f32) -> f32 {
  let h = hash & 3u;
  // 4 gradient directions: (1,1), (-1,1), (1,-1), (-1,-1)
  let u = select(y, x, h < 2u);
  let v = select(x, y, h < 2u);
  let signU = select(-1.0, 1.0, (h & 1u) == 0u);
  let signV = select(-1.0, 1.0, (h & 2u) == 0u);
  return signU * u + signV * v;
}

/**
 * 2D Perlin noise
 * Returns value in range approximately [-1, 1]
 * Uses hash-based permutation table simulation
 */
fn perlinNoise2D(x: f32, y: f32) -> f32 {
  // Find unit grid cell containing point
  let X = u32(floor(x)) & 255u;
  let Y = u32(floor(y)) & 255u;
  
  // Get relative xy coordinates of point within cell
  let xf = x - floor(x);
  let yf = y - floor(y);
  
  // Compute fade curves
  let u = fade(xf);
  let v = fade(yf);
  
  // Hash coordinates of the 4 square corners using simulated permutation table
  let A = permHash(X, Y);
  let AA = permHash(A & 255u, 0u);
  let AB = permHash(A & 255u, 1u);
  let B = permHash((X + 1u) & 255u, Y);
  let BA = permHash(B & 255u, 0u);
  let BB = permHash(B & 255u, 1u);
  
  // Blend results from 4 corners
  return lerp(
    v,
    lerp(u, grad2D(AA, xf, yf), grad2D(BA, xf - 1.0, yf)),
    lerp(u, grad2D(AB, xf, yf - 1.0), grad2D(BB, xf - 1.0, yf - 1.0))
  );
}

/**
 * Octave noise (Fractal Brownian Motion)
 * Combines multiple octaves of Perlin noise
 */
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

// ============================================================================
// Worley Noise Implementation (Cellular/Voronoi)
// ============================================================================

/**
 * Get feature point in Voronoi cell
 * Returns deterministic pseudo-random point within cell [0, 1] range
 */
fn getFeaturePoint(cellX: i32, cellY: i32) -> vec2<f32> {
  let hash = hash2(vec2<f32>(f32(cellX), f32(cellY)));
  let fx = f32(cellX) + f32(hash & 0xFFFFu) / 65535.0;
  let fy = f32(cellY) + f32((hash >> 16u) & 0xFFFFu) / 65535.0;
  return vec2<f32>(fx, fy);
}

/**
 * Euclidean distance
 */
fn distanceEuclidean(p1: vec2<f32>, p2: vec2<f32>) -> f32 {
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  return sqrt(dx * dx + dy * dy);
}

/**
 * Worley noise - returns distance to nearest feature point
 */
fn worleyNoise(x: f32, y: f32) -> f32 {
  let cellX = i32(floor(x));
  let cellY = i32(floor(y));
  
  var minDist: f32 = 999999.0;
  let pos = vec2<f32>(x, y);
  
  // Check 9 neighboring cells (3x3 grid)
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let featurePoint = getFeaturePoint(cellX + dx, cellY + dy);
      let dist = distanceEuclidean(pos, featurePoint);
      minDist = min(minDist, dist);
    }
  }
  
  return minDist;
}

/**
 * Worley noiseN - returns distances to N nearest feature points
 * For cobble pattern, we need at least 2 distances
 */
fn worleyNoiseN(x: f32, y: f32, n: u32) -> array<f32, 9> {
  let cellX = i32(floor(x));
  let cellY = i32(floor(y));
  
  var distances: array<f32, 9>;
  var count: u32 = 0u;
  let pos = vec2<f32>(x, y);
  
  // Check 9 neighboring cells
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
  
  // Simple bubble sort for small array (9 elements max)
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize noise from [-1, 1] to [0, 1]
 */
fn normalizeNoise(value: f32) -> f32 {
  return (value + 1.0) * 0.5;
}

/**
 * Clamp value to [0, 1]
 */
fn clamp01(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

/**
 * Quantize value for cartoon toon shading effect
 */
fn quantize(value: f32, levels: u32) -> f32 {
  if (levels <= 1u) {
    return value;
  }
  return floor(value * f32(levels)) / f32(levels);
}

// ============================================================================
// Pattern Generation Functions
// ============================================================================

/**
 * Generate solid color pattern
 */
fn patternSolid() -> vec4<f32> {
  return params.color;
}

/**
 * Generate smooth gradient pattern (cartoon style - flatter shading)
 */
fn patternSmooth(x: f32, y: f32) -> vec4<f32> {
  let baseColor = params.color;
  // Very subtle gradient for cartoon flat shading
  let gradient = 1.0 - (y / f32(params.size)) * 0.08;
  // Add minimal noise for texture
  let noise = perlinNoise2D(x * 0.02, y * 0.02) * 0.015;
  return baseColor * (gradient + noise);
}

/**
 * Generate noise pattern using Perlin octave noise
 */
fn patternNoise(x: f32, y: f32) -> vec4<f32> {
  let uv = vec2<f32>(x, y) * params.noiseScale;
  let noise = perlinOctaveNoise(uv.x, uv.y, params.noiseOctaves, params.noisePersistence, params.noiseLacunarity);
  let normalized = normalizeNoise(noise);
  // Reduced variation range for cartoon (0.85 to 1.0)
  var variation = 0.85 + normalized * 0.15;
  // Quantize for toon shading
  variation = quantize(variation, params.quantizeLevels);
  return params.color * variation;
}

/**
 * Generate cobblestone pattern using Worley + Perlin
 */
fn patternCobble(x: f32, y: f32) -> vec4<f32> {
  let uv = vec2<f32>(x, y) * params.worleyScale;
  let distances = worleyNoiseN(uv.x, uv.y, 2u);
  let d1 = distances[0];
  let d2 = distances[1];
  
  // Create stone edges (more defined for cartoon)
  let edge = (d2 - d1) * params.worleyContrast;
  var stone = clamp01(1.0 - d1 * 1.3);
  
  // Reduced Perlin variation for flatter look
  let perlinNoise = perlinNoise2D(x * 0.04, y * 0.04);
  var variation = 0.9 + normalizeNoise(perlinNoise) * 0.1;
  variation = quantize(variation, params.quantizeLevels);
  
  // More defined edges for cartoon style
  let edgeMask = select(0.6, 1.0, edge >= 0.2);
  var final = stone * variation * edgeMask;
  
  // Quantize final value for toon shading
  final = quantize(final, params.quantizeLevels);
  
  return params.color * final;
}

/**
 * Generate brick pattern
 */
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

/**
 * Generate wood planks pattern
 */
fn patternPlanks(x: f32, y: f32) -> vec4<f32> {
  let plankHeight = f32(params.size) / 4.0;
  let localY = fract(y / plankHeight);
  
  let inSeparator = localY < 0.05;
  let separatorColor = params.color * 0.7;
  
  return select(params.color, separatorColor, inSeparator);
}

/**
 * Generate grid pattern (concentric circles)
 */
fn patternGrid(x: f32, y: f32) -> vec4<f32> {
  let center = vec2<f32>(f32(params.size) / 2.0);
  let pos = vec2<f32>(x, y) - center;
  let dist = length(pos);
  let ring = fract(dist / (f32(params.size) / 10.0));
  let inRing = ring < 0.1;
  return select(params.color, params.color * 0.8, inRing);
}

// ============================================================================
// Main Compute Shader
// ============================================================================

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  
  // Bounds check
  if (x >= params.size || y >= params.size) {
    return;
  }
  
  let idx = y * params.size + x;
  var finalColor: vec4<f32>;
  
  // Generate pattern based on type
  if (params.pattern == 0u) {
    // Solid
    finalColor = patternSolid();
  } else if (params.pattern == 1u) {
    // Smooth
    finalColor = patternSmooth(f32(x), f32(y));
  } else if (params.pattern == 2u) {
    // Noise (Perlin)
    finalColor = patternNoise(f32(x), f32(y));
  } else if (params.pattern == 3u) {
    // Cobble (Worley + Perlin)
    finalColor = patternCobble(f32(x), f32(y));
  } else if (params.pattern == 4u) {
    // Bricks
    finalColor = patternBricks(f32(x), f32(y));
  } else if (params.pattern == 5u) {
    // Planks
    finalColor = patternPlanks(f32(x), f32(y));
  } else if (params.pattern == 6u) {
    // Grid
    finalColor = patternGrid(f32(x), f32(y));
  } else {
    // Fallback to solid
    finalColor = patternSolid();
  }
  
  // Apply brightness
  finalColor *= params.brightness;
  
  // Clamp to valid range
  finalColor = clamp(finalColor, vec4<f32>(0.0), vec4<f32>(1.0));
  
  // Pack RGBA8Unorm into u32
  let r = u32(finalColor.r * 255.0);
  let g = u32(finalColor.g * 255.0);
  let b = u32(finalColor.b * 255.0);
  let a = u32(finalColor.a * 255.0);
  
  output[idx] = r | (g << 8u) | (b << 16u) | (a << 24u);
}


// ============================================================================
// Temporal Reprojection Shader for Volumetric Clouds
// ============================================================================
// Implements temporal accumulation with:
// - Motion vector based reprojection
// - Neighborhood clamping for anti-ghosting
// - Adaptive blend factor based on confidence
// - Bilinear sampling of history buffer
// ============================================================================

// === Uniforms ===
struct TemporalUniforms {
  screenWidth: f32,
  screenHeight: f32,
  temporalBlend: f32,       // Base blend factor (0.9-0.98)
  frameIndex: u32,
  jitterX: f32,             // Sub-pixel jitter for TAA
  jitterY: f32,
  enableReprojection: f32,  // 1.0 = enabled, 0.0 = disabled
  _pad: f32,
}

@group(0) @binding(0) var<uniform> u: TemporalUniforms;
@group(0) @binding(1) var currentFrame: texture_2d<f32>;
@group(0) @binding(2) var historyFrame: texture_2d<f32>;
@group(0) @binding(3) var motionVectors: texture_2d<f32>;
@group(0) @binding(4) var depthTexture: texture_depth_2d;
@group(0) @binding(5) var linearSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

// === Constants ===
const NEIGHBORHOOD_SIZE: i32 = 1;
const MIN_BLEND: f32 = 0.0;
const MAX_BLEND: f32 = 0.98;

// === Helper Functions ===

// Convert UV to pixel coordinates
fn uvToPixel(uv: vec2<f32>) -> vec2<i32> {
  return vec2<i32>(uv * vec2<f32>(u.screenWidth, u.screenHeight));
}

// Clamp UV to valid range with small margin
fn clampUV(uv: vec2<f32>) -> vec2<f32> {
  let margin = 0.5 / vec2<f32>(u.screenWidth, u.screenHeight);
  return clamp(uv, margin, vec2<f32>(1.0) - margin);
}

// Check if UV is within valid range
fn isValidUV(uv: vec2<f32>) -> bool {
  return uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
}

// RGB to YCoCg color space (better for temporal filtering)
fn rgbToYCoCg(rgb: vec3<f32>) -> vec3<f32> {
  let y = dot(rgb, vec3<f32>(0.25, 0.5, 0.25));
  let co = dot(rgb, vec3<f32>(0.5, 0.0, -0.5));
  let cg = dot(rgb, vec3<f32>(-0.25, 0.5, -0.25));
  return vec3<f32>(y, co, cg);
}

// YCoCg to RGB
fn yCoCgToRgb(ycocg: vec3<f32>) -> vec3<f32> {
  let y = ycocg.x;
  let co = ycocg.y;
  let cg = ycocg.z;
  return vec3<f32>(
    y + co - cg,
    y + cg,
    y - co - cg
  );
}

// === Neighborhood Clamping ===

struct NeighborhoodStats {
  minColor: vec3<f32>,
  maxColor: vec3<f32>,
  avgColor: vec3<f32>,
}

fn gatherNeighborhood(uv: vec2<f32>) -> NeighborhoodStats {
  var stats: NeighborhoodStats;
  let pixelSize = vec2<f32>(1.0 / u.screenWidth, 1.0 / u.screenHeight);
  
  var minCol = vec3<f32>(1e10);
  var maxCol = vec3<f32>(-1e10);
  var avgCol = vec3<f32>(0.0);
  var samples = 0.0;
  
  // Sample 3x3 neighborhood
  for (var y = -NEIGHBORHOOD_SIZE; y <= NEIGHBORHOOD_SIZE; y++) {
    for (var x = -NEIGHBORHOOD_SIZE; x <= NEIGHBORHOOD_SIZE; x++) {
      let offset = vec2<f32>(f32(x), f32(y)) * pixelSize;
      let sampleUV = clampUV(uv + offset);
      let color = textureSample(currentFrame, linearSampler, sampleUV).rgb;
      
      // Convert to YCoCg for better clamping
      let ycocg = rgbToYCoCg(color);
      
      minCol = min(minCol, ycocg);
      maxCol = max(maxCol, ycocg);
      avgCol += ycocg;
      samples += 1.0;
    }
  }
  
  avgCol /= samples;
  
  // Expand bounds slightly to reduce flickering
  let extent = (maxCol - minCol) * 0.1;
  stats.minColor = minCol - extent;
  stats.maxColor = maxCol + extent;
  stats.avgColor = avgCol;
  
  return stats;
}

// Clip color to AABB in YCoCg space
fn clipToAABB(color: vec3<f32>, minColor: vec3<f32>, maxColor: vec3<f32>, avgColor: vec3<f32>) -> vec3<f32> {
  let center = (minColor + maxColor) * 0.5;
  let extent = (maxColor - minColor) * 0.5 + vec3<f32>(0.001);
  
  let offset = color - center;
  let unit = offset / extent;
  let absUnit = abs(unit);
  let maxComp = max(absUnit.x, max(absUnit.y, absUnit.z));
  
  if (maxComp > 1.0) {
    return center + offset / maxComp;
  }
  
  return color;
}

// === Motion Vector Sampling ===

fn sampleMotionVector(uv: vec2<f32>) -> vec2<f32> {
  // Motion vectors are stored as screen-space offsets
  let mv = textureSample(motionVectors, linearSampler, uv).rg;
  return mv;
}

// === Confidence Estimation ===

fn calculateConfidence(currentUV: vec2<f32>, historyUV: vec2<f32>, currentColor: vec3<f32>, historyColor: vec3<f32>) -> f32 {
  var confidence = 1.0;
  
  // Reduce confidence if history UV is out of bounds
  if (!isValidUV(historyUV)) {
    confidence *= 0.0;
  }
  
  // Reduce confidence based on color difference
  let colorDiff = length(currentColor - historyColor);
  confidence *= exp(-colorDiff * 2.0);
  
  // Reduce confidence at screen edges
  let edgeDist = min(
    min(historyUV.x, 1.0 - historyUV.x),
    min(historyUV.y, 1.0 - historyUV.y)
  );
  confidence *= smoothstep(0.0, 0.1, edgeDist);
  
  return saturate(confidence);
}

// === Main Temporal Resolve ===

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
  let uv = input.uv;
  
  // Sample current frame
  let currentSample = textureSample(currentFrame, linearSampler, uv);
  let currentColor = currentSample.rgb;
  let currentAlpha = currentSample.a;
  
  // If temporal is disabled, just return current
  if (u.enableReprojection < 0.5) {
    return currentSample;
  }
  
  // Get motion vector and calculate history UV
  let motionVector = sampleMotionVector(uv);
  let historyUV = uv - motionVector;
  
  // Sample history with bilinear filtering
  var historyColor: vec3<f32>;
  var historyAlpha: f32;
  
  if (isValidUV(historyUV)) {
    let historySample = textureSample(historyFrame, linearSampler, historyUV);
    historyColor = historySample.rgb;
    historyAlpha = historySample.a;
  } else {
    // Fall back to current if history is invalid
    historyColor = currentColor;
    historyAlpha = currentAlpha;
  }
  
  // Gather neighborhood statistics
  let neighborhood = gatherNeighborhood(uv);
  
  // Convert colors to YCoCg
  let currentYCoCg = rgbToYCoCg(currentColor);
  var historyYCoCg = rgbToYCoCg(historyColor);
  
  // Clip history to neighborhood AABB (anti-ghosting)
  historyYCoCg = clipToAABB(historyYCoCg, neighborhood.minColor, neighborhood.maxColor, neighborhood.avgColor);
  
  // Convert back to RGB
  let clampedHistory = yCoCgToRgb(historyYCoCg);
  
  // Calculate confidence
  let confidence = calculateConfidence(uv, historyUV, currentColor, clampedHistory);
  
  // Adaptive blend factor
  var blendFactor = u.temporalBlend * confidence;
  blendFactor = clamp(blendFactor, MIN_BLEND, MAX_BLEND);
  
  // Reduce blend for high-velocity areas (motion blur prevention)
  let motionMagnitude = length(motionVector) * max(u.screenWidth, u.screenHeight);
  blendFactor *= exp(-motionMagnitude * 0.1);
  
  // Final blend
  let finalColor = mix(currentColor, clampedHistory, blendFactor);
  let finalAlpha = mix(currentAlpha, historyAlpha, blendFactor);
  
  return vec4<f32>(finalColor, finalAlpha);
}

// === Motion Vector Generation (Separate Pass) ===
// This would be used in a separate compute pass to generate motion vectors
// from depth and camera matrices. For clouds, we use velocity from
// the cloud animation itself.

struct MotionVectorUniforms {
  currentViewProj: mat4x4<f32>,
  prevViewProj: mat4x4<f32>,
  screenWidth: f32,
  screenHeight: f32,
  _pad0: f32,
  _pad1: f32,
}

// Note: Motion vector generation is handled in the main cloud pass
// by storing world position and reprojecting with previous frame matrices.


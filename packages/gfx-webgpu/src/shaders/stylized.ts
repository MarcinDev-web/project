/**
 * Stylized/Cartoon Shader
 * 
 * Provides cartoon-style rendering with:
 * - Shadow ramps (configurable warm/cool color transitions)
 * - Specular bands (quantized highlights)
 * - Enhanced rim lighting
 * - Ambient color tinting
 * 
 * @module gfx-webgpu/shaders/stylized
 */

import { WGSL_COMMON_HELPERS } from './chunks';

/**
 * WGSL helper functions for stylized/cartoon rendering
 */
export const WGSL_STYLIZED_HELPERS = `
// Quantize value into discrete bands for toon shading
fn quantize_toon(value: f32, bands: f32) -> f32 {
  return floor(value * bands) / bands;
}

// Sample shadow ramp color based on lighting intensity
// Uses 4 colors: deep shadow, shadow, midtone, highlight
fn sample_shadow_ramp(intensity: f32, ramp: array<vec3<f32>, 4>) -> vec3<f32> {
  let t = clamp(intensity, 0.0, 1.0);
  if (t < 0.25) {
    return mix(ramp[0], ramp[1], t * 4.0);
  } else if (t < 0.5) {
    return mix(ramp[1], ramp[2], (t - 0.25) * 4.0);
  } else if (t < 0.75) {
    return mix(ramp[2], ramp[3], (t - 0.5) * 4.0);
  }
  return ramp[3];
}

// Calculate rim lighting for edge glow effect
fn calculate_rim(normal: vec3<f32>, viewDir: vec3<f32>, rimPower: f32, rimIntensity: f32) -> f32 {
  let NdotV = max(dot(normal, viewDir), 0.0);
  let rim = pow(1.0 - NdotV, rimPower);
  return rim * rimIntensity;
}

// Calculate specular highlight with band quantization
fn calculate_specular_banded(
  normal: vec3<f32>,
  viewDir: vec3<f32>,
  lightDir: vec3<f32>,
  specPower: f32,
  bands: f32
) -> f32 {
  let halfVec = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfVec), 0.0);
  let spec = pow(NdotH, specPower);
  // Quantize specular into bands
  return quantize_toon(spec, bands);
}

// Smooth step with configurable edge softness for cartoon shading
fn cartoon_smooth_step(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
`;

/**
 * Creates the stylized/cartoon shader code
 */
export function createStylizedShaderCode(): string {
  return `
// ===== Stylized/Cartoon Shader =====
// Designed for vibrant, illustrated look with clean shadows and highlights

const MAX_POINT_LIGHTS: u32 = 4u;

struct Light {
  lightType: u32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
  positionOrDirection: vec3<f32>,
  _pad3: f32,
  color: vec3<f32>,
  range: f32,
};

struct Uniforms {
  viewProjectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  _pad0 : f32,
  atlasInsetAndPad : vec4<f32>,
  // shadingParams0: x=ambient, y=toonBands, z=specularPower, w=rimPower
  shadingParams0 : vec4<f32>,
  atlasParams : vec4<f32>,
  
  // === LIGHTING DATA ===
  pointLightCount: u32,
  _padLights0: f32,
  _padLights1: f32,
  _padLights2: f32,
  directionalLightDir: vec3<f32>,
  _padDir: f32,
  directionalLightColor: vec3<f32>,
  _padDirColor: f32,
  ambientColor: vec3<f32>,
  ambientIntensity: f32,
  pointLights: array<Light, MAX_POINT_LIGHTS>,
  
  // === SHADOWS/CAMERA ===
  viewMatrix : mat4x4<f32>,
  lightViewProj : array<mat4x4<f32>, 4>,
  cascadeSplits : vec4<f32>,
  atlasRect : array<vec4<f32>, 4>,
  filterParams : vec4<f32>,
  biasParams : vec4<f32>,
  shadowExtraParams : vec4<f32>,
};

// Stylized rendering parameters (could be extended via additional uniform)
// Default shadow ramp: warm shadows transitioning to cool highlights
const SHADOW_RAMP_WARM: array<vec3<f32>, 4> = array<vec3<f32>, 4>(
  vec3<f32>(0.15, 0.08, 0.12),  // Deep shadow (purple-ish)
  vec3<f32>(0.35, 0.20, 0.25),  // Shadow (warm brown)
  vec3<f32>(0.75, 0.70, 0.65),  // Midtone (neutral warm)
  vec3<f32>(1.0, 0.98, 0.95)    // Highlight (warm white)
);

const SHADOW_RAMP_COOL: array<vec3<f32>, 4> = array<vec3<f32>, 4>(
  vec3<f32>(0.08, 0.10, 0.18),  // Deep shadow (blue-ish)
  vec3<f32>(0.20, 0.25, 0.40),  // Shadow (cool blue)
  vec3<f32>(0.65, 0.72, 0.78),  // Midtone (cool gray)
  vec3<f32>(0.95, 0.98, 1.0)    // Highlight (cool white)
);

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var texSampler : sampler;
@group(1) @binding(1) var atlasTex : texture_2d<f32>;
@group(1) @binding(2) var normalAtlasTex : texture_2d<f32>;
@group(1) @binding(3) var<storage, read> atlasMeta : AtlasMetaBuffer;
@group(1) @binding(4) var shadowAtlas : texture_depth_2d;
@group(1) @binding(5) var shadowSamplerCmp : sampler_comparison;

struct AtlasMeta {
  sideRect : vec4<f32>,
  topRect  : vec4<f32>,
  flags    : u32,
  saturation: f32,
  metallic : f32,
  roughness: f32,
};

struct AtlasMetaBuffer {
  entries: array<AtlasMeta>,
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) vNormal : vec3<f32>,
  @location(1) localPos : vec3<f32>,
  @location(2) worldPos : vec3<f32>,
  @location(3) vUV : vec2<f32>,
  @location(4) primaryColor : vec4<f32>,
  @location(5) secondaryColor : vec4<f32>,
  @location(6) emissiveColor : vec4<f32>,
  @location(7) materialParams : vec4<f32>,
  @location(8) materialId : f32,
  @location(9) vAO : f32,
};

${WGSL_COMMON_HELPERS}
${WGSL_STYLIZED_HELPERS}

// ===== Shadow Sampling =====
fn selectCascade(linearDepth: f32, splits: vec4<f32>) -> u32 {
  if (linearDepth <= splits.x) { return 0u; }
  if (linearDepth <= splits.y) { return 1u; }
  if (linearDepth <= splits.z) { return 2u; }
  return 3u;
}

fn sampleShadowPCF(uv: vec2<f32>, zRef: f32, kernel: i32, texelSize: vec2<f32>) -> f32 {
  var sum = 0.0;
  var count = 0.0;
  let k = max(kernel, 1);
  let r = k / 2;
  const MAX_KERNEL = 5;
  let halfMax = MAX_KERNEL / 2;
  for (var y = -halfMax; y <= halfMax; y++) {
    for (var x = -halfMax; x <= halfMax; x++) {
      let off = vec2<f32>(f32(x), f32(y)) * texelSize;
      let shadowValue = textureSampleCompare(shadowAtlas, shadowSamplerCmp, uv + off, zRef);
      let inKernel = f32(x >= -r && x < k - r && y >= -r && y < k - r);
      sum += shadowValue * inKernel;
      count += inKernel;
    }
  }
  return sum / max(count, 1.0);
}

fn sampleShadowStylized(worldPos: vec3<f32>, normal: vec3<f32>, cascadeIndex: u32) -> f32 {
  let biasedWorldPos = worldPos + normal * uniforms.biasParams.y;
  let LP = uniforms.lightViewProj[cascadeIndex] * vec4<f32>(biasedWorldPos, 1.0);
  let ndc = LP.xyz / max(LP.w, 1e-6);
  var uv = ndc.xy * 0.5 + vec2<f32>(0.5, 0.5);
  let rect = uniforms.atlasRect[cascadeIndex];
  let uvMin = rect.xy; let uvMax = rect.zw;
  let atlasUV = uvMin + uv * (uvMax - uvMin);
  var zRef = ndc.z * 0.5 + 0.5;
  zRef -= uniforms.biasParams.x;

  let dims = vec2<f32>(textureDimensions(shadowAtlas, 0));
  let texel = 1.0 / dims;
  
  // Use softer shadow sampling for cartoon look (larger kernel)
  return sampleShadowPCF(atlasUV, zRef, 5, texel);
}

// ===== Lighting Calculations =====

fn calcDirectionalLightStylized(
  normal: vec3<f32>,
  viewDir: vec3<f32>,
  baseColor: vec3<f32>,
  toonBands: f32,
  specBands: f32,
  rimPower: f32
) -> vec3<f32> {
  let lightDir = normalize(-uniforms.directionalLightDir);
  let NdotL = max(dot(normal, lightDir), 0.0);
  
  // Quantize diffuse into toon bands
  let diffuseIntensity = quantize_toon(NdotL, toonBands);
  
  // Sample shadow ramp based on intensity
  let shadowColor = sample_shadow_ramp(diffuseIntensity, SHADOW_RAMP_WARM);
  
  // Apply light color with shadow ramp influence
  var diffuse = shadowColor * uniforms.directionalLightColor * diffuseIntensity;
  
  // Banded specular highlight
  let specPower = max(uniforms.shadingParams0.z, 8.0);
  let spec = calculate_specular_banded(normal, viewDir, lightDir, specPower, specBands);
  let specColor = vec3<f32>(1.0, 0.98, 0.95) * spec * 0.5; // Warm white specular
  
  // Rim lighting
  let rim = calculate_rim(normal, viewDir, rimPower, 0.3);
  let rimColor = uniforms.directionalLightColor * rim;
  
  return diffuse + specColor + rimColor;
}

fn calcPointLightStylized(
  light: Light,
  worldPos: vec3<f32>,
  normal: vec3<f32>,
  viewDir: vec3<f32>,
  toonBands: f32
) -> vec3<f32> {
  let lightPos = light.positionOrDirection;
  let toLight = lightPos - worldPos;
  let distance = length(toLight);
  
  if (distance > light.range) {
    return vec3<f32>(0.0);
  }
  
  let lightDir = toLight / distance;
  let NdotL = max(dot(normal, lightDir), 0.0);
  
  // Quantized diffuse
  let diffuseIntensity = quantize_toon(NdotL, toonBands);
  
  // Smooth attenuation with toon-friendly falloff
  let normalizedDist = distance / light.range;
  let attenuation = 1.0 - smoothstep(0.0, 1.0, normalizedDist);
  attenuation = quantize_toon(attenuation, 3.0); // 3 bands for point light falloff
  
  return light.color * diffuseIntensity * attenuation;
}

// ===== Vertex Shader =====
@vertex
fn vs_main(
  @location(0) position : vec3<f32>,
  @location(1) normalPacked : vec4<f32>,
  @location(2) uv : vec2<f32>,
  @location(3) aoPacked : vec4<f32>,
  @location(4) instanceOffset : vec3<f32>,
  @location(5) instanceColorScale : vec4<f32>,
  @location(6) instanceSecondaryColor : vec4<f32>,
  @location(7) instanceEmissive : vec4<f32>,
  @location(8) instanceMaterialParams : vec4<f32>,
  @location(9) instanceRotation : vec4<f32>,
  @location(10) instanceMaterialId : f32
) -> VertexOutput {
  var output : VertexOutput;
  let scale = instanceColorScale.w;
  let q = normalize(instanceRotation);
  let scaledPos = position * scale;
  let rotatedPos = quat_rotate(q, scaledPos);
  let worldPos = rotatedPos + instanceOffset;
  output.position = uniforms.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
  let normal = normalPacked.xyz;
  output.vNormal = normalize(quat_rotate(q, normal));
  output.localPos = scaledPos;
  output.worldPos = worldPos;
  let atlasInset = uniforms.atlasInsetAndPad.xy;
  output.vUV = clamp(uv, atlasInset, vec2<f32>(1.0, 1.0) - atlasInset);
  let primaryAlpha = instanceMaterialParams.x;
  output.primaryColor = vec4<f32>(instanceColorScale.xyz, primaryAlpha);
  output.secondaryColor = instanceSecondaryColor;
  output.emissiveColor = instanceEmissive;
  output.materialParams = instanceMaterialParams;
  output.materialId = instanceMaterialId;
  output.vAO = clamp(aoPacked.x, 0.0, 1.0);
  return output;
}

// ===== Fragment Shader =====
@fragment
fn fs_main(
  @location(0) vNormal : vec3<f32>,
  @location(1) localPos : vec3<f32>,
  @location(2) worldPos : vec3<f32>,
  @location(3) vUV : vec2<f32>,
  @location(4) primaryColor : vec4<f32>,
  @location(5) secondaryColor : vec4<f32>,
  @location(6) emissiveColor : vec4<f32>,
  @location(7) materialParams : vec4<f32>,
  @location(8) materialId : f32,
  @location(9) vAO : f32
) -> @location(0) vec4<f32> {
  let N = normalize(vNormal);
  let V = normalize(uniforms.cameraPosition - worldPos);
  
  // === Stylized Parameters ===
  let TOON_BANDS = max(uniforms.shadingParams0.y, 3.0);
  let SPEC_BANDS = 3.0;
  let RIM_POWER = max(uniforms.shadingParams0.w, 2.5);
  
  // === Atlas Sampling ===
  let materialsPerRowF = max(uniforms.atlasParams.x, 1.0);
  let maxMatIdF = max(0.0, floor(materialsPerRowF * materialsPerRowF * 0.5 - 1.0));
  let matId = u32(clamp(materialId, 0.0, maxMatIdF));
  let matMeta = atlasMeta.entries[matId];
  let isTop = step(0.5, abs(N.y));
  let rect = mix(matMeta.sideRect, matMeta.topRect, vec4<f32>(isTop, isTop, isTop, isTop));
  let atlasUV = rect.xy + vUV * rect.zw;
  
  // Base color with instance tinting
  let tint = mix(primaryColor.rgb, secondaryColor.rgb, 0.15);
  var baseColor = textureSample(atlasTex, texSampler, atlasUV).rgb * tint;
  
  // Boost saturation for cartoon vibrancy
  let luminance = dot(baseColor, vec3<f32>(0.299, 0.587, 0.114));
  let saturationBoost = 1.2;
  baseColor = mix(vec3<f32>(luminance), baseColor, saturationBoost * matMeta.saturation);
  baseColor = clamp(baseColor, vec3<f32>(0.0), vec3<f32>(1.0));
  
  // === Shadow Calculation ===
  let viewPos = uniforms.viewMatrix * vec4<f32>(worldPos, 1.0);
  let linearDepth = -viewPos.z;
  let cascadeIdx = selectCascade(linearDepth, uniforms.cascadeSplits);
  let shadow = sampleShadowStylized(worldPos, N, cascadeIdx);
  
  // === Lighting ===
  // Ambient with cartoon-friendly color
  let ambientTint = vec3<f32>(0.95, 0.92, 1.0); // Slight cool tint
  let ambient = uniforms.ambientColor * uniforms.ambientIntensity * ambientTint;
  
  // Directional light with stylized shading
  var direct = calcDirectionalLightStylized(N, V, baseColor, TOON_BANDS, SPEC_BANDS, RIM_POWER);
  direct *= shadow;
  
  // Point lights
  for (var i = 0u; i < uniforms.pointLightCount && i < MAX_POINT_LIGHTS; i++) {
    direct += calcPointLightStylized(uniforms.pointLights[i], worldPos, N, V, TOON_BANDS);
  }
  
  // === Face-based Tone Variation (voxel style) ===
  let topMask = step(0.5, N.y);
  let bottomMask = step(0.5, -N.y);
  let sideMask = clamp(1.0 - topMask - bottomMask, 0.0, 1.0);
  let faceTone = topMask * 1.1 + sideMask * 1.0 + bottomMask * 0.85;
  
  // === Ambient Occlusion (subtle for cartoon) ===
  let ao = mix(1.0, clamp(vAO, 0.0, 1.0), 0.25);
  
  // === Final Composition ===
  var color = baseColor * (ambient + direct) * faceTone * ao;
  
  // Add emissive glow
  color += emissiveColor.rgb * emissiveColor.w;
  
  // Ensure positive values for HDR pipeline
  color = max(color, vec3<f32>(0.0));
  
  let alpha = clamp(primaryColor.a, 0.0, 1.0);
  return vec4<f32>(color, alpha);
}

// ===== Overlay Shader (for selection/highlight) =====
@fragment
fn fs_overlay(
  @location(0) vNormal : vec3<f32>,
  @location(2) worldPos : vec3<f32>,
  @location(4) primaryColor : vec4<f32>,
  @location(5) secondaryColor : vec4<f32>
) -> @location(0) vec4<f32> {
  let n = normalize(vNormal);
  let l = normalize(-uniforms.directionalLightDir);
  let v = normalize(uniforms.cameraPosition - worldPos);
  
  // Toon-style overlay shading
  let NdotL = max(dot(n, l), 0.0);
  let intensity = quantize_toon(0.35 + 0.65 * NdotL, 4.0);
  
  let highlightBase = mix(primaryColor.rgb, secondaryColor.rgb, 0.3);
  let highlight = mix(vec3<f32>(1.0), highlightBase, 0.4);
  
  // Strong rim for selection visibility
  let rim = calculate_rim(n, v, 2.0, 0.6);
  
  let color = clamp(highlight * (intensity + rim), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color, 0.8);
}
`;
}

/**
 * Shader variant for simpler/faster stylized rendering (no shadows)
 * Useful for mobile or low-end devices
 */
export function createStylizedSimpleShaderCode(): string {
  return `
// ===== Simplified Stylized Shader (No Shadows) =====
const MAX_POINT_LIGHTS: u32 = 4u;

struct Light {
  lightType: u32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
  positionOrDirection: vec3<f32>,
  _pad3: f32,
  color: vec3<f32>,
  range: f32,
};

struct Uniforms {
  viewProjectionMatrix : mat4x4<f32>,
  cameraPosition : vec3<f32>,
  _pad0 : f32,
  atlasInsetAndPad : vec4<f32>,
  shadingParams0 : vec4<f32>,
  atlasParams : vec4<f32>,
  pointLightCount: u32,
  _padLights0: f32,
  _padLights1: f32,
  _padLights2: f32,
  directionalLightDir: vec3<f32>,
  _padDir: f32,
  directionalLightColor: vec3<f32>,
  _padDirColor: f32,
  ambientColor: vec3<f32>,
  ambientIntensity: f32,
  pointLights: array<Light, MAX_POINT_LIGHTS>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var texSampler : sampler;
@group(1) @binding(1) var atlasTex : texture_2d<f32>;
@group(1) @binding(2) var normalAtlasTex : texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) vNormal : vec3<f32>,
  @location(1) localPos : vec3<f32>,
  @location(2) worldPos : vec3<f32>,
  @location(3) vUV : vec2<f32>,
  @location(4) vColor : vec3<f32>,
  @location(5) materialId : f32,
};

${WGSL_COMMON_HELPERS}
${WGSL_STYLIZED_HELPERS}

@vertex
fn vs_main(
  @location(0) position : vec3<f32>,
  @location(1) instanceOffset : vec3<f32>,
  @location(2) normalPacked : vec4<f32>,
  @location(3) uv : vec2<f32>,
  @location(4) instanceColorScale : vec4<f32>,
  @location(5) instanceRotation : vec4<f32>,
  @location(6) instanceMaterialId : f32
) -> VertexOutput {
  var output : VertexOutput;
  let scale = instanceColorScale.w;
  let q = normalize(instanceRotation);
  let scaledPos = position * scale;
  let rotatedPos = quat_rotate(q, scaledPos);
  let worldPos = rotatedPos + instanceOffset;
  output.position = uniforms.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
  let normal = normalPacked.xyz;
  output.vNormal = normalize(quat_rotate(q, normal));
  output.localPos = scaledPos;
  output.worldPos = worldPos;
  let atlasInset = uniforms.atlasInsetAndPad.xy;
  output.vUV = clamp(uv, atlasInset, vec2<f32>(1.0, 1.0) - atlasInset);
  output.vColor = instanceColorScale.xyz;
  output.materialId = instanceMaterialId;
  return output;
}

@fragment
fn fs_main(
  @location(0) vNormal : vec3<f32>,
  @location(1) localPos : vec3<f32>,
  @location(2) worldPos : vec3<f32>,
  @location(3) vUV : vec2<f32>,
  @location(4) vColor : vec3<f32>,
  @location(5) materialId : f32
) -> @location(0) vec4<f32> {
  let N = normalize(vNormal);
  let V = normalize(uniforms.cameraPosition - worldPos);
  
  let TOON_BANDS = max(uniforms.shadingParams0.y, 3.0);
  let RIM_POWER = 2.5;
  
  // Sample base color
  let materialsPerRowF = max(uniforms.atlasParams.x, 1.0);
  let maxMatIdF = max(0.0, floor(materialsPerRowF * materialsPerRowF * 0.5 - 1.0));
  let matId = u32(clamp(materialId, 0.0, maxMatIdF));
  let isTop = step(0.5, abs(N.y));
  let atlasOffset = getAtlasOffset(matId, isTop);
  let atlasScale = getAtlasScale();
  let atlasUV = atlasOffset + vUV * atlasScale;
  var baseColor = textureSample(atlasTex, texSampler, atlasUV).rgb * vColor;
  
  // Saturation boost
  let luminance = dot(baseColor, vec3<f32>(0.299, 0.587, 0.114));
  baseColor = mix(vec3<f32>(luminance), baseColor, 1.2);
  baseColor = clamp(baseColor, vec3<f32>(0.0), vec3<f32>(1.0));
  
  // Simple toon lighting
  let lightDir = normalize(-uniforms.directionalLightDir);
  let NdotL = max(dot(N, lightDir), 0.0);
  let diffuse = quantize_toon(NdotL, TOON_BANDS);
  
  // Shadow ramp
  let shadowColor = sample_shadow_ramp(diffuse, SHADOW_RAMP_WARM);
  
  // Rim lighting
  let rim = calculate_rim(N, V, RIM_POWER, 0.25);
  
  // Ambient
  let ambient = uniforms.ambientColor * uniforms.ambientIntensity;
  
  // Face tone
  let topMask = step(0.5, N.y);
  let bottomMask = step(0.5, -N.y);
  let sideMask = clamp(1.0 - topMask - bottomMask, 0.0, 1.0);
  let faceTone = topMask * 1.1 + sideMask * 1.0 + bottomMask * 0.85;
  
  var color = baseColor * (ambient + shadowColor * uniforms.directionalLightColor * diffuse) * faceTone;
  color += uniforms.directionalLightColor * rim;
  
  return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;
}


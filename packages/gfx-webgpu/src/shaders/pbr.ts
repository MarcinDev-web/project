import { WGSL_COMMON_HELPERS, WGSL_PBR_HELPERS } from './chunks';

/**
 * Generates WGSL implementing a basic Cook-Torrance PBR with GGX and Schlick Fresnel.
 * Integrates with existing atlas layout and lighting uniforms used by lighting.ts.
 */
export function createPbrShaderCode(): string {
  return `
// ===== PBR Shader (Cook-Torrance, GGX, Schlick Fresnel) =====
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
  // x: ambientFactor, y: unused, z: unused, w: unused (kept for compat)
  shadingParams0 : vec4<f32>,
  atlasParams : vec4<f32>,

  // Lighting block (must match CPU layout)
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
  // ====== APPENDED: Shadows/Camera ======
  viewMatrix : mat4x4<f32>,
  lightViewProj : array<mat4x4<f32>, 4>,
  cascadeSplits : vec4<f32>,
  atlasRect : array<vec4<f32>, 4>, // uvMin.xy, uvMax.zw
  filterParams : vec4<f32>, // x: pcfKernelRadius, y: pcssLightRadiusUV, z: maxFilterRadiusUV, w: pad
  biasParams : vec4<f32>,   // x: depthBias, y: normalBias, z/w: pad
  shadowExtraParams : vec4<f32>, // x: cascadeOverlap (fraction of cascade range), y/z/w: pad
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var texSampler : sampler;
@group(1) @binding(1) var atlasTex : texture_2d<f32>;
@group(1) @binding(2) var normalAtlasTex : texture_2d<f32>;
// NEW: Atlas metadata storage buffer
struct AtlasMeta {
  sideRect : vec4<f32>, // xy offset, zw scale
  topRect  : vec4<f32>,
  flags    : u32,       // bit0: hasNormal
  saturation: f32,      // saturation scale
  metallic : f32,       // base metallic
  roughness: f32,       // base roughness
};
struct AtlasMetaBuffer {
  entries: array<AtlasMeta>,
};
@group(1) @binding(3) var<storage, read> atlasMeta : AtlasMetaBuffer;
// Shadows
@group(1) @binding(4) var shadowAtlas : texture_depth_2d;
@group(1) @binding(5) var shadowSamplerCmp : sampler_comparison;
@group(1) @binding(6) var brdfLutTex : texture_2d<f32>;
@group(1) @binding(7) var prefilteredEnvTex : texture_cube<f32>;

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
${WGSL_PBR_HELPERS}

fn selectCascade(linearDepth: f32, splits: vec4<f32>) -> u32 {
  if (linearDepth <= splits.x) { return 0u; }
  if (linearDepth <= splits.y) { return 1u; }
  if (linearDepth <= splits.z) { return 2u; }
  return 3u;
}

fn computeCascadeBlend(linearDepth: f32, splits: vec4<f32>, overlapFrac: f32) -> vec3<u32> {
  // Returns (baseIndex, neighborIndex, weightBits) where weightBits packs weight as u32 via bitcast
  let baseIndex: u32 = selectCascade(linearDepth, splits);
  var neighbor: u32 = 4u; // invalid
  var weight: f32 = 0.0;

  // Lower boundary blend (with previous cascade)
  if (baseIndex > 0u) {
    var lowerSplit = splits.z;
    if (baseIndex == 1u) {
      lowerSplit = splits.x;
    } else if (baseIndex == 2u) {
      lowerSplit = splits.y;
    }
    var prevSplit = splits.y;
    if (baseIndex == 1u) {
      prevSplit = 0.0;
    } else if (baseIndex == 2u) {
      prevSplit = splits.x;
    }
    let range = max(1e-6, lowerSplit - prevSplit);
    let overlap = overlapFrac * range;
    if (linearDepth < lowerSplit + overlap) {
      let t = clamp((linearDepth - lowerSplit) / max(overlap, 1e-6), 0.0, 1.0);
      // When below boundary, blend towards previous cascade
      neighbor = baseIndex - 1u;
      weight = 1.0 - t;
    }
  }
  // Upper boundary blend (with next cascade)
  if (neighbor == 4u && baseIndex < 3u) {
    var upperSplit = splits.z;
    if (baseIndex == 0u) {
      upperSplit = splits.x;
    } else if (baseIndex == 1u) {
      upperSplit = splits.y;
    }
    // Next split (for range estimate)
    var nextSplit = 0.0;
    if (baseIndex == 0u) {
      nextSplit = splits.y;
    } else if (baseIndex == 1u) {
      nextSplit = splits.z;
    }
    var rangeCandidate = upperSplit;
    if (baseIndex < 2u) {
      rangeCandidate = nextSplit - upperSplit;
    }
    let range = max(1e-6, rangeCandidate);
    let overlap = overlapFrac * range;
    if (linearDepth > upperSplit - overlap) {
      let t = clamp((linearDepth - (upperSplit - overlap)) / max(overlap, 1e-6), 0.0, 1.0);
      neighbor = baseIndex + 1u;
      weight = t;
    }
  }
  return vec3<u32>(baseIndex, neighbor, bitcast<u32>(weight));
}

fn sampleShadowPCF(uv: vec2<f32>, zRef: f32, kernel: i32, texelSize: vec2<f32>) -> f32 {
  var sum = 0.0;
  var count = 0.0;
  let k = max(kernel, 1);
  let r = k / 2;
  // Use fixed loop bounds for uniform control flow - required by WebGPU
  const MAX_KERNEL = 9;
  let halfMax = MAX_KERNEL / 2;
  for (var y = -halfMax; y <= halfMax; y++) {
    for (var x = -halfMax; x <= halfMax; x++) {
      let off = vec2<f32>(f32(x), f32(y)) * texelSize;
      // Always sample to maintain uniform control flow
      let shadowValue = textureSampleCompare(shadowAtlas, shadowSamplerCmp, uv + off, zRef);
      // Use weight to include/exclude samples based on kernel radius
      let inKernel = f32(x >= -r && x < k - r && y >= -r && y < k - r);
      sum += shadowValue * inKernel;
      count += inKernel;
    }
  }
  return sum / max(count, 1.0);
}

fn sampleShadowPCSS(worldPos: vec3<f32>, normal: vec3<f32>, cascadeIndex: u32) -> f32 {
  // Apply normal bias in world space to reduce self-shadowing
  let biasedWorldPos = worldPos + normal * uniforms.biasParams.y;
  // Transform to light clip for this cascade
  let LP = uniforms.lightViewProj[cascadeIndex] * vec4<f32>(biasedWorldPos, 1.0);
  let ndc = LP.xyz / max(LP.w, 1e-6);
  var uv = ndc.xy * 0.5 + vec2<f32>(0.5, 0.5);
  // Map to atlas rect
  let rect = uniforms.atlasRect[cascadeIndex];
  let uvMin = rect.xy; let uvMax = rect.zw;
  let atlasUV = uvMin + uv * (uvMax - uvMin);
  var zRef = ndc.z * 0.5 + 0.5; // 0..1
  // Apply small depth bias
  zRef -= uniforms.biasParams.x;

  // Compute blocker search radius in texel units
  let dims = vec2<f32>(textureDimensions(shadowAtlas, 0));
  let texel = 1.0 / dims;
  let baseRadius = max(1.0, uniforms.filterParams.x);

  // Blocker search (5x5) around atlasUV within rect
  var avgBlocker = 0.0;
  var blockers = 0.0;
  let search = 5;
  let r = search / 2;
  for (var j = -r; j < search - r; j++) {
    for (var i = -r; i < search - r; i++) {
      let off = vec2<f32>(f32(i), f32(j)) * texel;
      let uvOff = clamp(atlasUV + off, uvMin + texel, uvMax - texel);
      // Read depth using level 0; for depth textures use textureLoad requires integer coords
      let coord = vec2<i32>(uvOff * dims);
      let d = textureLoad(shadowAtlas, coord, 0);
      if (d < zRef) { avgBlocker += d; blockers += 1.0; }
    }
  }
  var filterRadius = baseRadius;
  if (blockers > 0.5) {
    avgBlocker /= blockers;
    let penumbra = (zRef - avgBlocker) * uniforms.filterParams.y / max(avgBlocker, 1e-4);
    filterRadius = clamp(penumbra * f32(dims.x), baseRadius, uniforms.filterParams.z * f32(dims.x));
  }
  let kernel = i32(clamp(round(filterRadius), 1.0, 9.0));
  return sampleShadowPCF(atlasUV, zRef, kernel, texel);
}

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

// PBR helpers are injected from chunks

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
  // Flat/voxel-friendly shading: no normal mapping, no specular
  let Ngeom = normalize(vNormal);
  let V = normalize(uniforms.cameraPosition - worldPos);

  // Atlas sampling via metadata (base color only)
  let materialsPerRowF = max(uniforms.atlasParams.x, 1.0);
  let maxMatIdF = max(0.0, floor(materialsPerRowF * materialsPerRowF * 0.5 - 1.0));
  let matId = u32(clamp(materialId, 0.0, maxMatIdF));
  let matMeta = atlasMeta.entries[matId];
  let isTop = step(0.5, abs(Ngeom.y));
  let rect = mix(matMeta.sideRect, matMeta.topRect, vec4<f32>(isTop, isTop, isTop, isTop));
  let atlasUV = rect.xy + vUV * rect.zw;
  let tint = mix(primaryColor.rgb, secondaryColor.rgb, 0.2);
  var baseColor = textureSample(atlasTex, texSampler, atlasUV).rgb * tint;

  // Optional mild saturation boost for colorful blocks
  let Y = dot(baseColor, vec3<f32>(0.299, 0.587, 0.114));
  let U = baseColor.b - Y;
  let Vc = baseColor.r - Y;
  baseColor = clamp(vec3<f32>(Y + Vc * matMeta.saturation, Y + (baseColor.g - Y) * matMeta.saturation, Y + U * matMeta.saturation), vec3<f32>(0.0), vec3<f32>(1.0));

  // Flat normal (no normal mapping)
  let N = Ngeom;

  // Ambient term
  let metallic = clamp(materialParams.y, 0.0, 1.0);
  let roughness = clamp(materialParams.z, 0.0, 1.0);
  let ambient = uniforms.ambientColor * uniforms.ambientIntensity * baseColor * (1.0 - metallic * 0.35);

  // Simple voxel tri-tone based on face orientation (top/side/bottom)
  let topMask = step(0.5, N.y);
  let bottomMask = step(0.5, -N.y);
  let sideMask = clamp(1.0 - topMask - bottomMask, 0.0, 1.0);
  let tone = topMask * 1.15 + sideMask * 0.95 + bottomMask * 0.80;

  // Directional light - subtle Lambert only (keeps sense of sun without glare) with cascaded shadows
  let Ld = normalize(-uniforms.directionalLightDir);
  let NdotL_dir = max(dot(N, Ld), 0.0);
  // Compute linear view-space depth for cascade selection
  let viewPos = uniforms.viewMatrix * vec4<f32>(worldPos, 1.0);
  let linearDepth = -viewPos.z;
  let blendInfo = computeCascadeBlend(linearDepth, uniforms.cascadeSplits, uniforms.shadowExtraParams.x);
  let baseIdx = blendInfo.x;
  let neighborIdx = blendInfo.y;
  let blendWeight = bitcast<f32>(blendInfo.z);
  let shadowBase = sampleShadowPCSS(worldPos, N, baseIdx);
  let neighborValid = neighborIdx < 4u;
  let neighborSampleIdx = select(baseIdx, neighborIdx, neighborValid);
  let neighborShadow = sampleShadowPCSS(worldPos, N, neighborSampleIdx);
  let blendFactor = clamp(blendWeight, 0.0, 1.0);
  let neighborBlend = select(0.0, blendFactor, neighborValid);
  let shadowVal = mix(shadowBase, neighborShadow, neighborBlend);
  var direct = lambert(baseColor) * uniforms.directionalLightColor * (NdotL_dir * 0.25) * shadowVal;

  // Point lights - Lambert only (also subtle)
  for (var i = 0u; i < uniforms.pointLightCount && i < MAX_POINT_LIGHTS; i++) {
    let Lpos = uniforms.pointLights[i].positionOrDirection;
    let toL = Lpos - worldPos;
    let dist = length(toL);
    if (dist <= uniforms.pointLights[i].range) {
      let L = toL / max(dist, 1e-4);
      let attenuation = 1.0 / (1.0 + (dist * dist) / (uniforms.pointLights[i].range * uniforms.pointLights[i].range));
      let NdotL = max(dot(N, L), 0.0);
      direct += lambert(baseColor) * uniforms.pointLights[i].color * (NdotL * mix(0.3, 0.5, metallic)) * attenuation;
    }
  }

  // Apply vertex AO with moderate strength
  let ao = mix(1.0, clamp(vAO, 0.0, 1.0), 0.4);

  var color = (ambient + direct) * tone * ao;
  color += emissiveColor.rgb * emissiveColor.w;
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  let alpha = clamp(primaryColor.a, 0.0, 1.0);
  return vec4<f32>(color, alpha);
}

@fragment
fn fs_overlay(
  @location(0) vNormal : vec3<f32>,
  @location(2) worldPos : vec3<f32>,
  @location(4) primaryColor : vec4<f32>,
  @location(5) secondaryColor : vec4<f32>
) -> @location(0) vec4<f32> {
  let n = normalize(vNormal);
  let l = normalize(-uniforms.directionalLightDir);
  let intensity = 0.35 + 0.65 * max(dot(n, l), 0.0);
  let highlightBase = mix(primaryColor.rgb, secondaryColor.rgb, 0.3);
  let highlight = mix(vec3<f32>(1.0), highlightBase, 0.4);
  let rim = smoothstep(0.0, 1.0, 1.0 - clamp(dot(n, normalize(uniforms.cameraPosition - worldPos)), 0.0, 1.0));
  let color = clamp(highlight * (intensity + 0.3 * rim), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color, 0.75);
}
`;
}

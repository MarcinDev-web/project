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
  @location(4) vColor : vec3<f32>,
  @location(5) materialId : f32,
  @location(6) vAO : f32,
};

${WGSL_COMMON_HELPERS}
${WGSL_PBR_HELPERS}

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
  // Transform to light clip for this cascade
  let LP = uniforms.lightViewProj[cascadeIndex] * vec4<f32>(worldPos, 1.0);
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
  @location(1) instanceOffset : vec3<f32>,
  @location(2) normalPacked : vec4<f32>,
  @location(3) uv : vec2<f32>,
  @location(4) instanceColorScale : vec4<f32>,
  @location(5) instanceRotation : vec4<f32>,
  @location(6) instanceMaterialId : f32,
  @location(7) aoPacked : vec4<f32>
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
  @location(4) vColor : vec3<f32>,
  @location(5) materialId : f32,
  @location(6) vAO : f32
) -> @location(0) vec4<f32> {
  // Base inputs
  let Ngeom = normalize(vNormal);
  let V = normalize(uniforms.cameraPosition - worldPos);

  // Atlas sampling via metadata
  let materialsPerRowF = max(uniforms.atlasParams.x, 1.0);
  let maxMatIdF = max(0.0, floor(materialsPerRowF * materialsPerRowF * 0.5 - 1.0));
  let matId = u32(clamp(materialId, 0.0, maxMatIdF));
  let matMeta = atlasMeta.entries[matId];
  let isTop = step(0.5, abs(Ngeom.y));
  let rect = mix(matMeta.sideRect, matMeta.topRect, vec4<f32>(isTop, isTop, isTop, isTop));
  let atlasUV = rect.xy + vUV * rect.zw;
  var baseColor = textureSample(atlasTex, texSampler, atlasUV).rgb * vColor;

  // Normal mapping
  let normalSample = textureSample(normalAtlasTex, texSampler, atlasUV).rgb;
  let nTangent = normalize(normalSample * 2.0 - vec3<f32>(1.0));
  let dp1 = dpdx(worldPos);
  let dp2 = dpdy(worldPos);
  let duv1 = dpdx(vUV);
  let duv2 = dpdy(vUV);
  let det = duv1.x * duv2.y - duv1.y * duv2.x;
  let invDet = select(0.0, 1.0 / det, abs(det) > 1e-5);
  var T = (dp1 * duv2.y - dp2 * duv1.y) * invDet;
  var B = (dp2 * duv1.x - dp1 * duv2.x) * invDet;
  T = normalize(T - Ngeom * dot(Ngeom, T));
  B = normalize(cross(Ngeom, T));
  let N = normalize(mat3x3<f32>(T, B, Ngeom) * nTangent);

  // Material params from metadata
  let metallic = clamp(matMeta.metallic, 0.0, 1.0);
  let roughness = clamp(matMeta.roughness, 0.04, 1.0);

  // Fresnel base reflectance (F0)
  let dielectricF0 = vec3<f32>(0.04, 0.04, 0.04);
  let F0 = mix(dielectricF0, baseColor, metallic);

  // Saturation boost in YUV
  let Y = dot(baseColor, vec3<f32>(0.299, 0.587, 0.114));
  let U = baseColor.b - Y;
  let Vc = baseColor.r - Y;
  baseColor = clamp(vec3<f32>(Y + Vc * matMeta.saturation, Y + (baseColor.g - Y) * matMeta.saturation, Y + U * matMeta.saturation), vec3<f32>(0.0), vec3<f32>(1.0));

  // Ambient term
  let ambient = uniforms.ambientColor * uniforms.ambientIntensity * baseColor;

  // Directional light
  let Ld = normalize(-uniforms.directionalLightDir);
  let H = normalize(V + Ld);
  let NdotL_dir = max(dot(N, Ld), 0.0);
  let NDF_dir = distribution_ggx(N, H, roughness);
  let G_dir = geometry_smith(N, V, Ld, roughness);
  let F_dir = fresnel_schlick(max(dot(H, V), 0.0), F0);
  let kSpec_dir = (NDF_dir * G_dir) / max(4.0 * max(dot(N, V), 0.0) * NdotL_dir, 1e-4);
  let spec_dir = F_dir * kSpec_dir;
  let kd_dir = (vec3<f32>(1.0) - F_dir) * (1.0 - metallic);
  let diff_dir = kd_dir * lambert(baseColor);
  var direct = (diff_dir + spec_dir) * uniforms.directionalLightColor * NdotL_dir;
  // Shadowing (CSM + PCSS)
  let viewPos = (uniforms.viewMatrix * vec4<f32>(worldPos, 1.0)).xyz;
  let linearDepth = -viewPos.z;
  let cIdx = selectCascade(linearDepth, uniforms.cascadeSplits);
  let visibility = sampleShadowPCSS(worldPos, N, cIdx);
  direct *= visibility;
  // Rim lighting
  let rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.5);
  direct += rim * 0.2 * (vec3<f32>(1.0) - kd_dir);

  // Point lights
  for (var i = 0u; i < uniforms.pointLightCount && i < MAX_POINT_LIGHTS; i++) {
    let Lpos = uniforms.pointLights[i].positionOrDirection;
    let toL = Lpos - worldPos;
    let dist = length(toL);
    if (dist <= uniforms.pointLights[i].range) {
      let L = toL / max(dist, 1e-4);
      let H2 = normalize(V + L);
      let attenuation = 1.0 / (1.0 + (dist * dist) / (uniforms.pointLights[i].range * uniforms.pointLights[i].range));
      let NdotL = max(dot(N, L), 0.0);
      let NDF = distribution_ggx(N, H2, roughness);
      let Gv = geometry_smith(N, V, L, roughness);
      let Fv = fresnel_schlick(max(dot(H2, V), 0.0), F0);
      let kSpec = (NDF * Gv) / max(4.0 * max(dot(N, V), 0.0) * NdotL, 1e-4);
      let spec = Fv * kSpec;
      let kd = (vec3<f32>(1.0) - Fv) * (1.0 - metallic);
      let diff = kd * lambert(baseColor);
      direct += (diff + spec) * uniforms.pointLights[i].color * NdotL * attenuation;
    }
  }

  // Apply vertex AO with 0.4 strength
  let ao = mix(1.0, clamp(vAO, 0.0, 1.0), 0.4);
  // Image-Based Lighting (split-sum approximation)
  let NdotV = max(dot(N, V), 0.0);
  let R = reflect(-V, N);
  let brdf = textureSample(brdfLutTex, texSampler, vec2<f32>(NdotV, roughness)).rg;
  // Select mip level based on roughness (fallback to 0 if no mips)
  let prefiltered = textureSampleLevel(prefilteredEnvTex, texSampler, R, roughness * 4.0).rgb;
  let specIBL = prefiltered * (F0 * brdf.x + brdf.y);
  var color = (ambient + direct + specIBL) * ao;
  // Fog (disabled by default)
  let dist = length(uniforms.cameraPosition - worldPos);
  let fogDensity = 0.0;
  let fogFactor = clamp(exp(-fogDensity * dist), 0.0, 1.0);
  let fogColor = uniforms.ambientColor * uniforms.ambientIntensity;
  color = mix(fogColor, color, fogFactor);
  color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color, 1.0);
}

@fragment
fn fs_overlay(
  @location(0) vNormal : vec3<f32>,
  @location(2) worldPos : vec3<f32>,
  @location(4) vColor : vec3<f32>
) -> @location(0) vec4<f32> {
  let n = normalize(vNormal);
  let l = normalize(-uniforms.directionalLightDir);
  let intensity = 0.35 + 0.65 * max(dot(n, l), 0.0);
  let highlight = mix(vec3<f32>(1.0), vColor, 0.4);
  let rim = smoothstep(0.0, 1.0, 1.0 - clamp(dot(n, normalize(uniforms.cameraPosition - worldPos)), 0.0, 1.0));
  let color = clamp(highlight * (intensity + 0.3 * rim), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color, 0.75);
}
`;
}



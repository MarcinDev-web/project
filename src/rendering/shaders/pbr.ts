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
${WGSL_PBR_HELPERS}

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

// PBR helpers are injected from chunks

@fragment
fn fs_main(
  @location(0) vNormal : vec3<f32>,
  @location(1) localPos : vec3<f32>,
  @location(2) worldPos : vec3<f32>,
  @location(3) vUV : vec2<f32>,
  @location(4) vColor : vec3<f32>,
  @location(5) materialId : f32
) -> @location(0) vec4<f32> {
  // Base inputs
  let Ngeom = normalize(vNormal);
  let V = normalize(uniforms.cameraPosition - worldPos);

  // Atlas sampling
  let materialsPerRowF = max(uniforms.atlasParams.x, 1.0);
  let maxMatIdF = max(0.0, floor(materialsPerRowF * materialsPerRowF * 0.5 - 1.0));
  let matId = u32(clamp(materialId, 0.0, maxMatIdF));
  let isTop = step(0.5, abs(Ngeom.y));
  let atlasOffset = getAtlasOffset(matId, isTop);
  let atlasScale = getAtlasScale();
  let atlasUV = atlasOffset + vUV * atlasScale;
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

  // Simple metallic/roughness from base color luminance for now (until maps provided)
  let luminance = dot(baseColor, vec3<f32>(0.2126, 0.7152, 0.0722));
  let metallic = clamp(0.04 + 0.82 * (1.0 - luminance), 0.0, 1.0);
  let roughness = clamp(0.2 + 0.6 * luminance, 0.04, 1.0);

  // Fresnel base reflectance (F0)
  let dielectricF0 = vec3<f32>(0.04, 0.04, 0.04);
  let F0 = mix(dielectricF0, baseColor, metallic);

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

  var color = ambient + direct;
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



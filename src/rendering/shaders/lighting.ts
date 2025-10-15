/**
 * Enhanced shader with multiple light support
 * Supports:
 * - 1 directional light (sun/moon)
 * - 4 point lights
 * - Ambient light
 */

import { WGSL_COMMON_HELPERS } from './chunks';
export function createLightingShaderCode(): string {
  return `
// Maximum number of point lights supported
const MAX_POINT_LIGHTS: u32 = 4u;

struct Light {
  // type: 0=directional, 1=point, 2=spot (spot not yet implemented)
  lightType: u32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
  // position for point lights, direction for directional lights
  positionOrDirection: vec3<f32>,
  _pad3: f32,
  // color * intensity
  color: vec3<f32>,
  // range for point lights
  range: f32,
};

struct Uniforms {
  // viewProjectionMatrix: transforms world space to clip space
  viewProjectionMatrix : mat4x4<f32>,
  // cameraPosition: world-space camera origin
  cameraPosition : vec3<f32>,
  _pad0 : f32,
  // atlasInsetAndPad: xy contains atlas inset (half texel), zw unused padding
  atlasInsetAndPad : vec4<f32>,
  // shadingParams0: x=ambient, y=toonBands, z=specularPower, w=unused
  shadingParams0 : vec4<f32>,
  // atlasParams: x=materialsPerRow, y=texSizeInAtlas, z=atlasSize, w=padding
  atlasParams : vec4<f32>,
  
  // === LIGHTING DATA ===
  // Number of active point lights
  pointLightCount: u32,
  _padLights0: f32,
  _padLights1: f32,
  _padLights2: f32,
  // Directional light (sun/moon)
  directionalLightDir: vec3<f32>,
  _padDir: f32,
  directionalLightColor: vec3<f32>,
  _padDirColor: f32,
  // Ambient light
  ambientColor: vec3<f32>,
  ambientIntensity: f32,
  // Point lights array
  pointLights: array<Light, MAX_POINT_LIGHTS>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(1) @binding(0) var texSampler : sampler;
@group(1) @binding(1) var atlasTex : texture_2d<f32>;
@group(1) @binding(2) var normalAtlasTex : texture_2d<f32>;

// Vertex shader outputs
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

// Calculate lighting contribution from directional light
fn calcDirectionalLight(normal: vec3<f32>, viewDir: vec3<f32>) -> vec3<f32> {
  // Interpret stored direction as direction the light points; use opposite for lighting vector
  let lightDir = normalize(-uniforms.directionalLightDir);
  let NdotL = max(dot(normal, lightDir), 0.0);
  
  // Diffuse
  let diffuse = uniforms.directionalLightColor * NdotL;
  
  // Specular (Blinn-Phong)
  let halfVec = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfVec), 0.0);
  let specPower = max(uniforms.shadingParams0.z, 0.0001);
  let spec = pow(NdotH, specPower) * 0.15;
  
  return diffuse + vec3<f32>(spec);
}

// Calculate lighting contribution from a point light
fn calcPointLight(light: Light, worldPos: vec3<f32>, normal: vec3<f32>, viewDir: vec3<f32>) -> vec3<f32> {
  let lightPos = light.positionOrDirection;
  let toLight = lightPos - worldPos;
  let distance = length(toLight);
  
  // Early exit if outside range
  if (distance > light.range) {
    return vec3<f32>(0.0);
  }
  
  let lightDir = toLight / distance;
  let NdotL = max(dot(normal, lightDir), 0.0);
  
  // Attenuation (inverse square with range limit)
  let attenuation = 1.0 / (1.0 + (distance * distance) / (light.range * light.range));
  
  // Diffuse
  let diffuse = light.color * NdotL * attenuation;
  
  // Specular (Blinn-Phong)
  let halfVec = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfVec), 0.0);
  let specPower = max(uniforms.shadingParams0.z, 0.0001);
  let spec = pow(NdotH, specPower) * 0.2 * attenuation;
  
  return diffuse + vec3<f32>(spec);
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
  let nGeom = normalize(vNormal);
  let viewDir = normalize(uniforms.cameraPosition - worldPos);
  
  // Sample base color from atlas
  // Clamp materialId using atlas capacity derived from uniforms (2 cells per material)
  let materialsPerRowF = max(uniforms.atlasParams.x, 1.0);
  let maxMatIdF = max(0.0, floor(materialsPerRowF * materialsPerRowF * 0.5 - 1.0));
  let matId = u32(clamp(materialId, 0.0, maxMatIdF));
  let isTop = step(0.5, abs(nGeom.y));
  let atlasOffset = getAtlasOffset(matId, isTop);
  let atlasScale = getAtlasScale();
  let atlasUV = atlasOffset + vUV * atlasScale;
  var baseColor = textureSample(atlasTex, texSampler, atlasUV).rgb;
  baseColor = baseColor * vColor;
  
  // Removed baseColor minimum clamp to avoid double brightening with final base lift

  // === NORMAL MAPPING ===
  // Sample tangent-space normal and unpack from [0,1] to [-1,1]
  let normalSample = textureSample(normalAtlasTex, texSampler, atlasUV).rgb;
  let nTangent = normalize(normalSample * 2.0 - vec3<f32>(1.0));

  // Reconstruct TBN from screen-space derivatives
  let dp1 = dpdx(worldPos);
  let dp2 = dpdy(worldPos);
  let duv1 = dpdx(vUV);
  let duv2 = dpdy(vUV);
  let det = duv1.x * duv2.y - duv1.y * duv2.x;
  let invDet = select(0.0, 1.0 / det, abs(det) > 1e-5);
  var T = (dp1 * duv2.y - dp2 * duv1.y) * invDet;
  var B = (dp2 * duv1.x - dp1 * duv2.x) * invDet;
  // Orthonormalize
  T = normalize(T - nGeom * dot(nGeom, T));
  B = normalize(cross(nGeom, T));
  let n = normalize(mat3x3<f32>(T, B, nGeom) * nTangent);
  
  // Ambient occlusion (darken edges)
  // Clamp to avoid over-darkening on small instances and scale sensitivity
  let maxEdge = max(max(abs(localPos.x) * 2.0, abs(localPos.y) * 2.0), abs(localPos.z) * 2.0);
  let t = clamp(maxEdge, 0.0, 1.0);
  let ao = mix(0.85, 1.0, t);
  
  // Micro pattern disabled to avoid unintended banding across faces
  let micro = 0.0;
  
  // === LIGHTING CALCULATION ===
  // Keep ambient separate so it is NOT quantized away by toon shading
  let ambient = uniforms.ambientColor * uniforms.ambientIntensity;
  
  // Accumulate direct lighting (directional + points)
  var direct = vec3<f32>(0.0);
  direct += calcDirectionalLight(n, viewDir);
  for (var i = 0u; i < uniforms.pointLightCount && i < MAX_POINT_LIGHTS; i++) {
    direct += calcPointLight(uniforms.pointLights[i], worldPos, n, viewDir);
  }
  
  // Apply toon quantization ONLY to direct lighting
  let TOON_BANDS = max(uniforms.shadingParams0.y, 1.0);
  let directMag = length(direct);
  let directTone = floor(directMag * TOON_BANDS) / TOON_BANDS;
  let directDir = normalize(direct + vec3<f32>(0.001)); // Avoid division by zero
  let finalLighting = ambient + directDir * directTone;
  
  // Combine everything
  // Slight base lift for minimum visibility (increased for brighter tops)
  var color = baseColor * (finalLighting + vec3<f32>(0.25)) * ao;
  color = color + vec3<f32>(micro);
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
  // Use incoming light direction directly
  let l = normalize(-uniforms.directionalLightDir);
  let intensity = 0.35 + 0.65 * max(dot(n, l), 0.0);
  let highlight = mix(vec3<f32>(1.0), vColor, 0.4);
  let rim = smoothstep(0.0, 1.0, 1.0 - clamp(dot(n, normalize(uniforms.cameraPosition - worldPos)), 0.0, 1.0));
  let color = clamp(highlight * (intensity + 0.3 * rim), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color, 0.75);
}
`;
}

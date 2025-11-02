// Shared WGSL helper functions used across multiple shaders
// - quat_rotate: rotate a vector by a quaternion
// - getAtlasOffset: compute UV offset inside a texture atlas
// - getAtlasScale: compute UV scale for a single atlas cell
//
// Note: getAtlasOffset and getAtlasScale assume the following WGSL globals exist
// in the including module:
//   struct Uniforms { atlasParams : vec4<f32>; };
//   @group(0) @binding(0) var<uniform> uniforms : Uniforms;

export const WGSL_COMMON_HELPERS = `
// Rotate a vector by a quaternion (equivalent to q * v * conj(q))
fn quat_rotate(q : vec4<f32>, v : vec3<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

// Calculates UV offset in atlas based on material ID and texture type (side/top)
fn getAtlasOffset(materialId: u32, isTop: f32) -> vec2<f32> {
  let materialsPerRow = u32(uniforms.atlasParams.x);
  let texSize = uniforms.atlasParams.y;
  let atlasSize = uniforms.atlasParams.z;
  // Each material uses 2 cells (side + top)
  let cellIndex = materialId * 2u + u32(isTop);
  let row = cellIndex / materialsPerRow;
  let col = cellIndex % materialsPerRow;
  // Calculate pixel offset using configured padding (w = padding)
  let texSizeWithPadding = texSize + uniforms.atlasParams.w;
  let offsetX = f32(col) * texSizeWithPadding / atlasSize;
  let offsetY = f32(row) * texSizeWithPadding / atlasSize;
  return vec2<f32>(offsetX, offsetY);
}

// Calculates UV scale for a single texture in the atlas
fn getAtlasScale() -> vec2<f32> {
  let texSize = uniforms.atlasParams.y;
  let atlasSize = uniforms.atlasParams.z;
  return vec2<f32>(texSize / atlasSize, texSize / atlasSize);
}
`;

export const WGSL_PBR_HELPERS = `
fn fresnel_schlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - cosTheta, 5.0);
}

fn distribution_ggx(N: vec3<f32>, H: vec3<f32>, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let NdotH = max(dot(N, H), 0.0);
  let NdotH2 = NdotH * NdotH;
  let denom = (NdotH2 * (a2 - 1.0) + 1.0);
  return a2 / max(3.14159265 * denom * denom, 1e-4);
}

fn geometry_smith(N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  let NdotV = max(dot(N, V), 0.0);
  let NdotL = max(dot(N, L), 0.0);
  let ggx1 = NdotV / max(NdotV * (1.0 - k) + k, 1e-4);
  let ggx2 = NdotL / max(NdotL * (1.0 - k) + k, 1e-4);
  return ggx1 * ggx2;
}

fn lambert(diffuseColor: vec3<f32>) -> vec3<f32> {
  return diffuseColor / 3.14159265;
}
`;

export const WGSL_WATER_HELPERS = `
// Gerstner wave function for realistic water waves
// Returns (displaced position, normal offset)
fn gerstnerWave(
  position: vec2<f32>,
  time: f32,
  direction: vec2<f32>,
  amplitude: f32,
  frequency: f32,
  phaseSpeed: f32,
  steepness: f32
) -> vec3<f32> {
  // Normalize direction
  let dir = normalize(direction);
  // Wave phase calculation
  let phase = dot(dir, position) * frequency + phaseSpeed * time;
  // Gerstner wave calculation
  let Q = steepness * amplitude;
  let cosPhase = cos(phase);
  let sinPhase = sin(phase);
  
  // Displaced position (x, y, z)
  return vec3<f32>(
    Q * amplitude * cosPhase,
    amplitude * sinPhase,
    Q * amplitude * sinPhase
  );
}

// Water-specific Fresnel calculation (Schlick approximation for water)
// Returns reflection coefficient based on viewing angle
fn waterFresnel(viewDir: vec3<f32>, normal: vec3<f32>, eta: f32) -> f32 {
  let cosTheta = max(dot(viewDir, normal), 0.0);
  // F0 for water-air interface is approximately 0.02
  let F0 = vec3<f32>(0.02, 0.02, 0.02);
  // Schlick approximation
  let fresnel = F0.x + (1.0 - F0.x) * pow(1.0 - cosTheta, 5.0);
  return fresnel;
}

// Generate foam mask based on wave height, edge distance, and threshold
// Returns foam amount (0-1) where 1 = full foam
fn sampleFoam(
  waveNormal: vec3<f32>,
  position: vec2<f32>,
  size: vec2<f32>,
  threshold: f32
) -> f32 {
  // Foam at wave peaks (steep angles)
  let waveFoam = smoothstep(threshold, 1.0, abs(waveNormal.y));
  
  // Foam at edges (distance-based)
  let halfSize = size * 0.5;
  let distFromEdge = min(
    min(position.x + halfSize.x, halfSize.x - position.x),
    min(position.y + halfSize.y, halfSize.y - position.y)
  );
  let edgeFoam = 1.0 - smoothstep(0.0, 0.1, distFromEdge / min(halfSize.x, halfSize.y));
  
  // Combine both foam sources
  return min(1.0, waveFoam + edgeFoam * 0.5);
}
`;


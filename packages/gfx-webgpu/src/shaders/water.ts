import { WGSL_WATER_HELPERS } from './chunks';

/**
 * Generates WGSL code for water rendering with Gerstner waves, reflections, refractions, and foam.
 * Integrates with existing lighting system and environment cubemap for reflections.
 */
export function createWaterShaderCode(): string {
  return `
// ===== Water Shader (Gerstner Waves + Reflections + Refractions) =====

struct WaterUniforms {
  // Transform matrices
  viewProjectionMatrix: mat4x4<f32>,
  modelMatrix: mat4x4<f32>,
  normalMatrix: mat4x4<f32>,
  
  // Camera
  cameraPosition: vec3<f32>,
  _pad0: f32,
  
  // Time for animation
  time: f32,
  _pad1: f32,
  _pad2: f32,
  _pad3: f32,
  
  // Wave parameters
  waveDirection: vec2<f32>,
  waveHeight: f32,
  waveFrequency: f32,
  waveSpeed: f32,
  
  // Water appearance
  waterColor: vec4<f32>,
  foamColor: vec4<f32>,
  foamThreshold: f32,
  transparency: f32,
  refractionStrength: f32,
  reflectionStrength: f32,
  
  // Water size for foam calculation
  waterSize: vec2<f32>,
  _pad4: f32,
  _pad5: f32,
  
  // Feature flags
  causticsEnabled: u32,
  _pad6: u32,
  _pad7: u32,
  _pad8: u32,
};

// Lighting uniforms (reuse from main pipeline)
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

struct LightingUniforms {
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
  pointLights: array<Light, 4>,
};

@group(0) @binding(0) var<uniform> waterUniforms: WaterUniforms;
@group(0) @binding(1) var<uniform> lightingUniforms: LightingUniforms;

// Textures and samplers
@group(1) @binding(0) var waterSampler: sampler;
@group(1) @binding(1) var envCube: texture_cube<f32>; // Environment cubemap for reflections
@group(1) @binding(2) var depthTexture: texture_depth_2d; // Scene depth for refractions
@group(1) @binding(3) var sceneColor: texture_2d<f32>; // Scene color for refractions

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) viewPos: vec3<f32>,
  @location(2) normal: vec3<f32>,
  @location(3) uv: vec2<f32>,
  @location(4) viewDir: vec3<f32>,
};

${WGSL_WATER_HELPERS}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  // Apply Gerstner wave displacement in local space
  let localPos2D = vec2<f32>(input.position.x, input.position.z);
  let waveDisplacement = gerstnerWave(
    localPos2D,
    waterUniforms.time,
    waterUniforms.waveDirection,
    waterUniforms.waveHeight,
    waterUniforms.waveFrequency,
    waterUniforms.waveSpeed,
    0.5 // steepness (can be made configurable)
  );
  
  // Displace vertex position
  let displacedPos = vec3<f32>(
    input.position.x + waveDisplacement.x,
    input.position.y + waveDisplacement.y,
    input.position.z + waveDisplacement.z
  );
  
  // Calculate normal from wave displacement
  // Approximate normal by using cross product of tangent and bitangent
  let eps = 0.01;
  let posX = displacedPos + vec3<f32>(eps, 0.0, 0.0);
  let posZ = displacedPos + vec3<f32>(0.0, 0.0, eps);
  
  let waveX = gerstnerWave(
    vec2<f32>(posX.x, posX.z),
    waterUniforms.time,
    waterUniforms.waveDirection,
    waterUniforms.waveHeight,
    waterUniforms.waveFrequency,
    waterUniforms.waveSpeed,
    0.5
  );
  let waveZ = gerstnerWave(
    vec2<f32>(posZ.x, posZ.z),
    waterUniforms.time,
    waterUniforms.waveDirection,
    waterUniforms.waveHeight,
    waterUniforms.waveFrequency,
    waterUniforms.waveSpeed,
    0.5
  );
  
  let tangent = normalize(vec3<f32>(eps, waveX.y - waveDisplacement.y, 0.0));
  let bitangent = normalize(vec3<f32>(0.0, waveZ.y - waveDisplacement.y, eps));
  let waveNormal = cross(tangent, bitangent);
  
  // Transform to world space
  let worldPos = (waterUniforms.modelMatrix * vec4<f32>(displacedPos, 1.0)).xyz;
  output.worldPos = worldPos;
  
  // Transform to view space
  output.viewPos = worldPos - waterUniforms.cameraPosition;
  
  // Transform normal to world space
  output.normal = normalize((waterUniforms.normalMatrix * vec4<f32>(waveNormal, 0.0)).xyz);
  
  // Pass through UV
  output.uv = input.uv;
  
  // Calculate view direction
  output.viewDir = normalize(waterUniforms.cameraPosition - worldPos);
  
  // Transform to clip space
  output.position = waterUniforms.viewProjectionMatrix * vec4<f32>(worldPos, 1.0);
  
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let normal = normalize(input.normal);
  let viewDir = normalize(input.viewDir);
  
  // Calculate reflection vector
  let reflectDir = reflect(-viewDir, normal);
  
  // Sample environment cubemap for reflections
  let reflectionColor = textureSample(envCube, waterSampler, reflectDir).rgb;
  
  // Apply refraction distortion
  let refractionOffset = normal.xz * waterUniforms.refractionStrength;
  // Note: For full refraction, we'd need screen-space UV coordinates
  // This is a simplified version using normal-based distortion
  let refractedDir = refract(-viewDir, normal, 0.75); // Water-air IOR ≈ 1.33/1.0
  let refractionColor = textureSample(envCube, waterSampler, refractedDir).rgb;
  
  // Calculate Fresnel term (water-air interface)
  let fresnel = waterFresnel(viewDir, normal, 1.33);
  let fresnelStrength = waterUniforms.reflectionStrength;
  
  // Blend reflection and refraction based on Fresnel
  let surfaceColor = mix(refractionColor, reflectionColor, fresnel * fresnelStrength);
  
  // Apply water color tint
  surfaceColor *= waterUniforms.waterColor.rgb;
  
  // Calculate foam
  let foamAmount = sampleFoam(
    normal,
    vec2<f32>(input.uv.x * waterUniforms.waterSize.x - waterUniforms.waterSize.x * 0.5,
              input.uv.y * waterUniforms.waterSize.y - waterUniforms.waterSize.y * 0.5),
    waterUniforms.waterSize,
    waterUniforms.foamThreshold
  );
  
  // Blend foam color
  surfaceColor = mix(surfaceColor, waterUniforms.foamColor.rgb, foamAmount * waterUniforms.foamColor.a);
  
  // Apply directional lighting (simple lambertian)
  let lightDir = normalize(-lightingUniforms.directionalLightDir);
  let NdotL = max(dot(normal, lightDir), 0.0);
  let diffuse = lightingUniforms.directionalLightColor * NdotL;
  
  // Add ambient
  let ambient = lightingUniforms.ambientColor * lightingUniforms.ambientIntensity;
  
  // Combine lighting
  surfaceColor *= (ambient + diffuse);
  
  // Caustics effect (simplified - can be enhanced with texture or noise)
  var caustics = 1.0;
  if (waterUniforms.causticsEnabled == 1u) {
    // Simple caustics using wave-based pattern
    let causticsPhase = dot(normal.xz, lightDir.xz) * 10.0 + waterUniforms.time;
    caustics = 0.8 + 0.2 * sin(causticsPhase);
  }
  surfaceColor *= caustics;
  
  // Apply transparency
  let alpha = waterUniforms.waterColor.a * (1.0 - waterUniforms.transparency);
  
  return vec4<f32>(surfaceColor, alpha);
}
`;
}


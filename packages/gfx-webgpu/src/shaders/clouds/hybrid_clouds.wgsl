// ============================================================================
// Hybrid Volumetric Cloud Shader
// ============================================================================
// Combines SDF shapes, FBM noise, and Worley noise for realistic clouds.
// Supports multiple cloud types: cumulus, stratus, stratocumulus.
//
// Features:
// - Weather map sampling for coverage control
// - SDF-based cloud shapes for distinct formations
// - FBM noise for large-scale detail
// - Worley noise for erosion and natural edges
// - Beer-Lambert light absorption
// - Multi-scattering approximation
// ============================================================================

// === Uniforms ===
struct HybridCloudUniforms {
  viewProjectionInverse: mat4x4<f32>,
  viewProjection: mat4x4<f32>,
  prevViewProjection: mat4x4<f32>,
  cameraPosition: vec3<f32>,
  time: f32,
  sunDirection: vec3<f32>,
  cloudAltitude: f32,
  sunColor: vec3<f32>,
  cloudThickness: f32,
  skyColor: vec3<f32>,
  cloudDensity: f32,
  cloudSpeed: f32,
  screenWidth: f32,
  screenHeight: f32,
  nearPlane: f32,
  farPlane: f32,
  erosionStrength: f32,
  cloudType: f32,      // 0=auto(from weather), 1=cumulus, 2=stratus, 3=stratocumulus
  weatherMapScale: f32,
  _pad1: f32,
}

@group(0) @binding(0) var<uniform> u: HybridCloudUniforms;
@group(0) @binding(1) var depthTexture: texture_depth_2d;
@group(0) @binding(2) var weatherMap: texture_2d<f32>;
@group(0) @binding(3) var weatherSampler: sampler;
@group(0) @binding(4) var blueNoiseTex: texture_2d<f32>;
@group(0) @binding(5) var blueNoiseSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

// === Constants ===
const MAX_STEPS: i32 = 64;
const LIGHT_STEPS: i32 = 6;
const MAX_DIST: f32 = 15000.0;
const MIN_TRANSMITTANCE: f32 = 0.01;
const PI: f32 = 3.14159265359;

// === Hash Functions ===

fn hash3(p: vec3<f32>) -> f32 {
  var p3 = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn hash33(p: vec3<f32>) -> vec3<f32> {
  var p3 = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// === Noise Functions ===

// 3D Value noise with quintic interpolation
fn noise3D(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  
  let c000 = hash3(i + vec3<f32>(0.0, 0.0, 0.0));
  let c100 = hash3(i + vec3<f32>(1.0, 0.0, 0.0));
  let c010 = hash3(i + vec3<f32>(0.0, 1.0, 0.0));
  let c110 = hash3(i + vec3<f32>(1.0, 1.0, 0.0));
  let c001 = hash3(i + vec3<f32>(0.0, 0.0, 1.0));
  let c101 = hash3(i + vec3<f32>(1.0, 0.0, 1.0));
  let c011 = hash3(i + vec3<f32>(0.0, 1.0, 1.0));
  let c111 = hash3(i + vec3<f32>(1.0, 1.0, 1.0));
  
  return mix(
    mix(mix(c000, c100, u.x), mix(c010, c110, u.x), u.y),
    mix(mix(c001, c101, u.x), mix(c011, c111, u.x), u.y),
    u.z
  );
}

// FBM (Fractal Brownian Motion)
fn fbm(p: vec3<f32>, octaves: i32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var pos = p;
  var totalAmplitude = 0.0;
  
  for (var i = 0; i < octaves; i++) {
    value += amplitude * noise3D(pos);
    totalAmplitude += amplitude;
    pos *= 2.0;
    amplitude *= 0.5;
  }
  
  return value / totalAmplitude;
}

// Worley noise (cellular) for cloud erosion
fn worley3D(p: vec3<f32>) -> f32 {
  let cell = floor(p);
  var minDist = 1.0;
  
  for (var z = -1; z <= 1; z++) {
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let neighbor = cell + vec3<f32>(f32(x), f32(y), f32(z));
        let point = neighbor + hash33(neighbor);
        let diff = point - p;
        minDist = min(minDist, dot(diff, diff));
      }
    }
  }
  
  return sqrt(minDist);
}

// === SDF Primitives ===

fn sdSphere(p: vec3<f32>, r: f32) -> f32 {
  return length(p) - r;
}

fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdEllipsoid(p: vec3<f32>, r: vec3<f32>) -> f32 {
  let k0 = length(p / r);
  let k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

// Smooth minimum for blending SDFs
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = saturate(0.5 + 0.5 * (b - a) / k);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// === Cloud SDF Shapes ===

// Cumulus: puffy, cauliflower-like clouds
fn sdfCumulus(p: vec3<f32>, scale: f32) -> f32 {
  let ps = p / scale;
  
  // Main body - wide ellipsoid base
  let base = sdEllipsoid(ps, vec3<f32>(1.0, 0.6, 1.0));
  
  // Top bumps - multiple spheres for puffy appearance
  let top1 = sdSphere(ps - vec3<f32>(0.0, 0.5, 0.0), 0.7);
  let top2 = sdSphere(ps - vec3<f32>(0.4, 0.6, 0.2), 0.5);
  let top3 = sdSphere(ps - vec3<f32>(-0.3, 0.55, -0.1), 0.55);
  let top4 = sdSphere(ps - vec3<f32>(0.1, 0.7, -0.3), 0.4);
  
  // Smooth union of all parts
  var d = smin(base, top1, 0.3);
  d = smin(d, top2, 0.25);
  d = smin(d, top3, 0.25);
  d = smin(d, top4, 0.2);
  
  return d * scale;
}

// Stratus: flat, layered clouds
fn sdfStratus(p: vec3<f32>, scale: f32) -> f32 {
  let ps = p / scale;
  
  // Flat box with rounded edges
  let flat = sdBox(ps, vec3<f32>(2.0, 0.15, 2.0));
  
  // Add slight waviness
  let wave = sin(ps.x * 2.0) * cos(ps.z * 1.5) * 0.05;
  
  return (flat + wave) * scale;
}

// Stratocumulus: mixed layered and puffy
fn sdfStratocumulus(p: vec3<f32>, scale: f32) -> f32 {
  let ps = p / scale;
  
  // Flat base layer
  let flat = sdBox(ps, vec3<f32>(1.5, 0.2, 1.5));
  
  // Puffy bumps on top
  let bump1 = sdSphere(ps - vec3<f32>(0.0, 0.25, 0.0), 0.4);
  let bump2 = sdSphere(ps - vec3<f32>(0.5, 0.2, 0.3), 0.35);
  let bump3 = sdSphere(ps - vec3<f32>(-0.4, 0.22, -0.2), 0.38);
  
  var d = smin(flat, bump1, 0.2);
  d = smin(d, bump2, 0.15);
  d = smin(d, bump3, 0.15);
  
  return d * scale;
}

// Select cloud SDF based on type
fn selectCloudSDF(localPos: vec3<f32>, cloudType: f32, scale: f32) -> f32 {
  // cloudType: 0-0.33 = stratus, 0.33-0.66 = stratocumulus, 0.66-1.0 = cumulus
  if (cloudType < 0.33) {
    return sdfStratus(localPos, scale);
  } else if (cloudType < 0.66) {
    return sdfStratocumulus(localPos, scale);
  } else {
    return sdfCumulus(localPos, scale);
  }
}

// === Weather Map Sampling ===

fn sampleWeatherMap(worldPos: vec3<f32>) -> vec4<f32> {
  // Project world position to weather map UV
  let uv = worldPos.xz * u.weatherMapScale * 0.0001;
  return textureSample(weatherMap, weatherSampler, uv);
}

// === Cloud Density ===

fn cloudDensityHybrid(p: vec3<f32>) -> f32 {
  let cloudBottom = u.cloudAltitude;
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  // Height within cloud layer (0 at bottom, 1 at top)
  let heightFraction = saturate((p.y - cloudBottom) / u.cloudThickness);
  
  // Height gradient: rounded profile
  let heightGradient = smoothstep(0.0, 0.15, heightFraction) * smoothstep(1.0, 0.7, heightFraction);
  if (heightGradient < 0.01) { return 0.0; }
  
  // Sample weather map
  let weather = sampleWeatherMap(p);
  let coverage = weather.r;
  let cloudTypeFromWeather = weather.g;
  let precipitation = weather.b;
  
  // Early exit if no coverage
  if (coverage < 0.01) { return 0.0; }
  
  // Determine cloud type
  var cloudType = cloudTypeFromWeather;
  if (u.cloudType > 0.5) {
    // Override with uniform cloud type
    cloudType = (u.cloudType - 1.0) / 2.0; // Map 1,2,3 to 0,0.5,1
  }
  
  // Wind animation
  let wind = vec3<f32>(u.time * u.cloudSpeed * 50.0, 0.0, u.time * u.cloudSpeed * 20.0);
  
  // Sample position for noise
  let np = (p + wind) * 0.001;
  
  // === Base Shape from SDF ===
  // Create a grid of cloud cells
  let cellSize = 500.0;
  let cellPos = floor(p.xz / cellSize);
  let localPos = vec3<f32>(
    fract(p.x / cellSize) * 2.0 - 1.0,
    (p.y - cloudBottom - u.cloudThickness * 0.5) / (u.cloudThickness * 0.5),
    fract(p.z / cellSize) * 2.0 - 1.0
  );
  
  // SDF contribution (soft distance field)
  let sdfDist = selectCloudSDF(localPos, cloudType, 1.0);
  let sdfDensity = 1.0 - smoothstep(-0.3, 0.5, sdfDist);
  
  // === FBM Detail ===
  var fbmDetail = fbm(np * 1.0, 4) * 0.6;
  fbmDetail += fbm(np * 2.5, 3) * 0.25;
  fbmDetail += fbm(np * 6.0, 2) * 0.15;
  
  // === Worley Erosion ===
  let worleyErosion = worley3D(np * 8.0) * u.erosionStrength;
  
  // === Combine All Components ===
  // Base density from coverage and height
  var density = coverage * heightGradient;
  
  // Modulate by SDF shape (soft blend)
  density *= mix(0.3, 1.0, sdfDensity);
  
  // Add FBM detail
  density *= fbmDetail + 0.5;
  
  // Erode with Worley noise
  density -= worleyErosion * 0.3;
  
  // Apply global density control
  let threshold = 0.25 * (1.0 - u.cloudDensity);
  density = smoothstep(threshold, threshold + 0.2, density);
  
  // Boost density in precipitation areas
  density *= 1.0 + precipitation * 0.3;
  
  return max(0.0, density);
}

// === Ray-Plane Intersection ===

fn rayPlaneIntersect(ro: vec3<f32>, rd: vec3<f32>, planeY: f32) -> f32 {
  if (abs(rd.y) < 0.0001) { return -1.0; }
  return (planeY - ro.y) / rd.y;
}

// === Light Marching ===

fn lightMarch(p: vec3<f32>) -> f32 {
  let sunDir = normalize(u.sunDirection);
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  let tExit = rayPlaneIntersect(p, sunDir, cloudTop);
  if (tExit < 0.0) { return 1.0; }
  
  let stepSize = min(tExit, u.cloudThickness * 0.5) / f32(LIGHT_STEPS);
  var totalDensity = 0.0;
  var pos = p + sunDir * stepSize * 0.3;
  
  for (var i = 0; i < LIGHT_STEPS; i++) {
    pos += sunDir * stepSize;
    totalDensity += cloudDensityHybrid(pos) * stepSize;
  }
  
  // Beer's Law with multi-scattering
  let beer = exp(-totalDensity * 0.5);
  let multiScatter = exp(-totalDensity * 0.12) * 0.7;
  
  return beer * 0.8 + multiScatter * 0.2;
}

// === Depth Utilities ===

fn linearizeDepth(depth: f32) -> f32 {
  let z = depth;
  return u.nearPlane * u.farPlane / (u.farPlane - z * (u.farPlane - u.nearPlane));
}

fn sampleSceneDepth(uv: vec2<f32>) -> f32 {
  let texSize = textureDimensions(depthTexture);
  let pixelCoord = vec2<i32>(uv * vec2<f32>(texSize));
  let depthSample = textureLoad(depthTexture, pixelCoord, 0);
  return linearizeDepth(depthSample);
}

// === Main Raymarching ===

struct CloudResult {
  color: vec3<f32>,
  alpha: f32,
  depth: f32,
}

fn raymarchClouds(ro: vec3<f32>, rd: vec3<f32>, sceneDepth: f32, dither: f32) -> CloudResult {
  var result: CloudResult;
  result.color = vec3<f32>(0.0);
  result.alpha = 0.0;
  result.depth = MAX_DIST;
  
  let cloudBottom = u.cloudAltitude;
  let cloudTop = u.cloudAltitude + u.cloudThickness;
  
  // Calculate ray intersection with cloud layer
  var tEnter: f32;
  var tExit: f32;
  
  if (ro.y < cloudBottom) {
    if (rd.y <= 0.0) { return result; }
    tEnter = rayPlaneIntersect(ro, rd, cloudBottom);
    tExit = rayPlaneIntersect(ro, rd, cloudTop);
  } else if (ro.y > cloudTop) {
    if (rd.y >= 0.0) { return result; }
    tEnter = rayPlaneIntersect(ro, rd, cloudTop);
    tExit = rayPlaneIntersect(ro, rd, cloudBottom);
  } else {
    tEnter = 0.0;
    if (rd.y > 0.0) {
      tExit = rayPlaneIntersect(ro, rd, cloudTop);
    } else if (rd.y < 0.0) {
      tExit = rayPlaneIntersect(ro, rd, cloudBottom);
    } else {
      tExit = MAX_DIST;
    }
  }
  
  if (tExit < 0.0 || tEnter > MAX_DIST) { return result; }
  
  tEnter = max(tEnter, 0.0);
  tExit = min(tExit, MAX_DIST);
  
  // Scene occlusion
  if (sceneDepth < tEnter && sceneDepth < u.farPlane * 0.99) { return result; }
  if (sceneDepth < tExit && sceneDepth < u.farPlane * 0.99) { tExit = sceneDepth; }
  
  let rayLength = tExit - tEnter;
  if (rayLength <= 0.0) { return result; }
  
  let stepSize = rayLength / f32(MAX_STEPS);
  
  var transmittance = 1.0;
  var lightAccum = vec3<f32>(0.0);
  var firstHitDepth = MAX_DIST;
  
  var t = tEnter + stepSize * dither;
  let sunDir = normalize(u.sunDirection);
  
  for (var i = 0; i < MAX_STEPS; i++) {
    if (transmittance < MIN_TRANSMITTANCE) { break; }
    
    let pos = ro + rd * t;
    let density = cloudDensityHybrid(pos);
    
    if (density > 0.0) {
      // Record first hit depth
      if (firstHitDepth >= MAX_DIST) {
        firstHitDepth = t;
      }
      
      // Light contribution
      let lightAmount = lightMarch(pos);
      
      // Height-based color variation
      let heightFrac = saturate((pos.y - cloudBottom) / u.cloudThickness);
      
      // Direct sunlight
      let directLight = vec3<f32>(lightAmount) * u.sunColor;
      
      // Ambient from sky
      let ambientLight = u.skyColor * (0.15 + heightFrac * 0.1);
      
      // Silver lining effect (rim light at edges)
      let viewDotSun = dot(rd, sunDir);
      let silverLining = pow(saturate(viewDotSun + 0.3), 3.0) * 0.2;
      
      let sampleColor = directLight + ambientLight + vec3<f32>(silverLining) * u.sunColor;
      lightAccum += sampleColor * density * transmittance * stepSize * 2.0;
      
      transmittance *= exp(-density * stepSize * 0.8);
    }
    
    t += stepSize;
  }
  
  let cloudAlpha = 1.0 - transmittance;
  
  // Final cloud color
  var cloudColor = vec3<f32>(0.95, 0.97, 1.0) * (lightAccum + u.skyColor * 0.2);
  cloudColor = clamp(cloudColor, vec3<f32>(0.1), vec3<f32>(1.2));
  
  result.color = cloudColor;
  result.alpha = cloudAlpha;
  result.depth = firstHitDepth;
  
  return result;
}

// === Vertex Shader ===

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  let x = f32((vertexIndex << 1u) & 2u);
  let y = f32(vertexIndex & 2u);
  output.position = vec4<f32>(x * 2.0 - 1.0, y * -2.0 + 1.0, 0.0, 1.0);
  output.uv = vec2<f32>(x, 1.0 - y);
  return output;
}

// === Fragment Shader ===

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let ndc = vec2<f32>(input.uv.x * 2.0 - 1.0, input.uv.y * 2.0 - 1.0);
  let clipPos = vec4<f32>(ndc, 1.0, 1.0);
  let worldPos4 = u.viewProjectionInverse * clipPos;
  let worldTarget = worldPos4.xyz / worldPos4.w;
  let rayDir = normalize(worldTarget - u.cameraPosition);
  
  // Blue noise dithering
  let noiseUV = (input.uv * vec2<f32>(u.screenWidth, u.screenHeight)) / 64.0;
  let timeFrame = floor(u.time * 60.0);
  let goldenOffset = vec2<f32>(
    fract(timeFrame * 0.7548776662466927),
    fract(timeFrame * 0.5698402909980532)
  );
  let dither = textureSample(blueNoiseTex, blueNoiseSampler, noiseUV + goldenOffset).r;
  
  // Horizon fade
  let horizonFade = smoothstep(-0.03, 0.12, rayDir.y);
  if (horizonFade <= 0.0) { return vec4<f32>(0.0); }
  
  let sceneDepth = sampleSceneDepth(input.uv);
  
  let cloudResult = raymarchClouds(u.cameraPosition, rayDir, sceneDepth, dither);
  
  let fadedAlpha = cloudResult.alpha * horizonFade;
  return vec4<f32>(cloudResult.color * fadedAlpha, fadedAlpha);
}


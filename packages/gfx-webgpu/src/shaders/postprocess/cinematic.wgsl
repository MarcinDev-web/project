// Cinematic Post-Processing Shader
// Includes: Depth of Field, Chromatic Aberration, Vignette, Film Grain

struct CinematicParams {
    dofFocusDistance: f32,
    dofFocusRange: f32,
    dofBlurRadius: f32,
    chromaticAberrationStrength: f32,
    vignetteIntensity: f32,
    vignetteRoundness: f32,
    grainIntensity: f32,
    time: f32,
};

@group(0) @binding(0) var<uniform> params : CinematicParams;
@group(0) @binding(1) var inputTexture : texture_2d<f32>;
@group(0) @binding(2) var depthTexture : texture_depth_2d;
@group(0) @binding(3) var outputTexture : texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var linearSampler : sampler;

// Helper to linearize depth
fn linearizeDepth(depth: f32, near: f32, far: f32) -> f32 {
    let z = depth * 2.0 - 1.0;
    return (2.0 * near * far) / (far + near - z * (far - near));
}

// Helper random
fn hash(n: f32) -> f32 {
    return fract(sin(n) * 43758.5453);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let dims = textureDimensions(outputTexture);
    if (id.x >= dims.x || id.y >= dims.y) {
        return;
    }

    let uv = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(dims);
    
    // 1. Depth of Field (Simplified Poisson Disc)
    // Calculate CoC (Circle of Confusion)
    let depth = textureLoad(depthTexture, id.xy, 0);
    // Note: Assuming standard perspective projection, we need linear depth for DoF
    // For now, using raw depth difference as proxy or uniform values need to be tuned.
    
    // let linearD = linearizeDepth(depth, 0.1, 1000.0); 
    // let coc = abs(linearD - params.dofFocusDistance) / params.dofFocusRange;
    // coc = clamp(coc, 0.0, 1.0);
    
    // Simplified DoF logic:
    // Just read center pixel for now as DoF requires gathering samples which is expensive
    // Placeholder for DoF gather loop:
    var color = textureSampleLevel(inputTexture, linearSampler, uv, 0.0).rgb;
    
    // 2. Chromatic Aberration
    // Shift channels based on distance from center
    let distFromCenter = length(uv - 0.5);
    let offset = distFromCenter * params.chromaticAberrationStrength * 0.02;
    
    let r = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(offset, 0.0), 0.0).r;
    let g = textureSampleLevel(inputTexture, linearSampler, uv, 0.0).g;
    let b = textureSampleLevel(inputTexture, linearSampler, uv - vec2<f32>(offset, 0.0), 0.0).b;
    
    color = vec3<f32>(r, g, b);

    // 3. Vignette
    let d = distFromCenter;
    let vignette = smoothstep(0.8, 0.25 * (1.0 - params.vignetteRoundness), d * (params.vignetteIntensity + 0.5));
    color *= vignette;
    
    // 4. Film Grain
    let seed = dot(uv, vec2<f32>(12.9898, 78.233)) + params.time;
    let noise = hash(seed);
    color += (noise - 0.5) * params.grainIntensity;
    
    textureStore(outputTexture, id.xy, vec4<f32>(color, 1.0));
}


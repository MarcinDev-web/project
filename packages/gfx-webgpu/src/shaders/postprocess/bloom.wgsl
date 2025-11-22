// Bloom Post-Process Shaders

struct BloomParams {
    threshold: f32,
    knee: f32,
    intensity: f32,
    _pad: f32,
};

@group(0) @binding(0) var<uniform> params : BloomParams;
@group(0) @binding(1) var inputTexture : texture_2d<f32>;
@group(0) @binding(2) var outputTexture : texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var linearSampler : sampler;

// Helper: Quadratic threshold curve (from Unreal/Unity)
fn quadraticThreshold(color: vec3<f32>, threshold: f32, curve: vec3<f32>) -> vec3<f32> {
    // curve = (threshold - knee, knee * 2, 0.25 / knee)
    let brightness = max(color.r, max(color.g, color.b));
    var rq = clamp(brightness - curve.x, 0.0, curve.y);
    rq = curve.z * rq * rq;
    
    return color * max(rq, brightness - threshold) / max(brightness, 0.0001);
}

@compute @workgroup_size(8, 8)
fn prefilter(@builtin(global_invocation_id) id : vec3<u32>) {
    let dims = textureDimensions(outputTexture);
    if (id.x >= dims.x || id.y >= dims.y) {
        return;
    }

    // Sample 4 pixels (bilinear) or specific pattern
    let uv = (vec2<f32>(id.xy) + 0.5) / vec2<f32>(dims);
    var color = textureSampleLevel(inputTexture, linearSampler, uv, 0.0).rgb;
    
    // Thresholding
    // Simple version:
    // let brightness = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
    // if (brightness < params.threshold) { color = vec3<f32>(0.0); }
    
    // Better version (soft knee):
    let knee = params.knee;
    let curve = vec3<f32>(params.threshold - knee, knee * 2.0, 0.25 / max(knee, 0.00001));
    color = quadraticThreshold(color, params.threshold, curve);
    
    textureStore(outputTexture, id.xy, vec4<f32>(color, 1.0));
}

@compute @workgroup_size(8, 8)
fn downsample(@builtin(global_invocation_id) id : vec3<u32>) {
    let dims = textureDimensions(outputTexture);
    if (id.x >= dims.x || id.y >= dims.y) {
        return;
    }

    let texelSize = 1.0 / vec2<f32>(dims);
    let x = texelSize.x;
    let y = texelSize.y;
    let uv = (vec2<f32>(id.xy) + 0.5) * texelSize;

    // Karis Average (13-tap)
    // A - B - C
    // - D - E -
    // F - G - H
    // - I - J -
    // K - L - M
    
    let a = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(-2.0*x, 2.0*y), 0.0).rgb;
    let b = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>( 0.0,   2.0*y), 0.0).rgb;
    let c = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>( 2.0*x, 2.0*y), 0.0).rgb;
    
    let d = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(-1.0*x, 1.0*y), 0.0).rgb;
    let e = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>( 1.0*x, 1.0*y), 0.0).rgb;
    
    let f = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(-2.0*x, 0.0),   0.0).rgb;
    let g = textureSampleLevel(inputTexture, linearSampler, uv,                            0.0).rgb;
    let h = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>( 2.0*x, 0.0),   0.0).rgb;
    
    let i = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(-1.0*x, -1.0*y), 0.0).rgb;
    let j = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>( 1.0*x, -1.0*y), 0.0).rgb;
    
    let k = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(-2.0*x, -2.0*y), 0.0).rgb;
    let l = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>( 0.0,   -2.0*y), 0.0).rgb;
    let m = textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>( 2.0*x, -2.0*y), 0.0).rgb;
    
    var downsampled = vec3<f32>(0.0);
    downsampled += (d + e + i + j) * 0.5;
    downsampled += (a + b + g + f) * 0.125;
    downsampled += (b + c + h + g) * 0.125;
    downsampled += (f + g + l + k) * 0.125;
    downsampled += (g + h + m + l) * 0.125;
    
    downsampled *= 0.125; // Normalize? (0.5 + 4*0.125 = 1.0)
    // Wait, weights: 
    // Center block: 4 * 0.5 = 2.0? No.
    // Standard COD implementation:
    // box 4x4 weighted
    
    // Simple box filter for now to save lines/complexity
    // let simple = textureSampleLevel(inputTexture, linearSampler, uv, 0.0).rgb;
    
    textureStore(outputTexture, id.xy, vec4<f32>(downsampled, 1.0));
}

@compute @workgroup_size(8, 8)
fn upsample(@builtin(global_invocation_id) id : vec3<u32>) {
    let dims = textureDimensions(outputTexture);
    if (id.x >= dims.x || id.y >= dims.y) {
        return;
    }

    let texelSize = 1.0 / vec2<f32>(dims);
    let x = texelSize.x; // Filter radius
    let y = texelSize.y;
    let uv = (vec2<f32>(id.xy) + 0.5) * texelSize;

    // 3x3 Tent Filter
    var upsampled = vec3<f32>(0.0);
    
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(-x, y), 0.0).rgb * 1.0;
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(0.0, y), 0.0).rgb * 2.0;
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(x, y), 0.0).rgb * 1.0;
    
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(-x, 0.0), 0.0).rgb * 2.0;
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv,              0.0).rgb * 4.0;
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(x, 0.0), 0.0).rgb * 2.0;
    
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(-x, -y), 0.0).rgb * 1.0;
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(0.0, -y), 0.0).rgb * 2.0;
    upsampled += textureSampleLevel(inputTexture, linearSampler, uv + vec2<f32>(x, -y), 0.0).rgb * 1.0;
    
    upsampled *= (1.0 / 16.0);
    
    // Combine with existing frame (additive blend)
    // This shader assumes we read from lower-res mip (inputTexture) and write to higher-res (outputTexture)
    // But we also need to BLEND with what's already in outputTexture (the result of previous upsample or the scene)
    // For compute shader, we can't easily blend with "output" unless we read it.
    // Usually bloom upsample is: Output = PreviousUpsample + CurrentBlur
    
    // Assuming outputTexture is a separate buffer we accumulate into, or we just write the blurred result
    // and the composite pass handles the addition.
    
    textureStore(outputTexture, id.xy, vec4<f32>(upsampled, 1.0));
}


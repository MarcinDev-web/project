// Noise Library
// Implementation of common noise functions

// 3D Value Noise
fn hash(n: f32) -> f32 {
    return fract(sin(n) * 43758.5453);
}

fn noise3d(x: vec3<f32>) -> f32 {
    let p = floor(x);
    let f = fract(x);
    let f_smooth = f * f * (3.0 - 2.0 * f);
    
    let n = p.x + p.y * 57.0 + p.z * 113.0;
    
    return mix(
        mix(
            mix(hash(n + 0.0), hash(n + 1.0), f_smooth.x),
            mix(hash(n + 57.0), hash(n + 58.0), f_smooth.x),
            f_smooth.y
        ),
        mix(
            mix(hash(n + 113.0), hash(n + 114.0), f_smooth.x),
            mix(hash(n + 170.0), hash(n + 171.0), f_smooth.x),
            f_smooth.y
        ),
        f_smooth.z
    );
}

// Simplex Noise (Stub - simplified version for now)
fn simplex3d(v: vec3<f32>) -> f32 {
    // TODO: Implement full Simplex noise
    // For now, fallback to value noise
    return noise3d(v) * 2.0 - 1.0;
}

// FBM (Fractal Brownian Motion)
fn fbm(p: vec3<f32>, octaves: i32, lacunarity: f32, gain: f32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var currentP = p;
    
    for (var i = 0; i < octaves; i++) {
        value += amplitude * noise3d(currentP);
        currentP = currentP * lacunarity;
        amplitude = amplitude * gain;
    }
    
    return value;
}


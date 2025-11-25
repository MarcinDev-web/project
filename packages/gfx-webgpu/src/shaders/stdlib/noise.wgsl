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

fn mod289_v3(x: vec3<f32>) -> vec3<f32> {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_v4(x: vec4<f32>) -> vec4<f32> {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec4<f32>) -> vec4<f32> {
    return mod289_v4((x * 34.0 + 1.0) * x);
}

fn taylorInvSqrt(r: vec4<f32>) -> vec4<f32> {
    return 1.79284291400159 - 0.85373472095314 * r;
}

// Simplex Noise (full 3D implementation)
fn simplex3d(v: vec3<f32>) -> f32 {
    let C = vec2<f32>(1.0 / 6.0, 1.0 / 3.0);
    let D = vec4<f32>(0.0, 0.5, 1.0, 2.0);

    // First corner
    var i = floor(v + dot(v, C.yyy));
    let x0 = v - i + dot(i, C.xxx);

    // Other corners
    let g = step(x0.yzx, x0.xyz);
    let l = 1.0 - g;
    let i1 = min(g, l.zxy);
    let i2 = max(g, l.zxy);

    let x1 = x0 - i1 + C.xxx;
    let x2 = x0 - i2 + C.yyy;
    let x3 = x0 - D.yyy;

    // Permutations
    i = mod289_v3(i);
    let p = permute(
        permute(
            permute(i.z + vec4<f32>(0.0, i1.z, i2.z, 1.0)) + i.y + vec4<f32>(0.0, i1.y, i2.y, 1.0)
        ) + i.x + vec4<f32>(0.0, i1.x, i2.x, 1.0)
    );

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    let n_ = 1.0 / 7.0;
    let ns = n_ * D.wyz - D.xzx;

    let j = p - 49.0 * floor(p * ns.z * ns.z);

    let x_ = floor(j * ns.z);
    let y_ = floor(j - 7.0 * x_);

    let x = x_ * ns.x + ns.yyyy;
    let y = y_ * ns.x + ns.yyyy;
    let h = 1.0 - abs(x) - abs(y);

    let b0 = vec4<f32>(x.x, x.y, y.x, y.y);
    let b1 = vec4<f32>(x.z, x.w, y.z, y.w);

    let s0 = floor(b0) * 2.0 + 1.0;
    let s1 = floor(b1) * 2.0 + 1.0;
    let sh = -step(h, vec4<f32>(0.0));

    let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    let a1 = b1.xzyw + s1.xzyw * sh.zzww;

    var p0 = vec3<f32>(a0.x, a0.y, h.x);
    var p1 = vec3<f32>(a0.z, a0.w, h.y);
    var p2 = vec3<f32>(a1.x, a1.y, h.z);
    var p3 = vec3<f32>(a1.z, a1.w, h.w);

    // Normalize gradients
    let norm = taylorInvSqrt(vec4<f32>(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 = p0 * norm.x;
    p1 = p1 * norm.y;
    p2 = p2 * norm.z;
    p3 = p3 * norm.w;

    let m = max(0.6 - vec4<f32>(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4<f32>(0.0));
    let m2 = m * m;
    let m4 = m2 * m2;

    return 42.0 * dot(m4, vec4<f32>(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
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


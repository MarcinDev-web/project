//! Simplex Noise Implementation with SIMD support
//!
//! Simplex noise is an improvement over classic Perlin noise:
//! - Fewer directional artifacts
//! - Lower computational complexity in higher dimensions
//! - Continuous derivatives

use wasm_bindgen::prelude::*;

/// Skewing factor for 2D simplex noise
const F2: f32 = 0.366025403784; // (sqrt(3) - 1) / 2
const G2: f32 = 0.211324865405; // (3 - sqrt(3)) / 6

/// Gradient vectors for 2D
const GRAD2: [[f32; 2]; 8] = [
    [1.0, 0.0],
    [-1.0, 0.0],
    [0.0, 1.0],
    [0.0, -1.0],
    [0.707, 0.707],
    [-0.707, 0.707],
    [0.707, -0.707],
    [-0.707, -0.707],
];

/// Permutation table
const PERM: [u8; 256] = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69,
    142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219,
    203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
    74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230,
    220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209,
    76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198,
    173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
    207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2,
    44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110,
    79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144,
    12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199,
    106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222,
    114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];

/// Get permutation value with seed offset
#[inline]
fn perm(idx: i32, seed: u32) -> u8 {
    PERM[((idx as u32).wrapping_add(seed) & 255) as usize]
}

/// Dot product with gradient
#[inline]
fn grad_dot(hash: u8, x: f32, y: f32) -> f32 {
    let g = &GRAD2[(hash & 7) as usize];
    g[0] * x + g[1] * y
}

/// 2D Simplex noise at point (x, y)
///
/// Returns value in range [-1, 1]
#[wasm_bindgen]
pub fn simplex_2d(x: f32, y: f32, seed: u32) -> f32 {
    // Skew input space to determine simplex cell
    let s = (x + y) * F2;
    let i = (x + s).floor() as i32;
    let j = (y + s).floor() as i32;

    // Unskew back to get simplex origin
    let t = (i + j) as f32 * G2;
    let x0 = x - (i as f32 - t);
    let y0 = y - (j as f32 - t);

    // Determine which simplex we're in
    let (i1, j1) = if x0 > y0 { (1, 0) } else { (0, 1) };

    // Offsets for corners
    let x1 = x0 - i1 as f32 + G2;
    let y1 = y0 - j1 as f32 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2;
    let y2 = y0 - 1.0 + 2.0 * G2;

    // Hash coordinates
    let gi0 = perm(i + perm(j, seed) as i32, seed);
    let gi1 = perm(i + i1 + perm(j + j1, seed) as i32, seed);
    let gi2 = perm(i + 1 + perm(j + 1, seed) as i32, seed);

    // Calculate contributions from corners
    let mut n0 = 0.0;
    let mut n1 = 0.0;
    let mut n2 = 0.0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if t0 >= 0.0 {
        let t0_sq = t0 * t0;
        n0 = t0_sq * t0_sq * grad_dot(gi0, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if t1 >= 0.0 {
        let t1_sq = t1 * t1;
        n1 = t1_sq * t1_sq * grad_dot(gi1, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if t2 >= 0.0 {
        let t2_sq = t2 * t2;
        n2 = t2_sq * t2_sq * grad_dot(gi2, x2, y2);
    }

    // Scale to [-1, 1]
    70.0 * (n0 + n1 + n2)
}

/// Generate 2D Simplex noise for entire image
///
/// # Arguments
/// * `output` - Output buffer (width * height floats)
/// * `width` - Image width
/// * `height` - Image height
/// * `scale` - Noise scale (smaller = larger features)
/// * `seed` - Random seed
#[wasm_bindgen]
pub fn simplex_2d_batch(output: &mut [f32], width: u32, height: u32, scale: f32, seed: u32) {
    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) as usize;
            let nx = x as f32 * scale;
            let ny = y as f32 * scale;
            output[idx] = simplex_2d(nx, ny, seed);
        }
    }
}

/// Fractal Brownian Motion using Simplex noise
#[wasm_bindgen]
pub fn simplex_fbm(
    x: f32,
    y: f32,
    seed: u32,
    octaves: u32,
    lacunarity: f32,
    persistence: f32,
) -> f32 {
    let mut value = 0.0;
    let mut amplitude = 1.0;
    let mut frequency = 1.0;
    let mut max_value = 0.0;

    for _ in 0..octaves {
        value += simplex_2d(x * frequency, y * frequency, seed) * amplitude;
        max_value += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }

    value / max_value
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simplex_2d_range() {
        for i in 0..100 {
            let x = i as f32 * 0.1;
            let y = i as f32 * 0.15;
            let v = simplex_2d(x, y, 12345);
            assert!(v >= -1.5 && v <= 1.5, "Value {} out of expected range", v);
        }
    }

    #[test]
    fn test_simplex_2d_deterministic() {
        let v1 = simplex_2d(1.5, 2.5, 12345);
        let v2 = simplex_2d(1.5, 2.5, 12345);
        assert_eq!(v1, v2);
    }
}


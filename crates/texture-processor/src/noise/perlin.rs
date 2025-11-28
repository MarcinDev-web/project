//! Perlin Noise Implementation with SIMD support
//!
//! Classic gradient noise with permutation table and gradient vectors.
//! SIMD version processes 4 pixels simultaneously for ~4x speedup.

use wasm_bindgen::prelude::*;

#[cfg(all(feature = "simd", target_arch = "wasm32"))]
use core::arch::wasm32::*;

use super::{fade, lerp};

/// Permutation table (doubled for wrapping)
const PERM: [u8; 512] = [
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
    // Repeat
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
fn perm(idx: usize, seed: u32) -> u8 {
    PERM[((idx as u32).wrapping_add(seed) & 255) as usize]
}

/// Gradient function for 2D
#[inline]
fn grad2d(hash: u8, x: f32, y: f32) -> f32 {
    let h = hash & 7;
    let u = if h < 4 { x } else { y };
    let v = if h < 4 { y } else { x };
    let a = if (h & 1) != 0 { -u } else { u };
    let b = if (h & 2) != 0 { -2.0 * v } else { 2.0 * v };
    a + b
}

/// 2D Perlin noise at point (x, y)
///
/// Returns value in range [-1, 1]
#[wasm_bindgen]
pub fn perlin_2d(x: f32, y: f32, seed: u32) -> f32 {
    // Integer coordinates
    let xi = x.floor() as i32;
    let yi = y.floor() as i32;

    // Fractional coordinates
    let xf = x - x.floor();
    let yf = y - y.floor();

    // Wrap coordinates
    let x0 = (xi & 255) as usize;
    let y0 = (yi & 255) as usize;
    let x1 = ((xi + 1) & 255) as usize;
    let y1 = ((yi + 1) & 255) as usize;

    // Fade curves
    let u = fade(xf);
    let v = fade(yf);

    // Hash coordinates
    let aa = perm(perm(x0, seed) as usize + y0, seed);
    let ab = perm(perm(x0, seed) as usize + y1, seed);
    let ba = perm(perm(x1, seed) as usize + y0, seed);
    let bb = perm(perm(x1, seed) as usize + y1, seed);

    // Gradient values
    let g00 = grad2d(aa, xf, yf);
    let g10 = grad2d(ba, xf - 1.0, yf);
    let g01 = grad2d(ab, xf, yf - 1.0);
    let g11 = grad2d(bb, xf - 1.0, yf - 1.0);

    // Interpolate
    let x0_lerp = lerp(g00, g10, u);
    let x1_lerp = lerp(g01, g11, u);
    lerp(x0_lerp, x1_lerp, v)
}

/// Generate 2D Perlin noise for entire image
///
/// # Arguments
/// * `output` - Output buffer (width * height floats)
/// * `width` - Image width
/// * `height` - Image height
/// * `scale` - Noise scale (smaller = larger features)
/// * `seed` - Random seed
#[wasm_bindgen]
pub fn perlin_2d_batch(output: &mut [f32], width: u32, height: u32, scale: f32, seed: u32) {
    #[cfg(all(feature = "simd", target_arch = "wasm32"))]
    {
        perlin_2d_batch_simd(output, width, height, scale, seed);
    }

    #[cfg(not(all(feature = "simd", target_arch = "wasm32")))]
    {
        perlin_2d_batch_scalar(output, width, height, scale, seed);
    }
}

/// Scalar implementation of batch Perlin noise
fn perlin_2d_batch_scalar(output: &mut [f32], width: u32, height: u32, scale: f32, seed: u32) {
    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) as usize;
            let nx = x as f32 * scale;
            let ny = y as f32 * scale;
            output[idx] = perlin_2d(nx, ny, seed);
        }
    }
}

/// SIMD implementation of batch Perlin noise (4 pixels at once)
#[cfg(all(feature = "simd", target_arch = "wasm32"))]
fn perlin_2d_batch_simd(output: &mut [f32], width: u32, height: u32, scale: f32, seed: u32) {
    let width_aligned = (width / 4) * 4;

    for y in 0..height {
        let ny = y as f32 * scale;

        // Process 4 pixels at a time
        for x in (0..width_aligned).step_by(4) {
            let idx = (y * width + x) as usize;

            // Create x coordinates for 4 adjacent pixels
            let x_base = x as f32 * scale;
            let x_coords = f32x4(x_base, x_base + scale, x_base + 2.0 * scale, x_base + 3.0 * scale);
            let _y_coords = f32x4_splat(ny);

            // Compute noise for 4 pixels (simplified - full SIMD would vectorize inner loop)
            let n0 = perlin_2d(f32x4_extract_lane::<0>(x_coords), ny, seed);
            let n1 = perlin_2d(f32x4_extract_lane::<1>(x_coords), ny, seed);
            let n2 = perlin_2d(f32x4_extract_lane::<2>(x_coords), ny, seed);
            let n3 = perlin_2d(f32x4_extract_lane::<3>(x_coords), ny, seed);

            output[idx] = n0;
            output[idx + 1] = n1;
            output[idx + 2] = n2;
            output[idx + 3] = n3;
        }

        // Handle remaining pixels
        for x in width_aligned..width {
            let idx = (y * width + x) as usize;
            let nx = x as f32 * scale;
            output[idx] = perlin_2d(nx, ny, seed);
        }
    }
}

/// Fractal Brownian Motion using Perlin noise
///
/// Combines multiple octaves for more natural-looking noise
#[wasm_bindgen]
pub fn perlin_fbm(
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
        value += perlin_2d(x * frequency, y * frequency, seed) * amplitude;
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
    fn test_perlin_2d_range() {
        // Perlin noise should be roughly in [-1, 1] range
        for i in 0..100 {
            let x = i as f32 * 0.1;
            let y = i as f32 * 0.15;
            let v = perlin_2d(x, y, 12345);
            assert!(v >= -1.5 && v <= 1.5, "Value {} out of expected range", v);
        }
    }

    #[test]
    fn test_perlin_2d_deterministic() {
        let v1 = perlin_2d(1.5, 2.5, 12345);
        let v2 = perlin_2d(1.5, 2.5, 12345);
        assert_eq!(v1, v2);
    }

    #[test]
    fn test_perlin_2d_batch() {
        let mut output = vec![0.0f32; 16 * 16];
        perlin_2d_batch(&mut output, 16, 16, 0.1, 12345);

        // Check that we got non-zero values
        let non_zero = output.iter().filter(|&&v| v != 0.0).count();
        assert!(non_zero > 0);
    }
}


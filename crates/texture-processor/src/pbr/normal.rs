//! Normal Map Generation
//!
//! Generates tangent-space normal maps from height data using Sobel operator.

use wasm_bindgen::prelude::*;

/// Generate normal map from height data using Sobel operator
///
/// # Arguments
/// * `height_data` - Height map (width * height floats in 0-1 range)
/// * `output` - Output RGBA buffer (width * height * 4 bytes)
/// * `width` - Texture width
/// * `height` - Texture height
/// * `strength` - Normal map intensity (1.0 = subtle, 3.0+ = strong)
#[wasm_bindgen]
pub fn generate_normal_map(
    height_data: &[f32],
    output: &mut [u8],
    width: u32,
    height: u32,
    strength: f32,
) {
    #[cfg(all(feature = "simd", target_arch = "wasm32"))]
    {
        generate_normal_map_simd(height_data, output, width, height, strength);
    }

    #[cfg(not(all(feature = "simd", target_arch = "wasm32")))]
    {
        generate_normal_map_scalar(height_data, output, width, height, strength);
    }
}

/// Scalar implementation of normal map generation
fn generate_normal_map_scalar(
    height_data: &[f32],
    output: &mut [u8],
    width: u32,
    height: u32,
    strength: f32,
) {
    let w = width as i32;
    let h = height as i32;

    // Helper to get height with boundary clamping
    let get_height = |x: i32, y: i32| -> f32 {
        let cx = x.clamp(0, w - 1) as usize;
        let cy = y.clamp(0, h - 1) as usize;
        height_data[cy * width as usize + cx]
    };

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            let xi = x as i32;
            let yi = y as i32;

            // Sobel operator for X gradient
            let gx = -get_height(xi - 1, yi - 1) - 2.0 * get_height(xi - 1, yi) - get_height(xi - 1, yi + 1)
                   + get_height(xi + 1, yi - 1) + 2.0 * get_height(xi + 1, yi) + get_height(xi + 1, yi + 1);

            // Sobel operator for Y gradient
            let gy = -get_height(xi - 1, yi - 1) - 2.0 * get_height(xi, yi - 1) - get_height(xi + 1, yi - 1)
                   + get_height(xi - 1, yi + 1) + 2.0 * get_height(xi, yi + 1) + get_height(xi + 1, yi + 1);

            // Apply strength
            let gx = gx * strength;
            let gy = gy * strength;

            // Compute normal vector
            let mut nx = -gx;
            let mut ny = -gy;
            let mut nz = 1.0;

            // Normalize
            let len = (nx * nx + ny * ny + nz * nz).sqrt();
            if len > 0.0001 {
                nx /= len;
                ny /= len;
                nz /= len;
            }

            // Convert from [-1, 1] to [0, 255]
            output[idx] = ((nx * 0.5 + 0.5) * 255.0) as u8;     // R = X
            output[idx + 1] = ((ny * 0.5 + 0.5) * 255.0) as u8; // G = Y
            output[idx + 2] = ((nz * 0.5 + 0.5) * 255.0) as u8; // B = Z
            output[idx + 3] = 255;                               // A = 1
        }
    }
}

/// SIMD implementation (processes 4 pixels horizontally)
#[cfg(all(feature = "simd", target_arch = "wasm32"))]
fn generate_normal_map_simd(
    height_data: &[f32],
    output: &mut [u8],
    width: u32,
    height: u32,
    strength: f32,
) {
    // For simplicity, fall back to scalar for now
    // Full SIMD implementation would process 4 pixels simultaneously
    generate_normal_map_scalar(height_data, output, width, height, strength);
}

/// Generate flat normal map (pointing straight up)
///
/// Useful as fallback or for completely flat surfaces
#[wasm_bindgen]
pub fn generate_flat_normal_map(output: &mut [u8], width: u32, height: u32) {
    // Flat normal: (0, 0, 1) -> (128, 128, 255)
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            output[idx] = 128;     // X = 0
            output[idx + 1] = 128; // Y = 0
            output[idx + 2] = 255; // Z = 1
            output[idx + 3] = 255; // A
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_flat_normal_map() {
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_flat_normal_map(&mut output, 16, 16);

        // Check first pixel
        assert_eq!(output[0], 128); // X
        assert_eq!(output[1], 128); // Y
        assert_eq!(output[2], 255); // Z
        assert_eq!(output[3], 255); // A
    }

    #[test]
    fn test_normal_map_from_height() {
        let height_data = vec![0.5f32; 16 * 16];
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_normal_map(&height_data, &mut output, 16, 16, 2.0);

        // Flat height should produce near-flat normal
        // Center pixels should be close to (128, 128, 255)
        let center_idx = (8 * 16 + 8) * 4;
        assert!(output[center_idx + 2] > 200); // Z should be high
    }
}


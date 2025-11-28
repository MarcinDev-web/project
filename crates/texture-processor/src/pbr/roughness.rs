//! Roughness Map Generation
//!
//! Generates roughness maps for PBR materials.
//! Roughness: 0 = perfectly smooth (mirror), 1 = completely rough (matte)

use wasm_bindgen::prelude::*;
use crate::noise::{perlin, clamp01};

/// Generate roughness map with noise variation
///
/// # Arguments
/// * `output` - Output RGBA buffer (width * height * 4 bytes)
/// * `width` - Texture width
/// * `height` - Texture height
/// * `base_roughness` - Base roughness value (0-1)
/// * `noise_scale` - Scale of noise pattern
/// * `noise_strength` - Strength of noise variation (0-1)
/// * `seed` - Random seed
#[wasm_bindgen]
pub fn generate_roughness_map(
    output: &mut [u8],
    width: u32,
    height: u32,
    base_roughness: f32,
    noise_scale: f32,
    noise_strength: f32,
    seed: u32,
) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            // Add noise variation
            let noise = perlin::perlin_2d(x as f32 * noise_scale, y as f32 * noise_scale, seed);
            let roughness = base_roughness + noise * noise_strength;
            let roughness = clamp01(roughness);

            let value = (roughness * 255.0) as u8;
            output[idx] = value;
            output[idx + 1] = value;
            output[idx + 2] = value;
            output[idx + 3] = 255;
        }
    }
}

/// Generate uniform roughness map
#[wasm_bindgen]
pub fn generate_uniform_roughness(output: &mut [u8], width: u32, height: u32, roughness: f32) {
    let value = (clamp01(roughness) * 255.0) as u8;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            output[idx] = value;
            output[idx + 1] = value;
            output[idx + 2] = value;
            output[idx + 3] = 255;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uniform_roughness() {
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_uniform_roughness(&mut output, 16, 16, 0.5);

        // Check first pixel (0.5 * 255 = 127)
        assert_eq!(output[0], 127);
        assert_eq!(output[1], 127);
        assert_eq!(output[2], 127);
        assert_eq!(output[3], 255);
    }
}


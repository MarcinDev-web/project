//! Metallic Map Generation
//!
//! Generates metallic maps for PBR materials.
//! Metallic: 0 = dielectric (plastic, wood), 1 = metal (iron, gold)

use wasm_bindgen::prelude::*;
use crate::Pattern;
use crate::noise::{perlin, clamp01};

/// Generate metallic map based on pattern
///
/// # Arguments
/// * `output` - Output RGBA buffer (width * height * 4 bytes)
/// * `width` - Texture width
/// * `height` - Texture height
/// * `base_metallic` - Base metallic value (0-1)
/// * `pattern` - Pattern type (affects variation)
/// * `seed` - Random seed
#[wasm_bindgen]
pub fn generate_metallic_map(
    output: &mut [u8],
    width: u32,
    height: u32,
    base_metallic: f32,
    pattern: Pattern,
    seed: u32,
) {
    match pattern {
        // Non-metallic patterns
        Pattern::Noise | Pattern::Bricks | Pattern::Planks => {
            generate_uniform_metallic(output, width, height, 0.0);
        }
        // Potentially metallic patterns
        Pattern::Smooth => {
            if base_metallic > 0.1 {
                generate_smooth_metallic(output, width, height, base_metallic, seed);
            } else {
                generate_uniform_metallic(output, width, height, 0.0);
            }
        }
        // Default: use base value
        _ => {
            generate_uniform_metallic(output, width, height, base_metallic);
        }
    }
}

/// Generate uniform metallic value
fn generate_uniform_metallic(output: &mut [u8], width: u32, height: u32, metallic: f32) {
    let value = (clamp01(metallic) * 255.0) as u8;

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

/// Generate smooth metallic with subtle variation (for brushed metal look)
fn generate_smooth_metallic(
    output: &mut [u8],
    width: u32,
    height: u32,
    base_metallic: f32,
    seed: u32,
) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            // Very subtle noise for brushed metal effect
            let noise = perlin::perlin_2d(x as f32 * 0.02, y as f32 * 0.02, seed);
            let metallic = base_metallic + noise * 0.05;
            let metallic = clamp01(metallic);

            let value = (metallic * 255.0) as u8;
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
    fn test_uniform_metallic() {
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_metallic_map(&mut output, 16, 16, 0.8, Pattern::Solid, 0);

        // Check first pixel (0.8 * 255 ≈ 204)
        assert_eq!(output[0], 204);
    }

    #[test]
    fn test_non_metallic_pattern() {
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_metallic_map(&mut output, 16, 16, 0.8, Pattern::Bricks, 0);

        // Bricks should be non-metallic
        assert_eq!(output[0], 0);
    }
}


//! Ambient Occlusion Map Generation
//!
//! Generates ambient occlusion maps for PBR materials.
//! AO: 0 = fully occluded (dark), 1 = no occlusion (fully lit)

use wasm_bindgen::prelude::*;
use crate::Pattern;
use crate::noise::{perlin, worley, clamp01};

/// Generate ambient occlusion map based on pattern
///
/// # Arguments
/// * `output` - Output RGBA buffer (width * height * 4 bytes)
/// * `width` - Texture width
/// * `height` - Texture height
/// * `pattern` - Pattern type
/// * `seed` - Random seed
#[wasm_bindgen]
pub fn generate_ao_map(
    output: &mut [u8],
    width: u32,
    height: u32,
    pattern: Pattern,
    seed: u32,
) {
    match pattern {
        Pattern::Solid | Pattern::Smooth => {
            generate_uniform_ao(output, width, height, 1.0);
        }
        Pattern::Noise => {
            generate_noise_ao(output, width, height, seed);
        }
        Pattern::Cobble => {
            generate_cobble_ao(output, width, height, seed);
        }
        Pattern::Bricks => {
            generate_brick_ao(output, width, height, seed);
        }
        Pattern::Planks => {
            generate_plank_ao(output, width, height, seed);
        }
        Pattern::Grid => {
            generate_grid_ao(output, width, height);
        }
    }
}

/// Uniform AO (no occlusion)
fn generate_uniform_ao(output: &mut [u8], width: u32, height: u32, ao: f32) {
    let value = (clamp01(ao) * 255.0) as u8;

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

/// Noise-based AO for natural surfaces
fn generate_noise_ao(output: &mut [u8], width: u32, height: u32, seed: u32) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let noise = perlin::perlin_2d(x as f32 * 0.08, y as f32 * 0.08, seed);
            let ao = 0.85 + (noise + 1.0) * 0.5 * 0.15; // 0.85 to 1.0
            let ao = clamp01(ao);

            let value = (ao * 255.0) as u8;
            output[idx] = value;
            output[idx + 1] = value;
            output[idx + 2] = value;
            output[idx + 3] = 255;
        }
    }
}

/// Cobblestone AO (darker in cracks between stones)
fn generate_cobble_ao(output: &mut [u8], width: u32, height: u32, seed: u32) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let worley_dist = worley::worley_2d(x as f32 * 0.06, y as f32 * 0.06, seed);
            // Darker at edges (high distance), lighter at centers
            let ao = 1.0 - worley_dist * 0.3;
            let ao = clamp01(ao);

            let value = (ao * 255.0) as u8;
            output[idx] = value;
            output[idx + 1] = value;
            output[idx + 2] = value;
            output[idx + 3] = 255;
        }
    }
}

/// Brick AO (darker in mortar lines)
fn generate_brick_ao(output: &mut [u8], width: u32, height: u32, seed: u32) {
    let brick_width = width / 4;
    let brick_height = height / 8;
    let mortar_size = 2u32;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let row = y / brick_height;
            let offset = if row % 2 == 0 { 0 } else { brick_width / 2 };
            let bx = (x + offset) % brick_width;
            let by = y % brick_height;

            let is_mortar = bx < mortar_size || by < mortar_size;

            let ao = if is_mortar {
                0.5 // Darker in mortar
            } else {
                // Slight variation within bricks
                let noise = perlin::perlin_2d(x as f32 * 0.1, y as f32 * 0.1, seed);
                0.9 + noise * 0.1
            };

            let value = (clamp01(ao) * 255.0) as u8;
            output[idx] = value;
            output[idx + 1] = value;
            output[idx + 2] = value;
            output[idx + 3] = 255;
        }
    }
}

/// Plank AO (darker in gaps between planks)
fn generate_plank_ao(output: &mut [u8], width: u32, height: u32, seed: u32) {
    let plank_width = width / 4;
    let gap_size = 1u32;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let px = x % plank_width;
            let is_gap = px < gap_size;

            let ao = if is_gap {
                0.4 // Dark gaps
            } else {
                // Subtle grain variation
                let noise = perlin::perlin_2d(x as f32 * 0.05, y as f32 * 0.05, seed);
                0.9 + noise * 0.1
            };

            let value = (clamp01(ao) * 255.0) as u8;
            output[idx] = value;
            output[idx + 1] = value;
            output[idx + 2] = value;
            output[idx + 3] = 255;
        }
    }
}

/// Grid AO (darker on lines)
fn generate_grid_ao(output: &mut [u8], width: u32, height: u32) {
    let cell_size = width / 8;
    let line_width = 1u32;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let cx = x % cell_size;
            let cy = y % cell_size;
            let is_line = cx < line_width || cy < line_width;

            let ao = if is_line { 0.6 } else { 1.0 };

            let value = (ao * 255.0) as u8;
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
    fn test_uniform_ao() {
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_ao_map(&mut output, 16, 16, Pattern::Solid, 0);

        // Should be fully lit (255)
        assert_eq!(output[0], 255);
    }
}


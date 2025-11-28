//! Albedo (Base Color) Texture Generation
//!
//! Generates base color textures with pattern variations.

use crate::Pattern;
use crate::noise::{perlin, worley, clamp01};

/// Generate albedo texture with pattern variation
///
/// # Arguments
/// * `output` - Output RGBA buffer (width * height * 4 bytes)
/// * `width` - Texture width
/// * `height` - Texture height
/// * `color` - Base color [R, G, B, A] in 0-1 range
/// * `pattern` - Pattern type
/// * `seed` - Random seed
pub fn generate_albedo(
    output: &mut [u8],
    width: u32,
    height: u32,
    color: [f32; 4],
    pattern: Pattern,
    seed: u32,
) {
    match pattern {
        Pattern::Solid => generate_solid(output, width, height, color),
        Pattern::Smooth => generate_smooth(output, width, height, color, seed),
        Pattern::Noise => generate_noise(output, width, height, color, seed),
        Pattern::Cobble => generate_cobble(output, width, height, color, seed),
        Pattern::Bricks => generate_bricks(output, width, height, color, seed),
        Pattern::Planks => generate_planks(output, width, height, color, seed),
        Pattern::Grid => generate_grid(output, width, height, color),
    }
}

/// Solid color fill
fn generate_solid(output: &mut [u8], width: u32, height: u32, color: [f32; 4]) {
    let r = (color[0] * 255.0) as u8;
    let g = (color[1] * 255.0) as u8;
    let b = (color[2] * 255.0) as u8;
    let a = (color[3] * 255.0) as u8;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            output[idx] = r;
            output[idx + 1] = g;
            output[idx + 2] = b;
            output[idx + 3] = a;
        }
    }
}

/// Smooth gradient with subtle variation
fn generate_smooth(output: &mut [u8], width: u32, height: u32, color: [f32; 4], seed: u32) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            // Subtle noise variation
            let noise = perlin::perlin_2d(x as f32 * 0.05, y as f32 * 0.05, seed);
            let variation = 1.0 + noise * 0.05;

            output[idx] = (clamp01(color[0] * variation) * 255.0) as u8;
            output[idx + 1] = (clamp01(color[1] * variation) * 255.0) as u8;
            output[idx + 2] = (clamp01(color[2] * variation) * 255.0) as u8;
            output[idx + 3] = (color[3] * 255.0) as u8;
        }
    }
}

/// Perlin noise pattern
fn generate_noise(output: &mut [u8], width: u32, height: u32, color: [f32; 4], seed: u32) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let noise = perlin::perlin_2d(x as f32 * 0.08, y as f32 * 0.08, seed);
            let variation = 0.85 + (noise + 1.0) * 0.5 * 0.3; // 0.85 to 1.15

            output[idx] = (clamp01(color[0] * variation) * 255.0) as u8;
            output[idx + 1] = (clamp01(color[1] * variation) * 255.0) as u8;
            output[idx + 2] = (clamp01(color[2] * variation) * 255.0) as u8;
            output[idx + 3] = (color[3] * 255.0) as u8;
        }
    }
}

/// Cobblestone pattern using Worley noise
fn generate_cobble(output: &mut [u8], width: u32, height: u32, color: [f32; 4], seed: u32) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let worley_dist = worley::worley_2d(x as f32 * 0.06, y as f32 * 0.06, seed);
            let perlin_noise = perlin::perlin_2d(x as f32 * 0.1, y as f32 * 0.1, seed);

            // Darker at cell edges, lighter at centers
            let cell_shade = 1.0 - worley_dist * 0.4;
            let variation = cell_shade + perlin_noise * 0.1;

            output[idx] = (clamp01(color[0] * variation) * 255.0) as u8;
            output[idx + 1] = (clamp01(color[1] * variation) * 255.0) as u8;
            output[idx + 2] = (clamp01(color[2] * variation) * 255.0) as u8;
            output[idx + 3] = (color[3] * 255.0) as u8;
        }
    }
}

/// Brick pattern
fn generate_bricks(output: &mut [u8], width: u32, height: u32, color: [f32; 4], seed: u32) {
    let brick_width = width / 4;
    let brick_height = height / 8;
    let mortar_size = 2u32;

    // Mortar color (darker)
    let mortar_r = (color[0] * 0.4 * 255.0) as u8;
    let mortar_g = (color[1] * 0.4 * 255.0) as u8;
    let mortar_b = (color[2] * 0.4 * 255.0) as u8;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let row = y / brick_height;
            let offset = if row % 2 == 0 { 0 } else { brick_width / 2 };
            let bx = (x + offset) % brick_width;
            let by = y % brick_height;

            let is_mortar = bx < mortar_size || by < mortar_size;

            if is_mortar {
                output[idx] = mortar_r;
                output[idx + 1] = mortar_g;
                output[idx + 2] = mortar_b;
                output[idx + 3] = 255;
            } else {
                // Add variation per brick
                let brick_seed = seed.wrapping_add((row * 100 + (x + offset) / brick_width) as u32);
                let noise = perlin::perlin_2d(x as f32 * 0.1, y as f32 * 0.1, brick_seed);
                let variation = 0.9 + noise * 0.1;

                output[idx] = (clamp01(color[0] * variation) * 255.0) as u8;
                output[idx + 1] = (clamp01(color[1] * variation) * 255.0) as u8;
                output[idx + 2] = (clamp01(color[2] * variation) * 255.0) as u8;
                output[idx + 3] = (color[3] * 255.0) as u8;
            }
        }
    }
}

/// Wood plank pattern
fn generate_planks(output: &mut [u8], width: u32, height: u32, color: [f32; 4], seed: u32) {
    let plank_width = width / 4;
    let gap_size = 1u32;

    // Gap color (darker)
    let gap_r = (color[0] * 0.3 * 255.0) as u8;
    let gap_g = (color[1] * 0.3 * 255.0) as u8;
    let gap_b = (color[2] * 0.3 * 255.0) as u8;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let plank_idx = x / plank_width;
            let px = x % plank_width;

            let is_gap = px < gap_size;

            if is_gap {
                output[idx] = gap_r;
                output[idx + 1] = gap_g;
                output[idx + 2] = gap_b;
                output[idx + 3] = 255;
            } else {
                // Wood grain - elongated noise in Y direction
                let grain = perlin::perlin_2d(
                    x as f32 * 0.02,
                    y as f32 * 0.3 + plank_idx as f32 * 10.0,
                    seed,
                );
                let variation = 0.85 + grain * 0.15;

                output[idx] = (clamp01(color[0] * variation) * 255.0) as u8;
                output[idx + 1] = (clamp01(color[1] * variation) * 255.0) as u8;
                output[idx + 2] = (clamp01(color[2] * variation) * 255.0) as u8;
                output[idx + 3] = (color[3] * 255.0) as u8;
            }
        }
    }
}

/// Grid pattern
fn generate_grid(output: &mut [u8], width: u32, height: u32, color: [f32; 4]) {
    let cell_size = width / 8;
    let line_width = 1u32;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let cx = x % cell_size;
            let cy = y % cell_size;
            let is_line = cx < line_width || cy < line_width;

            let shade = if is_line { 0.6 } else { 1.0 };

            output[idx] = (color[0] * shade * 255.0) as u8;
            output[idx + 1] = (color[1] * shade * 255.0) as u8;
            output[idx + 2] = (color[2] * shade * 255.0) as u8;
            output[idx + 3] = (color[3] * 255.0) as u8;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_solid() {
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_albedo(&mut output, 16, 16, [1.0, 0.5, 0.25, 1.0], Pattern::Solid, 0);

        // Check first pixel
        assert_eq!(output[0], 255); // R
        assert_eq!(output[1], 127); // G (0.5 * 255)
        assert_eq!(output[2], 63);  // B (0.25 * 255)
        assert_eq!(output[3], 255); // A
    }
}


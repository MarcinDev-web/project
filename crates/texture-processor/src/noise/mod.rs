//! Noise generation module
//!
//! Provides SIMD-accelerated noise functions:
//! - Perlin noise (2D/3D)
//! - Simplex noise (2D/3D)
//! - Worley/Cellular noise (2D)

pub mod perlin;
pub mod simplex;
pub mod worley;

use crate::Pattern;

// Re-exports
pub use perlin::{perlin_2d, perlin_2d_batch};
pub use simplex::{simplex_2d, simplex_2d_batch};
pub use worley::{worley_2d, worley_2d_batch};

/// Generate height map based on pattern type
pub fn generate_height_map(
    output: &mut [f32],
    width: u32,
    height: u32,
    pattern: Pattern,
    seed: u32,
) {
    match pattern {
        Pattern::Solid | Pattern::Smooth => {
            // Flat height map
            for v in output.iter_mut() {
                *v = 0.5;
            }
        }
        Pattern::Noise => {
            perlin::perlin_2d_batch(output, width, height, 0.1, seed);
            // Normalize to 0-1
            for v in output.iter_mut() {
                *v = (*v + 1.0) * 0.5;
            }
        }
        Pattern::Cobble => {
            worley::worley_2d_batch(output, width, height, 0.08, seed);
        }
        Pattern::Bricks => {
            generate_brick_height(output, width, height, seed);
        }
        Pattern::Planks => {
            generate_plank_height(output, width, height, seed);
        }
        Pattern::Grid => {
            generate_grid_height(output, width, height);
        }
    }
}

/// Generate brick pattern height map
fn generate_brick_height(output: &mut [f32], width: u32, height: u32, seed: u32) {
    let brick_width = width / 4;
    let brick_height = height / 8;

    for y in 0..height {
        for x in 0..width {
            let row = y / brick_height;
            let offset = if row % 2 == 0 { 0 } else { brick_width / 2 };
            let bx = (x + offset) % brick_width;
            let by = y % brick_height;

            // Mortar lines
            let mortar_size = 2u32;
            let is_mortar = bx < mortar_size || by < mortar_size;

            let idx = (y * width + x) as usize;
            if is_mortar {
                output[idx] = 0.3;
            } else {
                // Add slight noise variation
                let noise = perlin::perlin_2d(x as f32 * 0.1, y as f32 * 0.1, seed);
                output[idx] = 0.5 + noise * 0.1;
            }
        }
    }
}

/// Generate plank pattern height map
fn generate_plank_height(output: &mut [f32], width: u32, height: u32, seed: u32) {
    let plank_width = width / 4;

    for y in 0..height {
        for x in 0..width {
            let plank_idx = x / plank_width;
            let px = x % plank_width;

            // Gap between planks
            let gap_size = 1u32;
            let is_gap = px < gap_size;

            let idx = (y * width + x) as usize;
            if is_gap {
                output[idx] = 0.2;
            } else {
                // Wood grain noise
                let grain = perlin::perlin_2d(
                    x as f32 * 0.02,
                    y as f32 * 0.3 + plank_idx as f32 * 10.0,
                    seed,
                );
                output[idx] = 0.5 + grain * 0.15;
            }
        }
    }
}

/// Generate grid pattern height map
fn generate_grid_height(output: &mut [f32], width: u32, height: u32) {
    let cell_size = width / 8;

    for y in 0..height {
        for x in 0..width {
            let cx = x % cell_size;
            let cy = y % cell_size;

            // Grid lines
            let line_width = 1u32;
            let is_line = cx < line_width || cy < line_width;

            let idx = (y * width + x) as usize;
            output[idx] = if is_line { 0.3 } else { 0.5 };
        }
    }
}

/// Utility: Clamp value to 0-1 range
#[inline]
pub fn clamp01(v: f32) -> f32 {
    if v < 0.0 {
        0.0
    } else if v > 1.0 {
        1.0
    } else {
        v
    }
}

/// Utility: Linear interpolation
#[inline]
pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + t * (b - a)
}

/// Utility: Smoothstep interpolation
#[inline]
pub fn smoothstep(t: f32) -> f32 {
    t * t * (3.0 - 2.0 * t)
}

/// Utility: Fade function for Perlin noise (quintic curve)
#[inline]
pub fn fade(t: f32) -> f32 {
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}


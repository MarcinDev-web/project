//! Emission Map Generation
//!
//! Generates emission maps for self-illuminating materials.
//! Emission maps contain RGB color * intensity.

use wasm_bindgen::prelude::*;
use crate::noise::{perlin, worley, clamp01};

/// Generate emission map
///
/// # Arguments
/// * `output` - Output RGBA buffer (width * height * 4 bytes)
/// * `width` - Texture width
/// * `height` - Texture height
/// * `color` - Emission color [R, G, B] in 0-1 range
/// * `intensity` - Emission intensity multiplier
/// * `pattern` - Pattern type (0=solid, 1=smooth, 2=noise, 3=worley)
/// * `seed` - Random seed
#[wasm_bindgen]
pub fn generate_emission_map(
    output: &mut [u8],
    width: u32,
    height: u32,
    color: &[f32],
    intensity: f32,
    pattern: u32,
    seed: u32,
) {
    let r = if color.len() > 0 { color[0] } else { 1.0 };
    let g = if color.len() > 1 { color[1] } else { 1.0 };
    let b = if color.len() > 2 { color[2] } else { 1.0 };

    match pattern {
        0 => generate_solid_emission(output, width, height, r, g, b, intensity),
        1 => generate_smooth_emission(output, width, height, r, g, b, intensity, seed),
        2 => generate_noise_emission(output, width, height, r, g, b, intensity, seed),
        3 => generate_worley_emission(output, width, height, r, g, b, intensity, seed),
        _ => generate_solid_emission(output, width, height, r, g, b, intensity),
    }
}

/// Uniform emission
fn generate_solid_emission(
    output: &mut [u8],
    width: u32,
    height: u32,
    r: f32,
    g: f32,
    b: f32,
    intensity: f32,
) {
    let er = (clamp01(r * intensity) * 255.0) as u8;
    let eg = (clamp01(g * intensity) * 255.0) as u8;
    let eb = (clamp01(b * intensity) * 255.0) as u8;

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            output[idx] = er;
            output[idx + 1] = eg;
            output[idx + 2] = eb;
            output[idx + 3] = 255;
        }
    }
}

/// Smooth emission with subtle pulsing variation
fn generate_smooth_emission(
    output: &mut [u8],
    width: u32,
    height: u32,
    r: f32,
    g: f32,
    b: f32,
    intensity: f32,
    seed: u32,
) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let noise = perlin::perlin_2d(x as f32 * 0.03, y as f32 * 0.03, seed);
            let variation = 0.9 + (noise + 1.0) * 0.5 * 0.2; // 0.9 to 1.1
            let i = intensity * variation;

            output[idx] = (clamp01(r * i) * 255.0) as u8;
            output[idx + 1] = (clamp01(g * i) * 255.0) as u8;
            output[idx + 2] = (clamp01(b * i) * 255.0) as u8;
            output[idx + 3] = 255;
        }
    }
}

/// Noise-based emission (glowstone-like)
fn generate_noise_emission(
    output: &mut [u8],
    width: u32,
    height: u32,
    r: f32,
    g: f32,
    b: f32,
    intensity: f32,
    seed: u32,
) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let noise = perlin::perlin_2d(x as f32 * 0.08, y as f32 * 0.08, seed);
            let normalized = (noise + 1.0) * 0.5; // 0 to 1
            let emission_mask = 0.7 + normalized * 0.3; // 0.7 to 1.0
            let i = intensity * emission_mask;

            output[idx] = (clamp01(r * i) * 255.0) as u8;
            output[idx + 1] = (clamp01(g * i) * 255.0) as u8;
            output[idx + 2] = (clamp01(b * i) * 255.0) as u8;
            output[idx + 3] = 255;
        }
    }
}

/// Worley-based emission (lava-like cracks)
fn generate_worley_emission(
    output: &mut [u8],
    width: u32,
    height: u32,
    r: f32,
    g: f32,
    b: f32,
    intensity: f32,
    seed: u32,
) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;

            let worley_dist = worley::worley_2d(x as f32 * 0.05, y as f32 * 0.05, seed);
            // Bright in cracks (low distance to cell edges)
            let emission_mask = clamp01(1.0 - worley_dist * 2.0);
            
            // Add perlin variation
            let noise = perlin::perlin_2d(x as f32 * 0.1, y as f32 * 0.1, seed);
            let variation = 0.8 + (noise + 1.0) * 0.5 * 0.2;
            
            let i = intensity * emission_mask * variation;

            output[idx] = (clamp01(r * i) * 255.0) as u8;
            output[idx + 1] = (clamp01(g * i) * 255.0) as u8;
            output[idx + 2] = (clamp01(b * i) * 255.0) as u8;
            output[idx + 3] = 255;
        }
    }
}

/// Generate black emission map (no emission)
#[wasm_bindgen]
pub fn generate_no_emission(output: &mut [u8], width: u32, height: u32) {
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            output[idx] = 0;
            output[idx + 1] = 0;
            output[idx + 2] = 0;
            output[idx + 3] = 255;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solid_emission() {
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_emission_map(&mut output, 16, 16, &[1.0, 0.5, 0.0], 1.0, 0, 0);

        // Check first pixel
        assert_eq!(output[0], 255); // R
        assert_eq!(output[1], 127); // G
        assert_eq!(output[2], 0);   // B
    }

    #[test]
    fn test_no_emission() {
        let mut output = vec![0u8; 16 * 16 * 4];
        generate_no_emission(&mut output, 16, 16);

        assert_eq!(output[0], 0);
        assert_eq!(output[1], 0);
        assert_eq!(output[2], 0);
    }
}


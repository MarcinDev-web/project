//! Texture Processor - High-performance procedural texture generation
//!
//! This crate provides SIMD-accelerated texture generation for:
//! - Noise functions (Perlin, Simplex, Worley)
//! - PBR texture maps (Normal, Roughness, Metallic, AO, Emission)
//! - Mipmap generation (Box, Lanczos filtering)
//! - Atlas packing (MaxRects bin-packing)

pub mod noise;
pub mod pbr;
pub mod mipmap;
pub mod atlas;

use wasm_bindgen::prelude::*;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

/// PBR texture generation result containing all maps
#[wasm_bindgen]
pub struct PBRResult {
    albedo: Vec<u8>,
    normal: Vec<u8>,
    roughness: Vec<u8>,
    metallic: Vec<u8>,
    ao: Vec<u8>,
    emission: Vec<u8>,
    width: u32,
    height: u32,
}

#[wasm_bindgen]
impl PBRResult {
    pub fn albedo(&self) -> Vec<u8> {
        self.albedo.clone()
    }

    pub fn normal(&self) -> Vec<u8> {
        self.normal.clone()
    }

    pub fn roughness(&self) -> Vec<u8> {
        self.roughness.clone()
    }

    pub fn metallic(&self) -> Vec<u8> {
        self.metallic.clone()
    }

    pub fn ao(&self) -> Vec<u8> {
        self.ao.clone()
    }

    pub fn emission(&self) -> Vec<u8> {
        self.emission.clone()
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }
}

/// Pattern types for procedural generation
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Pattern {
    Solid = 0,
    Smooth = 1,
    Noise = 2,
    Cobble = 3,
    Bricks = 4,
    Planks = 5,
    Grid = 6,
}

impl From<u32> for Pattern {
    fn from(value: u32) -> Self {
        match value {
            0 => Pattern::Solid,
            1 => Pattern::Smooth,
            2 => Pattern::Noise,
            3 => Pattern::Cobble,
            4 => Pattern::Bricks,
            5 => Pattern::Planks,
            6 => Pattern::Grid,
            _ => Pattern::Solid,
        }
    }
}

/// Generate complete PBR texture set
///
/// # Arguments
/// * `width` - Texture width in pixels
/// * `height` - Texture height in pixels
/// * `pattern` - Pattern type (0=solid, 1=smooth, 2=noise, 3=cobble, 4=bricks, 5=planks, 6=grid)
/// * `color` - Base color as [R, G, B, A] in 0-1 range
/// * `params` - PBR parameters [roughness, metallic, emission_r, emission_g, emission_b, emission_intensity]
/// * `seed` - Random seed for deterministic generation
#[wasm_bindgen]
pub fn generate_pbr_texture(
    width: u32,
    height: u32,
    pattern: u32,
    color: &[f32],
    params: &[f32],
    seed: u32,
) -> PBRResult {
    let pattern = Pattern::from(pattern);
    let size = (width * height) as usize;

    // Extract color
    let base_r = if color.len() > 0 { color[0] } else { 0.5 };
    let base_g = if color.len() > 1 { color[1] } else { 0.5 };
    let base_b = if color.len() > 2 { color[2] } else { 0.5 };
    let base_a = if color.len() > 3 { color[3] } else { 1.0 };

    // Extract PBR params
    let roughness_val = if params.len() > 0 { params[0] } else { 0.5 };
    let metallic_val = if params.len() > 1 { params[1] } else { 0.0 };
    let emission_r = if params.len() > 2 { params[2] } else { 0.0 };
    let emission_g = if params.len() > 3 { params[3] } else { 0.0 };
    let emission_b = if params.len() > 4 { params[4] } else { 0.0 };
    let emission_intensity = if params.len() > 5 { params[5] } else { 0.0 };

    // Generate albedo
    let mut albedo = vec![0u8; size * 4];
    pbr::albedo::generate_albedo(
        &mut albedo,
        width,
        height,
        [base_r, base_g, base_b, base_a],
        pattern,
        seed,
    );

    // Generate height map for normal generation
    let mut height_map = vec![0.0f32; size];
    noise::generate_height_map(&mut height_map, width, height, pattern, seed);

    // Generate normal map
    let mut normal = vec![0u8; size * 4];
    pbr::normal::generate_normal_map(&height_map, &mut normal, width, height, 2.0);

    // Generate roughness map
    let mut roughness = vec![0u8; size * 4];
    pbr::roughness::generate_roughness_map(
        &mut roughness,
        width,
        height,
        roughness_val,
        0.1,
        0.1,
        seed,
    );

    // Generate metallic map
    let mut metallic = vec![0u8; size * 4];
    pbr::metallic::generate_metallic_map(
        &mut metallic,
        width,
        height,
        metallic_val,
        pattern,
        seed,
    );

    // Generate AO map
    let mut ao = vec![0u8; size * 4];
    pbr::ao::generate_ao_map(&mut ao, width, height, pattern, seed);

    // Generate emission map
    let mut emission = vec![0u8; size * 4];
    if emission_intensity > 0.0 {
        pbr::emission::generate_emission_map(
            &mut emission,
            width,
            height,
            &[emission_r, emission_g, emission_b],
            emission_intensity,
            pattern as u32,
            seed,
        );
    }

    PBRResult {
        albedo,
        normal,
        roughness,
        metallic,
        ao,
        emission,
        width,
        height,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_pbr_texture() {
        let result = generate_pbr_texture(
            64,
            64,
            2, // noise pattern
            &[0.5, 0.5, 0.5, 1.0],
            &[0.5, 0.0, 0.0, 0.0, 0.0, 0.0],
            12345,
        );

        assert_eq!(result.width(), 64);
        assert_eq!(result.height(), 64);
        assert_eq!(result.albedo().len(), 64 * 64 * 4);
        assert_eq!(result.normal().len(), 64 * 64 * 4);
    }
}


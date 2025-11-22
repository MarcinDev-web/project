use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use rand::Rng;
use rand::rngs::StdRng;
use rand::SeedableRng;

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct SSGIConfig {
    pub step_count: u32,
    pub radius: f32,
    pub thickness: f32,
    pub max_roughness: f32,
}

#[wasm_bindgen]
impl SSGIConfig {
    #[wasm_bindgen(constructor)]
    pub fn new(step_count: u32, radius: f32, thickness: f32, max_roughness: f32) -> SSGIConfig {
        SSGIConfig {
            step_count,
            radius,
            thickness,
            max_roughness,
        }
    }
}

#[wasm_bindgen]
pub struct BlueNoiseGenerator {
    rng: StdRng,
}

#[wasm_bindgen]
impl BlueNoiseGenerator {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u64) -> BlueNoiseGenerator {
        BlueNoiseGenerator {
            rng: StdRng::seed_from_u64(seed),
        }
    }

    pub fn generate_noise_texture(&mut self, width: u32, height: u32) -> Vec<u8> {
        let mut data = Vec::with_capacity((width * height * 4) as usize);
        for _ in 0..(width * height) {
            let r = self.rng.gen::<u8>();
            let g = self.rng.gen::<u8>();
            // RG noise is enough for rotation and offset in 2D
            data.push(r);
            data.push(g);
            data.push(0);
            data.push(255);
        }
        data
    }

    pub fn generate_halton_sequence(&mut self, count: usize) -> Vec<f32> {
        let mut sequence = Vec::with_capacity(count * 2);
        for i in 0..count {
            sequence.push(self.halton(i as u32 + 1, 2));
            sequence.push(self.halton(i as u32 + 1, 3));
        }
        sequence
    }

    fn halton(&self, index: u32, base: u32) -> f32 {
        let mut f = 1.0;
        let mut r = 0.0;
        let mut i = index;
        let b = base as f32;
        
        while i > 0 {
            f = f / b;
            r = r + f * (i % base) as f32;
            i = i / base;
        }
        r
    }
}

#[wasm_bindgen]
pub struct SSGIUniforms {
    // Flat buffer for uniforms: 
    // 0: step_count (f32)
    // 1: radius
    // 2: thickness
    // 3: max_roughness
    // 4-7: projection matrix inverse elements (simplified) or passed separately
    data: Vec<f32>,
}

#[wasm_bindgen]
impl SSGIUniforms {
    pub fn get_data(&self) -> Vec<f32> {
        self.data.clone()
    }
}

#[wasm_bindgen]
pub fn get_ssgi_uniforms(config: &SSGIConfig) -> SSGIUniforms {
    let mut data = Vec::new();
    data.push(config.step_count as f32);
    data.push(config.radius);
    data.push(config.thickness);
    data.push(config.max_roughness);
    
    // Padding to 16 bytes (vec4)
    // 4 floats = 16 bytes. Perfect.
    
    SSGIUniforms { data }
}

#[wasm_bindgen]
pub fn cull_aabb_batch(planes: &[f32], aabbs: &[f32]) -> Vec<u8> {
    if planes.len() < 24 {
        return Vec::new();
    }
    
    let count = aabbs.len() / 6;
    let mut results = vec![0u8; count];

    for i in 0..count {
        let base = i * 6;
        let min_x = aabbs[base];
        let min_y = aabbs[base + 1];
        let min_z = aabbs[base + 2];
        let max_x = aabbs[base + 3];
        let max_y = aabbs[base + 4];
        let max_z = aabbs[base + 5];

        let mut visible = 1;
        
        // Check against 6 planes
        for p in 0..6 {
            let p_base = p * 4;
            let nx = planes[p_base];
            let ny = planes[p_base + 1];
            let nz = planes[p_base + 2];
            let d = planes[p_base + 3];

            // Find the positive vertex (p-vertex)
            // If normal component >= 0, use max, else use min
            let px = if nx >= 0.0 { max_x } else { min_x };
            let py = if ny >= 0.0 { max_y } else { min_y };
            let pz = if nz >= 0.0 { max_z } else { min_z };

            // Distance from plane to farthest positive corner
            // If < 0, the entire AABB is behind the plane -> culled
            let dist = nx * px + ny * py + nz * pz + d;

            if dist < 0.0 {
                visible = 0;
                break;
            }
        }
        results[i] = visible;
    }
    results
}
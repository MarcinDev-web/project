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

/// Test world-space AABBs against frustum planes.
/// planes: 24 floats (6 planes × 4 components: nx, ny, nz, d)
/// aabbs: N×6 floats (minX, minY, minZ, maxX, maxY, maxZ)
/// Returns: N bytes (1 = visible, 0 = culled)
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

/// Transform local AABBs to world space using world matrices.
/// Uses Arvo's method - O(18) ops per AABB instead of O(8×12) for corner transform.
/// 
/// world_matrices: N×16 floats (column-major 4x4 matrices)
/// local_aabbs: N×6 floats (minX, minY, minZ, maxX, maxY, maxZ)
/// Returns: N×6 floats (world-space AABBs)
#[wasm_bindgen]
pub fn batch_transform_aabbs(world_matrices: &[f32], local_aabbs: &[f32]) -> Vec<f32> {
    let count = local_aabbs.len() / 6;
    if world_matrices.len() < count * 16 {
        return Vec::new();
    }
    
    let mut out = vec![0.0f32; count * 6];
    
    for i in 0..count {
        let m_base = i * 16;
        let a_base = i * 6;
        let o_base = i * 6;
        
        let min_x = local_aabbs[a_base];
        let min_y = local_aabbs[a_base + 1];
        let min_z = local_aabbs[a_base + 2];
        let max_x = local_aabbs[a_base + 3];
        let max_y = local_aabbs[a_base + 4];
        let max_z = local_aabbs[a_base + 5];
        
        // Matrix elements (column-major)
        let m00 = world_matrices[m_base];
        let m01 = world_matrices[m_base + 1];
        let m02 = world_matrices[m_base + 2];
        let m10 = world_matrices[m_base + 4];
        let m11 = world_matrices[m_base + 5];
        let m12 = world_matrices[m_base + 6];
        let m20 = world_matrices[m_base + 8];
        let m21 = world_matrices[m_base + 9];
        let m22 = world_matrices[m_base + 10];
        let m30 = world_matrices[m_base + 12];
        let m31 = world_matrices[m_base + 13];
        let m32 = world_matrices[m_base + 14];
        
        // Arvo's method: compute world AABB without transforming 8 corners
        // Start with translation
        let mut w_min_x = m30;
        let mut w_min_y = m31;
        let mut w_min_z = m32;
        let mut w_max_x = m30;
        let mut w_max_y = m31;
        let mut w_max_z = m32;
        
        // X axis contribution
        let a = m00 * min_x;
        let b = m00 * max_x;
        w_min_x += a.min(b);
        w_max_x += a.max(b);
        
        let a = m01 * min_x;
        let b = m01 * max_x;
        w_min_y += a.min(b);
        w_max_y += a.max(b);
        
        let a = m02 * min_x;
        let b = m02 * max_x;
        w_min_z += a.min(b);
        w_max_z += a.max(b);
        
        // Y axis contribution
        let a = m10 * min_y;
        let b = m10 * max_y;
        w_min_x += a.min(b);
        w_max_x += a.max(b);
        
        let a = m11 * min_y;
        let b = m11 * max_y;
        w_min_y += a.min(b);
        w_max_y += a.max(b);
        
        let a = m12 * min_y;
        let b = m12 * max_y;
        w_min_z += a.min(b);
        w_max_z += a.max(b);
        
        // Z axis contribution
        let a = m20 * min_z;
        let b = m20 * max_z;
        w_min_x += a.min(b);
        w_max_x += a.max(b);
        
        let a = m21 * min_z;
        let b = m21 * max_z;
        w_min_y += a.min(b);
        w_max_y += a.max(b);
        
        let a = m22 * min_z;
        let b = m22 * max_z;
        w_min_z += a.min(b);
        w_max_z += a.max(b);
        
        out[o_base] = w_min_x;
        out[o_base + 1] = w_min_y;
        out[o_base + 2] = w_min_z;
        out[o_base + 3] = w_max_x;
        out[o_base + 4] = w_max_y;
        out[o_base + 5] = w_max_z;
    }
    
    out
}

/// Combined transform + cull in one pass (most efficient).
/// Transforms local AABBs to world space AND tests against frustum.
/// 
/// planes: 24 floats (6 planes × 4 components: nx, ny, nz, d)
/// world_matrices: N×16 floats (column-major 4x4 matrices)
/// local_aabbs: N×6 floats (minX, minY, minZ, maxX, maxY, maxZ)
/// Returns: N bytes (1 = visible, 0 = culled)
#[wasm_bindgen]
pub fn batch_transform_and_cull_aabbs(
    planes: &[f32],
    world_matrices: &[f32],
    local_aabbs: &[f32],
) -> Vec<u8> {
    if planes.len() < 24 {
        return Vec::new();
    }
    
    let count = local_aabbs.len() / 6;
    if world_matrices.len() < count * 16 {
        return Vec::new();
    }
    
    let mut results = vec![0u8; count];
    
    for i in 0..count {
        let m_base = i * 16;
        let a_base = i * 6;
        
        let min_x = local_aabbs[a_base];
        let min_y = local_aabbs[a_base + 1];
        let min_z = local_aabbs[a_base + 2];
        let max_x = local_aabbs[a_base + 3];
        let max_y = local_aabbs[a_base + 4];
        let max_z = local_aabbs[a_base + 5];
        
        // Matrix elements (column-major)
        let m00 = world_matrices[m_base];
        let m01 = world_matrices[m_base + 1];
        let m02 = world_matrices[m_base + 2];
        let m10 = world_matrices[m_base + 4];
        let m11 = world_matrices[m_base + 5];
        let m12 = world_matrices[m_base + 6];
        let m20 = world_matrices[m_base + 8];
        let m21 = world_matrices[m_base + 9];
        let m22 = world_matrices[m_base + 10];
        let m30 = world_matrices[m_base + 12];
        let m31 = world_matrices[m_base + 13];
        let m32 = world_matrices[m_base + 14];
        
        // Arvo's method for AABB transform
        let mut w_min_x = m30;
        let mut w_min_y = m31;
        let mut w_min_z = m32;
        let mut w_max_x = m30;
        let mut w_max_y = m31;
        let mut w_max_z = m32;
        
        // X axis
        let a = m00 * min_x; let b = m00 * max_x;
        w_min_x += a.min(b); w_max_x += a.max(b);
        let a = m01 * min_x; let b = m01 * max_x;
        w_min_y += a.min(b); w_max_y += a.max(b);
        let a = m02 * min_x; let b = m02 * max_x;
        w_min_z += a.min(b); w_max_z += a.max(b);
        
        // Y axis
        let a = m10 * min_y; let b = m10 * max_y;
        w_min_x += a.min(b); w_max_x += a.max(b);
        let a = m11 * min_y; let b = m11 * max_y;
        w_min_y += a.min(b); w_max_y += a.max(b);
        let a = m12 * min_y; let b = m12 * max_y;
        w_min_z += a.min(b); w_max_z += a.max(b);
        
        // Z axis
        let a = m20 * min_z; let b = m20 * max_z;
        w_min_x += a.min(b); w_max_x += a.max(b);
        let a = m21 * min_z; let b = m21 * max_z;
        w_min_y += a.min(b); w_max_y += a.max(b);
        let a = m22 * min_z; let b = m22 * max_z;
        w_min_z += a.min(b); w_max_z += a.max(b);
        
        // Frustum test
        let mut visible = 1u8;
        for p in 0..6 {
            let p_base = p * 4;
            let nx = planes[p_base];
            let ny = planes[p_base + 1];
            let nz = planes[p_base + 2];
            let d = planes[p_base + 3];
            
            let px = if nx >= 0.0 { w_max_x } else { w_min_x };
            let py = if ny >= 0.0 { w_max_y } else { w_min_y };
            let pz = if nz >= 0.0 { w_max_z } else { w_min_z };
            
            if nx * px + ny * py + nz * pz + d < 0.0 {
                visible = 0;
                break;
            }
        }
        results[i] = visible;
    }
    
    results
}

/// Returns indices of visible entities after transform + cull.
/// More efficient when expecting many culled entities (sparse result).
/// 
/// planes: 24 floats (6 planes × 4 components)
/// world_matrices: N×16 floats
/// local_aabbs: N×6 floats
/// Returns: array of visible entity indices (u32)
#[wasm_bindgen]
pub fn batch_transform_cull_get_visible_indices(
    planes: &[f32],
    world_matrices: &[f32],
    local_aabbs: &[f32],
) -> Vec<u32> {
    if planes.len() < 24 {
        return Vec::new();
    }
    
    let count = local_aabbs.len() / 6;
    if world_matrices.len() < count * 16 {
        return Vec::new();
    }
    
    let mut visible_indices = Vec::with_capacity(count);
    
    for i in 0..count {
        let m_base = i * 16;
        let a_base = i * 6;
        
        let min_x = local_aabbs[a_base];
        let min_y = local_aabbs[a_base + 1];
        let min_z = local_aabbs[a_base + 2];
        let max_x = local_aabbs[a_base + 3];
        let max_y = local_aabbs[a_base + 4];
        let max_z = local_aabbs[a_base + 5];
        
        let m00 = world_matrices[m_base];
        let m01 = world_matrices[m_base + 1];
        let m02 = world_matrices[m_base + 2];
        let m10 = world_matrices[m_base + 4];
        let m11 = world_matrices[m_base + 5];
        let m12 = world_matrices[m_base + 6];
        let m20 = world_matrices[m_base + 8];
        let m21 = world_matrices[m_base + 9];
        let m22 = world_matrices[m_base + 10];
        let m30 = world_matrices[m_base + 12];
        let m31 = world_matrices[m_base + 13];
        let m32 = world_matrices[m_base + 14];
        
        // Arvo's AABB transform
        let mut w_min_x = m30; let mut w_max_x = m30;
        let mut w_min_y = m31; let mut w_max_y = m31;
        let mut w_min_z = m32; let mut w_max_z = m32;
        
        let a = m00 * min_x; let b = m00 * max_x;
        w_min_x += a.min(b); w_max_x += a.max(b);
        let a = m01 * min_x; let b = m01 * max_x;
        w_min_y += a.min(b); w_max_y += a.max(b);
        let a = m02 * min_x; let b = m02 * max_x;
        w_min_z += a.min(b); w_max_z += a.max(b);
        
        let a = m10 * min_y; let b = m10 * max_y;
        w_min_x += a.min(b); w_max_x += a.max(b);
        let a = m11 * min_y; let b = m11 * max_y;
        w_min_y += a.min(b); w_max_y += a.max(b);
        let a = m12 * min_y; let b = m12 * max_y;
        w_min_z += a.min(b); w_max_z += a.max(b);
        
        let a = m20 * min_z; let b = m20 * max_z;
        w_min_x += a.min(b); w_max_x += a.max(b);
        let a = m21 * min_z; let b = m21 * max_z;
        w_min_y += a.min(b); w_max_y += a.max(b);
        let a = m22 * min_z; let b = m22 * max_z;
        w_min_z += a.min(b); w_max_z += a.max(b);
        
        // Frustum test
        let mut visible = true;
        for p in 0..6 {
            let p_base = p * 4;
            let nx = planes[p_base];
            let ny = planes[p_base + 1];
            let nz = planes[p_base + 2];
            let d = planes[p_base + 3];
            
            let px = if nx >= 0.0 { w_max_x } else { w_min_x };
            let py = if ny >= 0.0 { w_max_y } else { w_min_y };
            let pz = if nz >= 0.0 { w_max_z } else { w_min_z };
            
            if nx * px + ny * py + nz * pz + d < 0.0 {
                visible = false;
                break;
            }
        }
        
        if visible {
            visible_indices.push(i as u32);
        }
    }
    
    visible_indices
}
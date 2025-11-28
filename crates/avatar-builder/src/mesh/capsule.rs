//! Capsule mesh generation (Y-axis aligned)
//! 
//! Generates a capsule with hemispheres at top and bottom connected by a cylinder.
//! Compatible with TypeScript `generateCapsuleY` in `packages/avatar/src/geometry/capsule-geometry.ts`.

use wasm_bindgen::prelude::*;
use super::MeshData;
use std::f32::consts::PI;

/// Parameters for capsule generation
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct CapsuleParams {
    /// Radius of the capsule hemispheres and cylinder (default: 0.5)
    pub radius: f32,
    /// Height of the cylinder section (default: 1.0)
    pub cylinder_height: f32,
    /// Number of radial segments around the capsule (default: 16)
    pub radial_segments: u32,
    /// Number of segments for each hemisphere (default: 8)
    pub hemisphere_segments: u32,
}

#[wasm_bindgen]
impl CapsuleParams {
    #[wasm_bindgen(constructor)]
    pub fn new(radius: f32, cylinder_height: f32, radial_segments: u32, hemisphere_segments: u32) -> Self {
        Self {
            radius,
            cylinder_height,
            radial_segments,
            hemisphere_segments,
        }
    }
    
    pub fn default() -> Self {
        Self {
            radius: 0.5,
            cylinder_height: 1.0,
            radial_segments: 16,
            hemisphere_segments: 8,
        }
    }
}

impl Default for CapsuleParams {
    fn default() -> Self {
        Self {
            radius: 0.5,
            cylinder_height: 1.0,
            radial_segments: 16,
            hemisphere_segments: 8,
        }
    }
}

/// Generate a Y-axis aligned capsule mesh.
/// 
/// The capsule is centered at origin. Total height = cylinder_height + 2*radius.
/// Vertex format: [x, y, z, nx, ny, nz, u, v] (8 floats per vertex)
/// 
/// UV coordinates use U in [0, 1) creating a seam - requires addressModeU = 'repeat'.
/// 
/// # Arguments
/// * `params` - Capsule parameters (radius, height, segments)
/// 
/// # Returns
/// MeshData with interleaved vertices and triangle indices
#[wasm_bindgen]
pub fn generate_capsule_y(params: &CapsuleParams) -> MeshData {
    let radius = params.radius.max(0.001);
    let cylinder_height = params.cylinder_height.max(0.0);
    let radial_segments = params.radial_segments.max(3) as usize;
    let hemisphere_segments = params.hemisphere_segments.max(2) as usize;
    
    let total_height = cylinder_height + 2.0 * radius;
    let half_cyl = cylinder_height * 0.5;
    
    let mut positions: Vec<f32> = Vec::new();
    let mut normals: Vec<f32> = Vec::new();
    let mut uvs: Vec<f32> = Vec::new();
    let mut indices: Vec<u16> = Vec::new();
    
    // Build vertices
    // 1) Top pole (single vertex)
    let top_pole_y = half_cyl + radius;
    let top_sphere_center_y = half_cyl;
    positions.extend_from_slice(&[0.0, top_pole_y, 0.0]);
    normals.extend_from_slice(&[0.0, 1.0, 0.0]);
    uvs.extend_from_slice(&[0.5, 0.0]);
    
    // 2) Top hemisphere (from pi/2..0, excluding pole and cylinder edge)
    for h in 1..hemisphere_segments {
        let t = h as f32 / hemisphere_segments as f32;
        let phi = (t * PI) / 2.0;
        let ring_r = radius * phi.cos();
        let y = half_cyl + radius * phi.sin();
        let v = (total_height * 0.5 - y) / total_height;
        push_hemisphere_ring(&mut positions, &mut normals, &mut uvs, 
                            y, ring_r, v, top_sphere_center_y, radial_segments);
    }
    
    // 3) Cylinder section - top edge ring
    let top_cylinder_y = half_cyl;
    let top_cylinder_v = (total_height * 0.5 - top_cylinder_y) / total_height;
    push_cylinder_ring(&mut positions, &mut normals, &mut uvs,
                       top_cylinder_y, radius, top_cylinder_v, radial_segments);
    
    // 4) Cylinder section - bottom edge ring
    let bottom_cylinder_y = -half_cyl;
    let bottom_cylinder_v = (total_height * 0.5 - bottom_cylinder_y) / total_height;
    push_cylinder_ring(&mut positions, &mut normals, &mut uvs,
                       bottom_cylinder_y, radius, bottom_cylinder_v, radial_segments);
    
    // 5) Bottom hemisphere (from 0..pi/2, excluding pole and cylinder edge)
    let bottom_sphere_center_y = -half_cyl;
    for h in 1..hemisphere_segments {
        let t = h as f32 / hemisphere_segments as f32;
        let phi = (t * PI) / 2.0;
        let ring_r = radius * phi.cos();
        let y = -half_cyl - radius * phi.sin();
        let v = (total_height * 0.5 - y) / total_height;
        push_hemisphere_ring(&mut positions, &mut normals, &mut uvs,
                            y, ring_r, v, bottom_sphere_center_y, radial_segments);
    }
    
    // 6) Bottom pole (single vertex)
    let bottom_pole_y = -half_cyl - radius;
    let bottom_pole_index = (positions.len() / 3) as u16;
    positions.extend_from_slice(&[0.0, bottom_pole_y, 0.0]);
    normals.extend_from_slice(&[0.0, -1.0, 0.0]);
    uvs.extend_from_slice(&[0.5, 1.0]);
    
    // Generate indices
    let radial_u16 = radial_segments as u16;
    let top_pole_index = 0u16;
    
    // Top pole cap: connect top pole to first ring
    let first_ring_start = 1u16;
    for i in 0..radial_u16 {
        let i0 = top_pole_index;
        let i1 = first_ring_start + i;
        let i2 = first_ring_start + ((i + 1) % radial_u16);
        indices.push(i0);
        indices.push(i2);
        indices.push(i1);
    }
    
    // Connect rings (excluding poles)
    // Total rings: (hemisphere_segments - 1) + 2 + (hemisphere_segments - 1) = 2 * hemisphere_segments
    let rings = (hemisphere_segments - 1) + 2 + (hemisphere_segments - 1);
    for r in 0..(rings - 1) {
        let curr_start = first_ring_start + (r as u16) * radial_u16;
        let next_start = first_ring_start + ((r + 1) as u16) * radial_u16;
        if next_start >= bottom_pole_index {
            break;
        }
        for i in 0..radial_u16 {
            let i0 = curr_start + i;
            let i1 = curr_start + ((i + 1) % radial_u16);
            let i2 = next_start + i;
            let i3 = next_start + ((i + 1) % radial_u16);
            indices.push(i0);
            indices.push(i1);
            indices.push(i2);
            indices.push(i1);
            indices.push(i3);
            indices.push(i2);
        }
    }
    
    // Bottom pole cap: connect last ring to bottom pole
    let last_ring_start = bottom_pole_index - radial_u16;
    for i in 0..radial_u16 {
        let i0 = last_ring_start + i;
        let i1 = last_ring_start + ((i + 1) % radial_u16);
        let i2 = bottom_pole_index;
        indices.push(i0);
        indices.push(i1);
        indices.push(i2);
    }
    
    // Interleave vertex data
    let vertex_count = positions.len() / 3;
    let mut vertices = Vec::with_capacity(vertex_count * 8);
    
    for i in 0..vertex_count {
        let pos_idx = i * 3;
        let uv_idx = i * 2;
        vertices.push(positions[pos_idx]);
        vertices.push(positions[pos_idx + 1]);
        vertices.push(positions[pos_idx + 2]);
        vertices.push(normals[pos_idx]);
        vertices.push(normals[pos_idx + 1]);
        vertices.push(normals[pos_idx + 2]);
        vertices.push(uvs[uv_idx]);
        vertices.push(uvs[uv_idx + 1]);
    }
    
    MeshData::new(vertices, indices)
}

/// Push a ring of vertices for cylinder section (horizontal normals)
fn push_cylinder_ring(
    positions: &mut Vec<f32>,
    normals: &mut Vec<f32>,
    uvs: &mut Vec<f32>,
    y: f32,
    radius: f32,
    v: f32,
    radial_segments: usize,
) {
    for i in 0..radial_segments {
        let theta = (i as f32 / radial_segments as f32) * PI * 2.0;
        let cos_t = theta.cos();
        let sin_t = theta.sin();
        let x = radius * cos_t;
        let z = radius * sin_t;
        
        positions.push(x);
        positions.push(y);
        positions.push(z);
        normals.push(cos_t);
        normals.push(0.0);
        normals.push(sin_t);
        uvs.push(i as f32 / radial_segments as f32);
        uvs.push(v);
    }
}

/// Push a ring of vertices for hemisphere section (spherical normals)
fn push_hemisphere_ring(
    positions: &mut Vec<f32>,
    normals: &mut Vec<f32>,
    uvs: &mut Vec<f32>,
    y: f32,
    ring_radius: f32,
    v: f32,
    sphere_center_y: f32,
    radial_segments: usize,
) {
    for i in 0..radial_segments {
        let theta = (i as f32 / radial_segments as f32) * PI * 2.0;
        let cos_t = theta.cos();
        let sin_t = theta.sin();
        let x = ring_radius * cos_t;
        let z = ring_radius * sin_t;
        
        // Compute true sphere normal from position relative to sphere center
        let cx = x;
        let cy = y - sphere_center_y;
        let cz = z;
        let len_inv = 1.0 / (cx*cx + cy*cy + cz*cz).sqrt();
        let nx = cx * len_inv;
        let ny = cy * len_inv;
        let nz = cz * len_inv;
        
        positions.push(x);
        positions.push(y);
        positions.push(z);
        normals.push(nx);
        normals.push(ny);
        normals.push(nz);
        uvs.push(i as f32 / radial_segments as f32);
        uvs.push(v);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_capsule_default_params() {
        let params = CapsuleParams::default();
        let mesh = generate_capsule_y(&params);
        
        // Should have reasonable vertex/triangle counts
        assert!(mesh.vertex_count() > 0);
        assert!(mesh.triangle_count() > 0);
        assert_eq!(mesh.vertices_len(), mesh.vertex_count() * 8);
        assert_eq!(mesh.indices_len(), mesh.triangle_count() * 3);
    }
    
    #[test]
    fn test_capsule_normals_unit_length() {
        let params = CapsuleParams::default();
        let mesh = generate_capsule_y(&params);
        let verts = mesh.get_vertices();
        
        for i in 0..mesh.vertex_count() {
            let base = i * 8;
            let nx = verts[base + 3];
            let ny = verts[base + 4];
            let nz = verts[base + 5];
            let len = (nx*nx + ny*ny + nz*nz).sqrt();
            assert!((len - 1.0).abs() < 0.001, "Normal at vertex {} not unit length: {}", i, len);
        }
    }
    
    #[test]
    fn test_capsule_height() {
        let params = CapsuleParams::new(0.5, 1.0, 16, 8);
        let mesh = generate_capsule_y(&params);
        let verts = mesh.get_vertices();
        
        let mut min_y = f32::INFINITY;
        let mut max_y = f32::NEG_INFINITY;
        
        for i in 0..mesh.vertex_count() {
            let y = verts[i * 8 + 1];
            min_y = min_y.min(y);
            max_y = max_y.max(y);
        }
        
        let total_height = max_y - min_y;
        let expected_height = 1.0 + 2.0 * 0.5; // cylinder_height + 2*radius
        assert!((total_height - expected_height).abs() < 0.001);
    }
}

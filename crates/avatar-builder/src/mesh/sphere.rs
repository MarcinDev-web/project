//! UV Sphere mesh generation
//! 
//! Generates a unit sphere with UV mapping using latitude/longitude topology.
//! Compatible with TypeScript `generateSphereMesh` in `packages/avatar/src/geometry/sphere-geometry.ts`.

use wasm_bindgen::prelude::*;
use super::MeshData;
use std::f32::consts::PI;

/// Parameters for sphere generation
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct SphereParams {
    /// Number of horizontal and vertical segments (default: 16)
    pub segments: u32,
}

#[wasm_bindgen]
impl SphereParams {
    #[wasm_bindgen(constructor)]
    pub fn new(segments: u32) -> Self {
        Self { segments }
    }
    
    pub fn default() -> Self {
        Self { segments: 16 }
    }
}

impl Default for SphereParams {
    fn default() -> Self {
        Self { segments: 16 }
    }
}

/// Generate a UV sphere mesh.
/// 
/// The sphere is centered at origin with radius 1.0.
/// Vertex format: [x, y, z, nx, ny, nz, u, v] (8 floats per vertex)
/// 
/// # Arguments
/// * `segments` - Number of horizontal and vertical segments (min: 3)
/// 
/// # Returns
/// MeshData with interleaved vertices and triangle indices
#[wasm_bindgen]
pub fn generate_sphere(segments: u32) -> MeshData {
    let segments = segments.max(3) as usize;
    
    // Pre-calculate capacity
    // Vertices: 1 (top) + (segments-1) * segments (middle) + 1 (bottom)
    let vertex_count = 1 + (segments - 1) * segments + 1;
    // Triangles: segments (top cap) + 2 * segments * (segments-2) (middle) + segments (bottom cap)
    let triangle_count = segments + 2 * segments * (segments - 2) + segments;
    
    let mut vertices = Vec::with_capacity(vertex_count * 8);
    let mut indices = Vec::with_capacity(triangle_count * 3);
    
    // Top vertex (pole)
    push_vertex(&mut vertices, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.5, 0.0);
    
    // Middle vertices (latitudes)
    for lat in 1..segments {
        let theta = (lat as f32 * PI) / segments as f32;
        let sin_theta = theta.sin();
        let cos_theta = theta.cos();
        let v = lat as f32 / segments as f32;
        
        for lon in 0..segments {
            let phi = (lon as f32 * 2.0 * PI) / segments as f32;
            let sin_phi = phi.sin();
            let cos_phi = phi.cos();
            let u = lon as f32 / segments as f32;
            
            let x = cos_phi * sin_theta;
            let y = cos_theta;
            let z = sin_phi * sin_theta;
            
            // For unit sphere, normal = position
            push_vertex(&mut vertices, x, y, z, x, y, z, u, v);
        }
    }
    
    // Bottom vertex (pole)
    push_vertex(&mut vertices, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.5, 1.0);
    
    // Generate indices
    let segments_u16 = segments as u16;
    
    // Top cap triangles (connect top pole to first ring)
    for lon in 0..segments_u16 {
        let current = 1 + lon;
        let next = 1 + ((lon + 1) % segments_u16);
        indices.push(0); // top pole
        indices.push(next);
        indices.push(current);
    }
    
    // Middle quads (converted to triangles)
    for lat in 0..(segments - 2) as u16 {
        for lon in 0..segments_u16 {
            let current = 1 + lat * segments_u16 + lon;
            let next = 1 + lat * segments_u16 + ((lon + 1) % segments_u16);
            let below_current = 1 + (lat + 1) * segments_u16 + lon;
            let below_next = 1 + (lat + 1) * segments_u16 + ((lon + 1) % segments_u16);
            
            // First triangle
            indices.push(current);
            indices.push(next);
            indices.push(below_current);
            // Second triangle
            indices.push(next);
            indices.push(below_next);
            indices.push(below_current);
        }
    }
    
    // Bottom cap triangles (connect last ring to bottom pole)
    let bottom_vertex_idx = (1 + (segments - 1) * segments) as u16;
    for lon in 0..segments_u16 {
        let current = 1 + ((segments - 2) as u16) * segments_u16 + lon;
        let next = 1 + ((segments - 2) as u16) * segments_u16 + ((lon + 1) % segments_u16);
        indices.push(bottom_vertex_idx);
        indices.push(current);
        indices.push(next);
    }
    
    MeshData::new(vertices, indices)
}

/// Push a vertex in interleaved format [x, y, z, nx, ny, nz, u, v]
#[inline]
fn push_vertex(
    vertices: &mut Vec<f32>,
    x: f32, y: f32, z: f32,
    nx: f32, ny: f32, nz: f32,
    u: f32, v: f32,
) {
    vertices.push(x);
    vertices.push(y);
    vertices.push(z);
    vertices.push(nx);
    vertices.push(ny);
    vertices.push(nz);
    vertices.push(u);
    vertices.push(v);
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sphere_vertex_count() {
        let mesh = generate_sphere(16);
        // 1 + (16-1)*16 + 1 = 242 vertices
        assert_eq!(mesh.vertex_count(), 242);
        // 8 floats per vertex
        assert_eq!(mesh.vertices_len(), 242 * 8);
    }
    
    #[test]
    fn test_sphere_index_count() {
        let mesh = generate_sphere(16);
        // Top cap: 16, middle: 2*16*(16-2)=448, bottom cap: 16 = 480 triangles
        assert_eq!(mesh.triangle_count(), 480);
        assert_eq!(mesh.indices_len(), 480 * 3);
    }
    
    #[test]
    fn test_sphere_min_segments() {
        let mesh = generate_sphere(2); // Should be clamped to 3
        // 1 + (3-1)*3 + 1 = 8 vertices
        assert_eq!(mesh.vertex_count(), 8);
    }
    
    #[test]
    fn test_sphere_normals_unit_length() {
        let mesh = generate_sphere(8);
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
}


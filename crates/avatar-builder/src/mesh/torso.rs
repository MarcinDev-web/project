//! Heroic torso mesh generation
//! 
//! Generates a compound torso mesh with lower body and shoulder shelf.
//! Compatible with TypeScript `generateHeroicTorsoMesh` in `packages/avatar/src/geometry/torso-geometry.ts`.

use wasm_bindgen::prelude::*;
use super::MeshData;

/// Shoulder width ratio relative to torso core width.
/// This is the style ABI for avatar torso proportions.
pub const SHOULDER_TO_TORSO_RATIO: f32 = 1.35;

/// Parameters for torso generation
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub struct TorsoParams {
    /// Lower torso width (relative to full width, default: 0.95)
    pub lower_width: f32,
    /// Lower torso height (relative to total height, default: 0.8)
    pub lower_height: f32,
    /// Lower torso depth (default: 1.0)
    pub lower_depth: f32,
    /// Shoulder width ratio relative to torso core (default: 1.35)
    pub shoulder_width_ratio: f32,
    /// Shoulder height (relative to total height, default: 0.25)
    pub shoulder_height: f32,
    /// Shoulder depth (default: 1.0)
    pub shoulder_depth: f32,
    /// Overlap between lower torso and shoulder shelf (default: 0.05)
    pub shoulder_overlap: f32,
    /// Vertical offset of lower torso center (default: -0.15)
    pub lower_center_y: f32,
}

#[wasm_bindgen]
impl TorsoParams {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::default()
    }
    
    pub fn default() -> Self {
        Self {
            lower_width: 0.95,
            lower_height: 0.8,
            lower_depth: 1.0,
            shoulder_width_ratio: SHOULDER_TO_TORSO_RATIO,
            shoulder_height: 0.25,
            shoulder_depth: 1.0,
            shoulder_overlap: 0.05,
            lower_center_y: -0.15,
        }
    }
}

impl Default for TorsoParams {
    fn default() -> Self {
        Self {
            lower_width: 0.95,
            lower_height: 0.8,
            lower_depth: 1.0,
            shoulder_width_ratio: SHOULDER_TO_TORSO_RATIO,
            shoulder_height: 0.25,
            shoulder_depth: 1.0,
            shoulder_overlap: 0.05,
            lower_center_y: -0.15,
        }
    }
}

/// Generate a heroic torso mesh with compound geometry.
/// 
/// The mesh consists of:
/// - Lower torso: main body (narrower)
/// - Upper shoulder shelf: wider horizontal block (pauldron-like)
/// 
/// This creates an action-figure silhouette with proper attachment points
/// for upper arms.
/// 
/// Vertex format: [x, y, z, nx, ny, nz, u, v] (8 floats per vertex)
/// 
/// # Arguments
/// * `params` - Torso geometry parameters
/// 
/// # Returns
/// MeshData with interleaved vertices and triangle indices
#[wasm_bindgen]
pub fn generate_heroic_torso(params: &TorsoParams) -> MeshData {
    let mut vertices: Vec<f32> = Vec::new();
    let mut normals: Vec<f32> = Vec::new();
    let mut uvs: Vec<f32> = Vec::new();
    let mut indices: Vec<u16> = Vec::new();
    
    // Add a box to the mesh
    let mut add_box = |center_x: f32, center_y: f32, center_z: f32,
                       width: f32, height: f32, depth: f32| {
        let half_w = width / 2.0;
        let half_h = height / 2.0;
        let half_d = depth / 2.0;
        
        // Define 8 corners (in local space)
        let corners: [[f32; 3]; 8] = [
            [-half_w, -half_h, -half_d], // 0: left-bottom-back
            [ half_w, -half_h, -half_d], // 1: right-bottom-back
            [ half_w,  half_h, -half_d], // 2: right-top-back
            [-half_w,  half_h, -half_d], // 3: left-top-back
            [-half_w, -half_h,  half_d], // 4: left-bottom-front
            [ half_w, -half_h,  half_d], // 5: right-bottom-front
            [ half_w,  half_h,  half_d], // 6: right-top-front
            [-half_w,  half_h,  half_d], // 7: left-top-front
        ];
        
        // Helper to add a quad (two triangles) with the given vertices and normal
        let mut add_quad = |v0: [f32; 3], v1: [f32; 3], v2: [f32; 3], v3: [f32; 3],
                           normal: [f32; 3]| {
            let base_idx = (vertices.len() / 3) as u16;
            
            // Standard box UV mapping
            let quad_uvs: [[f32; 2]; 4] = [
                [0.0, 0.0], // bottom-left
                [1.0, 0.0], // bottom-right
                [1.0, 1.0], // top-right
                [0.0, 1.0], // top-left
            ];
            
            let quad_verts = [v0, v1, v2, v3];
            for i in 0..4 {
                let v = quad_verts[i];
                let uv = quad_uvs[i];
                vertices.push(v[0] + center_x);
                vertices.push(v[1] + center_y);
                vertices.push(v[2] + center_z);
                normals.push(normal[0]);
                normals.push(normal[1]);
                normals.push(normal[2]);
                uvs.push(uv[0]);
                uvs.push(uv[1]);
            }
            
            // Two triangles
            indices.push(base_idx);
            indices.push(base_idx + 1);
            indices.push(base_idx + 2);
            indices.push(base_idx);
            indices.push(base_idx + 2);
            indices.push(base_idx + 3);
        };
        
        // Front face (+Z)
        add_quad(corners[4], corners[5], corners[6], corners[7], [0.0, 0.0, 1.0]);
        // Back face (-Z)
        add_quad(corners[1], corners[0], corners[3], corners[2], [0.0, 0.0, -1.0]);
        // Right face (+X)
        add_quad(corners[5], corners[1], corners[2], corners[6], [1.0, 0.0, 0.0]);
        // Left face (-X)
        add_quad(corners[0], corners[4], corners[7], corners[3], [-1.0, 0.0, 0.0]);
        // Top face (+Y)
        add_quad(corners[3], corners[7], corners[6], corners[2], [0.0, 1.0, 0.0]);
        // Bottom face (-Y)
        add_quad(corners[4], corners[0], corners[1], corners[5], [0.0, -1.0, 0.0]);
    };
    
    // Add lower torso (centered at origin, extends downward more)
    add_box(
        0.0, params.lower_center_y, 0.0,
        params.lower_width, params.lower_height, params.lower_depth,
    );
    
    // Add upper shoulder shelf (positioned at top, overlapping slightly with lower torso)
    let shoulder_center_y = params.lower_center_y 
        + (params.lower_height / 2.0) 
        - (params.shoulder_overlap / 2.0) 
        + (params.shoulder_height / 2.0);
    add_box(
        0.0, shoulder_center_y, 0.0,
        params.shoulder_width_ratio, params.shoulder_height, params.shoulder_depth,
    );
    
    // Interleave vertex data
    let vertex_count = vertices.len() / 3;
    let mut interleaved = Vec::with_capacity(vertex_count * 8);
    
    for i in 0..vertex_count {
        let pos_idx = i * 3;
        let uv_idx = i * 2;
        interleaved.push(vertices[pos_idx]);
        interleaved.push(vertices[pos_idx + 1]);
        interleaved.push(vertices[pos_idx + 2]);
        interleaved.push(normals[pos_idx]);
        interleaved.push(normals[pos_idx + 1]);
        interleaved.push(normals[pos_idx + 2]);
        interleaved.push(uvs[uv_idx]);
        interleaved.push(uvs[uv_idx + 1]);
    }
    
    MeshData::new(interleaved, indices)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_torso_default_params() {
        let params = TorsoParams::default();
        let mesh = generate_heroic_torso(&params);
        
        // Two boxes = 2 * 6 faces * 4 vertices = 48 vertices
        assert_eq!(mesh.vertex_count(), 48);
        // Two boxes = 2 * 6 faces * 2 triangles = 24 triangles
        assert_eq!(mesh.triangle_count(), 24);
    }
    
    #[test]
    fn test_torso_normals_unit_length() {
        let params = TorsoParams::default();
        let mesh = generate_heroic_torso(&params);
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
    fn test_shoulder_ratio() {
        assert!((SHOULDER_TO_TORSO_RATIO - 1.35).abs() < 0.001);
    }
}


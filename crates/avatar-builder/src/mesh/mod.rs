//! Procedural mesh generation for avatar parts.
//! 
//! All meshes are generated in interleaved format: [x, y, z, nx, ny, nz, u, v]
//! which is directly compatible with the WebGPU renderer.

mod sphere;
mod capsule;
mod torso;

pub use sphere::{generate_sphere, SphereParams};
pub use capsule::{generate_capsule_y, CapsuleParams};
pub use torso::{generate_heroic_torso, TorsoParams};

use wasm_bindgen::prelude::*;

/// Result of mesh generation containing interleaved vertex data and indices.
#[wasm_bindgen]
pub struct MeshData {
    /// Interleaved vertex data: [x, y, z, nx, ny, nz, u, v, ...] (8 floats per vertex)
    vertices: Vec<f32>,
    /// Triangle indices (3 per triangle)
    indices: Vec<u16>,
}

#[wasm_bindgen]
impl MeshData {
    /// Get pointer to vertex data for zero-copy access from JS
    pub fn vertices_ptr(&self) -> *const f32 {
        self.vertices.as_ptr()
    }
    
    /// Get vertex data length in floats
    pub fn vertices_len(&self) -> usize {
        self.vertices.len()
    }
    
    /// Get pointer to index data for zero-copy access from JS
    pub fn indices_ptr(&self) -> *const u16 {
        self.indices.as_ptr()
    }
    
    /// Get index data length
    pub fn indices_len(&self) -> usize {
        self.indices.len()
    }
    
    /// Get vertex count (vertices_len / 8)
    pub fn vertex_count(&self) -> usize {
        self.vertices.len() / 8
    }
    
    /// Get triangle count (indices_len / 3)
    pub fn triangle_count(&self) -> usize {
        self.indices.len() / 3
    }
    
    /// Copy vertices to a new Vec (for testing/debugging)
    pub fn get_vertices(&self) -> Vec<f32> {
        self.vertices.clone()
    }
    
    /// Copy indices to a new Vec (for testing/debugging)
    pub fn get_indices(&self) -> Vec<u16> {
        self.indices.clone()
    }
}

impl MeshData {
    /// Create new MeshData (internal use)
    pub(crate) fn new(vertices: Vec<f32>, indices: Vec<u16>) -> Self {
        Self { vertices, indices }
    }
}


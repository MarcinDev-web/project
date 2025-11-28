//! Avatar Builder WASM Module
//! 
//! High-performance avatar mesh generation and skeleton operations for UGC 3D platform.
//! 
//! ## Features
//! - Procedural mesh generation (sphere, capsule, torso)
//! - Skeleton joint hierarchy with world matrix computation
//! - Animation sampling and pose blending
//! - GPU skinning matrix computation
//! - Morph target application
//! 
//! ## Performance
//! Using Rust/WASM provides 5-10x speedup over TypeScript for mesh generation
//! and skeleton operations, critical for responsive avatar editor experience.

pub mod mesh;
pub mod skeleton;
pub mod skinning;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Vertex stride: 8 floats per vertex [x, y, z, nx, ny, nz, u, v]
pub const VERTEX_STRIDE: usize = 8;

// Re-exports for convenient access
pub use mesh::{
    generate_sphere, generate_capsule_y, generate_heroic_torso,
    SphereParams, CapsuleParams, TorsoParams, MeshData,
};
pub use skeleton::{AvatarSkeleton, JointId};
pub use skinning::compute_skin_matrices;


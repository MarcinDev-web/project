//! PBR Texture Map Generation
//!
//! Generates physically-based rendering maps:
//! - Albedo (base color with pattern variation)
//! - Normal maps (from height data using Sobel)
//! - Roughness maps
//! - Metallic maps
//! - Ambient occlusion maps
//! - Emission maps

pub mod albedo;
pub mod normal;
pub mod roughness;
pub mod metallic;
pub mod ao;
pub mod emission;

// Re-exports
pub use albedo::generate_albedo;
pub use normal::generate_normal_map;
pub use roughness::generate_roughness_map;
pub use metallic::generate_metallic_map;
pub use ao::generate_ao_map;
pub use emission::generate_emission_map;


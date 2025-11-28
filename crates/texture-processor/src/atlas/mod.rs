//! Texture Atlas Module
//!
//! Provides rectangle bin-packing and atlas building functionality:
//! - MaxRects bin-packing algorithm
//! - Atlas texture assembly

pub mod packer;
pub mod builder;

// Re-exports
pub use packer::{pack_rectangles, PackResult};
pub use builder::build_atlas;


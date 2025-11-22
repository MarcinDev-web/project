mod terrain;
mod simple_mesh;
mod greedy_mesh;
mod raycast;

use wasm_bindgen::prelude::*;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

pub use terrain::*;
pub use greedy_mesh::*;
pub use simple_mesh::*;
pub use raycast::*;

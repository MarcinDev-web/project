mod vm;
mod node;
mod nodes;
mod signal;
mod loader;

use wasm_bindgen::prelude::*;
use vm::ScriptVM;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct VMWrapper {
    vm: ScriptVM,
}

#[wasm_bindgen]
impl VMWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            vm: ScriptVM::new(),
        }
    }

    pub fn load_graph(&mut self, data: &[u8]) -> Result<(), JsValue> {
        self.vm.load_graph(data).map_err(|e| JsValue::from_str(&e))
    }

    pub fn step(&mut self, dt: f32) -> Vec<f32> {
        self.vm.step(dt)
    }
    
    pub fn trigger(&mut self, entity_id: u32, signal: &str) {
        // TODO: Implement external trigger
    }
}

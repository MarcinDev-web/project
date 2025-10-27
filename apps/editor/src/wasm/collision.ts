import type { WasmCollision } from '@engine/wasm-collision';
import { init as initWasmCollision } from '@engine/wasm-collision';

let instance: WasmCollision | null = null;
let initializing = false;

export function ensureWasmCollisionInit(): void {
  if (instance || initializing) return;
  initializing = true;
  // Fire-and-forget init; errors are swallowed to allow graceful fallback
  void initWasmCollision()
    .then(api => {
      instance = api;
    })
    .catch(() => {
      // Keep instance as null to signal fallback
    })
    .finally(() => {
      initializing = false;
    });
}

export function getWasmCollisionSync(): WasmCollision | null {
  return instance;
}



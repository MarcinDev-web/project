# @engine/compute-wasm

Minimal Rust to WASM package exposing a simple add(a, b) function as a proof of concept.

Build:

pnpm --filter @engine/compute-wasm build

Usage:

import init, * as wasm from '@engine/compute-wasm';
await init();
console.log(wasm.add(2, 3));

## Performance & Cleanup

- Prefer passing TypedArray buffers and operating in-place in Rust for hot paths.
- Avoid per-frame allocations; reuse buffers and structs.
- If Rust allocates objects exposed to JS, ensure they are freed via generated `free()` or a wrapper `dispose()`.

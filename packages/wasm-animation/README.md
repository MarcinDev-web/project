# @engine/wasm-animation

WebAssembly bindings for the animation system.

## Overview

This package provides high-performance WASM implementations for skeletal animation blending and processing. It is generated from the `crates/animation` Rust source.

## Installation

```bash
pnpm add @engine/wasm-animation
```

## Usage

```typescript
import init, { AnimationState } from '@engine/wasm-animation';

await init();
const state = new AnimationState();
```

## Development

To rebuild this package from Rust sources:

```bash
pnpm build:wasm
```


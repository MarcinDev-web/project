# @engine/wasm-physics

WebAssembly bindings for the physics engine.

## Overview

This package provides high-performance WASM implementations for physics simulation. It is generated from the `crates/physics` Rust source.

## Installation

```bash
pnpm add @engine/wasm-physics
```

## Usage

```typescript
import init, { PhysicsWorld } from '@engine/wasm-physics';

await init();
```

## Development

To rebuild this package from Rust sources:

```bash
pnpm build:wasm
```


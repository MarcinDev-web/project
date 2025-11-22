# @engine/wasm-collision

WebAssembly bindings for the collision detection system.

## Overview

This package provides high-performance WASM implementations for collision detection and spatial queries. It is generated from the `crates/collision` Rust source.

## Installation

```bash
pnpm add @engine/wasm-collision
```

## Usage

```typescript
import init, { Collider } from '@engine/wasm-collision';

await init();
```

## Development

To rebuild this package from Rust sources:

```bash
pnpm build:wasm
```


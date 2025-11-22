# @engine/wasm-voxel

WebAssembly bindings for the voxel engine.

## Overview

This package provides high-performance WASM implementations for voxel terrain generation and meshing. It is generated from the `crates/voxel-engine` Rust source.

## Installation

```bash
pnpm add @engine/wasm-voxel
```

## Usage

```typescript
import init, { VoxelWorld } from '@engine/wasm-voxel';

await init();
```

## Development

To rebuild this package from Rust sources:

```bash
pnpm build:wasm
```


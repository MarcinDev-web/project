# @engine/wasm-mesh

WebAssembly bindings for mesh processing.

## Overview

This package provides high-performance WASM implementations for mesh optimization and generation. It is generated from the `crates/mesh-processor` Rust source.

## Installation

```bash
pnpm add @engine/wasm-mesh
```

## Usage

```typescript
import init, { processMesh } from '@engine/wasm-mesh';

await init();
```

## Development

To rebuild this package from Rust sources:

```bash
pnpm build:wasm
```


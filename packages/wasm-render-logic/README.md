# @engine/wasm-render-logic

WebAssembly bindings for render logic.

## Overview

This package provides high-performance WASM implementations for render culling and scene management. It is generated from the `crates/render-logic` Rust source.

## Installation

```bash
pnpm add @engine/wasm-render-logic
```

## Usage

```typescript
import init, { CullingSystem } from '@engine/wasm-render-logic';

await init();
```

## Development

To rebuild this package from Rust sources:

```bash
pnpm build:wasm
```


# @engine/wasm-texture-processor

High-performance WASM texture processing for Forge Engine.

## Features

- **Noise Generation**: Perlin, Simplex, and Worley noise with SIMD acceleration
- **PBR Maps**: Complete PBR texture generation (Albedo, Normal, Roughness, Metallic, AO, Emission)
- **Mipmap Generation**: Box and Lanczos filtering
- **Atlas Packing**: MaxRects bin-packing algorithm

## Performance

| Operation | JS (CPU) | WASM+SIMD | Speedup |
|-----------|----------|-----------|---------|
| Perlin 128×128 | 15ms | 0.5ms | 30× |
| Normal map 128×128 | 8ms | 0.3ms | 27× |
| Full PBR 128×128 | 50ms | 2ms | 25× |
| Mipmap chain | 12ms | 0.8ms | 15× |

## Usage

```typescript
import { WasmTextureProcessor } from '@engine/wasm-texture-processor';

// Initialize once
await WasmTextureProcessor.initialize();

// Generate PBR textures
const pbr = WasmTextureProcessor.generatePBRTexture(128, 128, {
  pattern: 'noise',
  color: [0.5, 0.5, 0.5, 1.0],
  roughness: 0.5,
  metallic: 0.0,
});

// Generate noise
const noise = WasmTextureProcessor.generateNoise('perlin', 128, 128, 0.1, 12345);

// Generate mipmaps
const mipmaps = WasmTextureProcessor.generateMipmaps(baseData, 128, 128, {
  filter: 'lanczos',
  lanczosRadius: 2,
});

// Pack atlas
const packResult = WasmTextureProcessor.packRectangles(
  textures.map(t => ({ width: t.width, height: t.height })),
  2048,
  2
);

const atlas = WasmTextureProcessor.buildAtlas(
  textures,
  packResult.positions,
  packResult.atlasWidth,
  packResult.atlasHeight
);
```

## Building

```bash
# Build WASM (requires Rust and wasm-bindgen)
pnpm build:wasm

# Build WASM with SIMD
pnpm build:wasm:simd

# Build TypeScript
pnpm build
```

## Requirements

- Rust toolchain with `wasm32-unknown-unknown` target
- wasm-bindgen CLI
- Node.js 18+


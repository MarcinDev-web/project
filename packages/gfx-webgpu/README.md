# @engine/gfx-webgpu

**WebGPU Renderer** - High-performance rendering.

## Zawartość

- **DeviceManager** - GPU initialization
- **ResourceCache** - Buffers, textures, shaders, materials
- **Renderer** - Main renderer
- **Materials** - PBR, unlit, voxel materials
- **Shadows** - Cascaded shadow maps
- **Postprocess** - Bloom, tonemap, LUT

## Zależności

- `@engine/core`
- `@engine/world`
- `@webgpu/types`

## Instalacja

```bash
pnpm add @engine/gfx-webgpu
```

## Użycie

```typescript
import { DeviceManager, Renderer } from '@engine/gfx-webgpu';
import { World } from '@engine/world';

const deviceManager = new DeviceManager();
await deviceManager.initialize(canvas);

const renderer = new Renderer(deviceManager, canvas);
await renderer.initialize();

// Render loop
function render() {
  renderer.render(world, camera);
  requestAnimationFrame(render);
}
```

## Status

✅ **Zmigrowany** - Faza 3 zakończona (26.10.2025)

## Features

- 57 plików źródłowych
- ~8,000 linii kodu
- 224 dist files (największy pakiet!)
- PBR rendering pipeline
- Cascaded shadow maps
- Post-processing (Bloom, Tonemap, LUT)
- Material system z texture atlas
- 14 internal test files

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


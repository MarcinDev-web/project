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

🚧 **W budowie** - Placeholder dla przyszłej migracji

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


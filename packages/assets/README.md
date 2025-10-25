# @engine/assets

**Asset Management** - Loading, streaming, serialization.

## Zawartość

- **AssetManager** - Main asset manager
- **Loaders** - Mesh, texture, animation, audio, script
- **Streaming** - LRU cache, prefetch, eviction
- **UGCPack** - World serialization

## Zależności

- `@engine/core`
- `@engine/world`

## Instalacja

```bash
pnpm add @engine/assets
```

## Użycie

```typescript
import { AssetManager } from '@engine/assets';

const assetManager = new AssetManager();

// Load asset
const meshAsset = await assetManager.load('mesh://character');

// Preload
await assetManager.preload([
  'texture://skybox',
  'audio://music',
]);
```

## Status

🚧 **W budowie** - Placeholder dla przyszłej migracji

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


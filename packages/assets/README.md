# @engine/assets

**Asset Management** - Asset registry, loaders, streaming.

## Zawartość

- **AssetRegistry** - Central asset storage and querying (primarily for blocks)
- **AssetTypes** - Unified type system for all assets
- **RecentAssetsTracker** - Track recently used assets
- **AssetImporter** - GLTF/GLB asset importing
- **GltfOptimizer** - GLTF optimization with Draco compression

**Uwaga:** System obecnie koncentruje się na blokach z `@engine/gfx-webgpu/BlockLibrary` (10 bloków w 3 kategoriach: basic, natural, gameplay). AssetRegistry automatycznie konwertuje bloki na assety.

## Zależności

- `@engine/core` (math, types)
- `@engine/world` (Entity, Scene)
- `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions`
- `draco3dgltf`

## Instalacja

```bash
pnpm add @engine/assets
```

## Użycie

### Asset Registry

```typescript
import { assetRegistry, type Asset } from '@engine/assets';
import { BLOCK_LIBRARY } from '@engine/gfx-webgpu';

// Initialize registry
await assetRegistry.initialize();

// Register blocks from BlockLibrary
for (const [blockId, block] of Object.entries(BLOCK_LIBRARY)) {
  assetRegistry.registerBlockAsset(block);
}

// Query assets (blocks)
const buildingBlocks = assetRegistry.query({ category: 'Building' }); // basic blocks
const naturalBlocks = assetRegistry.query({ category: 'Nature' }); // grass, dirt, stone
const gameplayBlocks = assetRegistry.query({ category: 'Gameplay' }); // light, glass
const searchResults = assetRegistry.search('red');

// Register custom block asset
const customBlock: Asset = {
  type: 'block',
  category: 'Building',
  metadata: { id: 'my-block', name: 'My Block', isBuiltIn: false },
  color: [1, 0, 0, 1],
  scale: [1, 1, 1],
  isPlaceable: true,
};
assetRegistry.register(customBlock);
```

### Asset Importer

```typescript
import { AssetImporter } from '@engine/assets';
import { Scene } from '@engine/world';

const scene = new Scene();
const importer = new AssetImporter(scene);

// Import GLTF/GLB file
const entity = await importer.importGLTF(file);
```

### Recent Assets Tracker

```typescript
import { RecentAssetsTracker } from '@engine/assets';

const tracker = new RecentAssetsTracker();

// Record usage
tracker.recordUsage('asset-id');

// Get recent IDs
const recentIds = tracker.getRecent(10);

// Get recent assets
const recent = tracker.getRecentAssets((id) => assetRegistry.get(id));
```

## Status

✅ **Zmigrowany** - Faza 6 zakończona (26.10.2025)

## Testy

Pakiet posiada przechodzące testy:
- AssetRegistry.test.ts (27 testów)
- RecentAssetsTracker.test.ts (19 testów)
- AssetImporter.test.ts (1 test)

```bash
pnpm test
```

## Struktura

```
packages/assets/
├── src/
│   ├── core/
│   │   ├── AssetTypes.ts       # Unified asset type system
│   │   ├── AssetRegistry.ts    # Asset storage & querying
│   │   └── RecentAssetsTracker.ts  # Usage history
│   ├── loaders/
│   │   ├── AssetImporter.ts    # GLTF/GLB importer
│   │   └── GltfOptimizer.ts    # GLTF optimization
│   └── index.ts
└── __tests__/ (47 testów)
```

## Bloki

System używa bloków z `@engine/gfx-webgpu/BlockLibrary`:
- **Basic (5 bloków)**: plastic_red, plastic_blue, plastic_green, plastic_yellow, concrete_white
- **Natural (3 bloki)**: grass, dirt, stone
- **Gameplay (2 bloki)**: light_white, glass_clear

Każdy blok może być automatycznie zarejestrowany jako asset przez AssetRegistry.

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)

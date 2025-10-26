# @engine/assets

**Asset Management** - Asset registry, library, loaders, streaming.

## Zawartość

- **AssetRegistry** - Central asset storage and querying
- **AssetLibrary** - Built-in asset collections (Furniture, Architecture, Nature, etc.)
- **AssetTypes** - Unified type system for all assets
- **RecentAssetsTracker** - Track recently used assets
- **AssetImporter** - GLTF/GLB asset importing
- **GltfOptimizer** - GLTF optimization with Draco compression

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

// Initialize with built-in assets
await assetRegistry.initialize();

// Query assets
const furniture = assetRegistry.query({ category: 'Furniture' });
const featured = assetRegistry.getFeatured();
const searchResults = assetRegistry.search('chair');

// Register custom asset
const customAsset: Asset = {
  type: 'primitive',
  category: 'Custom',
  metadata: { id: 'my-asset', name: 'My Asset', isBuiltIn: false },
  color: [1, 0, 0, 1],
  scale: [1, 1, 1],
  isPlaceable: true,
};
assetRegistry.register(customAsset);
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

Pakiet posiada 81 przechodzących testów:
- AssetRegistry.test.ts (27 testów)
- AssetLibrary.test.ts (34 testy)
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
│   │   ├── AssetTypes.ts
│   │   ├── AssetRegistry.ts
│   │   ├── AssetLibrary.ts
│   │   └── RecentAssetsTracker.ts
│   ├── loaders/
│   │   ├── AssetImporter.ts
│   │   └── GltfOptimizer.ts
│   └── index.ts
└── __tests__/ (81 testów)
```

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)

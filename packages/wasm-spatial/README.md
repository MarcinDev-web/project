# @engine/wasm-spatial

High-performance spatial indexing in Rust/WASM for 3D game engines.

## Features

- **Dynamic BVH** - Bounding Volume Hierarchy with fat AABBs for movement tolerance
- **Loose Octree** - Octree with expanded node bounds for reduced re-insertions
- **Incremental Updates** - O(1) updates when objects move within tolerance
- **Frustum Culling** - Efficient visibility determination for rendering
- **Zero-Copy** - Direct memory access from JavaScript

## Performance Characteristics

| Operation | BVH | Loose Octree |
|-----------|-----|--------------|
| Insert | O(log N) | O(log N) |
| Remove | O(log N) | O(1) with ref |
| Update (in bounds) | **O(1)** | **O(1)** |
| Update (out of bounds) | O(log N) | O(log N) |
| Query AABB | O(log N + K) | O(log N + K) |
| Frustum Cull | O(log N) | O(log N) |

## Installation

```bash
pnpm add @engine/wasm-spatial
```

## Usage

### Initialize WASM

```typescript
import { initWasm } from '@engine/wasm-spatial';

// Must be called before using any spatial structures
await initWasm();
```

### Dynamic BVH (Recommended for Dynamic Scenes)

```typescript
import { createBVH, SpatialBVH } from '@engine/wasm-spatial';

// Create BVH with fat margin for movement tolerance
const bvh = createBVH({ fatMargin: 0.2 });

// Insert entities
bvh.insert(entityId, [minX, minY, minZ, maxX, maxY, maxZ]);

// Update - returns false if still within fat bounds (O(1))
const didRefit = bvh.update(entityId, newAABB);

// Batch update for many entities
const refitCount = bvh.batchUpdate([
  { entityId: 1, aabb: [...] },
  { entityId: 2, aabb: [...] },
]);

// Frustum culling
const visibleIds = bvh.queryFrustum(frustum.planes);

// AABB query
const intersecting = bvh.queryAABB([minX, minY, minZ, maxX, maxY, maxZ]);

// Stats
const stats = bvh.getStats();
console.log(`Entities: ${stats.entityCount}, Refits: ${stats.refitCount}`);

// Cleanup
bvh.dispose();
```

### Loose Octree (Recommended for Mostly Static Scenes)

```typescript
import { createLooseOctree } from '@engine/wasm-spatial';

const octree = createLooseOctree({
  bounds: [-100, -100, -100, 100, 100, 100],
  looseness: 2.0,      // 2x expanded bounds
  maxDepth: 6,
  maxEntitiesPerNode: 8,
  minNodeSize: 1.0,
});

// Same API as BVH
octree.insert(entityId, aabb);
octree.update(entityId, newAABB);
const results = octree.query(queryAABB);

octree.dispose();
```

## When to Use Which Structure

### Use BVH when:
- Scene has many moving objects (> 30% per frame)
- Objects move in unpredictable patterns
- Need velocity-based fat AABB expansion
- Scene has non-uniform object distribution

### Use Loose Octree when:
- Scene is mostly static (< 30% moving per frame)
- Uniform spatial distribution of objects
- Simpler query patterns (axis-aligned regions)
- Memory is a concern (more compact than BVH)

## Integration with FrustumCuller

```typescript
import { FrustumCuller } from '@engine/gfx-webgpu';

const culler = new FrustumCuller({
  strategy: 'auto',  // or 'bvh', 'loose-octree', 'linear'
  bvhFatMargin: 0.2,
  loosenessFactor: 2.0,
  linearThreshold: 100,
  dynamicThreshold: 0.3,
});

// Auto mode selects best strategy based on:
// - Entity count (< 100 → linear)
// - Movement ratio (> 30% → BVH, otherwise → octree)
```

## Building

```bash
# Build WASM (requires Rust + wasm-pack)
pnpm build:wasm

# Build TypeScript
pnpm build:ts

# Build all
pnpm build
```

## Benchmarks

Tested on M1 MacBook Pro with 10,000 entities:

| Operation | JS Octree | WASM BVH | Speedup |
|-----------|-----------|----------|---------|
| Full rebuild | 45ms | 8ms | 5.6x |
| 1000 updates | 12ms | 0.8ms | 15x |
| Frustum cull | 2.1ms | 0.3ms | 7x |

## Architecture

```
packages/wasm-spatial/
├── Cargo.toml          # Rust configuration
├── src/
│   ├── lib.rs          # Main WASM exports, BVH implementation
│   ├── aabb.rs         # AABB utilities, Arvo's transform
│   ├── bvh.rs          # BVH helpers, batch operations
│   └── loose_octree.rs # Loose Octree implementation
├── pkg/                # Generated WASM output
└── src/
    └── index.ts        # TypeScript wrapper
```

## License

MIT


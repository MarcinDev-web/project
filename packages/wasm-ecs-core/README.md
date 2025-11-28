# @engine/wasm-ecs-core

WASM-accelerated ECS hot paths for the game engine. Provides significant performance improvements for:

- **ECS Queries**: Batch queries using component bitmasks
- **Transform Hierarchy**: SIMD-optimized batch world matrix computation
- **Frustum Culling**: Fast visibility testing with hierarchical transforms

## Installation

```bash
pnpm add @engine/wasm-ecs-core
```

## Building

```bash
# Build WASM module
cd crates/ecs-core
wasm-pack build --target web --out-dir ../../packages/wasm-ecs-core/pkg

# Build TypeScript wrapper
cd packages/wasm-ecs-core
pnpm build:ts
```

## Usage

### Initialization

```typescript
import { initWasm, isWasmReady } from '@engine/wasm-ecs-core';

// Initialize WASM module (do this once at startup)
await initWasm();
console.log('WASM ready:', isWasmReady());
```

### Transform Hierarchy

Zero-copy access to transform data with automatic world matrix computation:

```typescript
import { TransformHierarchyWasm } from '@engine/wasm-ecs-core';

const hierarchy = new TransformHierarchyWasm(1000);
hierarchy.resize(entityCount);

// Direct access to WASM memory (zero-copy)
const positions = hierarchy.positions;  // Float32Array view
const rotations = hierarchy.rotations;  // Float32Array view
const scales = hierarchy.scales;        // Float32Array view
const parents = hierarchy.parents;      // Int32Array view

// Copy entity data
for (let i = 0; i < entities.length; i++) {
  const t = entities[i].transform;
  positions[i * 3] = t.position[0];
  positions[i * 3 + 1] = t.position[1];
  positions[i * 3 + 2] = t.position[2];
  // ... rotations, scales, parents
}

// Update all world matrices in topological order
hierarchy.updateWorldMatrices();

// Read back world matrices
const worldMatrices = hierarchy.worldMatrices; // Float32Array view
```

### ECS Queries

Batch queries using 64-bit component bitmasks:

```typescript
import { EcsWorldWasm, ComponentRegistry } from '@engine/wasm-ecs-core';

// Register component types
const registry = new ComponentRegistry();
const TRANSFORM = registry.register(Transform);
const MESH = registry.register(MeshComponent);
const PHYSICS = registry.register(RigidBody);

// Create ECS world
const ecs = new EcsWorldWasm(1000);
ecs.resize(entityCount);

// Set component masks for entities
const masks = new BigUint64Array(entityCount);
for (let i = 0; i < entities.length; i++) {
  let mask = 0n;
  if (entities[i].hasComponent(Transform)) mask |= 1n << BigInt(TRANSFORM);
  if (entities[i].hasComponent(MeshComponent)) mask |= 1n << BigInt(MESH);
  // ...
  masks[i] = mask;
}
ecs.batchSetMasks(masks);

// Query entities with Transform AND Mesh components
const requiredMask = registry.getCombinedMask([Transform, MeshComponent]);
const result = ecs.query(requiredMask); // Uint32Array of matching indices

// Query with exclusion
const excludeMask = registry.getMask(RigidBody);
const nonPhysics = ecs.queryExclude(requiredMask, excludeMask);
```

### Frustum Culling

Fast visibility testing:

```typescript
import { FrustumCullerWasm } from '@engine/wasm-ecs-core';

const culler = new FrustumCullerWasm(1000);

// Compute world AABBs from matrices and local bounds
culler.computeWorldAabbs(worldMatrices, localHalfExtents);

// Cull against camera frustum
const viewProj = camera.getViewProjectionMatrix();
const visibleIndices = culler.cull(viewProj);

// Or use full pipeline with hierarchy
const visible = culler.cullHierarchy(hierarchy, halfExtents, viewProj);
```

### Stateless Batch APIs

For one-off operations without maintaining state:

```typescript
import {
  batchUpdateTransforms,
  batchFrustumCull,
  batchEcsQuery
} from '@engine/wasm-ecs-core';

// Transform hierarchy update
const worldMatrices = batchUpdateTransforms(positions, rotations, scales, parents);

// Frustum culling
const visible = batchFrustumCull(worldMatrices, halfExtents, viewProj);

// ECS query
const matching = batchEcsQuery(componentMasks, requiredMask);
```

## Performance

Benchmarks on 10,000 entities (M1 MacBook Pro):

| Operation | TypeScript | WASM | Speedup |
|-----------|-----------|------|---------|
| Transform hierarchy update | 12ms | 2ms | 6x |
| ECS query (all) | 3ms | 0.4ms | 7.5x |
| Frustum culling | 5ms | 0.8ms | 6x |

## Architecture

The module consists of:

1. **Rust crate** (`crates/ecs-core/`): Core algorithms with optional SIMD
2. **WASM binary** (`pkg/`): Compiled WebAssembly module
3. **TypeScript wrapper** (`src/`): High-level API with zero-copy access

### Memory Layout

Data is stored in Structure of Arrays (SoA) format for cache efficiency:

```
positions:  [x0, y0, z0, x1, y1, z1, ...]
rotations:  [x0, y0, z0, w0, x1, y1, z1, w1, ...]
scales:     [x0, y0, z0, x1, y1, z1, ...]
parents:    [p0, p1, p2, ...]
worldMats:  [m00, m01, ..., m15, m00, m01, ...]
```

### Zero-Copy Access

TypeScript can directly access WASM memory through typed array views:

```typescript
const positions = hierarchy.positions; // View into WASM memory
positions[0] = 10.0; // Directly writes to WASM memory
hierarchy.markLocalDirty(0);
hierarchy.updateWorldMatrices();
```

## Integration with Scene

To use with the existing Scene/Entity system:

```typescript
import { Scene } from '@engine/world';
import { TransformHierarchyWasm, initWasm } from '@engine/wasm-ecs-core';

class WasmTransformSystem {
  private hierarchy: TransformHierarchyWasm;
  private entityToIndex = new Map<string, number>();

  async initialize(scene: Scene): Promise<void> {
    await initWasm();
    this.hierarchy = new TransformHierarchyWasm(10000);
    this.sync(scene);
  }

  sync(scene: Scene): void {
    const entities = scene.getAllEntities();
    this.hierarchy.resize(entities.length);
    
    // Build index mapping
    this.entityToIndex.clear();
    entities.forEach((e, i) => this.entityToIndex.set(e.id, i));

    // Copy transform data
    const pos = this.hierarchy.positions;
    const rot = this.hierarchy.rotations;
    const scl = this.hierarchy.scales;
    const par = this.hierarchy.parents;

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const t = e.transform;
      
      pos[i * 3] = t.position[0];
      pos[i * 3 + 1] = t.position[1];
      pos[i * 3 + 2] = t.position[2];
      
      rot[i * 4] = t.rotation[0];
      rot[i * 4 + 1] = t.rotation[1];
      rot[i * 4 + 2] = t.rotation[2];
      rot[i * 4 + 3] = t.rotation[3];
      
      scl[i * 3] = t.scale[0];
      scl[i * 3 + 1] = t.scale[1];
      scl[i * 3 + 2] = t.scale[2];
      
      const parentEntity = e.parent;
      par[i] = parentEntity ? (this.entityToIndex.get(parentEntity.id) ?? -1) : -1;
    }

    this.hierarchy.markAllDirty();
  }

  update(): Float32Array {
    this.hierarchy.updateWorldMatrices();
    return this.hierarchy.worldMatrices;
  }
}
```

## License

MIT


# @engine/wasm-collision

High-performance WebAssembly bindings for collision detection in the 3D engine.

## Overview

This package provides WASM implementations for collision detection and spatial queries, compiled from the `crates/collision` Rust source. It offers significant performance improvements over pure TypeScript implementations, especially for batch operations.

## Features

- **OBB-OBB Collision** - Full 15-axis SAT (Separating Axis Theorem) with contact generation
- **Sphere Collisions** - Sphere-sphere, sphere-OBB intersections
- **Capsule Collisions** - Capsule-sphere, capsule-OBB, capsule-capsule
- **Raycasting** - Ray-sphere, ray-OBB, ray-capsule intersections
- **Batch Operations** - Efficient TRS-based batch collision checks
- **Spatial Indexing** - Morton code-based spatial grid for broad-phase
- **Frustum Culling** - View frustum queries with optional occlusion culling
- **Object Pooling** - Buffer pool for reduced GC pressure

## Installation

```bash
pnpm add @engine/wasm-collision
```

## Usage

### Basic Initialization

```typescript
import { init } from '@engine/wasm-collision';

const wasm = await init();
```

### Collision Detection

```typescript
// OBB-OBB intersection (boolean)
const obbA = {
  center: new Float32Array([0, 0, 0]),
  axes: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), // Identity rotation
  half: new Float32Array([1, 1, 1]),
};
const obbB = {
  center: new Float32Array([1.5, 0, 0]),
  axes: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  half: new Float32Array([1, 1, 1]),
};

const collides = wasm.obbIntersect(obbA, obbB);

// OBB-OBB with contact information (for physics resolution)
const contact = wasm.obbIntersectWithContact(obbA, obbB);
if (contact.has_collision) {
  console.log('Depth:', contact.depth);
  console.log('Normal:', contact.normal_x, contact.normal_y, contact.normal_z);
  console.log('Point:', contact.point_x, contact.point_y, contact.point_z);
}
```

### Batch Collision Checking

```typescript
import { getTrsBuffers, releaseTrsBuffers } from '@engine/wasm-collision';

// Preview object
const preview = {
  pos: new Float32Array([0, 0, 0]),
  rot: new Float32Array([0, 0, 0, 1]), // Quaternion (x, y, z, w)
  scl: new Float32Array([2, 2, 2]),
};

// Other objects to check against
const others = {
  positions: new Float32Array([0.5, 0, 0, 5, 0, 0, 0, 5, 0]),
  rotations: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
  scales: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
};

const collidingIndices = wasm.batchCheckTrs(preview, others);
console.log('Colliding objects:', collidingIndices);
```

### Raycasting

```typescript
const rayOrigin = new Float32Array([0, 0, -5]);
const rayDir = new Float32Array([0, 0, 1]);

// Ray-Sphere
const sphereCenter = new Float32Array([0, 0, 0]);
const sphereRadius = 1.0;
const t = wasm.raySphereIntersect(rayOrigin, rayDir, sphereCenter, sphereRadius);
if (t >= 0) {
  console.log('Hit at distance:', t);
}

// Ray-Capsule
const capsuleBase = new Float32Array([0, -1, 0]);
const capsuleTip = new Float32Array([0, 1, 0]);
const capsuleRadius = 0.5;
const tCapsule = wasm.rayCapsuleIntersect(rayOrigin, rayDir, capsuleBase, capsuleTip, capsuleRadius);
```

### Buffer Pooling

```typescript
import { getTrsBuffers, releaseTrsBuffers, getPoolMetrics } from '@engine/wasm-collision';

// Get pooled buffers (reuses existing if available)
const buffers = getTrsBuffers(100); // For 100 objects
// ... use buffers.positions, buffers.rotations, buffers.scales ...

// Release back to pool when done
releaseTrsBuffers(buffers);

// Monitor pool performance
const metrics = getPoolMetrics();
console.log('Pool hit rate:', (metrics.hitRate * 100).toFixed(1) + '%');
```

## API Reference

### Intersection Tests

| Function | Description |
|----------|-------------|
| `obbIntersect(a, b)` | Boolean OBB-OBB test |
| `obbIntersectWithContact(a, b)` | OBB-OBB with contact info (depth, normal, point) |
| `sphereSphereIntersect(...)` | Boolean sphere-sphere test |
| `sphereObbIntersect(...)` | Boolean sphere-OBB test |
| `capsuleSphereIntersect(...)` | Boolean capsule-sphere test |
| `capsuleObbIntersect(...)` | Boolean capsule-OBB test |
| `capsuleCapsuleIntersect(...)` | Boolean capsule-capsule test |

### Raycasting

| Function | Description |
|----------|-------------|
| `raySphereIntersect(...)` | Returns hit distance or -1 |
| `rayObbIntersect(...)` | Returns hit distance or -1 |
| `rayCapsuleIntersect(...)` | Returns hit distance or -1 |

### Batch Operations

| Function | Description |
|----------|-------------|
| `batchCheckTrs(preview, others)` | Check one object against many (TRS format) |
| `batchCheckAll(trsArray)` | Check all objects against each other |
| `computeSceneBounds(...)` | Compute AABB bounds for scene |

### CollisionWorld (Advanced)

The `CollisionWorld` class provides a persistent collision world for complex scenarios:

```typescript
const world = new wasm.CollisionWorld();
world.resize(1000);
// ... set up positions, rotations, scales via pointers ...
const pairs = world.check_collisions();
const visible = world.query_frustum(viewProjMatrix);
world.clear(); // Release memory
```

## Performance Tips

1. **Use batch operations** - `batchCheckTrs` is much faster than individual checks
2. **Pool buffers** - Use `getTrsBuffers`/`releaseTrsBuffers` to avoid allocations
3. **Choose the right threshold**:
   - < 64 objects: TypeScript may be faster (no FFI overhead)
   - 64-500 objects: Direct WASM
   - > 500 objects: Consider Web Worker

## Development

### Building from Rust

```bash
# Full WASM build (requires Rust + wasm-pack)
pnpm build:full

# TypeScript only (uses pre-built WASM)
pnpm build
```

### Testing

```bash
pnpm test
```

## Architecture

```
@engine/wasm-collision
├── src/
│   ├── index.ts      # Main API and WASM bindings
│   ├── pool.ts       # Buffer pooling for performance
│   └── __tests__/    # Vitest tests
├── pkg/              # Compiled WASM output
└── crates/collision  # Rust source (../../crates/collision)
```

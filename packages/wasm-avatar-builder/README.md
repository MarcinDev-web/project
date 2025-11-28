# @engine/wasm-avatar-builder

High-performance avatar mesh generation and skeleton system using Rust/WASM.

## Features

- **Procedural mesh generation** - Sphere, capsule, and heroic torso meshes
- **Skeleton system** - Joint hierarchy with world matrix computation
- **GPU skinning** - Skin matrix computation for shader consumption
- **Pose blending** - SLERP-based rotation blending

## Performance

Using Rust/WASM provides 5-10x speedup over TypeScript for:
- Mesh generation (sphere, capsule, torso)
- Skeleton world matrix computation
- Skin matrix calculation
- Pose blending

## Installation

```bash
pnpm add @engine/wasm-avatar-builder
```

## Usage

### Initialize WASM

```typescript
import { initWasm } from '@engine/wasm-avatar-builder';

// Call once at application startup
await initWasm();
```

### Generate Meshes

```typescript
import { 
  createSphereMesh, 
  createCapsuleMesh, 
  createTorsoMesh 
} from '@engine/wasm-avatar-builder';

// Generate sphere (head)
const sphere = createSphereMesh(16); // 16 segments
console.log(`Sphere: ${sphere.vertexCount} vertices, ${sphere.triangleCount} triangles`);

// Generate capsule (limbs)
const capsule = createCapsuleMesh(0.5, 1.0, 16, 8);

// Generate torso
const torso = createTorsoMesh();
```

### Skeleton Operations

```typescript
import { AvatarSkeleton, batch_set_transforms } from '@engine/wasm-avatar-builder';

// Create skeleton with 10 joints
const skeleton = new AvatarSkeleton(10);

// Set up hierarchy
skeleton.set_parent(1, 0); // Joint 1 is child of joint 0
skeleton.set_parent(2, 1); // Joint 2 is child of joint 1

// Set joint transforms
skeleton.set_translation(0, 0, 1, 0);
skeleton.set_rotation(1, 0, 0, 0, 1); // Quaternion (x, y, z, w)
skeleton.set_scale(2, 1, 1, 1);

// Compute world matrices (call once per frame)
skeleton.compute_world_matrices();

// Get world matrices for GPU upload
const matrices = skeleton.get_world_matrices();
```

### Skin Matrix Computation

```typescript
import { 
  SkinMatrixComputer, 
  compute_skin_matrices 
} from '@engine/wasm-avatar-builder';

// One-shot computation
const skinMatrices = compute_skin_matrices(
  worldMatrices,      // Float32Array: 16 floats per joint
  inverseBindMatrices, // Float32Array: 16 floats per joint
  jointCount
);

// Persistent computer (avoids allocations)
const computer = new SkinMatrixComputer(64); // max 64 joints
computer.set_inverse_bind_matrices(inverseBindMatrices);

// Per-frame computation
computer.compute(worldMatrices, jointCount);
const ptr = computer.get_output_ptr(); // Zero-copy pointer
```

### Pose Blending

```typescript
import { blend_poses } from '@engine/wasm-avatar-builder';

// Blend two poses with 50% weight
blend_poses(
  trans_a, rot_a, scale_a,  // Pose A
  trans_b, rot_b, scale_b,  // Pose B
  0.5,                       // Weight (0 = A, 1 = B)
  jointCount,
  out_trans, out_rot, out_scale  // Output buffers
);
```

## Building

### Prerequisites

- Rust with `wasm32-unknown-unknown` target
- wasm-pack

### Build WASM

```bash
cd crates/avatar-builder
wasm-pack build --target web --out-dir ../../packages/wasm-avatar-builder/pkg --release
```

### Build TypeScript

```bash
cd packages/wasm-avatar-builder
pnpm build:ts
```

## Vertex Format

All meshes use interleaved vertex format:

```
[x, y, z, nx, ny, nz, u, v]  // 8 floats per vertex
```

- Position: `[x, y, z]`
- Normal: `[nx, ny, nz]`
- UV: `[u, v]`

## License

MIT


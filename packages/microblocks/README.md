# @engine/microblocks

**Micro Block System** - Independent system for building detailed structures using small blocks/shapes.

## Overview

The micro block system enables fine-grained building with small blocks (1/8 the size of standard blocks). It operates independently from BlockLibrary, allowing flexible use cases for detailed construction.

## Features

- **Sparse Storage**: Only non-empty chunks stored in memory
- **Greedy Meshing**: Automatically merges adjacent faces for performance
- **Chunk-based**: 16×16×16 micro blocks per chunk
- **ECS Integration**: Works seamlessly with the engine's Entity-Component-System
- **Serialization**: Full save/load support
- **Incremental Updates**: Only regenerates meshes for changed chunks

## Architecture

### Components

- **MicroBlockStore**: Chunk-based sparse storage for micro blocks
- **MicroBlockMesher**: Greedy meshing algorithm for mesh generation
- **MicroBlockComponent**: ECS component that holds a micro block store
- **MicroBlockSystem**: ECS system that updates mesh geometry automatically

### Block Size

- Micro blocks are **1/8 the size** of standard blocks (0.125 units)
- Each standard block can contain **512 micro blocks** (8×8×8)
- Chunks are **16×16×16 micro blocks** (2×2×2 standard blocks)

## Usage

### Basic Example

```typescript
import { Scene, Entity, TransformComponent } from '@engine/world';
import {
  MicroBlockStore,
  MicroBlockComponent,
  MicroBlockSystem,
  type MicroBlock,
} from '@engine/microblocks';

// Create scene
const scene = new Scene('my-scene');

// Create micro block store
const store = new MicroBlockStore();

// Place a block
const block: MicroBlock = {
  type: 'cube',
  materialId: 'plastic_red',
  rotation: 0,
};
store.setBlock([0, 0, 0], block);

// Create entity with micro blocks
const entity = new Entity('microblock-structure');
entity.addComponent(new TransformComponent({ position: [0, 0, 0] }));
entity.addComponent(new MicroBlockComponent({ store }));

// Add to scene
scene.addEntity(entity);

// Create and update system
const system = new MicroBlockSystem(scene);
system.update(0.016); // Mesh will be generated automatically
```

### Using Presets

```typescript
import { createMicroBlockFromPreset, MICRO_BLOCK_PRESETS } from '@engine/microblocks';

// Create block from preset
const block = createMicroBlockFromPreset('cube_red');
if (block) {
  store.setBlock([0, 0, 0], block);
}
```

### Serialization

```typescript
// Save
const component = entity.getComponent(MicroBlockComponent);
const data = component?.toJSON();

// Load
const newComponent = new MicroBlockComponent();
newComponent.fromJSON(data);
```

### Custom Chunk Size

```typescript
// Create store with custom chunk size
const store = new MicroBlockStore(32); // 32×32×32 blocks per chunk

const component = new MicroBlockComponent({ store, chunkSize: 32 });
```

## API Reference

### MicroBlockStore

- `getBlock(worldPos: Vec3): MicroBlock | null` - Get block at position
- `setBlock(worldPos: Vec3, block: MicroBlock | null): void` - Set/remove block
- `getChunk(coord: ChunkCoord): MicroBlockChunk | undefined` - Get chunk
- `getDirtyChunks(): MicroBlockChunk[]` - Get chunks that need remeshing
- `toJSON(): MicroBlockStoreData` - Serialize store
- `fromJSON(data: MicroBlockStoreData): void` - Deserialize store

### MicroBlockComponent

- `store: MicroBlockStore` - The micro block store
- `chunkSize: number` - Chunk size configuration
- `toJSON(): MicroBlockComponentData` - Serialize component
- `fromJSON(data: MicroBlockComponentData): void` - Deserialize component
- `clone(): MicroBlockComponent` - Deep clone component

### MicroBlockSystem

- `update(deltaTime: number): void` - Update system (call each frame)
- `forceUpdate(entity: Entity): void` - Force update all chunks for entity
- `dispose(): void` - Dispose system resources

## Performance Considerations

- **Sparse Storage**: Only stores non-empty chunks (memory efficient)
- **Dirty Flagging**: Only regenerates meshes for changed chunks
- **Greedy Meshing**: Reduces vertex count by ~70-90%
- **Batch Updates**: Limits chunk updates per frame (configurable)
- **Face Culling**: Automatically skips interior faces

### Configuration

```typescript
const system = new MicroBlockSystem(scene, {
  enableAutoUpdate: true, // Enable automatic mesh updates
  maxChunksPerFrame: 5, // Max chunks to update per frame
});
```

## Block Types

Currently supported shapes:
- `cube` - Full cube
- `slab` - Half-height block
- `stairs` - Stair block
- `corner` - Corner block
- `wedge` - Wedge block

Additional shapes can be added by extending the mesher.

## Integration

The micro block system integrates with:

- **@engine/world**: ECS components and systems
- **@engine/gfx-webgpu**: Mesh rendering pipeline
- **@engine/core**: Math utilities and disposal patterns

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

## Dependencies

- `@engine/core` - Core utilities
- `@engine/world` - ECS runtime
- `@engine/gfx-webgpu` - Rendering (for CustomMeshData types)

## License

Part of UGC 3D Platform.


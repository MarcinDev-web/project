# @engine/blocks

Block definitions library for FORGE Engine.

Contains block type definitions, categories, and built-in block library inspired by Kogama/Roblox/Minecraft style blocks.

## Usage

```typescript
import { getBlock, BLOCK_LIBRARY, type BlockDefinition } from '@engine/blocks';

const grassBlock = getBlock('grass');
const allBasicBlocks = getBlocksByCategory('basic');
```

## Exports

- `BlockDefinition` - Block type definition interface
- `BlockCategory` - Block category type
- `BlockMaterialType` - Material type enum
- `BLOCK_LIBRARY` - Built-in block library
- `getBlock(id)` - Get block by ID
- `getBlocksByCategory(category)` - Get all blocks in category
- `getAllCategories()` - Get all available categories


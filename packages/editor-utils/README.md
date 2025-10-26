# @engine/editor-utils

Reusable utilities for building 3D editors and tools.

## Features

- **HistoryManager** - Undo/redo system with command pattern
- **HistoryHelpers** - Entity path computation and serialization helpers
- **SnapSystem** - Grid and object snapping utilities  
- **SnapConfig** - Snap configuration and settings

## Installation

```bash
pnpm add @engine/editor-utils
```

## Usage

### History Manager (Undo/Redo)

```typescript
import { HistoryManager } from '@engine/editor-utils';

const history = new HistoryManager({
  logger: {
    debug: console.debug,
    warn: console.warn,
  }
});

// Execute command
history.execute({
  execute: () => { /* do something */ },
  undo: () => { /* undo it */ },
  description: 'My action'
});

// Undo/Redo
history.undo();
history.redo();
```

### Snap System

```typescript
import { SnapSystem, SnapConfig } from '@engine/editor-utils';

const snapConfig = new SnapConfig();
snapConfig.gridSize = 1.0;
snapConfig.enableGridSnap = true;

const snapSystem = new SnapSystem(snapConfig);

const snapped = snapSystem.snapPosition([1.3, 2.7, 3.1]);
// Result: [1.0, 3.0, 3.0] (snapped to grid)
```

## Dependencies

- `@engine/core` - Math utilities
- `@engine/world` - Entity system (for HistoryHelpers)

## License

MIT


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
import { SnapSystem, SNAP_PRESETS } from '@engine/editor-utils';

// Create with default config
const snapSystem = new SnapSystem();

// Or use a preset
const snapSystem = new SnapSystem(SNAP_PRESETS.NORMAL);

// Or customize
const snapSystem = new SnapSystem({
  enabled: true,
  increment: 1.0,
  axes: { x: true, y: true, z: true },
  rotationAxes: { x: true, y: false, z: true }, // Per-axis rotation snapping
});

// Snap position (creates new array)
const snapped = snapSystem.snapPosition([1.3, 2.7, 3.1]);
// Result: [1.0, 3.0, 3.0] (snapped to grid with increment 1.0)

// Snap position in-place (performance optimized, mutates input)
const position = [1.3, 2.7, 3.1];
snapSystem.snapPositionInPlace(position);
// position is now [1.0, 3.0, 3.0]

// Or use output array to avoid mutating input
const out = [0, 0, 0];
snapSystem.snapPositionInPlace(position, out);
// position unchanged, out contains snapped values

// Snap rotation with per-axis control
const rotation: Quat = [0, 0, 0, 1];
const snappedRotation = snapSystem.snapRotation(rotation);

// Snap scale
const scale = [1.3, 0.7, 2.4];
const snappedScale = snapSystem.snapScale(scale);

// Check if positions are on same grid point
const same = snapSystem.areOnSameGridPoint([1.0, 2.0, 3.0], [1.1, 2.1, 3.1]);
```

## Dependencies

- `@engine/core` - Math utilities
- `@engine/world` - Entity system (for HistoryHelpers)

## License

MIT


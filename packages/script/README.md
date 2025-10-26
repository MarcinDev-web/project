# @engine/script

**UGC Scripting** - LogicCubes system, sandbox.

## Zawartość

- **ScriptRuntime** - Sandboxed script execution
- **LogicCubes** - Visual scripting system
- **Behavior** - Behavior trees
- **Coroutines** - Coroutine scheduler

## Zależności

- `@engine/core`
- `@engine/world`

## Instalacja

```bash
pnpm add @engine/script
```

## Użycie

```typescript
import { LogicCubeSystem, BuiltInCubes } from '@engine/script';

const scriptSystem = new LogicCubeSystem(world);
world.addSystem(scriptSystem);

// Register cubes
scriptSystem.registerCube(new BuiltInCubes.PlayerEnterZone());
scriptSystem.registerCube(new BuiltInCubes.OpenDoor());
```

## Status

✅ **Zmigrowany** - Faza 4 zakończona (26.10.2025)

## Features

- 30 plików źródłowych
- ~2,200 linii kodu
- 124 dist files
- 9 built-in LogicCubes
- Behavior system with coroutines
- Connection management for visual scripting
- Circular dependency resolved (components moved to @engine/script)

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


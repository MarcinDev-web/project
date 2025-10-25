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

🚧 **W budowie** - Placeholder dla przyszłej migracji

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


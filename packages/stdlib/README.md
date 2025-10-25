# @engine/stdlib

**Standard Library** - Prefabs and common systems.

## Zawartość

- **Animation** - AnimationSystem, state machines, skeletal
- **Audio** - AudioSystem, spatial audio
- **CharacterController** - Kinematic character movement
- **AI** - Pathfinding, navmesh (przyszłość)

## Zależności

- `@engine/core`
- `@engine/world`
- `@engine/assets`
- `@engine/input`

## Instalacja

```bash
pnpm add @engine/stdlib
```

## Użycie

```typescript
import { CharacterController, AnimationSystem } from '@engine/stdlib';

const characterController = new CharacterController(world, inputManager);
world.addSystem(characterController);

const animationSystem = new AnimationSystem(world);
world.addSystem(animationSystem);

// Play animation
animationSystem.play(playerId, 'walk');
```

## Status

🚧 **W budowie** - Placeholder dla przyszłej migracji

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


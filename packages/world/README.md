# @engine/world

**ECS Runtime** - World, Scene, Components, Systems, Physics.

## Zawartość

- **World/Scene** - ECS state management
- **Components** - Transform, Renderable, RigidBody, Camera, Light, etc.
- **Systems** - TransformSystem, PhysicsSystem, CullingSystem
- **Physics** - PhysicsWorld, collision detection, raycasting

## Zależności

- `@engine/core`

## Instalacja

```bash
pnpm add @engine/world
```

## Użycie

```typescript
import { World, Transform, RigidBody } from '@engine/world';
import { Vec3 } from '@engine/core';

const world = new World('My Game');
const entityId = world.createEntity('Player');

world.addComponent(entityId, new Transform(Vec3.zero()));
world.addComponent(entityId, new RigidBody(75)); // 75kg

world.fixedUpdate(1 / 60); // Physics tick
world.update(dt);          // Frame update
```

## Status

🚧 **W budowie** - Placeholder dla przyszłej migracji

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


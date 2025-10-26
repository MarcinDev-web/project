# @engine/core

**Foundation layer** - Low-level utilities used everywhere in the engine.

## Zawartość

- **Math** - Vec3, Mat4, Quat, AABB, Ray
- **ECS Base** - Entity ID, Component interface, System interface
- **EventBus** - Pub/sub event system
- **JobSystem** - Worker abstraction, task queues
- **Utils** - UUID, binary I/O, bit flags

## Zależności

ZERO (to jest base layer)

## Instalacja

```bash
pnpm add @engine/core
```

## Użycie

```typescript
import { Vec3, Mat4, EventBus } from '@engine/core';

const position = Vec3.create(1, 2, 3);
const matrix = Mat4.identity();

const events = new EventBus();
events.on('test', () => console.log('Event fired'));
```

## Status

✅ **Zmigrowany** - Faza 1 zakończona (26.10.2025)

## Testy

Pakiet posiada 17 przechodzących testów:
- math.test.ts (17 testów - Vec3, Mat4, Quat, helpers)

```bash
pnpm test
```

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


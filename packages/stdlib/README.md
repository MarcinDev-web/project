# @engine/stdlib

**Standard Library** - Animation, audio, character controller.

## Zawartość

- **Animation** - AnimationSystem, AnimationClip, AnimationController, AnimationStateMachine, SkeletalAnimation
- **Audio** - AudioSystem, AudioManager, SpatialAudioSource (Web Audio API wrapper)
- **CharacterController** - PlayerController, CharacterControllerSystem, gameplay intent system

## Zależności

- `@engine/core` (math, ECS base)
- `@engine/world` (Scene, Components, PhysicsWorld)

## Instalacja

```bash
pnpm add @engine/stdlib
```

## Użycie

### Animation

```typescript
import { AnimationSystem } from '@engine/stdlib/Animation';
import { Scene } from '@engine/world';

const scene = new Scene();
const animSystem = new AnimationSystem(scene);

// Update loop
function update(deltaTime: number) {
  animSystem.update(deltaTime);
}
```

### Audio

```typescript
import { audioSystem } from '@engine/stdlib/Audio';

// Initialize
await audioSystem.ready();

// Play SFX
await audioSystem.sfx.playClip('jump');

// Play music
await audioSystem.music.play('background-music');
```

### Character Controller

```typescript
import { CharacterControllerSystem } from '@engine/stdlib/CharacterController';
import { Scene } from '@engine/world';
import { PhysicsWorld } from '@engine/world';

const scene = new Scene();
const physics = new PhysicsWorld();
const charSystem = new CharacterControllerSystem(scene, physics);

// Update loop
function update(deltaTime: number) {
  charSystem.update(deltaTime);
}
```

## Status

✅ **Zmigrowany** - Faza 5 zakończona (26.10.2025)

## Testy

Pakiet posiada 10 przechodzących testów:
- AnimationSystem.test.ts (5 testów)
- AnimationStateMachine.test.ts (5 testów)

```bash
pnpm test
```

## Struktura

```
packages/stdlib/
├── src/
│   ├── Animation/
│   │   ├── AnimationSystem.ts
│   │   ├── AnimationClip.ts
│   │   ├── AnimationController.ts
│   │   ├── AnimationStateMachine.ts
│   │   ├── SkeletalAnimation.ts
│   │   ├── Skeleton.ts
│   │   ├── interpolation.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── Audio/
│   │   ├── AudioSystem.ts
│   │   ├── AudioManager.ts
│   │   └── index.ts
│   ├── CharacterController/
│   │   ├── CharacterControllerSystem.ts
│   │   ├── Controller.ts
│   │   ├── Intent.ts
│   │   ├── PlayerSession.ts
│   │   ├── LocalPlayerController.ts
│   │   ├── CharacterPawn.ts
│   │   ├── RuntimePlayerTag.ts
│   │   ├── ManifestBindings.ts
│   │   ├── PlayerControllerFactory.ts
│   │   └── index.ts
│   └── index.ts
├── __tests__/
│   ├── AnimationSystem.test.ts
│   ├── AnimationStateMachine.test.ts
│   └── helpers/
│       └── animationTestUtils.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)

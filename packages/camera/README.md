# @engine/camera

**Camera Systems** - Orbit camera, FPS camera, camera director with smooth transitions.

## Zawartość

- **OrbitCamera** - Orbit-style mouse controls (class-based)
- **FPSCamera** - First-person camera with pointer lock
- **CameraDirector** - Manages camera modes and smooth transitions
- **createOrbitControls** - Factory function (backward compatibility)

## Zależności

- `@engine/core` (math)
- `@engine/world` (Scene, PhysicsWorld)

## Instalacja

```bash
pnpm add @engine/camera
```

## Użycie

### Orbit Camera

```typescript
import { OrbitCamera, createOrbitControls } from '@engine/camera';

const canvas = document.querySelector('canvas');

// Class-based
const orbitCamera = new OrbitCamera(canvas, {
  initialDistance: 5,
  minDistance: 1,
  maxDistance: 20,
});

const state = orbitCamera.getState();
// state: { yaw, pitch, distance }

orbitCamera.setEnabled(false); // Disable when UI is focused
orbitCamera.cleanup(); // Cleanup

// Or use factory function (backward compatibility)
const controls = createOrbitControls(canvas);
```

### FPS Camera

```typescript
import { FPSCamera } from '@engine/camera';

const fpsCamera = new FPSCamera(canvas, {
  eyeHeight: 1.6,
  sensitivity: 0.0025,
  pitchLimit: Math.PI / 2 - 0.05,
});

// Enable pointer lock
fpsCamera.enable();

// Get view matrix
const viewMatrix = fpsCamera.getViewMatrix(playerPosition);

// Get direction vectors
const forward = fpsCamera.getForwardDirection();
const right = fpsCamera.getRightDirection();
```

### Camera Director

```typescript
import { CameraDirector } from '@engine/camera';
import { createOrbitControls } from '@engine/camera';

const orbitControls = createOrbitControls(canvas);
const fpsCamera = new FPSCamera(canvas);

const director = new CameraDirector({
  orbitControls,
  fpsCamera,
  canvas,
  scene,
  physicsWorld,
});

// Switch modes
director.setMode('orbit');
director.setMode('fps');

// Blend between modes
director.startBlend('fps', 0.5); // Blend to FPS over 0.5s

// Update (in game loop)
director.update(deltaTime);

// Get matrices
const viewMatrix = director.getViewMatrix();
const projectionMatrix = director.getProjectionMatrix();
```

## Status

✅ **Zmigrowany** - Faza 6 zakończona (26.10.2025)

## Testy

Pakiet jest testowany przez @engine/input (input.test.ts testuje OrbitCamera)

```bash
pnpm test
```

## Struktura

```
packages/camera/
├── src/
│   ├── OrbitCamera.ts (refactored from src/input.ts)
│   ├── FPSCamera.ts
│   ├── CameraDirector.ts
│   └── index.ts
└── __tests__/ (tested via @engine/input)
```

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)

# @engine/camera

**Camera Systems** - Orbit, FPS, TPS cameras.

## Zawartość

- **CameraDirector** - Unified camera director
- **OrbitCamera** - Editor orbit camera
- **FPSCamera** - First-person camera
- **TPSCamera** - Third-person camera

## Zależności

- `@engine/core`
- `@engine/world`

## Instalacja

```bash
pnpm add @engine/camera
```

## Użycie

```typescript
import { CameraDirector, OrbitCamera, FPSCamera } from '@engine/camera';

const orbitCam = new OrbitCamera(Vec3.zero(), 10);
const fpsCam = new FPSCamera(Vec3.create(0, 1.6, 0));

const director = new CameraDirector(orbitCam);

// Switch to FPS
director.blendTo(fpsCam, 0.5); // 0.5s blend

// Update
function update(dt: number) {
  director.update(dt);
  const viewMatrix = director.getViewMatrix();
  renderer.render(world, viewMatrix);
}
```

## Status

🚧 **W budowie** - Placeholder dla przyszłej migracji

Zobacz: [MIGRATION_PLAN.md](../../docs/MIGRATION_PLAN.md)


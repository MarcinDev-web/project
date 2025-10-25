# Plan Migracji do Modularnej Architektury

## Przegląd

Ten dokument opisuje **szczegółowy plan migracji** z obecnej struktury hybrid (src/) do docelowej modularnej architektury (packages/ + apps/).

**Strategia**: **Gradual Refactor** - budujemy nową strukturę równolegle z obecną, krok po kroku.

## Założenia

1. **Zero downtime**: Projekt musi kompilować się i działać po każdej fazie
2. **Testy muszą przejść**: 358 testów musi pozostać green
3. **Atomiczne commity**: Każda faza = osobny commit
4. **Dokumentacja zmian**: Notatki per faza

## Timeline

**Szacowany czas**: 2-3 tygodnie (full-time work)

| Faza | Zadania | Czas | Dependency |
|------|---------|------|------------|
| **Faza 0** | Setup monorepo | 1 dzień | - |
| **Faza 1** | @engine/core | 2 dni | Faza 0 |
| **Faza 2** | @engine/world | 3 dni | Faza 1 |
| **Faza 3** | @engine/gfx-webgpu | 3 dni | Faza 2 |
| **Faza 4** | @engine/script | 2 dni | Faza 2 |
| **Faza 5** | @engine/stdlib | 2 dni | Faza 2 |
| **Faza 6** | @engine/assets, input, camera | 2 dni | Faza 2 |
| **Faza 7** | apps/editor | 3 dni | Fazy 1-6 |
| **Faza 8** | Cleanup | 1 dzień | Faza 7 |

---

## Faza 0: Setup Monorepo

**Cel**: Przygotować infrastrukturę monorepo.

**Czas**: 1 dzień

### Zadania

#### 1. Zainstaluj pnpm

```bash
npm install -g pnpm
```

#### 2. Utwórz `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'shared'
```

#### 3. Zaktualizuj root `package.json`

```json
{
  "name": "ugc-3d-platform",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*",
    "shared"
  ],
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --parallel -r dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^2.1.3",
    "@types/node": "^24.7.2"
  }
}
```

#### 4. Utwórz root `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "paths": {
      "@engine/core": ["./packages/core/src"],
      "@engine/world": ["./packages/world/src"],
      "@engine/gfx-webgpu": ["./packages/gfx-webgpu/src"],
      "@engine/voxel": ["./packages/voxel/src"],
      "@engine/assets": ["./packages/assets/src"],
      "@engine/script": ["./packages/script/src"],
      "@engine/input": ["./packages/input/src"],
      "@engine/camera": ["./packages/camera/src"],
      "@engine/net": ["./packages/net/src"],
      "@engine/stdlib": ["./packages/stdlib/src"]
    }
  }
}
```

#### 5. Utwórz strukturę folderów

```bash
mkdir -p packages apps docs/adr shared
```

#### 6. Zainstaluj zależności

```bash
pnpm install
```

### Weryfikacja

```bash
# Sprawdź że workspace działa
pnpm -r list
```

### Commit

```bash
git add .
git commit -m "feat: Setup monorepo (pnpm workspaces)"
```

---

## Faza 1: @engine/core

**Cel**: Przenieść foundation layer (math, ECS base, event, job).

**Czas**: 2 dni

### Zadania

#### 1. Utwórz pakiet `packages/core`

```bash
cd packages
mkdir -p core/src/{math,ecs,event,job,utils}
cd core
```

#### 2. Utwórz `package.json`

```json
{
  "name": "@engine/core",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./math": "./dist/math/index.js",
    "./ecs": "./dist/ecs/index.js",
    "./event": "./dist/event/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^2.1.3"
  }
}
```

#### 3. Utwórz `tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"]
}
```

#### 4. Przenieś `src/math.ts` → `packages/core/src/math/`

**Akcja**: Rozdziel `src/math.ts` na moduły:

```bash
# W packages/core/src/math/
touch Vec3.ts Mat4.ts Quat.ts AABB.ts Ray.ts helpers.ts index.ts
```

**Przenieś kod**:
- `Vec3.*` → `Vec3.ts`
- `Mat4.*` → `Mat4.ts`
- `Quat.*` → `Quat.ts`
- AABB types → `AABB.ts`
- Ray types → `Ray.ts`
- Helper functions → `helpers.ts`

**`index.ts`**:
```typescript
export * from './Vec3';
export * from './Mat4';
export * from './Quat';
export * from './AABB';
export * from './Ray';
export * from './helpers';
```

#### 5. Przenieś ECS base

**Z**: `src/engine/scene/core/Entity.ts`, `src/engine/scene/components/Component.ts`
**Do**: `packages/core/src/ecs/`

**Uwaga**: Przenoś tylko **typy base** (EntityId, Component interface), nie konkretne komponenty (Transform, etc. - to Faza 2).

```typescript
// packages/core/src/ecs/Entity.ts
export type EntityId = number;

// packages/core/src/ecs/Component.ts
export interface Component {
  readonly type: string;
}

export type ComponentClass<T extends Component = Component> = new (...args: any[]) => T;

// packages/core/src/ecs/System.ts
export interface System {
  readonly requiredComponents: ComponentClass[];
  update(dt: number): void;
  fixedUpdate?(dtFixed: number): void;
}

// packages/core/src/ecs/ComponentStore.ts
export class ComponentStore<T extends Component> {
  // ... implementation
}
```

#### 6. Przenieś EventBus

**Z**: `src/logic/EventBus.ts`
**Do**: `packages/core/src/event/EventBus.ts`

#### 7. Utwórz JobSystem (placeholder)

```typescript
// packages/core/src/job/JobSystem.ts
export enum TaskPriority {
  RenderCritical,
  Background,
  Idle,
}

export interface Task {
  execute(): void | Promise<void>;
  priority: TaskPriority;
}

export interface JobHandle {
  id: number;
  cancel(): void;
  isComplete(): boolean;
  await(): Promise<void>;
}

export class JobSystem {
  constructor(workerCount = navigator.hardwareConcurrency || 4) {
    // TODO: Implement
  }
  
  schedule(task: Task): JobHandle {
    // TODO: Implement
    throw new Error('Not implemented');
  }
  
  update(): void {
    // TODO: Implement
  }
}
```

#### 8. Utwórz Utils

```typescript
// packages/core/src/utils/UUID.ts
export function generateUUID(): string {
  return crypto.randomUUID();
}

// packages/core/src/utils/BitFlags.ts
export class BitFlags {
  private _value: number;
  
  constructor(initial = 0) {
    this._value = initial;
  }
  
  set(flag: number): void {
    this._value |= flag;
  }
  
  unset(flag: number): void {
    this._value &= ~flag;
  }
  
  has(flag: number): boolean {
    return (this._value & flag) === flag;
  }
  
  value(): number {
    return this._value;
  }
}
```

#### 9. Utwórz główny `index.ts`

```typescript
// packages/core/src/index.ts
export * from './math';
export * from './ecs';
export * from './event';
export * from './job';
export * from './utils';
```

#### 10. Build pakietu

```bash
cd packages/core
pnpm build
```

#### 11. Przenieś testy

```bash
mkdir -p packages/core/__tests__
# Przenieś testy math z src/__tests__/math.test.ts
cp ../../src/__tests__/math.test.ts __tests__/
# Update importów:
# - import { ... } from '../math' → import { ... } from '@engine/core/math'
```

#### 12. Uruchom testy

```bash
pnpm test
```

#### 13. Zaktualizuj istniejący kod do używania `@engine/core`

**Przykład**: `src/app.ts`

```typescript
// Przed:
import { mat4LookAt, mat4Multiply, type Mat4, type Vec3 } from './math';

// Po:
import { mat4LookAt, mat4Multiply, type Mat4, type Vec3 } from '@engine/core/math';
```

**Automatyzacja** (find & replace):
```bash
# Zastąp wszystkie importy math
find src -name "*.ts" -exec sed -i "s|from './math'|from '@engine/core/math'|g" {} \;
find src -name "*.ts" -exec sed -i "s|from '../math'|from '@engine/core/math'|g" {} \;
find src -name "*.ts" -exec sed -i "s|from '../../math'|from '@engine/core/math'|g" {} \;
```

#### 14. Sprawdź kompilację

```bash
cd ../.. # root
npm run build
npm test
```

### Weryfikacja

- ✅ `packages/core` kompiluje się
- ✅ `packages/core` testy przechodzą
- ✅ `src/` używa `@engine/core` zamiast `./math`
- ✅ Wszystkie 358 testów przechodzą

### Commit

```bash
git add packages/core
git add src  # Updated imports
git commit -m "feat: Create @engine/core package (math, ECS base, event, job)"
```

---

## Faza 2: @engine/world

**Cel**: Przenieść ECS runtime (World, Scene, Components, Systems).

**Czas**: 3 dni

### Zadania

#### 1. Utwórz pakiet `packages/world`

```bash
cd packages
mkdir -p world/src/{core,components,systems,physics}
cd world
```

#### 2. `package.json`

```json
{
  "name": "@engine/world",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest"
  },
  "dependencies": {
    "@engine/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^2.1.3"
  }
}
```

#### 3. Przenieś `src/engine/scene/core/` → `packages/world/src/core/`

**Pliki**:
- `Entity.ts` (już w @engine/core, więc tylko concrete Entity class)
- `Scene.ts`
- `Transform.ts`

#### 4. Przenieś `src/engine/scene/components/` → `packages/world/src/components/`

**Pliki** (wszystkie komponenty):
- `Transform.ts` (jeśli nie w core/)
- `CameraComponent.ts`
- `LightComponent.ts`
- `PhysicsComponent.ts`
- `MeshComponent.ts`
- `MaterialComponent.ts`
- `AnimationComponent.ts`
- `JointComponent.ts`
- `EnvironmentComponent.ts`
- `LogicCubeComponent.ts`
- `ScriptComponent.ts`
- `RuntimePlayerTag.ts`
- `CharacterController.ts`

#### 5. Przenieś `src/engine/scene/systems/` → `packages/world/src/systems/`

**Pliki**:
- `Raycaster.ts`
- `Selection.ts`

#### 6. Przenieś `src/physics/` → `packages/world/src/physics/`

**Pliki**:
- `PhysicsWorld.ts`
- `PhysicsSystem.ts`
- `CollisionDetection.ts`
- `BoundingVolume.ts`
- `Joint.ts`
- `Octree.ts`
- `PhysicsRaycast.ts`
- `inertia.ts`

#### 7. Zaktualizuj importy w `packages/world`

```typescript
// Przed:
import { Vec3 } from '../../../math';

// Po:
import { Vec3 } from '@engine/core/math';
```

#### 8. Utwórz `index.ts`

```typescript
// packages/world/src/index.ts
export * from './core';
export * from './components';
export * from './systems';
export * from './physics';
```

#### 9. Build

```bash
pnpm build
```

#### 10. Zaktualizuj `src/` do używania `@engine/world`

```typescript
// Przed:
import { Scene } from './engine/scene';
import { Transform } from './engine/scene/core/Transform';

// Po:
import { Scene, Transform } from '@engine/world';
```

#### 11. Usuń duplikaty `src/scene/`

**UWAGA**: `src/scene/` jest duplikatem `src/engine/scene/`. Po migracji do `@engine/world`, usuń cały folder `src/scene/`.

```bash
# Sprawdź że wszystkie importy z src/scene/ zostały zmienione na @engine/world
grep -r "from './scene" src/
grep -r "from '../scene" src/

# Usuń folder
rm -rf src/scene
```

#### 12. Testy

```bash
# Przenieś testy
mkdir -p packages/world/__tests__
cp -r ../../src/__tests__/entity.test.ts __tests__/
cp -r ../../src/__tests__/scene.test.ts __tests__/
cp -r ../../src/__tests__/transform.test.ts __tests__/
cp -r ../../src/__tests__/Physics*.test.ts __tests__/

# Update importów
# ...

pnpm test
```

#### 13. Weryfikacja

```bash
cd ../.. # root
npm test
```

### Weryfikacja

- ✅ `packages/world` kompiluje się
- ✅ `packages/world` testy przechodzą
- ✅ `src/scene/` usunięte (duplikat)
- ✅ Wszystkie 358 testów przechodzą

### Commit

```bash
git add packages/world
git add src
git rm -rf src/scene
git commit -m "feat: Create @engine/world package (ECS runtime, physics)"
```

---

## Faza 3: @engine/gfx-webgpu

**Cel**: Przenieść renderer WebGPU.

**Czas**: 3 dni

### Zadania

#### 1. Utwórz pakiet `packages/gfx-webgpu`

```bash
cd packages
mkdir -p gfx-webgpu/src/{device,resources,view,graph,materials,shaders,textures,shadows,postprocess,core}
cd gfx-webgpu
```

#### 2. `package.json`

```json
{
  "name": "@engine/gfx-webgpu",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest"
  },
  "dependencies": {
    "@engine/core": "workspace:*",
    "@engine/world": "workspace:*",
    "@webgpu/types": "^0.1.65"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^2.1.3"
  }
}
```

#### 3. Przenieś `src/rendering/` → `packages/gfx-webgpu/src/`

**Struktura docelowa**:
```
packages/gfx-webgpu/src/
├── device/
│   └── DeviceManager.ts (refactor z Renderer.ts)
├── resources/
│   └── resources.ts (z src/rendering/resources/)
├── core/
│   └── Renderer.ts, FrameRenderer.ts, ...
├── materials/
├── shaders/
├── textures/
├── shadows/
├── postprocess/
└── index.ts
```

#### 4. Refactor `DeviceManager`

**Przed** (`src/rendering/core/Renderer.ts`):
```typescript
export async function initRenderer(...) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  // ...
}
```

**Po** (`packages/gfx-webgpu/src/device/DeviceManager.ts`):
```typescript
export class DeviceManager {
  adapter: GPUAdapter | null = null;
  device: GPUDevice | null = null;
  queue: GPUQueue | null = null;
  
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    this.adapter = await navigator.gpu.requestAdapter();
    this.device = await this.adapter.requestDevice();
    this.queue = this.device.queue;
  }
}
```

#### 5. Zaktualizuj importy

```typescript
// Przed:
import { Vec3, Mat4 } from '../../../math';
import { Scene, Transform } from '../../../engine/scene';

// Po:
import { Vec3, Mat4 } from '@engine/core/math';
import { Scene, Transform } from '@engine/world';
```

#### 6. Build

```bash
pnpm build
```

#### 7. Zaktualizuj `src/` do używania `@engine/gfx-webgpu`

```typescript
// Przed:
import { initRenderer } from './rendering';

// Po:
import { DeviceManager, Renderer } from '@engine/gfx-webgpu';

const deviceManager = new DeviceManager();
await deviceManager.initialize(canvas);

const renderer = new Renderer(deviceManager, canvas);
```

#### 8. Usuń `src/rendering/`

```bash
rm -rf src/rendering
```

#### 9. Testy

```bash
mkdir -p packages/gfx-webgpu/__tests__
# Przenieś testy rendering
cp -r ../../src/__tests__/rendering.test.ts __tests__/
# ...
pnpm test
```

#### 10. Weryfikacja

```bash
cd ../.. # root
npm test
```

### Weryfikacja

- ✅ `packages/gfx-webgpu` kompiluje się
- ✅ `src/rendering/` usunięte
- ✅ Wszystkie testy przechodzą

### Commit

```bash
git add packages/gfx-webgpu
git add src
git rm -rf src/rendering
git commit -m "feat: Create @engine/gfx-webgpu package (renderer)"
```

---

## Faza 4: @engine/script

**Cel**: Przenieść LogicCubes system.

**Czas**: 2 dni

### Zadania

#### 1. Utwórz pakiet `packages/script`

```bash
cd packages
mkdir -p script/src/{runtime,LogicCubes,dsl,behavior,coroutine,connection,storage}
cd script
```

#### 2. Przenieś `src/logic/` → `packages/script/src/LogicCubes/`

**Pliki**:
- `LogicCubeSystem.ts`
- `ScriptSystem.ts`
- `cubes/` → `LogicCubes/cubes/`
- `Behavior.ts`, `BehaviorRegistry.ts`
- `CoroutineScheduler.ts`
- `LogicConnectionManager.ts`, `LogicConnectionRegistry.ts`
- `VariableStorage.ts`
- `types.ts`

**UWAGA**: `EventBus.ts` już w `@engine/core/event`, nie duplikuj.

#### 3. Build

```bash
pnpm build
```

#### 4. Zaktualizuj `src/` do używania `@engine/script`

```typescript
// Przed:
import { LogicCubeSystem } from './logic/LogicCubeSystem';
import { registerBuiltInLogicCubes } from './logic/cubes';

// Po:
import { LogicCubeSystem, registerBuiltInLogicCubes } from '@engine/script';
```

#### 5. Usuń `src/logic/`

```bash
rm -rf src/logic
```

### Weryfikacja

- ✅ `packages/script` kompiluje się
- ✅ `src/logic/` usunięte
- ✅ Wszystkie testy przechodzą

### Commit

```bash
git add packages/script
git add src
git rm -rf src/logic
git commit -m "feat: Create @engine/script package (LogicCubes)"
```

---

## Faza 5: @engine/stdlib

**Cel**: Przenieść animation, audio, gameplay.

**Czas**: 2 dni

### Zadania

#### 1. Utwórz pakiet `packages/stdlib`

```bash
cd packages
mkdir -p stdlib/src/{Animation,Audio,CharacterController}
cd stdlib
```

#### 2. Przenieś `src/animation/` → `packages/stdlib/src/Animation/`

**Pliki**:
- `AnimationSystem.ts`
- `AnimationStateMachine.ts`
- `AnimationClip.ts`
- `AnimationController.ts`
- `SkeletalAnimation.ts`
- `Skeleton.ts`
- `interpolation.ts`
- `types.ts`

#### 3. Przenieś `src/audio/` → `packages/stdlib/src/Audio/`

**Pliki**:
- `AudioSystem.ts`
- `AudioManager.ts`

#### 4. Przenieś `src/gameplay/` → `packages/stdlib/src/CharacterController/`

**Pliki**:
- `Controller.ts`
- `LocalPlayerController.ts`
- `Intent.ts`
- `ManifestBindings.ts`
- `PlayerControllerFactory.ts`
- `PlayerSession.ts`
- `pawn/CharacterPawn.ts`
- `controllers/`, `session/`, `tags/`

#### 5. Przenieś `src/scene/CharacterControllerSystem.ts` → `packages/stdlib/src/CharacterController/`

#### 6. Build

```bash
pnpm build
```

#### 7. Zaktualizuj `src/` do używania `@engine/stdlib`

```typescript
// Przed:
import { AnimationSystem } from './animation/AnimationSystem';
import { AudioSystem } from './audio/AudioSystem';
import { CharacterController } from './gameplay/Controller';

// Po:
import { AnimationSystem } from '@engine/stdlib/Animation';
import { AudioSystem } from '@engine/stdlib/Audio';
import { CharacterController } from '@engine/stdlib/CharacterController';
```

#### 8. Usuń stare foldery

```bash
rm -rf src/animation src/audio src/gameplay
```

### Weryfikacja

- ✅ `packages/stdlib` kompiluje się
- ✅ `src/animation/`, `src/audio/`, `src/gameplay/` usunięte
- ✅ Wszystkie testy przechodzą

### Commit

```bash
git add packages/stdlib
git add src
git rm -rf src/animation src/audio src/gameplay
git commit -m "feat: Create @engine/stdlib package (animation, audio, character)"
```

---

## Faza 6: @engine/assets, @engine/input, @engine/camera

**Cel**: Przenieść asset management, input, camera.

**Czas**: 2 dni

### Zadania

#### 1. `packages/assets`

```bash
cd packages
mkdir -p assets/src/{core,loaders,streaming,serialization}
```

**Przenieś** `src/editor/assets/` → `packages/assets/src/`

**Pliki**:
- `AssetRegistry.ts` → `core/AssetRegistry.ts`
- `AssetLibrary.ts` → `core/AssetLibrary.ts`
- `AssetImporter.ts` → `loaders/AssetImporter.ts`
- `RecentAssetsTracker.ts` → `core/RecentAssetsTracker.ts`

#### 2. `packages/input`

```bash
mkdir -p input/src
```

**Przenieś**:
- `src/input/InputContext.ts` → `packages/input/src/InputContext.ts`
- `src/input/CharacterInput.ts` → `packages/input/src/CharacterInput.ts`
- `src/input.ts` (orbit controls) → przejdzie do camera

#### 3. `packages/camera`

```bash
mkdir -p camera/src
```

**Przenieś**:
- `src/editor/camera/CameraDirector.ts` → `packages/camera/src/CameraDirector.ts`
- `src/editor/camera/CameraState.ts` → `packages/camera/src/CameraState.ts`
- `src/input.ts` (orbit controls) → `packages/camera/src/OrbitCamera.ts`

**Refactor**: Wydziel orbit controls do klasy `OrbitCamera`.

#### 4. Build pakietów

```bash
cd packages/assets && pnpm build
cd ../input && pnpm build
cd ../camera && pnpm build
```

#### 5. Zaktualizuj importy w `src/`

#### 6. Usuń stare lokalizacje

```bash
rm -rf src/input src/input.ts
# src/editor/assets, src/editor/camera zostają (będą w Fazie 7)
```

### Weryfikacja

- ✅ Wszystkie pakiety kompilują się
- ✅ Testy przechodzą

### Commit

```bash
git add packages/{assets,input,camera}
git add src
git commit -m "feat: Create @engine/assets, @engine/input, @engine/camera packages"
```

---

## Faza 7: apps/editor

**Cel**: Przenieść edytor do `apps/editor`.

**Czas**: 3 dni

### Zadania

#### 1. Utwórz `apps/editor`

```bash
mkdir -p apps/editor/src
cd apps/editor
```

#### 2. `package.json`

```json
{
  "name": "@apps/editor",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "@engine/core": "workspace:*",
    "@engine/world": "workspace:*",
    "@engine/gfx-webgpu": "workspace:*",
    "@engine/assets": "workspace:*",
    "@engine/script": "workspace:*",
    "@engine/input": "workspace:*",
    "@engine/camera": "workspace:*",
    "@engine/stdlib": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vite": "^7.1.9",
    "vitest": "^2.1.3"
  }
}
```

#### 3. Przenieś `src/editor/` → `apps/editor/src/`

**Struktura**:
```
apps/editor/src/
├── ui/
├── managers/
├── controllers/
├── states/
├── panels/
├── core/
├── history/
├── grid/
├── snap/
├── placement/
├── visuals/
├── utils/
├── EditorApp.ts (z src/app.ts)
├── bootstrap.ts (z src/bootstrap.ts)
└── main.ts (z src/main.ts)
```

#### 4. Przenieś `src/app/` → `apps/editor/src/`

Scal `src/app/` z `src/editor/` w `apps/editor/src/`.

#### 5. Przenieś `src/styles/` → `apps/editor/styles/`

#### 6. Przenieś `index.html`, `vite.config.ts`

```bash
cp ../../index.html .
cp ../../vite.config.ts .
```

#### 7. Zaktualizuj `vite.config.ts`

```typescript
// apps/editor/vite.config.ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@engine/core': path.resolve(__dirname, '../../packages/core/src'),
      '@engine/world': path.resolve(__dirname, '../../packages/world/src'),
      '@engine/gfx-webgpu': path.resolve(__dirname, '../../packages/gfx-webgpu/src'),
      '@engine/assets': path.resolve(__dirname, '../../packages/assets/src'),
      '@engine/script': path.resolve(__dirname, '../../packages/script/src'),
      '@engine/input': path.resolve(__dirname, '../../packages/input/src'),
      '@engine/camera': path.resolve(__dirname, '../../packages/camera/src'),
      '@engine/stdlib': path.resolve(__dirname, '../../packages/stdlib/src'),
    },
  },
});
```

#### 8. Build

```bash
pnpm build
```

#### 9. Dev test

```bash
pnpm dev
# Otwórz http://localhost:5173 i sprawdź że działa
```

### Weryfikacja

- ✅ `apps/editor` kompiluje się
- ✅ `apps/editor` uruchamia się w dev mode
- ✅ Wszystkie funkcje editora działają

### Commit

```bash
git add apps/editor
git commit -m "feat: Create apps/editor (edytor jako aplikacja)"
```

---

## Faza 8: Cleanup

**Cel**: Usunąć stare pliki, zaktualizować root.

**Czas**: 1 dzień

### Zadania

#### 1. Usuń `src/`

```bash
# Sprawdź że wszystko zostało przeniesione
ls src/

# Usuń
rm -rf src/
```

#### 2. Zaktualizuj root `package.json`

```json
{
  "name": "ugc-3d-platform",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --filter @apps/editor dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

#### 3. Zaktualizuj root `tsconfig.json`

Usuń stare aliasy do `src/`.

#### 4. Zaktualizuj `README.md`

```markdown
# UGC 3D Platform

Modular WebGPU/TypeScript game engine for UGC platforms.

## Structure

- `packages/` - Engine modules (@engine/*)
- `apps/` - Applications (editor, playground)
- `docs/` - Documentation

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run editor in dev mode
pnpm dev

# Run tests
pnpm test
```

## Packages

- `@engine/core` - Foundation (math, ECS, event, job)
- `@engine/world` - ECS runtime (World, components, systems)
- `@engine/gfx-webgpu` - WebGPU renderer
- `@engine/voxel` - Voxel/microblock system (future)
- `@engine/assets` - Asset loading & streaming
- `@engine/script` - UGC scripting (LogicCubes)
- `@engine/input` - Input management
- `@engine/camera` - Camera systems
- `@engine/net` - Multiplayer (future)
- `@engine/stdlib` - Standard library (animation, audio, character)

## Apps

- `@apps/editor` - Scene editor
- `@apps/playground` - Demo/sandbox (future)
```

#### 5. Usuń stare pliki root

```bash
rm -f src/main.ts src/bootstrap.ts src/app.ts src/math.ts src/logger.ts src/input.ts
rm -f index.html vite.config.ts  # Teraz w apps/editor/
```

#### 6. Przenieś testy

```bash
# Przenieś pozostałe testy z src/__tests__/ do odpowiednich pakietów
# ...
rm -rf src/__tests__
```

#### 7. Przenieś `examples/` (jeśli istnieje)

```bash
mkdir -p apps/playground
# ...
```

#### 8. Final build & test

```bash
pnpm install  # Refresh workspaces
pnpm build
pnpm test
```

### Weryfikacja

- ✅ `src/` usunięte
- ✅ Wszystkie pakiety kompilują się
- ✅ Wszystkie 358 testów przechodzą
- ✅ `apps/editor` uruchamia się

### Commit

```bash
git add .
git rm -rf src
git commit -m "chore: Complete migration to modular architecture"
```

---

## Post-Migration

### 1. Publikacja Pakietów (Optional)

Jeśli chcesz publikować jako SDK:

```bash
# Setup npm scopes
npm login

# Publish packages
cd packages/core && npm publish --access public
cd packages/world && npm publish --access public
# ...
```

### 2. CI/CD Setup

**.github/workflows/ci.yml**:
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
```

### 3. Dokumentacja

Zaktualizuj linki w `docs/` do nowych lokalizacji pakietów.

---

## Troubleshooting

### Problem: Circular Dependencies

```
Error: Circular dependency detected:
  @engine/world → @engine/gfx-webgpu → @engine/world
```

**Rozwiązanie**: Zależności muszą być acykliczne. Renderer nie powinien importować z World, tylko typy.

### Problem: Testy Nie Przechodzą

```bash
# Sprawdź importy
grep -r "from '\." packages/
```

Wszystkie importy powinny używać `@engine/*` zamiast relative paths.

### Problem: TypeScript Path Aliases

```
Cannot find module '@engine/core'
```

**Rozwiązanie**: Sprawdź `tsconfig.json` paths i upewnij się że package.json ma prawidłowe `exports`.

---

## Podsumowanie

Po zakończeniu migracji:

- ✅ Modularny monorepo (pnpm workspaces)
- ✅ Pakiety `@engine/*` gotowe do publikacji jako SDK
- ✅ Edytor jako aplikacja (`apps/editor`)
- ✅ Czyste zależności (core → world → gfx)
- ✅ Wszystkie 358 testów przechodzą
- ✅ Zero duplikacji kodu

**Rezultat**: Profesjonalna architektura gotowa na skalę.

---

## Następne Kroki

1. ✅ [CURRENT_STRUCTURE.md](./CURRENT_STRUCTURE.md)
2. ✅ [ARCHITECTURE.md](./ARCHITECTURE.md)
3. ✅ [TARGET_STRUCTURE.md](./TARGET_STRUCTURE.md)
4. ✅ [MODULE_SPECIFICATIONS.md](./MODULE_SPECIFICATIONS.md)
5. ✅ [FRAME_MODEL.md](./FRAME_MODEL.md)
6. ✅ [PERFORMANCE_PHILOSOPHY.md](./PERFORMANCE_PHILOSOPHY.md)
7. ✅ [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) (TEN DOKUMENT)
8. ⏭️ [adr/001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md)


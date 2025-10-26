# Architecture - UGC 3D Platform

**Jedno źródło prawdy o architekturze projektu**

## Przegląd

Modularny silnik 3D oparty na WebGPU z profesjonalnym edytorem scen. Architektura monorepo z czystym podziałem na pakiety silnika i aplikacje.

## Struktura Projektu

```
ugc-3d-platform/
├── packages/           # Pakiety silnika (@engine/*)
│   ├── core/          # Fundament (math, ECS types, event, job)
│   ├── world/         # ECS runtime + fizyka
│   ├── gfx-webgpu/    # Renderer WebGPU
│   ├── assets/        # Zarządzanie assetami
│   ├── script/        # Skryptowanie UGC (LogicCubes)
│   ├── input/         # Input management
│   ├── camera/        # Systemy kamer
│   └── stdlib/        # Biblioteka standardowa
├── apps/              # Aplikacje
│   └── editor/        # Edytor scen 3D
└── docs/              # Dokumentacja
```

## Pakiety Silnika

### @engine/core
**Warstwa fundamentu** - niezależna od innych pakietów

**Eksportuje:**
- Math (Vec3, Mat4, Quat, AABB, Ray) - wysokowydajne operacje 3D
- ECS types (EntityId, Component, System) - typy bazowe
- EventBus - pub/sub messaging
- JobSystem - scheduler zadań async
- Utils (UUID, BitFlags, Logger)

**Bez zależności zewnętrznych**

### @engine/world
**ECS runtime** - zarządzanie sceną i fizyką

**Eksportuje:**
- Entity, Scene - zarządzanie sceną
- Transform, Camera, Light, Mesh, Material - komponenty bazowe
- PhysicsWorld, PhysicsSystem - symulacja fizyki
- Raycaster, SelectionManager - narzędzia sceny
- Wszystkie komponenty i systemy ECS

**Zależności:** `@engine/core`

### @engine/gfx-webgpu
**Renderer** - pipeline renderowania WebGPU

**Eksportuje:**
- initRenderer, Renderer - inicjalizacja i główna pętla
- DeviceManager - zarządzanie GPU
- MaterialSystem, TextureManager - materiały i tekstury
- ShadowSystem, PostProcess - cienie i efekty
- BlockLibrary - system bloków

**Zależności:** `@engine/core`, `@engine/world`, `@webgpu/types`

**Architektura:**
- Forward+ rendering
- PBR materials
- Shadow mapping (cascaded + point)
- Texture atlas (100x redukcja bind calls)
- Post-processing (bloom, tone mapping)

### @engine/assets
**Asset management** - ładowanie i cache'owanie

**Eksportuje:**
- AssetRegistry - zarządzanie assetami i bloków
- GltfLoader, TextureLoader - loadery
- StreamingManager - streaming assetów
- RecentAssetsTracker - historia

**Zależności:** `@engine/core`, `@gltf-transform/*`

**Uwaga:** System koncentruje się na blokach z BlockLibrary (@engine/gfx-webgpu). AssetRegistry może rejestrować bloki jako assety.

### @engine/script
**UGC Scripting** - wizualne skryptowanie LogicCubes

**Eksportuje:**
- LogicCubeSystem, LogicCubeRegistry - system kostki
- registerBuiltInLogicCubes - 40+ wbudowanych kostek
- BehaviorSystem - system zachowań
- CoroutineScheduler - korutyny
- LogicConnectionManager - połączenia między kostkami
- VariableStorage - zmienne runtime

**Zależności:** `@engine/core`, `@engine/world`

**Typy kostek:**
- Triggers: onClick, onTimer, onGameStart, onPlayerEnter
- Actions: sendMessage, setVariable, spawnEntity, destroyEntity
- Conditions: compareVariable, isPlayerNear, checkDistance
- Data: variable, counter, timer
- Gates: AND, OR, NOT, Delay

### @engine/input
**Input management** - keyboard, mouse, gamepad

**Eksportuje:**
- InputContext, InputContextManager - konteksty input
- CharacterInput, GameplayInputContext - input dla postaci
- EditorInputContext - input dla editora

**Zależności:** `@engine/core`

### @engine/camera
**Camera systems** - orbit, FPS, director

**Eksportuje:**
- OrbitCamera - kamera orbit dla editora
- FPSCamera - kamera FPS dla play mode
- CameraDirector - zarządzanie kamerami

**Zależności:** `@engine/core`, `@engine/world`

### @engine/stdlib
**Standard library** - systemy gameplay

**Eksportuje:**
- AnimationSystem, AnimationStateMachine - animacje
- AudioSystem, AudioManager - audio
- CharacterController, CharacterControllerSystem - kontroler postaci
- PlayerSession, PlayerControllerFactory - sesja gracza

**Zależności:** `@engine/core`, `@engine/world`

**Cyclic dependency z world** - dozwolone, oba pakiety się kompilują

## Aplikacje

### @apps/editor
**Profesjonalny edytor scen 3D**

**Funkcje:**
- Modern UI z glassmorphism
- Block placement system (Minecraft-style)
- Snap-to-grid z wizualizacją 3D
- Play mode z FPS controls
- History (undo/redo)
- LogicCubes visual scripting
- Animation editor
- Asset browser
- Lighting i environment

**Zależności:** wszystkie pakiety @engine/*

## Zasady Architektoniczne

### Dependency Flow
```
core → world → {gfx-webgpu, assets, script, input, camera, stdlib}
                          ↓
                       editor
```

**Reguły:**
- Core nie ma zależności
- World zależy tylko od core
- Inne pakiety zależą od core i/lub world
- Editor zależy od wszystkich
- Brak cyklicznych zależności (oprócz world ↔ stdlib - dozwolone)

### Module Boundaries
- Każdy pakiet ma jasno zdefiniowany export przez `index.ts`
- Importy tylko z głównego indexu pakietu: `from '@engine/world'`
- Brak importów submodułów: ~~`from '@engine/world/Entity'`~~
- Pakiety są niezależnie kompilowalne

### Performance First
- Question every allocation w hot paths
- Cache locality dla struktur danych
- Batch operations gdzie możliwe
- Lazy load non-critical resources
- Szczegóły w [PERFORMANCE.md](./PERFORMANCE.md)

### Testing Philosophy
- Test behavior, not implementation
- Mock external dependencies
- E2E dla critical user paths
- Unit dla business logic
- Szczegóły w [TESTING.md](./TESTING.md)

## Tech Stack

- **TypeScript 5.9** - strict mode, no `any`
- **WebGPU** - modern GPU API
- **pnpm** - workspaces, fast
- **Vite** - dev server, build tool
- **Vitest** - testing framework
- **gl-matrix** - math library
- **@gltf-transform** - GLTF processing

## Development Workflow

```bash
# Instalacja
pnpm install

# Build wszystkich pakietów
pnpm build

# Dev editor
pnpm dev

# Testy
pnpm test

# Linting
pnpm lint
```

### Praca z pakietami

```bash
# Build konkretnego pakietu
cd packages/world
pnpm build

# Watch mode
pnpm dev

# Testy pakietu
pnpm test
```

## Szczegóły Techniczne

Dokumenty techniczne w `technical/`:
- [FRAME_MODEL.md](./technical/FRAME_MODEL.md) - model ramki renderowania
- [PLAY_MODE.md](./technical/PLAY_MODE.md) - state machine play mode

## Historia Decyzji

Architecture Decision Records w `adr/`:
- [001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md) - decyzja o modularnej architekturze

---

**Status:** ✅ Migracja do modularnej architektury zakończona (Fazy 0-8)  
**Ostatnia aktualizacja:** 2025-10-26

# Architecture - Forge Engine

**Jedno źródło prawdy o architekturze projektu**

## Przegląd

Modularny silnik 3D oparty na WebGPU z profesjonalnym edytorem scen i kompletną platformą multiplayer. Architektura monorepo z czystym podziałem na pakiety silnika i aplikacje.

## Struktura Projektu

```
forge-engine/
├── packages/           # Pakiety silnika (@engine/*)
│   ├── core/          # Fundament (math, ECS types, event, job, utils)
│   ├── world/         # ECS runtime + fizyka
│   ├── gfx-webgpu/    # Renderer WebGPU
│   ├── script/        # Skryptowanie UGC (LogicCubes)
│   ├── stdlib/        # Biblioteka standardowa (animation, audio, character)
│   ├── input/         # Input management
│   ├── camera/        # Systemy kamer
│   ├── editor-utils/  # Narzędzia edytorskie (history, snap)
│   ├── test-utils/    # Narzędzia testowe (mocks, fixtures, assertions)
│   ├── animation/     # System animacji
│   ├── avatar/        # System awatarów i customizacji
│   ├── blocks/        # System bloków i generacji modeli
│   ├── brand/         # Branding i zasoby wizualne
│   ├── economy/       # System ekonomii i walut
│   ├── gateway/       # API gateway i rate limiting
│   ├── microblocks/   # System mikrobloków (voxel)
│   ├── net/           # Networking client-side
│   ├── net-protocol/  # Definicje protokołu sieciowego
│   ├── net-server/    # Networking server-side
│   ├── voxel/         # System voxeli i renderowania chunków
│   ├── wasm-collision/# WASM collision detection
│   ├── world-server/  # Server-side world management
│   └── world-templates/ # Szablony światów
├── apps/              # Aplikacje
│   ├── editor/        # Edytor scen 3D
│   ├── player/        # Klient gry (player)
│   ├── platform/      # Platforma web (dashboard, marketplace)
│   ├── net-server/    # Serwer API i bazy danych
│   └── collab-server/ # Serwer kolaboracji WebRTC
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
- Utils (UUID, BitFlags, Logger, DisposableGroup)

**Utils:**
- `DisposableGroup` - universal resource cleanup pattern (Oct 2025)
- `UUID` - unique identifier generation
- `BitFlags` - bit manipulation utilities
- `Logger` - logging utilities

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

### @engine/test-utils
**Test utilities** - reużywalne narzędzia testowe

**Eksportuje:**
- createMockCanvas, createMockGPU - WebGPU/Canvas mocks
- entityFixtures - entity test fixtures
- expectVec3ToBeCloseTo - custom assertions
- waitFor - async test utilities

**Zależności:** `@engine/core`, `@engine/world`

**Przeznaczenie:**
- Reużywalne mocks i fixtures
- Custom matchers i assertions
- Helpers dla testów async
- Snapshot testing utilities

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

### @engine/editor-utils
**Narzędzia edytorskie** - reużywalne utilities dla edytorów (NEW - Oct 2025)

**Eksportuje:**
- HistoryManager - system undo/redo z scene snapshots
- HistoryHelpers - entity path computation, serialization
- SnapSystem - grid snapping (position, rotation, scale)
- SnapConfig - konfiguracja snappingu, presety (FINE/NORMAL/COARSE)

**Zależności:** `@engine/core`, `@engine/world`

**Przeznaczenie:**
- Reużywalne narzędzia edytorskie (nie UI)
- Mogą być używane w różnych edytorach/toolach
- Logika bez zależności od DOM/UI

**Przykład użycia:**
```typescript
import { HistoryManager, SnapSystem } from '@engine/editor-utils';

const history = new HistoryManager(100);
const snap = new SnapSystem({ increment: 0.5 });
```

### @engine/animation
**System animacji** - zaawansowany runtime animacji

**Eksportuje:**
- AnimationClip, AnimationTrack - klipy i ścieżki animacji
- AnimationBlender - mieszanie animacji
- GLTF animation support - import z GLTF
- Skeletal animation - animacja szkieletowa z skinningiem

**Zależności:** `@engine/core`, `@engine/world`

### @engine/avatar
**System awatarów** - customizacja postaci

**Eksportuje:**
- AvatarBuilder - builder awatarów
- BodyPart, CharacterRig - części ciała i rigging
- AvatarCustomizer - system customizacji

**Zależności:** `@engine/core`, `@engine/world`, `@engine/animation`

### @engine/blocks
**System bloków** - definicje i generacja modeli

**Eksportuje:**
- BlockLibrary - biblioteka bloków
- ModelBuilder - proceduralny generator modeli
- BlockPalette - palety bloków

**Zależności:** `@engine/core`, `@engine/world`

### @engine/economy
**System ekonomii** - wirtualna waluta i transakcje

**Eksportuje:**
- CurrencySystem - zarządzanie walutami
- TransactionManager - system transakcji
- MarketplaceIntegration - integracja z marketplace

**Zależności:** `@engine/core`

### @engine/voxel
**System voxeli** - renderowanie i generacja terenu

**Eksportuje:**
- VoxelChunk, VoxelWorld - chunki i świat voxelowy
- TerrainGenerator - generator terenu
- VoxelRenderer - renderer voxeli

**Zależności:** `@engine/core`, `@engine/world`, `@engine/gfx-webgpu`

### @engine/microblocks
**Mikrobloki** - precyzyjne budowanie

**Eksportuje:**
- MicroblockSystem - system mikrobloków
- SubBlockPlacement - umieszczanie sub-bloków
- AdvancedPlacementTools - zaawansowane narzędzia

**Zależności:** `@engine/core`, `@engine/world`

### @engine/world-templates
**Szablony światów** - gotowe konfiguracje

**Eksportuje:**
- WorldTemplate - system szablonów
- TemplateLoader - ładowanie szablonów
- ScenarioBuilder - builder scenariuszy

**Zależności:** `@engine/core`, `@engine/world`

### @engine/net
**Networking client** - synchronizacja multiplayer (klient)

**Eksportuje:**
- NetworkClient - klient sieciowy
- EntitySync - synchronizacja encji
- ZoneManager - zarządzanie strefami

**Zależności:** `@engine/core`, `@engine/world`

### @engine/net-protocol
**Protokół sieciowy** - definicje wspólne

**Eksportuje:**
- MessageTypes - typy wiadomości
- Serialization - serializacja danych
- ProtocolVersion - wersjonowanie protokołu

**Zależności:** Brak (shared)

### @engine/net-server
**Networking server** - logika serwera

**Eksportuje:**
- ServerNetworkManager - zarządzanie siecią
- SessionManager - zarządzanie sesjami
- ServerZoneManager - serwer stref

**Zależności:** `@engine/core`, `@engine/world-server`, `@engine/net-protocol`

### @engine/world-server
**Server world** - symulacja po stronie serwera

**Eksportuje:**
- ServerWorld - świat serwerowy
- HeadlessPhysics - fizyka bez renderowania
- ServerEntityManager - zarządzanie encjami

**Zależności:** `@engine/core`, `@engine/world`

### @engine/gateway
**API Gateway** - zarządzanie API

**Eksportuje:**
- APIGateway - gateway API
- RateLimiter - rate limiting
- TokenAuth - autentykacja tokenowa
- ServiceRegistry - rejestr serwisów

**Zależności:** Brak (standalone)

### @engine/brand
**Branding** - zasoby brandingowe

**Eksportuje:**
- Logo, Wordmark - zasoby logo
- BrandColors - kolory brandingowe
- Typography - typografia

**Zależności:** Brak (assets)

### @engine/wasm-collision
**WASM Collision** - detekcja kolizji w WASM

**Eksportuje:**
- WASMCollisionWorld - świat kolizji WASM
- initWASM - inicjalizacja modułu

**Zależności:** Rust/WASM

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

### @apps/player
**Klient gry** - aplikacja do grania

**Funkcje:**
- Multiplayer support
- Real-time synchronization
- Save system i checkpoints
- Performance monitoring
- Chat system
- Input handling

**Zależności:** `@engine/core`, `@engine/world`, `@engine/gfx-webgpu`, `@engine/stdlib`, `@engine/net`, `@engine/avatar`

### @apps/platform
**Platforma Web** - interfejs platformy

**Funkcje:**
- User dashboard
- Game browser i launcher
- Studio i zarządzanie projektami
- Marketplace (assets, games)
- Social (friends, chat, forum)
- User profiles

**Zależności:** React, własne API

### @apps/net-server
**Serwer API** - backend platformy

**Funkcje:**
- RESTful API
- Authentication (JWT)
- Database (Prisma + PostgreSQL)
- WebSocket support
- Asset storage
- User management
- Forum, marketplace, studio

**Zależności:** Express, Prisma, WebSocket

### @apps/collab-server
**Serwer kolaboracji** - real-time multiplayer

**Funkcje:**
- WebRTC signaling
- Room management
- Real-time synchronization
- Session handling

**Zależności:** WebSocket, WebRTC

## Zasady Architektoniczne

### Dependency Flow
```
Level 0: core (fundament)
         ↓
Level 1: world, net-protocol (shared)
         ↓
Level 2: gfx-webgpu, script, input, camera, stdlib, animation, 
         blocks, voxel, microblocks, world-templates, net, 
         world-server, editor-utils, avatar
         ↓
Level 3: net-server, gateway
         ↓
Level 4: apps (editor, player, platform, net-server, collab-server)
```

**Reguły:**
- Core nie ma zależności (Level 0)
- World zależy tylko od core (Level 1)
- Pakiety silnika zależą od core i/lub world (Level 2)
- Networking i gateway na Level 3
- Aplikacje zależą od odpowiednich pakietów (Level 4)
- Brak cyklicznych zależności (oprócz world ↔ stdlib - dozwolone)

### Module Boundaries
- Każdy pakiet ma jasno zdefiniowany export przez `index.ts`
- Importy tylko z głównego indexu pakietu: `from '@engine/world'`
- Lub dokumentowane subpaths: `from '@engine/core/math'`, `from '@engine/core/utils'`
- Brak importów submodułów: ~~`from '@engine/world/Entity'`~~
- Brak importów wewnętrznych: ~~`from '../packages/core/src/...'`~~
- Pakiety są niezależnie kompilowalne

**Egzekwowanie:**
- ESLint rule `no-restricted-imports` blokuje importy do `packages/*/src/**`
- TypeScript `paths` aliasy kierują na `@engine/*` abstrakcje
- Code review checklist wymaga compliance z granicami modułów
- Pre-commit hooks uruchamiają linter przed każdym commitem

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

## Organizacja Pakietów (Package Guidelines)

### Zasady alokacji kodu

**Kod należy do `packages/` gdy:**
- Jest reużywalny poza editorem
- Nie ma zależności od editor-specific UI
- Implementuje logikę biznesową/core functionality
- Może być używany w innych aplikacjach (playground, viewer, etc.)

**Kod należy do `apps/editor/` gdy:**
- Jest ściśle związany z editor UI
- Zarządza editor-specific state
- Implementuje workflows/UX edytora
- Ma zależności od DOM/browser APIs specyficzne dla edytora

### Import Policy

✅ **Zawsze:**
```typescript
import { Something } from '@engine/package-name';
```

❌ **Nigdy:**
```typescript
import { Something } from '../../../packages/package-name/src/...';
```

### Szczegółowe guidelines
Zobacz [PACKAGE_GUIDELINES.md](./PACKAGE_GUIDELINES.md) dla decision tree, examples, i anti-patterns.

---

## Niedawny Refactoring (Oct 2025)

### Code Duplication Elimination

Przeprowadzono major refactoring eliminujący duplikację kodu między `apps/editor` a `packages/`:

**Faza 1:** Camera & Asset Loaders
- Usunięto duplikaty: CameraDirector, FPSCamera, AssetImporter, GltfOptimizer
- Impact: -805 linii

**Faza 2:** AssetRegistry & AssetTypes Unification
- AssetRegistry: 689 → 38 linii (thin wrapper)
- AssetTypes: usunięty z editora
- Impact: -1018 linii

**Faza 3:** Utilities Migration
- Utworzono `@engine/editor-utils` package
- DisposableGroup → `@engine/core/utils`
- HistoryManager, SnapSystem → `@engine/editor-utils`
- Impact: ~850 linii moved to packages

**Rezultaty:**
- -1823 linie duplikatów wyeliminowane
- +1 nowy pakiet (@engine/editor-utils)
- -10.35 kB bundle size
- 100% import consistency
- 0 breaking changes

**Szczegóły:** Zobacz [REFACTORING_COMPLETE.md](./REFACTORING_COMPLETE.md)

---

## Editor UI Architecture

### Panel System

Editor używa modularnego systemu paneli zarządzanego przez `EditorPanelManager`:

**Lokalizacja:** `apps/editor/src/editor/panels/`

**Dostępne panele:**
- **LayersPanel** - zarządzanie warstwami sceny
- **BookmarksPanel** - zakładki do szybkiej nawigacji
- **HistoryPanel** - historia undo/redo
- **LogicPanel** - konfiguracja LogicCubes
- **TemplateGalleryPanel** - galeria szablonów
- **VegetationPanel** - narzędzia do roślinności
- **NpcPanel** - konfiguracja NPC
- **WeaponPanel** - zarządzanie bronią
- **UIPanel** - elementy UI canvas
- **TerrainPanel** - narzędzia terenu
- **RenderSettingsPanel** - ustawienia renderowania
- **SettingsPanel** - preferencje edytora (UI, kamera, precyzja, historia)

**Wzorzec implementacji:**
- Każdy panel to klasa z metodą `mount(parent: HTMLElement)`
- Panele implementują `dispose()` dla cleanup
- Style w `ui-panel.css` (wspólne style dla wszystkich paneli)
- Ustawienia zapisywane w localStorage przez `storageSave/load`

**SettingsPanel** (Oct 2025):
- Zarządza preferencjami edytora (UI visibility, precision controls, camera settings)
- Synchronizuje się z `EditorState` w czasie rzeczywistym
- Persistuje ustawienia między sesjami
- Sekcje: UI Preferences, Precision Controls, Camera Preferences, Rotation Snap, History, Easy Place Mode

## Szczegóły Techniczne

Dokumenty techniczne w `technical/`:
- [FRAME_MODEL.md](./technical/FRAME_MODEL.md) - model ramki renderowania
- [PLAY_MODE.md](./technical/PLAY_MODE.md) - state machine play mode

## Historia Decyzji

Architecture Decision Records w `adr/`:
- [001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md) - decyzja o modularnej architekturze

---

**Status:** ✅ Architektura produkcyjna - kompletna platforma multiplayer  
**Ostatnia aktualizacja:** 2025-11-12

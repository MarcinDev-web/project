# Architektura Silnika WebGPU/TypeScript dla Platformy UGC 3D

## Wizja

Budujemy platformę UGC 3D (nextgen Roblox/Kogama) opartą na WebGPU i TypeScript. To nie jest silnik gier AAA dla konsol - to praktyczna architektura dla:

- 🌐 **Przeglądarka** (WebGPU)
- 👥 **Multiplayer**
- 🎨 **Edytor** wbudowany
- 🧱 **Voxele/mikrobloki**
- 🎮 **User-generated content**
- 📦 **Skala internetowa** z narzędziami indie

## Zasada #0: Silnik = Runtime + API, Nie Singleton

**Najważniejsza zasada**: Silnik nie jest "wielkim singletonem z miliardem managerów".

```
Silnik = Runtime + API
```

### Co To Znaczy?

- **Silnik** dostarcza prymitywów (Entity, Component, Renderer, Physics)
- **Edytor** jest **klientem** tego API
- **Gra użytkownika** jest **klientem** tego API
- **Silnik nie wie**, że robisz "parkour RPG tower defense z laserami"

### Analogia: DOM vs Aplikacje Web

```
DOM = prymitywy (div, canvas, button)
TODO App = klient DOM API

Silnik = prymitywy (Entity, Mesh, RigidBody)
Twoja Gra = klient Engine API
```

### Dlaczego To Jest Kluczowe?

✅ **Możesz podmienić renderer** (WebGPU → WebGL → Canvas2D)
✅ **Możesz wymienić fizykę** (własna → Box2D → Rapier)
✅ **Możesz wrzucić runtime do iframe sandbox** usera
✅ **Edytor nie ma backdoorów** - używa tego samego API co user

## Architektura Modułów

### Struktura Monorepo

```
packages/          # Moduły silnika (@engine/*)
  core/            # @engine/core - Foundation
  world/           # @engine/world - Runtime ECS
  gfx-webgpu/      # @engine/gfx-webgpu - Renderer
  voxel/           # @engine/voxel - Voxel/chunk system
  assets/          # @engine/assets - Asset loading/streaming
  script/          # @engine/script - UGC scripting (sandbox)
  input/           # @engine/input - Input management
  camera/          # @engine/camera - Camera systems
  net/             # @engine/net - Multiplayer (przyszłość)
  stdlib/          # @engine/stdlib - Standard prefabs

apps/              # Aplikacje
  editor/          # Edytor (React + WebGPU canvas)
  playground/      # Demo/sandbox

docs/              # Dokumentacja
```

## Moduły Core

### 1. `@engine/core` - Foundation Layer

**Odpowiedzialność**: Narzędzia niskiego poziomu używane wszędzie.

**ZERO**: WebGPU, Scene, Voxele.

**Zawartość**:

#### JobSystem / TaskScheduler
```typescript
// Abstrakcja nad Worker'ami i requestIdleCallback
interface JobSystem {
  schedule(task: Task, priority: TaskPriority): JobHandle;
  cancel(handle: JobHandle): void;
}

enum TaskPriority {
  RenderCritical,    // Input, physics tick
  Background,        // Chunk meshing, asset loading
  Idle,              // AI pathfinding, navmesh bake
}
```

**Dlaczego?**: Chunk mesher w voxelach nie może blokować inputu.

#### ECS Foundation
```typescript
// Minimalna warstwa ECS - tylko typy i bazy
type EntityId = number;

interface Component {
  readonly type: string;
}

interface System {
  update(dt: number): void;
  requiredComponents: ComponentType[];
}
```

**Nie zawiera**: Konkretnych komponentów (Transform, Mesh, etc.) - to w `@engine/world`.

#### Math
```typescript
// Wektory, macierze, quaterniony
class Vec3 {
  x: number; y: number; z: number;
  static create(x, y, z): Vec3;
  static add(a: Vec3, b: Vec3): Vec3;
  static dot(a: Vec3, b: Vec3): number;
  // ...
}

class Mat4 { /* 4x4 matrix */ }
class Quat { /* quaternion */ }

// Geometria
interface AABB {
  min: Vec3;
  max: Vec3;
}

class Ray {
  origin: Vec3;
  direction: Vec3;
}
```

**Uwaga**: Nie używamy zewnętrznej libki (gl-matrix) w rdzeniu bez opakowania - musimy móc ją wymienić.

#### EventBus / Signal
```typescript
// Lekki pub/sub (namespaced, nie globalny)
class EventBus {
  on(event: string, callback: Function): Unsubscribe;
  emit(event: string, data?: any): void;
  off(event: string, callback: Function): void;
}
```

**Przykłady użycia**:
- Editor UI słucha `chunkRemeshed`
- Gameplay słucha `playerDied`
- Scripts słuchają `triggerActivated`

#### Utils
- UUID generation
- Binary I/O (dla serializacji)
- Bitflags
- Małe utility functions

**Zależności**: ZERO (to jest base layer)

---

### 2. `@engine/world` - Runtime Świata

**Odpowiedzialność**: Symulacja gry. Nie rendering. Nie GPU. Prawa fizyki świata.

**Zawartość**:

#### World / Scene
```typescript
class World {
  // ECS state
  entities: Map<EntityId, Entity>;
  components: ComponentStore;
  systems: System[];
  
  // Simulation clock
  fixedUpdate(dtFixed: number): void;   // 60Hz logika (niezależnie od FPS)
  update(dtRender: number): void;       // Per frame
  
  // Chunk management (dla voxeli)
  loadChunk(chunkId: ChunkId): void;
  unloadChunk(chunkId: ChunkId): void;
}
```

#### Komponenty Bazowe
```typescript
// Transform - pozycja, rotacja, skala, hierarchia
interface Transform extends Component {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  parent: EntityId | null;
  children: EntityId[];
  localMatrix: Mat4;
  worldMatrix: Mat4;
}

// Renderable - referencja do mesh/material
interface Renderable extends Component {
  meshId: MeshHandle;
  materialId: MaterialHandle;
  visible: boolean;
}

// Collider - shape info dla fizyki
interface Collider extends Component {
  shape: 'box' | 'sphere' | 'capsule' | 'mesh';
  size: Vec3;
  offset: Vec3;
}

// RigidBody - prędkości, masa, gravity
interface RigidBody extends Component {
  velocity: Vec3;
  angularVelocity: Vec3;
  mass: number;
  gravityScale: number;
  isKinematic: boolean;
}

// Script - callbacki userlandowe
interface Script extends Component {
  scriptId: string;
  state: any;
}
```

#### Systemy Runtime
```typescript
// TransformSystem - aktualizuje globalne macierze (parent-child)
class TransformSystem implements System {
  update(dt: number): void {
    // Traverse hierarchy, compute worldMatrix
  }
}

// PhysicsSystem - integruje prędkości, rozwiązuje kolizje
class PhysicsSystem implements System {
  fixedUpdate(dtFixed: number): void {
    // Apply forces, resolve collisions
  }
}

// ScriptSystem - odpala logiczne skrypty użytkownika
class ScriptSystem implements System {
  fixedUpdate(dtFixed: number): void {
    // Execute user scripts (sandboxed)
  }
}

// CullingSystem - wyznacza co jest widoczne dla kamery
class CullingSystem implements System {
  update(camera: Camera): VisibleSet {
    // Frustum culling, occlusion hints
  }
}
```

**Headless-friendly**: Ten moduł można odpalić bez GPU (server tick, testy, replays).

**Zależności**: `@engine/core`

---

### 3. `@engine/gfx-webgpu` - Renderer WebGPU

**Odpowiedzialność**: Rendering. Świat nic o nim nie wie, renderer tylko "patrzy" na świat.

**Zawartość**:

#### DeviceManager
```typescript
class DeviceManager {
  adapter: GPUAdapter;
  device: GPUDevice;
  queue: GPUQueue;
  
  async initialize(): Promise<void>;
  getFeatures(): GPUFeatureName[];
  getLimits(): GPUSupportedLimits;
}
```

**Jeden punkt**: Negocjacja GPU capabilities.

#### ResourceCache
```typescript
class ResourceCache {
  // Bufory GPU
  getBuffer(id: BufferId): GPUBuffer;
  createBuffer(desc: BufferDescriptor): BufferId;
  
  // Tekstury
  getTexture(id: TextureId): GPUTexture;
  createTexture(desc: TextureDescriptor): TextureId;
  
  // Shadery (WGSL)
  getShaderModule(id: ShaderId): GPUShaderModule;
  
  // Materiały (pipeline + bind group + params)
  getMaterial(id: MaterialId): Material;
}
```

**Deterministyczny**: `getMeshHandle(meshID)` daje stable handle, unikamy duplikatów.

#### SceneView / RenderView
```typescript
// Abstrakcja kamerki
interface RenderView {
  projection: Mat4;
  view: Mat4;
  viewport: Viewport;
}

class SceneView {
  renderView: RenderView;
  visibleEntities: Entity[];  // Z CullingSystem
  
  render(commandEncoder: GPUCommandEncoder): void;
}
```

#### Render Graph
```typescript
// Struktura passów
interface RenderGraph {
  addPass(pass: RenderPass): void;
  execute(device: GPUDevice): void;
}

// Przykładowe passy:
// - DepthPrepass
// - ShadowPass (cascaded shadow maps)
// - GBufferPass (deferred) lub MainLightingPass (forward PBR)
// - TransparentPass
// - PostProcessPass (bloom, tonemap, LUT)
// - UIPass
```

**Wersja 1**: Może być prostsza (tylko MainLightingPass + PostProcess), ale struktura musi być gotowa na rozbudowę.

#### Materiały / Shadery
```typescript
// Materiał = bundle parametrów dla shaderów
interface Material {
  type: MaterialType;      // StandardLit, Unlit, Voxel, UI, Water
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  params: MaterialParams;  // Kolor, metalness, roughness, emissive, textures
}

// Typy materiałów (dozwolone dla UGC)
enum MaterialType {
  StandardLit,    // PBR z lighting
  Unlit,          // Bez lighting
  Voxel,          // Optymalizowany dla voxeli
  UI,             // 2D UI
  Water,          // Animated water
}
```

**UGC Safety**: User **nie pisze** surowego WGSL. Wybiera typ materiału z katalogu i ustawia parametry.

**Shader Permutations**: Internie generujemy warianty shaderów (np. `USE_LIGHTING | USE_FOG | USE_SKINNING`).

**Zależności**: `@engine/core` (math), `@engine/world` (komponenty)

---

### 4. `@engine/voxel` - System Voxeli/Mikrobloków

**Odpowiedzialność**: Voxele i mikrobloki (subvoxel).

**Zawartość**:

#### ChunkStore
```typescript
// Logiczne dane o voxelach
class ChunkStore {
  chunks: Map<ChunkId, Chunk>;
  
  getBlock(x: number, y: number, z: number): BlockId;
  setBlock(x: number, y: number, z: number, blockId: BlockId): void;
}

interface Chunk {
  position: Vec3;
  blocks: Uint16Array;  // 16x16x16 = 4096 bloków
  palette?: BlockPalette;  // Kompresja (RLE, palette)
  microblocks?: MicroChunk;  // Subvoxel data
}
```

#### ChunkMesher
```typescript
// Worker-based meshing
interface ChunkMesher {
  meshChunk(chunk: Chunk): Promise<MeshData>;
}

// Features:
// - Greedy meshing (łączenie sąsiadujących voxeli w quady)
// - AO (ambient occlusion) per-vertex
// - Mikrobloki (subvoxel): voxel 1x1x1 zawiera 4x4x4 microcells
```

**Mikrobloki**: Wyróżnik platformy.

```typescript
interface MicroChunk {
  resolution: number;  // np. 4 (4x4x4 microcells per voxel)
  data: Uint8Array;    // Dense voxel data
}
```

#### ChunkStreamingSystem
```typescript
// Na podstawie pozycji kamery/gracza
class ChunkStreamingSystem {
  update(cameraPos: Vec3): void {
    // Priorytetyzuj chunki:
    // - Blisko: załaduj + zmeshuj + GPU
    // - Średnio: załaduj logicznie
    // - Daleko: tylko heightmap silhouette (LOD)
  }
}
```

**Workers**: **MUSI** działać w workerach (przez `@engine/core` JobSystem). Meshing w głównym wątku = lagi.

**Zależności**: `@engine/core`, `@engine/world`

---

### 5. `@engine/assets` - Asset Loading & Streaming

**Odpowiedzialność**: Ładowanie zasobów (mesh, textures, animations, sounds, scripts).

**Zawartość**:

#### AssetManager
```typescript
class AssetManager {
  get(uri: string): Promise<Asset>;
  preload(uris: string[]): Promise<void>;
  unload(uri: string): void;
}

// URI resolver: nie tylko HTTP
// - "texture://grass" → może być z bundle, cache, HTTP, IndexedDB
```

#### Loaders
```typescript
interface AssetLoader<T> {
  load(uri: string): Promise<T>;
}

// Loadery dla różnych typów:
// - MeshLoader (GLTF, OBJ)
// - TextureLoader (PNG, KTX2, BC compressed)
// - AnimationLoader
// - AudioLoader
// - ScriptLoader (LogicCubes)
```

#### Streaming
```typescript
// LRU cache - wyrzuca dalekie assety
class AssetCache {
  maxSize: number;
  cache: LRUCache<AssetId, Asset>;
  
  evict(): void;  // Wyrzuć najmniej używane
}
```

#### Serializacja / Eksport Levelek
```typescript
// Pakowanie levelu użytkownika do .ugcpack
interface UGCPack {
  entities: EntityData[];    // ECS state
  voxels: ChunkData[];       // Voxel data
  assets: AssetManifest;     // Embedded textures, meshes, scripts
  metadata: PackMetadata;    // Author, version, permissions
}

function exportWorld(world: World): UGCPack;
function importWorld(pack: UGCPack): World;
```

**Security**: Tu jest punkt moderacji i sandboxing.

**Zależności**: `@engine/core`, `@engine/world`

---

### 6. `@engine/script` - System Skryptów UGC

**Odpowiedzialność**: Bezpieczne wykonywanie user-generated logic.

**Problem**: User nie może mieć pełnego dostępu do `window`, `fetch`, `eval`.

**Rozwiązanie v1**: DSL oparty na danych (LogicCubes).

**Zawartość**:

#### ScriptRuntime
```typescript
class ScriptRuntime {
  executeScript(script: Script, context: ScriptContext): void;
}

interface ScriptContext {
  entity: Entity;
  world: World;
  events: EventBus;
  // Ograniczone API - tylko dozwolone operacje
}
```

#### LogicCubes (DSL)
```typescript
// Skrypt to JSON, nie surowy kod
interface LogicCube {
  type: 'action' | 'condition' | 'trigger' | 'data';
  id: string;
  inputs: Port[];
  outputs: Port[];
  execute(context: ScriptContext): void;
}

// Przykład: "PlayerEnterZone" → "OpenDoor"
const triggerCube: LogicCube = {
  type: 'trigger',
  id: 'player_enter_zone',
  inputs: [{ name: 'zone', type: 'entity' }],
  outputs: [{ name: 'onEnter', type: 'signal' }],
};
```

**Opcja B (przyszłość)**: Sandboxed VM (isolated iframe + postMessage, Realms API).

**Intent**: Engine dostaje wynik intencji ("podnieś obiekt", "zadaj dmg 20"), nie surowy kod z prawami do GPU.

**Zależności**: `@engine/core`, `@engine/world`

---

### 7. `@engine/input` - Input Management

**Odpowiedzialność**: Keyboard, mouse, gamepad, touch.

**Zawartość**:

```typescript
class InputManager {
  keyboard: KeyboardState;
  mouse: MouseState;
  gamepad: GamepadState;
  touch: TouchState;
  
  update(): void;
}

// Stack-based contexts (EditorInputContext, GameplayInputContext)
class InputContextManager {
  push(context: InputContext): void;
  pop(): void;
  current(): InputContext;
}
```

**Zasada**: Input wysyła eventy do ECS jako komponenty `InputState`, nie pcha bezpośrednio kamery.

**Zależności**: `@engine/core`

---

### 8. `@engine/camera` - Camera Systems

**Odpowiedzialność**: Różne tryby kamery.

**Zawartość**:

```typescript
// Orbit camera (edytor)
class OrbitCamera {
  target: Vec3;
  distance: number;
  azimuth: number;
  elevation: number;
  
  getViewMatrix(): Mat4;
}

// FPS camera (gracz)
class FPSCamera {
  position: Vec3;
  yaw: number;
  pitch: number;
  
  getViewMatrix(): Mat4;
}

// TPS camera (third-person)
class TPSCamera {
  target: Entity;
  offset: Vec3;
  
  getViewMatrix(): Mat4;
}

// Unified director
class CameraDirector {
  activeCamera: Camera;
  blendTo(camera: Camera, duration: number): void;
  getViewMatrix(): Mat4;
}
```

**Kamery to encje ECS** z komponentem `Camera` (projekcja, FOV, etc.).

**Zależności**: `@engine/core`, `@engine/world`

---

### 9. `@engine/net` - Networking (Przyszłość)

**Odpowiedzialność**: Multiplayer, replikacja, replay.

**Zawartość**:

```typescript
// Snapshot replicator
class SnapshotReplicator {
  captureSnapshot(world: World): Snapshot;
  applySnapshot(world: World, snapshot: Snapshot): void;
}

// Input replicator (client-side prediction)
class InputReplicator {
  sendInput(input: InputState): void;
  reconcile(serverState: Snapshot): void;
}

// Replay recorder
class ReplayRecorder {
  record(input: InputState, time: number): void;
  playback(time: number): InputState;
}
```

**Headless-friendly**: `@engine/world` można odpalić w workerze jako serwer symulacji.

**Zależności**: `@engine/core`, `@engine/world`

---

### 10. `@engine/stdlib` - Standard Library

**Odpowiedzialność**: Gotowe prefaby używane w większości gier.

**Zawartość**:

```typescript
// CharacterController (kinematic movement)
class CharacterController {
  moveSpeed: number;
  jumpForce: number;
  update(input: InputState, dt: number): void;
}

// AnimationSystem (blending, state machines)
class AnimationSystem {
  play(clip: AnimationClip): void;
  blend(clip1: AnimationClip, clip2: AnimationClip, weight: number): void;
}

// AudioSystem (spatial audio)
class AudioSystem {
  play(sound: AudioClip, position: Vec3): void;
}

// BasicEnemyAI
// DoorTrigger
// Inventory
// ...
```

**Zależności**: `@engine/core`, `@engine/world`

---

## Apps

### `apps/editor/` - Edytor

**Technologie**: React, Tailwind, shadcn/ui, WebGPU canvas.

**Struktura**:
```
apps/editor/
  src/
    ui/              # React components
    managers/        # EditorModeManager, etc.
    controllers/     # Gizmos, placement
    states/          # PlayModeStateMachine states
    panels/          # Outliner, Properties, Assets
  styles/            # CSS
```

**Edytor woła publiczne API**:
```typescript
import { World } from '@engine/world';
import { DeviceManager } from '@engine/gfx-webgpu';

const world = new World();
world.createEntity();
world.addComponent(entity, Transform { ... });
```

**Zero backdoors**: Edytor nie ma `_privateSuperHack()`. Runtime i edytor muszą być spójne.

---

### `apps/playground/` - Demo/Sandbox

Minimalna gra-test do developmentu i testowania engine API.

---

## Performance Philosophy

### 1. Workers

**Wszystko co ciężkie → worker**:
- Chunk meshing (voxele)
- Pathfinding AI
- Lightmap baking
- Navmesh generation

### 2. ECS i SOA (Structure of Arrays)

**Hot data** (Transform) w SOA:
```typescript
// Zamiast:
class Transform {
  position: Vec3;
  rotation: Quat;
}

// Użyj:
class TransformStore {
  positions: Float32Array;  // [x,y,z, x,y,z, ...]
  rotations: Float32Array;  // [x,y,z,w, x,y,z,w, ...]
}
```

**Dlaczego?**: Cache locality, wektorowe operacje, przyszłe GPU compute.

### 3. Render - Minimalizuj Bind Calls

**UGC = tysiące małych meshów**.

**Problem**: Każdy mesh = nowy bind call.

**Rozwiązanie**:
- Grupuj draw calls po materiale
- Instanced rendering (jeden draw call dla 100 meshów)
- Texture atlas (100 materiałów = 1 tekstura = 1 bind)

### 4. Streaming Assetów

**Nie ładuj wszystkiego upfront**:
1. Szkielet mapy (collider + lowpoly proxy)
2. HD tekstury i mesh (gdy kamera blisko)
3. Audio i efekty (on-demand)

### 5. Logika Gry Oddzielona od FPS

**Fixed timestep** dla fizyki/AI (60Hz), niezależnie od FPS:

```typescript
// Słaby laptop: 30 FPS render, ale 60 Hz gameplay
let accumulator = 0;
const fixedDt = 1 / 60;

function frame(dt: number) {
  accumulator += dt;
  
  while (accumulator >= fixedDt) {
    world.fixedUpdate(fixedDt);  // Physics, scripts
    accumulator -= fixedDt;
  }
  
  world.update(dt);     // Rendering, animations
  renderer.render();
}
```

**Rezultat**: Multiplayer nie rozjeżdża się, nawet jeśli ktoś ma słaby laptop.

---

## Frame Model

### Przepływ Pojedynczej Klatki (60 FPS)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INPUT                                                    │
│    InputSystem → zbierz input → aktualizuj InputState      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FIXED UPDATE LOOP (60Hz, niezależnie od FPS)            │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ a. PhysicsSystem.fixedUpdate(1/60)                  │ │
│    │    - Integruj prędkości                             │ │
│    │    - Rozwiąż kolizje                                │ │
│    │    - Aktualizuj RigidBody                           │ │
│    └─────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ b. ScriptSystem.fixedUpdate(1/60)                   │ │
│    │    - Tick LogicCubes                                │ │
│    │    - Execute user scripts (sandbox)                 │ │
│    └─────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ c. CharacterControllerSystem.fixedUpdate(1/60)      │ │
│    │    - Apply movement intent                          │ │
│    │    - Handle jump, crouch, sprint                    │ │
│    └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. VARIABLE UPDATE (per frame)                             │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ a. TransformSystem.update()                         │ │
│    │    - Recompute global matrices (parent-child)       │ │
│    └─────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ b. AnimationSystem.update(dtRender)                 │ │
│    │    - Blend animations                               │ │
│    │    - Update skeleton transforms                     │ │
│    └─────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ c. CullingSystem.update(activeCamera)               │ │
│    │    - Frustum culling                                │ │
│    │    - Occlusion hints                                │ │
│    │    - Build visible list                             │ │
│    └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. RENDER                                                   │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ a. Renderer.prepareFrame()                          │ │
│    │    - Sort by material (reduce bind calls)           │ │
│    │    - Pack instancing data                           │ │
│    └─────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ b. Render Graph Execute:                            │ │
│    │    - DepthPrepass (optional)                        │ │
│    │    - ShadowPass                                     │ │
│    │    - MainLightingPass (PBR + GGX)                   │ │
│    │    - TransparentPass                                │ │
│    │    - PostProcessPass (Bloom, Tonemap, LUT)          │ │
│    │    - UI/HUDPass                                     │ │
│    └─────────────────────────────────────────────────────┘ │
│    ┌─────────────────────────────────────────────────────┐ │
│    │ c. Present to canvas                                │ │
│    └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. ASYNC (background, JobSystem)                           │
│    - Chunk meshing (voxel)                                 │
│    - Asset loading/streaming                               │
│    - Navmesh baking                                        │
│    - Audio processing                                      │
└─────────────────────────────────────────────────────────────┘
```

### Ważne Zasady

1. **Renderer nie modyfikuje stanu gry**
   - Renderer tylko czyta (Transform, Renderable)
   - Nie zmienia pozycji, nie tworzy encji

2. **Świat jest jeden, widoków może być wiele**
   - Split screen: 2 kamery, 1 symulacja
   - Minimap: osobny viewport
   - Edytor: top-down view vs game view

3. **Fixed timestep zapewnia determinizm**
   - Physics zawsze 60 Hz
   - Multiplayer nie rozjeżdża się
   - Replays działają poprawnie

---

## Separator: Authoring vs Runtime

**W edytorze**: Masz 2 światy.

### Authoring World
- Scene edytowana przez użytkownika
- Zawiera gizmos, selection handles, edytor components
- Stan "spoczynku" - nic nie symuluje

### Runtime World
- Kopia authoring world + filtr (manifest)
- Tylko komponenty runtime (Transform, RigidBody, Script)
- Symulacja aktywna (physics, scripts)

### Przejście Edit → Play

```typescript
// 1. Snapshot authoring
const snapshot = worldManager.snapshotAuthoring();

// 2. Build runtime world (z manifestem)
const runtimeWorld = worldManager.buildRuntimeWorld(manifest);

// 3. Graj
runtimeWorld.start();

// 4. Stop → restore
worldManager.restoreAuthoring(snapshot);
worldManager.clearRuntimeWorld();
```

**Dlaczego?**: Authoring i runtime nie mogą się zanieczyszczać. Physics nie może modyfikować authoring.

---

## Diagram Zależności Modułów

```
                 ┌──────────────┐
                 │  apps/editor │
                 └───────┬──────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
 ┌──────────┐    ┌──────────┐    ┌──────────┐
 │ @engine/ │    │ @engine/ │    │ @engine/ │
 │  input   │    │  camera  │    │  assets  │
 └────┬─────┘    └────┬─────┘    └────┬─────┘
      │               │               │
      └───────────────┼───────────────┘
                      │
                      ▼
              ┌───────────────┐
              │  @engine/     │
              │   script      │
              └───────┬───────┘
                      │
                      ▼
      ┌───────────────────────────┐
      │     @engine/world         │
      │  (ECS, Components,        │
      │   Systems, Scene)         │
      └───────┬──────────┬────────┘
              │          │
         ┌────┘          └────┐
         ▼                    ▼
 ┌──────────────┐     ┌──────────────┐
 │  @engine/    │     │  @engine/    │
 │  gfx-webgpu  │     │   voxel      │
 └──────┬───────┘     └──────┬───────┘
        │                    │
        └────────┬───────────┘
                 │
                 ▼
         ┌───────────────┐
         │  @engine/core │
         │  (Math, ECS   │
         │   base, Job,  │
         │   Event)      │
         └───────────────┘
```

**Zasada**: Zależności tylko w dół. Core nie zna World. World nie zna Renderer.

---

## Co To Daje?

### ✅ Przyszłe Korzyści

1. **Podmienialność**
   - Chcesz WebGL zamiast WebGPU? Wymień `@engine/gfx-webgpu` na `@engine/gfx-webgl`
   - Chcesz Rapier physics? Wymień implementację `PhysicsSystem`

2. **Sandbox dla UGC**
   - Runtime w iframe
   - User scripts nie mają dostępu do GPU, DOM, fetch
   - Moderacja i limitowanie

3. **Edytor jako Klient**
   - Edytor używa tego samego API co user
   - Zero backdoorów = zero niespodzianek w production

4. **Headless Server**
   - `@engine/world` działa bez GPU
   - Server tick dla multiplayer
   - Testy bez przeglądarki

5. **SDK dla Twórców**
   - Możesz zapakować jako SDK
   - `npm install @engine/core @engine/world`
   - Ludzie mogą robić własne aplikacje na Twoim runtime

---

## Następne Kroki

1. ✅ [CURRENT_STRUCTURE.md](./CURRENT_STRUCTURE.md) - Zrozumienie obecnego stanu
2. ✅ [ARCHITECTURE.md](./ARCHITECTURE.md) - Wizja modularnego silnika (TEN DOKUMENT)
3. ⏭️ [TARGET_STRUCTURE.md](./TARGET_STRUCTURE.md) - Konkretna struktura folderów
4. ⏭️ [MODULE_SPECIFICATIONS.md](./MODULE_SPECIFICATIONS.md) - Szczegółowe API każdego modułu
5. ⏭️ [FRAME_MODEL.md](./FRAME_MODEL.md) - Szczegółowy opis frame pipeline
6. ⏭️ [PERFORMANCE_PHILOSOPHY.md](./PERFORMANCE_PHILOSOPHY.md) - Optymalizacje
7. ⏭️ [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Plan migracji krok po kroku
8. ⏭️ [adr/001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md) - ADR

---

## Referencje

- [Play Mode State Machine](./PLAY_MODE_STATE_MACHINE.md) - Przykład dobrego designu
- [Testing Workflow](./TESTING.md) - Testowanie
- Inspiracje: Unity ECS, Bevy (Rust), Amethyst, PlayCanvas, Roblox architecture


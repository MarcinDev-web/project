# Docelowa Struktura Projektu

## Przegląd

Docelowa architektura to **monorepo** z czystym podziałem na:
- `packages/` - moduły silnika (`@engine/*`)
- `apps/` - aplikacje (edytor, playground)
- `docs/` - dokumentacja
- `shared/` - współdzielone typy/utils

## Struktura Root

```
ugc-3d-platform/
├── packages/              # Moduły silnika
├── apps/                  # Aplikacje
├── shared/                # Współdzielone
├── docs/                  # Dokumentacja
├── scripts/               # Build scripts, tools
├── .github/               # CI/CD
├── package.json           # Root package (workspace)
├── pnpm-workspace.yaml    # pnpm workspaces config
├── turbo.json             # Turbo build config (optional)
└── tsconfig.json          # Root TypeScript config
```

## Moduły Silnika: `packages/`

### 1. `packages/core/` - @engine/core

**Foundation layer**. Zero zależności zewnętrznych (poza TypeScript).

```
packages/core/
├── src/
│   ├── ecs/
│   │   ├── Entity.ts              # EntityId, entity management
│   │   ├── Component.ts           # Base Component interface
│   │   ├── System.ts              # Base System interface
│   │   ├── ComponentStore.ts      # SOA storage dla komponentów
│   │   └── index.ts
│   │
│   ├── job/
│   │   ├── JobSystem.ts           # Main job scheduler
│   │   ├── TaskQueue.ts           # Priority queues
│   │   ├── WorkerPool.ts          # Worker management
│   │   └── index.ts
│   │
│   ├── math/
│   │   ├── Vec3.ts                # 3D vectors
│   │   ├── Mat4.ts                # 4x4 matrices
│   │   ├── Quat.ts                # Quaternions
│   │   ├── AABB.ts                # Axis-aligned bounding box
│   │   ├── Ray.ts                 # Ray (origin + direction)
│   │   ├── helpers.ts             # Math utilities
│   │   └── index.ts
│   │
│   ├── event/
│   │   ├── EventBus.ts            # Pub/sub event system
│   │   ├── Signal.ts              # Lightweight signals
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── UUID.ts                # UUID generation
│   │   ├── BinaryIO.ts            # Binary serialization
│   │   ├── BitFlags.ts            # Bit manipulation
│   │   └── index.ts
│   │
│   └── index.ts                   # Public API
│
├── __tests__/
│   ├── Vec3.test.ts
│   ├── Mat4.test.ts
│   ├── EventBus.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/core"
├── tsconfig.json
└── README.md
```

**package.json**:
```json
{
  "name": "@engine/core",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./ecs": "./dist/ecs/index.js",
    "./math": "./dist/math/index.js",
    "./event": "./dist/event/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}
```

---

### 2. `packages/world/` - @engine/world

**ECS runtime**. World, Scene, Components, Systems.

```
packages/world/
├── src/
│   ├── core/
│   │   ├── World.ts               # Main World class
│   │   ├── Scene.ts               # Scene (collection of entities)
│   │   └── index.ts
│   │
│   ├── components/
│   │   ├── Transform.ts           # Position, rotation, scale, hierarchy
│   │   ├── Renderable.ts          # Mesh + material reference
│   │   ├── Collider.ts            # Collision shape
│   │   ├── RigidBody.ts           # Physics body
│   │   ├── Script.ts              # Script component
│   │   ├── Camera.ts              # Camera component
│   │   ├── Light.ts               # Light component
│   │   ├── Animation.ts           # Animation state
│   │   ├── Audio.ts               # Audio source
│   │   └── index.ts
│   │
│   ├── systems/
│   │   ├── TransformSystem.ts     # Hierarchy updates
│   │   ├── PhysicsSystem.ts       # Physics simulation
│   │   ├── ScriptSystem.ts        # Script execution
│   │   ├── CullingSystem.ts       # Frustum culling
│   │   ├── Raycaster.ts           # Raycasting
│   │   ├── Selection.ts           # Selection management
│   │   └── index.ts
│   │
│   ├── physics/
│   │   ├── PhysicsWorld.ts        # Physics world
│   │   ├── CollisionDetection.ts  # AABB, OBB, sphere
│   │   ├── BoundingVolume.ts      # Bounding volumes
│   │   ├── Joint.ts               # Physics joints
│   │   ├── Octree.ts              # Spatial partitioning
│   │   ├── inertia.ts             # Inertia calculations
│   │   └── index.ts
│   │
│   └── index.ts                   # Public API
│
├── __tests__/
│   ├── World.test.ts
│   ├── Transform.test.ts
│   ├── PhysicsSystem.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/world"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`

---

### 3. `packages/gfx-webgpu/` - @engine/gfx-webgpu

**WebGPU renderer**.

```
packages/gfx-webgpu/
├── src/
│   ├── device/
│   │   ├── DeviceManager.ts       # GPU device initialization
│   │   ├── FeatureDetection.ts    # Feature detection
│   │   └── index.ts
│   │
│   ├── resources/
│   │   ├── ResourceCache.ts       # Main cache
│   │   ├── BufferManager.ts       # GPU buffers
│   │   ├── TextureManager.ts      # Textures
│   │   ├── ShaderManager.ts       # Shader modules
│   │   ├── MaterialManager.ts     # Materials
│   │   ├── MeshManager.ts         # Mesh data
│   │   └── index.ts
│   │
│   ├── view/
│   │   ├── RenderView.ts          # Camera view abstraction
│   │   ├── SceneView.ts           # Scene rendering view
│   │   ├── Viewport.ts            # Viewport management
│   │   └── index.ts
│   │
│   ├── graph/
│   │   ├── RenderGraph.ts         # Render graph
│   │   ├── RenderPass.ts          # Base pass
│   │   ├── DepthPrepass.ts        # Depth prepass
│   │   ├── ShadowPass.ts          # Shadow mapping
│   │   ├── MainLightingPass.ts    # PBR lighting
│   │   ├── TransparentPass.ts     # Transparent objects
│   │   ├── PostProcessPass.ts     # Post-processing
│   │   ├── UIPass.ts              # UI rendering
│   │   └── index.ts
│   │
│   ├── materials/
│   │   ├── Material.ts            # Material base
│   │   ├── MaterialType.ts        # Material types (StandardLit, etc.)
│   │   ├── MaterialParams.ts      # Material parameters
│   │   ├── ShaderPermutations.ts  # Shader variants
│   │   └── index.ts
│   │
│   ├── shaders/
│   │   ├── pbr.wgsl               # PBR shader
│   │   ├── unlit.wgsl             # Unlit shader
│   │   ├── voxel.wgsl             # Voxel shader
│   │   ├── ui.wgsl                # UI shader
│   │   ├── postprocess/
│   │   │   ├── bloom.wgsl
│   │   │   ├── tonemap.wgsl
│   │   │   └── lut.wgsl
│   │   └── index.ts
│   │
│   ├── textures/
│   │   ├── TextureAtlas.ts        # Texture atlas
│   │   ├── TextureCache.ts        # Texture cache
│   │   ├── TextureLoader.ts       # Texture loading
│   │   └── index.ts
│   │
│   ├── shadows/
│   │   ├── ShadowCascades.ts      # Cascaded shadow maps
│   │   ├── ShadowRenderer.ts      # Shadow rendering
│   │   └── index.ts
│   │
│   ├── postprocess/
│   │   ├── Bloom.ts               # Bloom effect
│   │   ├── Tonemap.ts             # Tonemapping
│   │   ├── LUT.ts                 # LUT color grading
│   │   └── index.ts
│   │
│   ├── core/
│   │   ├── Renderer.ts            # Main renderer
│   │   ├── FrameRenderer.ts       # Per-frame logic
│   │   ├── InstanceManager.ts     # Instancing
│   │   ├── FrustumCuller.ts       # Culling
│   │   └── index.ts
│   │
│   └── index.ts                   # Public API
│
├── __tests__/
│   ├── DeviceManager.test.ts
│   ├── Material.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/gfx-webgpu"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`, `@engine/world`

---

### 4. `packages/voxel/` - @engine/voxel

**Voxel/microblock system** (przyszłość).

```
packages/voxel/
├── src/
│   ├── chunk/
│   │   ├── ChunkStore.ts          # Voxel data storage
│   │   ├── Chunk.ts               # Single chunk
│   │   ├── ChunkManager.ts        # Chunk management
│   │   └── index.ts
│   │
│   ├── meshing/
│   │   ├── ChunkMesher.ts         # Worker-based mesher
│   │   ├── GreedyMeshing.ts       # Greedy meshing algorithm
│   │   ├── AmbientOcclusion.ts    # Per-vertex AO
│   │   ├── MicroblockMesher.ts    # Subvoxel meshing
│   │   └── index.ts
│   │
│   ├── streaming/
│   │   ├── ChunkStreamingSystem.ts # Streaming system
│   │   ├── ChunkPriority.ts       # Priority calculation
│   │   ├── LODManager.ts          # Level of detail
│   │   └── index.ts
│   │
│   ├── data/
│   │   ├── BlockPalette.ts        # Block palette
│   │   ├── Microblock.ts          # Microblock data
│   │   ├── Compression.ts         # RLE compression
│   │   └── index.ts
│   │
│   └── index.ts
│
├── __tests__/
│   ├── ChunkMesher.test.ts
│   ├── GreedyMeshing.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/voxel"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`, `@engine/world`

---

### 5. `packages/assets/` - @engine/assets

**Asset loading & streaming**.

```
packages/assets/
├── src/
│   ├── core/
│   │   ├── AssetManager.ts        # Main asset manager
│   │   ├── AssetCache.ts          # LRU cache
│   │   ├── AssetHandle.ts         # Asset handles
│   │   ├── URIResolver.ts         # URI resolution
│   │   └── index.ts
│   │
│   ├── loaders/
│   │   ├── MeshLoader.ts          # GLTF, OBJ
│   │   ├── TextureLoader.ts       # PNG, KTX2
│   │   ├── AnimationLoader.ts     # Animation clips
│   │   ├── AudioLoader.ts         # Audio files
│   │   ├── ScriptLoader.ts        # Script assets
│   │   └── index.ts
│   │
│   ├── streaming/
│   │   ├── StreamingSystem.ts     # Asset streaming
│   │   ├── Prefetch.ts            # Prefetching
│   │   ├── Eviction.ts            # Cache eviction
│   │   └── index.ts
│   │
│   ├── serialization/
│   │   ├── UGCPack.ts             # UGC pack format
│   │   ├── WorldSerializer.ts     # World serialization
│   │   ├── EntitySerializer.ts    # Entity serialization
│   │   └── index.ts
│   │
│   └── index.ts
│
├── __tests__/
│   ├── AssetManager.test.ts
│   ├── MeshLoader.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/assets"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`, `@engine/world`

---

### 6. `packages/script/` - @engine/script

**UGC scripting system** (LogicCubes).

```
packages/script/
├── src/
│   ├── runtime/
│   │   ├── ScriptRuntime.ts       # Script execution runtime
│   │   ├── ScriptContext.ts       # Execution context
│   │   ├── Sandbox.ts             # Sandbox VM
│   │   └── index.ts
│   │
│   ├── LogicCubes/
│   │   ├── LogicCube.ts           # Base LogicCube
│   │   ├── LogicCubeSystem.ts     # System
│   │   ├── cubes/
│   │   │   ├── ActionCubes.ts
│   │   │   ├── ConditionCubes.ts
│   │   │   ├── DataCubes.ts
│   │   │   ├── LogicGateCubes.ts
│   │   │   ├── TriggerCubes.ts
│   │   │   ├── PlayerDetection.ts
│   │   │   └── types.ts
│   │   └── index.ts
│   │
│   ├── dsl/
│   │   ├── DSLParser.ts           # DSL parsing
│   │   ├── DSLCompiler.ts         # Compilation
│   │   └── index.ts
│   │
│   ├── behavior/
│   │   ├── Behavior.ts            # Behavior base
│   │   ├── BehaviorRegistry.ts    # Behavior registration
│   │   └── index.ts
│   │
│   ├── coroutine/
│   │   ├── CoroutineScheduler.ts  # Coroutine execution
│   │   └── index.ts
│   │
│   ├── connection/
│   │   ├── LogicConnectionManager.ts
│   │   ├── LogicConnectionRegistry.ts
│   │   └── index.ts
│   │
│   ├── storage/
│   │   ├── VariableStorage.ts     # Variable storage
│   │   └── index.ts
│   │
│   └── index.ts
│
├── __tests__/
│   ├── ScriptRuntime.test.ts
│   ├── LogicCube.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/script"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`, `@engine/world`

---

### 7. `packages/input/` - @engine/input

**Input management**.

```
packages/input/
├── src/
│   ├── InputManager.ts            # Main input manager
│   ├── KeyboardState.ts           # Keyboard
│   ├── MouseState.ts              # Mouse
│   ├── GamepadState.ts            # Gamepad
│   ├── TouchState.ts              # Touch
│   ├── InputContext.ts            # Stack-based contexts
│   ├── CharacterInput.ts          # Character input handling
│   └── index.ts
│
├── __tests__/
│   ├── InputManager.test.ts
│   ├── InputContext.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/input"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`

---

### 8. `packages/camera/` - @engine/camera

**Camera systems**.

```
packages/camera/
├── src/
│   ├── CameraDirector.ts          # Unified camera director
│   ├── OrbitCamera.ts             # Orbit camera (editor)
│   ├── FPSCamera.ts               # FPS camera
│   ├── TPSCamera.ts               # Third-person camera
│   ├── CinematicCamera.ts         # Cinematic camera
│   ├── CameraBlending.ts          # Camera blending
│   └── index.ts
│
├── __tests__/
│   ├── CameraDirector.test.ts
│   ├── OrbitCamera.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/camera"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`, `@engine/world`

---

### 9. `packages/net/` - @engine/net

**Multiplayer & networking** (przyszłość).

```
packages/net/
├── src/
│   ├── replication/
│   │   ├── SnapshotReplicator.ts  # Snapshot replication
│   │   ├── InputReplicator.ts     # Input replication
│   │   ├── DeltaCompression.ts    # Delta compression
│   │   └── index.ts
│   │
│   ├── replay/
│   │   ├── ReplayRecorder.ts      # Replay recording
│   │   ├── ReplayPlayer.ts        # Replay playback
│   │   └── index.ts
│   │
│   ├── sync/
│   │   ├── ClientPrediction.ts    # Client-side prediction
│   │   ├── ServerReconciliation.ts # Reconciliation
│   │   └── index.ts
│   │
│   └── index.ts
│
├── __tests__/
│   ├── SnapshotReplicator.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/net"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`, `@engine/world`

---

### 10. `packages/stdlib/` - @engine/stdlib

**Standard library** (prefabs).

```
packages/stdlib/
├── src/
│   ├── CharacterController/
│   │   ├── CharacterController.ts
│   │   ├── CharacterPawn.ts
│   │   ├── LocalPlayerController.ts
│   │   ├── Intent.ts
│   │   ├── ManifestBindings.ts
│   │   └── index.ts
│   │
│   ├── Animation/
│   │   ├── AnimationSystem.ts
│   │   ├── AnimationStateMachine.ts
│   │   ├── AnimationClip.ts
│   │   ├── AnimationController.ts
│   │   ├── SkeletalAnimation.ts
│   │   ├── Skeleton.ts
│   │   ├── interpolation.ts
│   │   └── index.ts
│   │
│   ├── Audio/
│   │   ├── AudioSystem.ts
│   │   ├── AudioManager.ts
│   │   ├── SpatialAudio.ts
│   │   └── index.ts
│   │
│   ├── AI/
│   │   ├── BasicEnemyAI.ts
│   │   ├── Pathfinding.ts
│   │   ├── NavMesh.ts
│   │   └── index.ts
│   │
│   ├── Triggers/
│   │   ├── DoorTrigger.ts
│   │   ├── AreaTrigger.ts
│   │   └── index.ts
│   │
│   ├── Inventory/
│   │   ├── InventorySystem.ts
│   │   └── index.ts
│   │
│   └── index.ts
│
├── __tests__/
│   ├── CharacterController.test.ts
│   ├── AnimationSystem.test.ts
│   └── ...
│
├── package.json                   # name: "@engine/stdlib"
├── tsconfig.json
└── README.md
```

**Zależności**: `@engine/core`, `@engine/world`, `@engine/assets`, `@engine/input`

---

## Aplikacje: `apps/`

### 1. `apps/editor/` - Edytor

**Główna aplikacja edytora**.

```
apps/editor/
├── src/
│   ├── ui/
│   │   ├── EditorUI.ts            # Main UI entry
│   │   ├── Toolbar.ts
│   │   ├── StatusBar.ts
│   │   ├── ContextMenu.ts
│   │   ├── Dialogs/
│   │   └── index.ts
│   │
│   ├── managers/
│   │   ├── EditorModeManager.ts   # Edit/Play mode
│   │   ├── LogicCubeLibrary.ts
│   │   ├── FavoritesManager.ts
│   │   ├── InventoryManager.ts
│   │   └── index.ts
│   │
│   ├── controllers/
│   │   ├── BlockDragController.ts
│   │   ├── EditorPlacementController.ts
│   │   ├── RotationController.ts
│   │   ├── EasyPlaceController.ts
│   │   └── index.ts
│   │
│   ├── states/
│   │   ├── EditState.ts
│   │   ├── PreflightState.ts
│   │   ├── LoadingState.ts
│   │   ├── PlayIntroState.ts
│   │   ├── PlayingState.ts
│   │   ├── PausedState.ts
│   │   ├── ReturnState.ts
│   │   └── index.ts
│   │
│   ├── panels/
│   │   ├── AssetBrowser.ts
│   │   ├── OutlinerPanel.ts
│   │   ├── PropertiesPanel.ts
│   │   ├── LogicCubePanel.ts
│   │   ├── EnvironmentPanel.ts
│   │   └── index.ts
│   │
│   ├── core/
│   │   ├── PlayModeStateMachine.ts
│   │   ├── PlayManifest.ts
│   │   ├── WorldManager.ts
│   │   └── index.ts
│   │
│   ├── history/
│   │   ├── HistoryManager.ts
│   │   ├── Command.ts
│   │   └── index.ts
│   │
│   ├── grid/
│   │   ├── GridRenderer.ts
│   │   ├── GridConfig.ts
│   │   └── index.ts
│   │
│   ├── snap/
│   │   ├── SnapSystem.ts
│   │   ├── CoordinateManager.ts
│   │   └── index.ts
│   │
│   ├── placement/
│   │   ├── PlacementPreview.ts
│   │   ├── PlacementValidator.ts
│   │   └── index.ts
│   │
│   ├── visuals/
│   │   ├── SelectionVisuals.ts
│   │   ├── Gizmos.ts
│   │   └── index.ts
│   │
│   ├── assets/
│   │   ├── AssetRegistry.ts
│   │   ├── AssetLibrary.ts
│   │   ├── AssetImporter.ts
│   │   ├── RecentAssetsTracker.ts
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── dom.ts
│   │   └── index.ts
│   │
│   ├── EditorApp.ts              # Main EditorApp class
│   ├── bootstrap.ts              # Bootstrap
│   └── main.ts                   # Vite entry
│
├── styles/
│   ├── main.css
│   ├── panels/
│   ├── ui/
│   └── ...
│
├── public/
│   └── assets/
│
├── index.html
├── package.json                   # name: "@apps/editor"
├── tsconfig.json
├── vite.config.ts
└── README.md
```

**Zależności**: Wszystkie `@engine/*` moduły

---

### 2. `apps/playground/` - Demo/Sandbox

**Minimalna gra-test**.

```
apps/playground/
├── src/
│   ├── main.ts                    # Entry point
│   ├── GameWorld.ts               # Simple game world
│   └── examples/
│       ├── basic-scene.ts
│       ├── physics-demo.ts
│       └── scripting-demo.ts
│
├── public/
│   └── assets/
│
├── index.html
├── package.json                   # name: "@apps/playground"
├── tsconfig.json
├── vite.config.ts
└── README.md
```

**Zależności**: `@engine/core`, `@engine/world`, `@engine/gfx-webgpu`, `@engine/stdlib`

---

## Shared: `shared/`

**Współdzielone typy i utilities** (optional).

```
shared/
├── types/
│   ├── common.ts
│   └── index.ts
│
├── utils/
│   ├── helpers.ts
│   └── index.ts
│
├── package.json                   # name: "@shared/common"
└── README.md
```

---

## Dokumentacja: `docs/`

```
docs/
├── adr/                           # Architecture Decision Records (PL)
│   ├── 001-modular-engine-architecture.md
│   ├── 002-ecs-design.md
│   └── README.md
│
├── architecture/
│   ├── diagrams/
│   │   ├── module-dependencies.mmd
│   │   ├── frame-pipeline.mmd
│   │   └── ecs-hierarchy.mmd
│   └── README.md
│
├── api/                           # API docs (autogenerated)
│   └── ...
│
├── guides/
│   ├── getting-started.md
│   ├── creating-components.md
│   ├── writing-systems.md
│   └── scripting-guide.md
│
├── ARCHITECTURE.md                # Main architecture doc
├── CURRENT_STRUCTURE.md           # Obecna struktura
├── TARGET_STRUCTURE.md            # Docelowa struktura (TEN DOKUMENT)
├── MODULE_SPECIFICATIONS.md       # Szczegółowe specyfikacje modułów
├── FRAME_MODEL.md                 # Frame pipeline
├── PERFORMANCE_PHILOSOPHY.md      # Performance guidelines
├── MIGRATION_PLAN.md              # Plan migracji
├── PLAY_MODE_STATE_MACHINE.md     # Play mode docs
└── TESTING.md                     # Testing docs
```

---

## Root Files

### `package.json` (root)

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
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "typescript": "^5.9.3",
    "vitest": "^2.1.3"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'shared'
```

### `turbo.json` (optional)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false
    }
  }
}
```

### `tsconfig.json` (root)

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
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
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
      "@engine/stdlib": ["./packages/stdlib/src"],
      "@shared/*": ["./shared/*"]
    }
  }
}
```

---

## Mapowanie: Obecna → Docelowa

| Obecna Lokalizacja | Docelowa Lokalizacja | Akcja |
|-------------------|---------------------|-------|
| `src/math.ts` | `packages/core/src/math/` | Przenieś + modularyzuj |
| `src/engine/scene/core/` | `packages/world/src/core/` | Przenieś |
| `src/engine/scene/components/` | `packages/world/src/components/` | Przenieś |
| `src/engine/scene/systems/` | `packages/world/src/systems/` | Przenieś |
| `src/scene/` | ❌ Usuń | Duplikat |
| `src/physics/` | `packages/world/src/physics/` | Przenieś |
| `src/rendering/` | `packages/gfx-webgpu/src/` | Przenieś + refactor |
| `src/logic/` | `packages/script/src/LogicCubes/` | Przenieś |
| `src/animation/` | `packages/stdlib/src/Animation/` | Przenieś |
| `src/audio/` | `packages/stdlib/src/Audio/` | Przenieś |
| `src/gameplay/` | `packages/stdlib/src/CharacterController/` | Przenieś |
| `src/editor/` | `apps/editor/src/` | Przenieś |
| `src/app/` | `apps/editor/src/` | Scal z editor |
| `src/input.ts` | `packages/camera/src/OrbitCamera.ts` | Przenieś orbit controls |
| `src/input/` | `packages/input/src/` | Przenieś |
| `src/logger.ts` | `apps/editor/src/utils/logger.ts` | Przenieś |
| `src/app.ts` | `apps/editor/src/EditorApp.ts` | Przenieś |
| `src/bootstrap.ts` | `apps/editor/src/bootstrap.ts` | Przenieś |
| `src/main.ts` | `apps/editor/src/main.ts` | Przenieś |
| `src/styles/` | `apps/editor/styles/` | Przenieś |
| `src/__tests__/` | Odpowiednie `packages/*/tests/` | Rozdziel |

---

## Zależności Między Pakietami

```
Level 0 (Foundation):
  - @engine/core

Level 1 (Runtime):
  - @engine/world (depends: core)
  - @engine/input (depends: core)

Level 2 (Rendering & Systems):
  - @engine/gfx-webgpu (depends: core, world)
  - @engine/voxel (depends: core, world)
  - @engine/assets (depends: core, world)
  - @engine/script (depends: core, world)
  - @engine/camera (depends: core, world)
  - @engine/net (depends: core, world)

Level 3 (Standard Library):
  - @engine/stdlib (depends: core, world, assets, input)

Level 4 (Applications):
  - @apps/editor (depends: all @engine/*)
  - @apps/playground (depends: core, world, gfx-webgpu, stdlib)
```

**Zasada**: Zależności tylko w dół. Core nie zna World. World nie zna Renderer.

---

## Build System

### Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run editor in dev mode
cd apps/editor
pnpm dev

# Run tests
pnpm test

# Watch mode dla developmentu pakietu
cd packages/core
pnpm dev
```

### Production

```bash
# Build wszystkich pakietów
pnpm build

# Build tylko editora
cd apps/editor
pnpm build

# Build jako SDK (publikacja npm)
pnpm build:packages
```

---

## Następne Kroki

1. ✅ [CURRENT_STRUCTURE.md](./CURRENT_STRUCTURE.md) - Obecna struktura
2. ✅ [ARCHITECTURE.md](./ARCHITECTURE.md) - Wizja modularnego silnika
3. ✅ [TARGET_STRUCTURE.md](./TARGET_STRUCTURE.md) - Docelowa struktura (TEN DOKUMENT)
4. ⏭️ [MODULE_SPECIFICATIONS.md](./MODULE_SPECIFICATIONS.md) - Szczegółowe API
5. ⏭️ [FRAME_MODEL.md](./FRAME_MODEL.md) - Frame pipeline
6. ⏭️ [PERFORMANCE_PHILOSOPHY.md](./PERFORMANCE_PHILOSOPHY.md) - Performance
7. ⏭️ [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Plan migracji

---

## Podsumowanie

**Docelowa struktura**:
- ✅ Modularny monorepo (pnpm workspaces)
- ✅ Czyste zależności (core → world → gfx)
- ✅ Separacja silnika od aplikacji
- ✅ Pakiety jako SDK (możliwość publikacji npm)
- ✅ Edytor jako klient API (zero backdoors)
- ✅ Scalability (łatwo dodać nowe moduły)

**Rezultat**: Profesjonalna architektura gotowa na skalę Roblox/Kogama-nextgen.


# Codebase Patterns & Conventions

> **Design patterns, idioms, and conventions used throughout the UGC 3D Platform**  
> **For AI assistants and developers**

## 🎨 Design Patterns

### 1. Component Pattern (ECS)

**When to use:** Representing game objects with composable behavior

```typescript
// ✅ PATTERN: Component as data holder
export class TransformComponent extends Component {
  public position: Vec3;
  public rotation: Quat;
  public scale: Vec3;
  
  constructor(data: TransformData) {
    super('Transform');
    this.position = Vec3.fromArray(data.position || [0, 0, 0]);
    this.rotation = Quat.fromArray(data.rotation || [0, 0, 0, 1]);
    this.scale = Vec3.fromArray(data.scale || [1, 1, 1]);
  }
  
  serialize(): TransformData {
    return {
      position: this.position.toArray(),
      rotation: this.rotation.toArray(),
      scale: this.scale.toArray(),
    };
  }
  
  dispose(): void {
    // Cleanup if needed
  }
}

// ✅ PATTERN: System processes components
export class TransformSystem {
  update(entities: Entity[]): void {
    for (const entity of entities) {
      const transform = entity.getComponent(TransformComponent);
      if (transform) {
        // Process transform
        this.updateWorldMatrix(transform);
      }
    }
  }
}
```

**Key points:**
- Components are pure data (+ serialization)
- Systems contain logic
- No component-to-component communication (use events or systems)

---

### 2. Disposable Pattern

**When to use:** Managing resource lifecycle (GPU buffers, event listeners, timers)

```typescript
// ✅ PATTERN: Disposable interface
export interface Disposable {
  dispose(): void;
}

// ✅ PATTERN: Implement disposal
export class Renderer implements Disposable {
  private device: GPUDevice;
  private buffers: GPUBuffer[] = [];
  
  dispose(): void {
    // Always check if already disposed
    if (!this.device) return;
    
    // Dispose child resources first
    for (const buffer of this.buffers) {
      buffer.destroy();
    }
    this.buffers = [];
    
    // Then dispose main resource
    this.device.destroy();
    this.device = null!;
  }
}

// ✅ PATTERN: DisposableGroup for batch cleanup
import { DisposableGroup } from '@engine/core';

export class Scene implements Disposable {
  private disposables = new DisposableGroup();
  
  add(entity: Entity): void {
    this.entities.push(entity);
    this.disposables.add(entity); // Auto-cleanup
  }
  
  dispose(): void {
    this.disposables.dispose(); // Disposes all entities
  }
}
```

**Key points:**
- Every resource must have disposal
- Use `DisposableGroup` for collections
- Idempotent disposal (safe to call multiple times)
- Child resources before parent resources

---

### 3. Event Bus Pattern

**When to use:** Decoupled communication between systems

```typescript
// ✅ PATTERN: Define event types
export interface SceneEvents {
  'entity:added': { entity: Entity };
  'entity:removed': { entity: Entity };
  'component:changed': { entity: Entity; component: Component };
}

// ✅ PATTERN: Use typed event bus
import { EventBus } from '@engine/core';

export class Scene {
  private events = new EventBus<SceneEvents>();
  
  addEntity(entity: Entity): void {
    this.entities.push(entity);
    this.events.emit('entity:added', { entity });
  }
  
  // Expose events publicly
  on<K extends keyof SceneEvents>(
    event: K,
    handler: (data: SceneEvents[K]) => void
  ): void {
    this.events.on(event, handler);
  }
}

// ✅ PATTERN: Subscribe to events
scene.on('entity:added', ({ entity }) => {
  console.log('Entity added:', entity.name);
});
```

**Key points:**
- Type-safe event definitions
- Explicit event names (avoid magic strings)
- Always unsubscribe in `dispose()`

---

### 4. Factory Pattern

**When to use:** Complex object construction

```typescript
// ✅ PATTERN: Factory for complex entities
export class EntityFactory {
  static createPlayer(scene: Scene): Entity {
    const player = new Entity('player');
    
    // Add all required components
    player.addComponent(new TransformComponent({
      position: [0, 1, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    }));
    
    player.addComponent(new MeshComponent({
      geometry: 'cube',
      material: 'player',
    }));
    
    player.addComponent(new PhysicsComponent({
      type: 'dynamic',
      mass: 70,
      collider: 'capsule',
    }));
    
    scene.addEntity(player);
    return player;
  }
  
  static createLight(type: 'point' | 'directional', position: Vec3): Entity {
    const light = new Entity(`${type}-light`);
    light.addComponent(new TransformComponent({ position: position.toArray() }));
    light.addComponent(new LightComponent({ type, intensity: 1.0 }));
    return light;
  }
}
```

**Key points:**
- Encapsulates complex construction
- Returns fully configured objects
- Named factory methods (not generic `create()`)

---

### 5. Command Pattern (History/Undo)

**When to use:** Implementing undo/redo functionality

```typescript
// ✅ PATTERN: Command interface
export interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
}

// ✅ PATTERN: Concrete command
export class MoveEntityCommand implements Command {
  constructor(
    private entity: Entity,
    private from: Vec3,
    private to: Vec3
  ) {}
  
  execute(): void {
    const transform = this.entity.getComponent(TransformComponent);
    if (transform) {
      transform.position.copy(this.to);
    }
  }
  
  undo(): void {
    const transform = this.entity.getComponent(TransformComponent);
    if (transform) {
      transform.position.copy(this.from);
    }
  }
  
  redo(): void {
    this.execute();
  }
}

// ✅ PATTERN: History manager
import { HistoryManager } from '@engine/editor-utils';

const history = new HistoryManager();
const command = new MoveEntityCommand(entity, oldPos, newPos);

history.execute(command); // Execute and add to history
history.undo(); // Undo last command
history.redo(); // Redo last undone command
```

**Key points:**
- Every action is a command
- Store state needed for undo
- Immutable snapshots when possible

---

### 6. Observer Pattern (Reactive State)

**When to use:** Reactive UI updates, state synchronization

```typescript
// ✅ PATTERN: Signal-based reactivity
import { signal, computed, effect } from '@preact/signals-core';

export class EditorState {
  // Observable state
  public selectedEntity = signal<Entity | null>(null);
  public mode = signal<'edit' | 'play'>('edit');
  
  // Computed values
  public canEdit = computed(() => this.mode.value === 'edit');
  
  // Effects (side effects)
  constructor() {
    effect(() => {
      const entity = this.selectedEntity.value;
      if (entity) {
        console.log('Selected:', entity.name);
      }
    });
  }
}

// Usage
const state = new EditorState();
state.selectedEntity.value = entity; // Auto-triggers effect
```

**Key points:**
- Use `@preact/signals-core` for reactive state
- Avoid manual observer registration
- Automatic dependency tracking

---

### 7. Object Pool Pattern

**When to use:** High-frequency allocations (particles, physics collisions)

```typescript
// ✅ PATTERN: Object pool
export class Vec3Pool {
  private pool: Vec3[] = [];
  private active = new Set<Vec3>();
  
  acquire(): Vec3 {
    let vec: Vec3;
    
    if (this.pool.length > 0) {
      vec = this.pool.pop()!;
    } else {
      vec = new Vec3();
    }
    
    this.active.add(vec);
    return vec.set(0, 0, 0); // Reset to zero
  }
  
  release(vec: Vec3): void {
    if (this.active.has(vec)) {
      this.active.delete(vec);
      this.pool.push(vec);
    }
  }
  
  releaseAll(): void {
    for (const vec of this.active) {
      this.pool.push(vec);
    }
    this.active.clear();
  }
}

// Usage in hot path
class ParticleSystem {
  private vecPool = new Vec3Pool();
  
  update(dt: number): void {
    for (const particle of this.particles) {
      const velocity = this.vecPool.acquire(); // Reuse
      velocity.copy(particle.velocity);
      // ... use velocity ...
      this.vecPool.release(velocity); // Return to pool
    }
  }
}
```

**Key points:**
- Use for frequently allocated objects
- Always reset state on acquire
- Track active vs pooled objects

---

### 8. State Machine Pattern

**When to use:** Complex state transitions (play mode, animation states)

```typescript
// ✅ PATTERN: State interface
export interface State {
  enter(): void;
  update(dt: number): void;
  exit(): void;
}

// ✅ PATTERN: Concrete states
export class EditState implements State {
  constructor(private editor: Editor) {}
  
  enter(): void {
    console.log('Entering edit mode');
    this.editor.enableEditing();
  }
  
  update(dt: number): void {
    this.editor.updateEditing(dt);
  }
  
  exit(): void {
    this.editor.disableEditing();
  }
}

export class PlayState implements State {
  constructor(private editor: Editor) {}
  
  enter(): void {
    console.log('Entering play mode');
    this.editor.startGame();
  }
  
  update(dt: number): void {
    this.editor.updateGame(dt);
  }
  
  exit(): void {
    this.editor.stopGame();
  }
}

// ✅ PATTERN: State machine
export class StateMachine {
  private currentState: State | null = null;
  
  transition(newState: State): void {
    if (this.currentState) {
      this.currentState.exit();
    }
    this.currentState = newState;
    this.currentState.enter();
  }
  
  update(dt: number): void {
    if (this.currentState) {
      this.currentState.update(dt);
    }
  }
}
```

**Key points:**
- Clear state lifecycle (enter → update → exit)
- No direct state-to-state transitions
- State machine manages transitions

---

## 🔧 Common Idioms

### 1. Null Object Pattern

```typescript
// ✅ Return empty/null objects instead of null
export class Scene {
  getEntity(name: string): Entity {
    return this.entities.find(e => e.name === name) || Entity.NULL;
  }
}

export class Entity {
  static readonly NULL = new Entity('__null__');
  
  isNull(): boolean {
    return this === Entity.NULL;
  }
}

// Usage
const entity = scene.getEntity('player');
if (!entity.isNull()) {
  // Safe to use
}
```

### 2. Builder Pattern (Fluent API)

```typescript
// ✅ Fluent API for complex configurations
export class MaterialBuilder {
  private data: Partial<MaterialData> = {};
  
  setAlbedo(color: Vec3): this {
    this.data.albedo = color.toArray();
    return this;
  }
  
  setMetallic(value: number): this {
    this.data.metallic = value;
    return this;
  }
  
  setRoughness(value: number): this {
    this.data.roughness = value;
    return this;
  }
  
  build(): Material {
    return new Material(this.data as MaterialData);
  }
}

// Usage
const material = new MaterialBuilder()
  .setAlbedo(new Vec3(1, 0, 0))
  .setMetallic(0.8)
  .setRoughness(0.2)
  .build();
```

### 3. Guard Clauses

```typescript
// ✅ Early returns for validation
export function processEntity(entity: Entity): void {
  // Guard clauses at top
  if (!entity) return;
  if (entity.isNull()) return;
  if (!entity.has(TransformComponent)) return;
  
  // Main logic (unindented)
  const transform = entity.getComponent(TransformComponent)!;
  transform.position.add(velocity);
}
```

### 4. Assertion Helpers

```typescript
// ✅ Type-safe assertions
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}

// Usage
const entity: Entity | null = scene.getEntity('player');
assertDefined(entity, 'Player entity not found');
// TypeScript now knows entity is Entity (not null)
entity.setPosition(0, 0, 0);
```

---

## 🎯 Naming Conventions

### Files

```
PascalCase   → Classes, Components, Systems
camelCase    → Utilities, functions
kebab-case   → Test files (optional)
UPPER_CASE   → Constants files
```

**Examples:**
```
TransformComponent.ts
EntityFactory.ts
mathUtils.ts
vec3.ts
TransformComponent.test.ts
CONSTANTS.ts
```

### Variables

```typescript
// Classes, Types, Interfaces → PascalCase
class Entity {}
interface Transform {}
type ComponentData = {};

// Functions, variables → camelCase
function createEntity() {}
const entityCount = 10;

// Constants → UPPER_SNAKE_CASE
const MAX_ENTITIES = 1000;
const DEFAULT_POSITION = [0, 0, 0];

// Private members → _camelCase (optional, prefer 'private' keyword)
class Scene {
  private _entities: Entity[]; // or just 'entities' with 'private'
}
```

---

## 📁 File Organization

### Package Structure

```
packages/my-package/
├── src/
│   ├── index.ts              # Public API exports
│   ├── MyClass.ts            # One class per file (preferred)
│   ├── types.ts              # Shared types/interfaces
│   ├── utils.ts              # Utility functions
│   ├── constants.ts          # Constants
│   └── subsystem/            # Logical grouping
│       ├── index.ts
│       ├── SubA.ts
│       └── SubB.ts
├── __tests__/                # Tests (mirror src structure)
│   ├── MyClass.test.ts
│   └── subsystem/
│       └── SubA.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Export Patterns

```typescript
// ✅ src/index.ts - Barrel exports
export * from './MyClass';
export * from './types';
export { createEntity, destroyEntity } from './utils';

// ✅ Re-export from subsystems
export * from './subsystem';

// ❌ Don't export everything blindly
// export * from './internal'; // Only export public API
```

---

## 🧪 Testing Patterns

### Test Structure

```typescript
// ✅ PATTERN: Arrange-Act-Assert
describe('TransformComponent', () => {
  test('applies translation correctly', () => {
    // Arrange
    const transform = new TransformComponent({
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });
    
    // Act
    transform.position.add(new Vec3(1, 2, 3));
    
    // Assert
    expect(transform.position.toArray()).toEqual([1, 2, 3]);
  });
});
```

### Test Fixtures

```typescript
// ✅ PATTERN: Reusable test data
export const testFixtures = {
  entity: {
    basic: () => new Entity('test'),
    withTransform: () => {
      const entity = new Entity('test');
      entity.addComponent(new TransformComponent({
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      }));
      return entity;
    },
  },
  
  scene: {
    empty: () => new Scene(),
    withEntities: (count: number) => {
      const scene = new Scene();
      for (let i = 0; i < count; i++) {
        scene.addEntity(new Entity(`entity-${i}`));
      }
      return scene;
    },
  },
};

// Usage
test('scene contains entities', () => {
  const scene = testFixtures.scene.withEntities(5);
  expect(scene.entities.length).toBe(5);
});
```

---

## 💡 Performance Patterns

### 1. Batch Processing

```typescript
// ✅ Batch similar operations
class Renderer {
  private batches = new Map<Material, Mesh[]>();
  
  render(scene: Scene): void {
    // Group by material
    this.batches.clear();
    for (const entity of scene.entities) {
      const mesh = entity.getComponent(MeshComponent);
      if (mesh) {
        const material = mesh.material;
        if (!this.batches.has(material)) {
          this.batches.set(material, []);
        }
        this.batches.get(material)!.push(mesh);
      }
    }
    
    // Render in batches (minimize state changes)
    for (const [material, meshes] of this.batches) {
      this.bindMaterial(material);
      for (const mesh of meshes) {
        this.drawMesh(mesh);
      }
    }
  }
}
```

### 2. Lazy Initialization

```typescript
// ✅ Defer expensive operations
class AssetManager {
  private cache = new Map<string, Asset>();
  
  async get(url: string): Promise<Asset> {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }
    
    // Load only if needed
    const asset = await this.load(url);
    this.cache.set(url, asset);
    return asset;
  }
}
```

### 3. Spatial Partitioning

```typescript
// ✅ Use spatial structures for queries
class Octree {
  query(bounds: AABB): Entity[] {
    // Only check entities in relevant cells
    const results: Entity[] = [];
    this.queryNode(this.root, bounds, results);
    return results;
  }
}

// Don't iterate all entities every frame
```

---

## 🚀 Advanced Patterns

### 1. Dependency Injection

```typescript
// ✅ PATTERN: Constructor injection
export class RenderSystem {
  constructor(
    private renderer: Renderer,
    private camera: Camera
  ) {}
  
  update(entities: Entity[]): void {
    this.renderer.render(entities, this.camera);
  }
}

// Usage
const renderer = new Renderer(canvas);
const camera = new Camera();
const renderSystem = new RenderSystem(renderer, camera);
```

### 2. Plugin System

**When to use:** Extending engine functionality in a modular, reusable way

```typescript
// ✅ PATTERN: Plugin interface with metadata, lifecycle, and API
import type { Plugin, PluginMetadata } from '@engine/core/plugin';
import { Engine } from '@engine/world';

// Define plugin API interface for type safety
export interface PhysicsPluginAPI {
  raycast(from: Vec3, to: Vec3): RaycastHit | null;
  setGravity(gravity: Vec3): void;
}

export class PhysicsPlugin implements Plugin<Engine> {
  // Metadata with version and dependencies
  readonly metadata: PluginMetadata = {
    name: 'physics',
    version: '1.0.0',
    description: 'Physics simulation with Rapier',
    dependencies: [], // Can specify: [{ name: 'core', versionRange: '^1.0.0' }]
  };
  
  private physicsSystem?: PhysicsSystem;
  
  // Async install supported
  async install(engine: Engine): Promise<void> {
    this.physicsSystem = new PhysicsSystem(engine.scene);
    engine.registerSystem('physics', this.physicsSystem);
  }
  
  async uninstall(engine: Engine): Promise<void> {
    engine.unregisterSystem('physics');
    this.physicsSystem?.dispose();
    this.physicsSystem = undefined;
  }
  
  // Optional lifecycle hooks
  onStart(engine: Engine): void {
    this.physicsSystem?.start();
  }
  
  onStop(engine: Engine): void {
    this.physicsSystem?.stop();
  }
  
  // Expose API for inter-plugin communication
  getAPI(): PhysicsPluginAPI {
    return {
      raycast: (from, to) => this.physicsSystem!.raycast(from, to),
      setGravity: (g) => this.physicsSystem!.setGravity(g),
    };
  }
}

// ✅ PATTERN: Engine as central runtime container
const engine = new Engine({ name: 'My Game' });

// Install plugins (async, validates dependencies)
await engine.use(new PhysicsPlugin());
await engine.use(new RenderPlugin());

// Start all plugins
await engine.start();

// Game loop
function gameLoop(dt: number) {
  engine.update(dt);        // Variable timestep
  engine.fixedUpdate(1/60); // Fixed timestep for physics
}

// Access plugin API
const physics = engine.plugins.getAPI<PhysicsPluginAPI>('physics');
physics?.setGravity(new Vec3(0, -9.81, 0));

// Cleanup
await engine.stop();
engine.dispose();
```

**Key points:**
- Plugins have `metadata` with name, version, and optional dependencies
- Lifecycle: `install()` → `onStart()` → `onStop()` → `uninstall()`
- All lifecycle methods support async
- Dependencies are validated with semver ranges
- Plugins can expose typed APIs via `getAPI()`
- Use `PluginManager` for dependency resolution and ordering
- Engine combines Scene, PluginManager, and Systems

**Files:**
- `@engine/core/plugin` - Plugin, PluginMetadata, PluginManager
- `@engine/world/engine` - Engine class

---

## 📚 Resources

- **Architecture Decisions:** [docs/adr/](docs/adr/)
- **Code Review Checklist:** [docs/guidelines/CODE_REVIEW_CHECKLIST.md](docs/guidelines/CODE_REVIEW_CHECKLIST.md)
- **Package Guidelines:** [docs/guidelines/PACKAGE_GUIDELINES.md](docs/guidelines/PACKAGE_GUIDELINES.md)

---

**Use these patterns consistently across the codebase for maintainability and predictability.**


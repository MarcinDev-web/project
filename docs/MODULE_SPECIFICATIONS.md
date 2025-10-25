# Specyfikacje Modułów - API Reference

## Przegląd

Ten dokument zawiera szczegółową specyfikację każdego modułu silnika z:
- Odpowiedzialnością modułu
- Zależnościami
- Głównymi klasami/interfejsami (Public API)
- Przykładami użycia
- Granicami ("Nie robi")

## Format Specyfikacji

Dla każdego modułu:
```
## @engine/nazwa

**Odpowiedzialność**: Co robi moduł
**Zależności**: Które inne moduły używa
**Eksporty**: Główne klasy/interfejsy
**Przykład użycia**: TypeScript snippet
**Nie robi**: Granice modułu
```

---

# Foundation Layer

## @engine/core

**Odpowiedzialność**: Narzędzia niskiego poziomu używane wszędzie w silniku.

**Zależności**: ZERO (to jest base layer)

**Eksporty**:

### Math

```typescript
// Vec3 - 3D vectors
export class Vec3 {
  x: number;
  y: number;
  z: number;
  
  static create(x: number, y: number, z: number): Vec3;
  static zero(): Vec3;
  static one(): Vec3;
  static up(): Vec3;
  static forward(): Vec3;
  
  static add(a: Vec3, b: Vec3): Vec3;
  static subtract(a: Vec3, b: Vec3): Vec3;
  static multiply(a: Vec3, scalar: number): Vec3;
  static dot(a: Vec3, b: Vec3): number;
  static cross(a: Vec3, b: Vec3): Vec3;
  static length(v: Vec3): number;
  static normalize(v: Vec3): Vec3;
  static lerp(a: Vec3, b: Vec3, t: number): Vec3;
}

// Mat4 - 4x4 matrices
export class Mat4 {
  data: Float32Array;  // 16 elements
  
  static identity(): Mat4;
  static multiply(a: Mat4, b: Mat4): Mat4;
  static translate(v: Vec3): Mat4;
  static rotate(axis: Vec3, angle: number): Mat4;
  static scale(v: Vec3): Mat4;
  static perspective(fov: number, aspect: number, near: number, far: number): Mat4;
  static lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4;
  static invert(m: Mat4): Mat4;
  static transpose(m: Mat4): Mat4;
}

// Quat - Quaternions
export class Quat {
  x: number;
  y: number;
  z: number;
  w: number;
  
  static identity(): Quat;
  static fromAxisAngle(axis: Vec3, angle: number): Quat;
  static fromEuler(x: number, y: number, z: number): Quat;
  static multiply(a: Quat, b: Quat): Quat;
  static slerp(a: Quat, b: Quat, t: number): Quat;
  static toMat4(q: Quat): Mat4;
}

// AABB - Axis-Aligned Bounding Box
export interface AABB {
  min: Vec3;
  max: Vec3;
}

export function aabbIntersects(a: AABB, b: AABB): boolean;
export function aabbContainsPoint(aabb: AABB, point: Vec3): boolean;
export function aabbExpand(aabb: AABB, point: Vec3): AABB;

// Ray
export interface Ray {
  origin: Vec3;
  direction: Vec3;  // Normalized
}

export function rayIntersectsAABB(ray: Ray, aabb: AABB): number | null;
```

### ECS Foundation

```typescript
// Entity ID
export type EntityId = number;

// Component base
export interface Component {
  readonly type: string;
}

export type ComponentClass<T extends Component = Component> = new (...args: any[]) => T;

// System base
export interface System {
  readonly requiredComponents: ComponentClass[];
  
  update(dt: number): void;
  fixedUpdate?(dtFixed: number): void;
}

// Component storage (SOA)
export class ComponentStore<T extends Component> {
  add(entityId: EntityId, component: T): void;
  remove(entityId: EntityId): void;
  get(entityId: EntityId): T | undefined;
  has(entityId: EntityId): boolean;
  getAll(): IterableIterator<[EntityId, T]>;
}
```

### Job System

```typescript
export enum TaskPriority {
  RenderCritical = 0,   // Input, physics tick (main thread)
  Background = 1,       // Chunk meshing, asset loading (worker)
  Idle = 2,            // AI pathfinding, navmesh bake (idle)
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
  constructor(workerCount?: number);
  
  schedule(task: Task): JobHandle;
  cancel(handle: JobHandle): void;
  update(): void;  // Call per frame to process RenderCritical tasks
}
```

### Event Bus

```typescript
export type EventCallback = (data?: any) => void;
export type Unsubscribe = () => void;

export class EventBus {
  on(event: string, callback: EventCallback): Unsubscribe;
  once(event: string, callback: EventCallback): Unsubscribe;
  off(event: string, callback: EventCallback): void;
  emit(event: string, data?: any): void;
  clear(): void;
}
```

### Utils

```typescript
// UUID
export function generateUUID(): string;

// Binary I/O
export class BinaryWriter {
  writeUint8(value: number): void;
  writeUint16(value: number): void;
  writeUint32(value: number): void;
  writeFloat32(value: number): void;
  writeString(value: string): void;
  toBuffer(): ArrayBuffer;
}

export class BinaryReader {
  constructor(buffer: ArrayBuffer);
  readUint8(): number;
  readUint16(): number;
  readUint32(): number;
  readFloat32(): number;
  readString(): string;
}

// Bit flags
export class BitFlags {
  constructor(initial?: number);
  set(flag: number): void;
  unset(flag: number): void;
  toggle(flag: number): void;
  has(flag: number): boolean;
  value(): number;
}
```

**Przykład użycia**:

```typescript
import { Vec3, Mat4, EventBus } from '@engine/core';

// Math
const position = Vec3.create(1, 2, 3);
const velocity = Vec3.create(0, -9.8, 0);
const newPos = Vec3.add(position, Vec3.multiply(velocity, dt));

// Event Bus
const events = new EventBus();
events.on('playerDied', (data) => {
  console.log('Player died:', data);
});
events.emit('playerDied', { playerId: 123 });

// Job System
const jobSystem = new JobSystem(4);
jobSystem.schedule({
  execute: async () => {
    // Heavy work in worker
    await meshChunk(chunkData);
  },
  priority: TaskPriority.Background,
});
```

**Nie robi**:
- ❌ Nie wie o Scene, World, Entity (to w `@engine/world`)
- ❌ Nie wie o WebGPU, rendering (to w `@engine/gfx-webgpu`)
- ❌ Nie wie o physics, collision (to w `@engine/world`)

---

# Runtime Layer

## @engine/world

**Odpowiedzialność**: Symulacja świata gry. ECS runtime.

**Zależności**: `@engine/core`

**Eksporty**:

### World / Scene

```typescript
import { EntityId, Component, System, EventBus } from '@engine/core';

export class World {
  readonly events: EventBus;
  
  constructor(name?: string);
  
  // Entity management
  createEntity(name?: string): EntityId;
  destroyEntity(id: EntityId): void;
  getEntity(id: EntityId): Entity | undefined;
  getAllEntities(): Entity[];
  
  // Component management
  addComponent<T extends Component>(id: EntityId, component: T): void;
  removeComponent<T extends Component>(id: EntityId, type: ComponentClass<T>): void;
  getComponent<T extends Component>(id: EntityId, type: ComponentClass<T>): T | undefined;
  hasComponent<T extends Component>(id: EntityId, type: ComponentClass<T>): boolean;
  
  // Query
  query(...types: ComponentClass[]): Entity[];
  
  // System management
  addSystem(system: System): void;
  removeSystem(system: System): void;
  
  // Simulation
  fixedUpdate(dtFixed: number): void;
  update(dtRender: number): void;
  
  // Serialization
  toJSON(): WorldData;
  static fromJSON(data: WorldData): World;
}

export interface Entity {
  id: EntityId;
  name: string;
  active: boolean;
  components: Map<string, Component>;
}
```

### Components

```typescript
import { Vec3, Quat, Mat4 } from '@engine/core';

// Transform - pozycja, rotacja, skala, hierarchia
export class Transform implements Component {
  readonly type = 'Transform';
  
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  
  parent: EntityId | null;
  children: EntityId[];
  
  localMatrix: Mat4;
  worldMatrix: Mat4;
  
  constructor(position?: Vec3, rotation?: Quat, scale?: Vec3);
  
  setParent(parentId: EntityId | null): void;
  getWorldPosition(): Vec3;
  getWorldRotation(): Quat;
}

// Renderable - mesh + material
export class Renderable implements Component {
  readonly type = 'Renderable';
  
  meshId: string;
  materialId: string;
  visible: boolean;
  castShadows: boolean;
  receiveShadows: boolean;
  
  constructor(meshId: string, materialId: string);
}

// Collider - collision shape
export class Collider implements Component {
  readonly type = 'Collider';
  
  shape: 'box' | 'sphere' | 'capsule' | 'mesh';
  size: Vec3;
  offset: Vec3;
  isTrigger: boolean;
  
  constructor(shape: string, size: Vec3);
}

// RigidBody - physics
export class RigidBody implements Component {
  readonly type = 'RigidBody';
  
  velocity: Vec3;
  angularVelocity: Vec3;
  mass: number;
  gravityScale: number;
  isKinematic: boolean;
  useGravity: boolean;
  
  constructor(mass: number);
  
  applyForce(force: Vec3): void;
  applyImpulse(impulse: Vec3): void;
}

// Camera
export class Camera implements Component {
  readonly type = 'Camera';
  
  fov: number;
  aspect: number;
  near: number;
  far: number;
  isPrimary: boolean;
  
  constructor(fov: number, aspect: number);
  
  getProjectionMatrix(): Mat4;
}

// Light
export class Light implements Component {
  readonly type = 'Light';
  
  lightType: 'directional' | 'point' | 'spot';
  color: Vec3;
  intensity: number;
  range: number;
  castShadows: boolean;
  
  constructor(type: string, color: Vec3, intensity: number);
}

// Script
export class Script implements Component {
  readonly type = 'Script';
  
  scriptId: string;
  state: any;
  
  constructor(scriptId: string, state?: any);
}
```

### Systems

```typescript
// TransformSystem - aktualizuje hierarchię
export class TransformSystem implements System {
  readonly requiredComponents = [Transform];
  
  constructor(world: World);
  
  update(dt: number): void;  // Recompute world matrices
}

// PhysicsSystem - symulacja fizyki
export class PhysicsSystem implements System {
  readonly requiredComponents = [Transform, RigidBody];
  
  constructor(world: World);
  
  fixedUpdate(dtFixed: number): void;
  
  // Helpers
  raycast(ray: Ray, maxDistance: number): RaycastHit | null;
  overlapSphere(center: Vec3, radius: number): EntityId[];
}

// CullingSystem - frustum culling
export class CullingSystem implements System {
  readonly requiredComponents = [Transform, Renderable];
  
  constructor(world: World);
  
  update(camera: Camera): EntityId[];  // Returns visible entities
}
```

**Przykład użycia**:

```typescript
import { World, Transform, Renderable, RigidBody } from '@engine/world';
import { Vec3, Quat } from '@engine/core';

// Utwórz świat
const world = new World('My Game');

// Dodaj systemy
world.addSystem(new TransformSystem(world));
world.addSystem(new PhysicsSystem(world));

// Utwórz encję
const playerId = world.createEntity('Player');

// Dodaj komponenty
world.addComponent(playerId, new Transform(
  Vec3.create(0, 1, 0),
  Quat.identity(),
  Vec3.one()
));

world.addComponent(playerId, new Renderable('character_mesh', 'character_mat'));
world.addComponent(playerId, new RigidBody(75));  // 75kg

// Game loop
function gameLoop(dt: number) {
  world.fixedUpdate(1 / 60);  // Physics
  world.update(dt);            // Rendering prep
}

// Query
const allPhysicsEntities = world.query(Transform, RigidBody);
```

**Nie robi**:
- ❌ Nie renderuje (to w `@engine/gfx-webgpu`)
- ❌ Nie ładuje assetów (to w `@engine/assets`)
- ❌ Nie wie o WebGPU

---

# Rendering Layer

## @engine/gfx-webgpu

**Odpowiedzialność**: WebGPU rendering. Tylko czyta świat, nie modyfikuje.

**Zależności**: `@engine/core`, `@engine/world`

**Eksporty**:

### Device Manager

```typescript
export class DeviceManager {
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  queue: GPUQueue | null;
  
  async initialize(canvas: HTMLCanvasElement): Promise<void>;
  
  getFeatures(): GPUFeatureName[];
  getLimits(): GPUSupportedLimits;
  supportsTimestamps(): boolean;
}
```

### Resource Cache

```typescript
export type BufferId = string;
export type TextureId = string;
export type ShaderId = string;
export type MaterialId = string;
export type MeshId = string;

export class ResourceCache {
  constructor(device: GPUDevice);
  
  // Bufory
  createBuffer(desc: BufferDescriptor): BufferId;
  getBuffer(id: BufferId): GPUBuffer | undefined;
  destroyBuffer(id: BufferId): void;
  
  // Tekstury
  createTexture(desc: TextureDescriptor): TextureId;
  getTexture(id: TextureId): GPUTexture | undefined;
  destroyTexture(id: TextureId): void;
  
  // Shadery
  createShaderModule(code: string): ShaderId;
  getShaderModule(id: ShaderId): GPUShaderModule | undefined;
  
  // Materiały
  createMaterial(desc: MaterialDescriptor): MaterialId;
  getMaterial(id: MaterialId): Material | undefined;
  
  // Meshe
  uploadMesh(mesh: MeshData): MeshId;
  getMesh(id: MeshId): GPUMesh | undefined;
}

export interface BufferDescriptor {
  size: number;
  usage: GPUBufferUsageFlags;
  data?: ArrayBuffer;
}

export interface TextureDescriptor {
  width: number;
  height: number;
  format: GPUTextureFormat;
  usage: GPUTextureUsageFlags;
  data?: ArrayBuffer;
}

export interface MeshData {
  vertices: Float32Array;
  indices?: Uint32Array;
  vertexCount: number;
  indexCount?: number;
}
```

### Renderer

```typescript
import { World, Camera } from '@engine/world';

export class Renderer {
  constructor(deviceManager: DeviceManager, canvas: HTMLCanvasElement);
  
  async initialize(): Promise<void>;
  
  // Frame rendering
  render(world: World, camera: Camera): void;
  
  // Resource management
  getResourceCache(): ResourceCache;
  
  // Settings
  setShadowsEnabled(enabled: boolean): void;
  setPostProcessEnabled(enabled: boolean): void;
}
```

### Material System

```typescript
export enum MaterialType {
  StandardLit = 'StandardLit',
  Unlit = 'Unlit',
  Voxel = 'Voxel',
  UI = 'UI',
  Water = 'Water',
}

export interface MaterialParams {
  albedo?: Vec3;
  metallic?: number;
  roughness?: number;
  emissive?: Vec3;
  albedoTexture?: TextureId;
  normalTexture?: TextureId;
  metallicRoughnessTexture?: TextureId;
}

export interface MaterialDescriptor {
  type: MaterialType;
  params: MaterialParams;
  doubleSided?: boolean;
  transparent?: boolean;
}

export interface Material {
  id: MaterialId;
  type: MaterialType;
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  params: MaterialParams;
}
```

**Przykład użycia**:

```typescript
import { DeviceManager, Renderer, ResourceCache } from '@engine/gfx-webgpu';
import { World } from '@engine/world';

// Setup
const deviceManager = new DeviceManager();
await deviceManager.initialize(canvas);

const renderer = new Renderer(deviceManager, canvas);
await renderer.initialize();

const resourceCache = renderer.getResourceCache();

// Upload mesh
const meshId = resourceCache.uploadMesh({
  vertices: new Float32Array([...]),
  indices: new Uint32Array([...]),
  vertexCount: 8,
  indexCount: 36,
});

// Create material
const matId = resourceCache.createMaterial({
  type: MaterialType.StandardLit,
  params: {
    albedo: Vec3.create(1, 0, 0),  // Red
    metallic: 0.0,
    roughness: 0.5,
  },
});

// Render loop
function render() {
  renderer.render(world, camera);
  requestAnimationFrame(render);
}
```

**Nie robi**:
- ❌ Nie modyfikuje World (tylko czyta Transform, Renderable)
- ❌ Nie ładuje assetów z dysku (to `@engine/assets`)
- ❌ Nie wie o skryptach, logice gry

---

# Asset Management

## @engine/assets

**Odpowiedzialność**: Ładowanie i streaming assetów.

**Zależności**: `@engine/core`, `@engine/world`

**Eksporty**:

```typescript
export type AssetId = string;

export enum AssetType {
  Mesh = 'mesh',
  Texture = 'texture',
  Animation = 'animation',
  Audio = 'audio',
  Script = 'script',
}

export interface Asset {
  id: AssetId;
  type: AssetType;
  uri: string;
  data: any;
  loaded: boolean;
}

export class AssetManager {
  constructor();
  
  // Loading
  async load(uri: string): Promise<Asset>;
  async loadMultiple(uris: string[]): Promise<Asset[]>;
  
  // Preloading
  async preload(uris: string[]): Promise<void>;
  
  // Access
  get(uri: string): Asset | undefined;
  has(uri: string): boolean;
  
  // Unloading
  unload(uri: string): void;
  unloadAll(): void;
  
  // URI resolver
  setResolver(resolver: URIResolver): void;
}

export interface URIResolver {
  resolve(uri: string): Promise<Response>;
}

// Loaders
export interface AssetLoader<T> {
  load(uri: string): Promise<T>;
}

export class MeshLoader implements AssetLoader<MeshData> {
  async load(uri: string): Promise<MeshData>;
}

export class TextureLoader implements AssetLoader<ImageBitmap> {
  async load(uri: string): Promise<ImageBitmap>;
}

// Streaming
export class AssetStreamingSystem {
  constructor(assetManager: AssetManager, maxCacheSize: number);
  
  update(camera: Camera): void;  // Stream based on camera position
  
  setPriority(uri: string, priority: number): void;
}

// UGC Pack
export interface UGCPack {
  version: string;
  metadata: {
    name: string;
    author: string;
    description: string;
  };
  entities: EntityData[];
  assets: {
    meshes: MeshData[];
    textures: TextureData[];
    scripts: ScriptData[];
  };
}

export class UGCPackSerializer {
  static serialize(world: World): UGCPack;
  static deserialize(pack: UGCPack): World;
}
```

**Przykład użycia**:

```typescript
import { AssetManager, MeshLoader, TextureLoader } from '@engine/assets';

const assetManager = new AssetManager();

// Load mesh
const meshAsset = await assetManager.load('mesh://character');
const meshData = meshAsset.data as MeshData;

// Load texture
const textureAsset = await assetManager.load('texture://character_diffuse');

// Preload
await assetManager.preload([
  'mesh://level_01',
  'texture://skybox',
  'audio://background_music',
]);

// URI resolver (custom)
assetManager.setResolver({
  async resolve(uri: string): Promise<Response> {
    if (uri.startsWith('bundle://')) {
      // Load from embedded bundle
      return fetchFromBundle(uri);
    }
    // Default HTTP
    return fetch(uri);
  },
});
```

**Nie robi**:
- ❌ Nie renderuje (to `@engine/gfx-webgpu`)
- ❌ Nie wie o WebGPU (zwraca tylko dane)

---

# Scripting

## @engine/script

**Odpowiedzialność**: Bezpieczne wykonywanie user scripts (LogicCubes).

**Zależności**: `@engine/core`, `@engine/world`

**Eksporty**:

```typescript
import { World, EntityId } from '@engine/world';
import { EventBus } from '@engine/core';

export interface ScriptContext {
  entity: EntityId;
  world: World;
  events: EventBus;
  deltaTime: number;
}

export class ScriptRuntime {
  constructor(world: World);
  
  executeScript(script: Script, context: ScriptContext): void;
  
  // Sandbox API (ograniczone)
  getRestrictedAPI(): ScriptAPI;
}

export interface ScriptAPI {
  // Entity
  getPosition(entity: EntityId): Vec3;
  setPosition(entity: EntityId, pos: Vec3): void;
  
  // Events
  emit(event: string, data?: any): void;
  on(event: string, callback: Function): void;
  
  // Queries
  findEntitiesWithTag(tag: string): EntityId[];
  
  // BRAK dostępu do:
  // - window, document
  // - fetch, XMLHttpRequest
  // - eval, Function constructor
  // - WebGPU API
}

// LogicCubes
export interface LogicCube {
  id: string;
  type: 'action' | 'condition' | 'trigger' | 'data';
  inputs: Port[];
  outputs: Port[];
  
  execute(context: ScriptContext): void;
}

export interface Port {
  name: string;
  type: 'signal' | 'number' | 'string' | 'entity' | 'vec3';
  value?: any;
}

export class LogicCubeSystem implements System {
  readonly requiredComponents = [Transform, LogicCubeComponent];
  
  constructor(world: World);
  
  fixedUpdate(dtFixed: number): void;
  
  registerCube(cube: LogicCube): void;
}

// Built-in cubes
export namespace BuiltInCubes {
  export class PlayerEnterZone implements LogicCube {
    // ...
  }
  
  export class OpenDoor implements LogicCube {
    // ...
  }
  
  export class SetVariable implements LogicCube {
    // ...
  }
}
```

**Przykład użycia**:

```typescript
import { LogicCubeSystem, BuiltInCubes } from '@engine/script';

const scriptSystem = new LogicCubeSystem(world);
world.addSystem(scriptSystem);

// Register cubes
scriptSystem.registerCube(new BuiltInCubes.PlayerEnterZone());
scriptSystem.registerCube(new BuiltInCubes.OpenDoor());

// User-defined logic (JSON, not code)
const triggerLogic = {
  type: 'trigger',
  cubes: [
    { id: 'trigger_1', type: 'PlayerEnterZone', inputs: { zone: doorZoneEntity } },
    { id: 'action_1', type: 'OpenDoor', inputs: { door: doorEntity } },
  ],
  connections: [
    { from: 'trigger_1.onEnter', to: 'action_1.execute' },
  ],
};
```

**Nie robi**:
- ❌ Nie daje pełnego dostępu do JavaScript (tylko sandbox)
- ❌ Nie wykonuje `eval()` user code
- ❌ Nie pozwala na dostęp do GPU, DOM, network

---

# Input & Camera

## @engine/input

**Odpowiedzialność**: Input management (keyboard, mouse, gamepad, touch).

**Zależności**: `@engine/core`

**Eksporty**:

```typescript
export class InputManager {
  keyboard: KeyboardState;
  mouse: MouseState;
  gamepad: GamepadState;
  touch: TouchState;
  
  constructor(element: HTMLElement);
  
  update(): void;
  destroy(): void;
}

export class KeyboardState {
  isKeyDown(key: string): boolean;
  isKeyPressed(key: string): boolean;  // This frame only
  isKeyReleased(key: string): boolean;
}

export class MouseState {
  position: Vec2;
  delta: Vec2;
  buttons: boolean[];
  wheel: number;
  
  isButtonDown(button: number): boolean;
  isButtonPressed(button: number): boolean;
}

// Input contexts (stack-based)
export interface InputContext {
  name: string;
  bindings: InputBinding[];
  pointerLock?: boolean;
}

export interface InputBinding {
  action: string;
  keys: string[];
  callback: (value: number) => void;
}

export class InputContextManager {
  push(context: InputContext): void;
  pop(): void;
  current(): InputContext | undefined;
  
  processInput(inputManager: InputManager): void;
}
```

**Przykład użycia**:

```typescript
import { InputManager, InputContextManager } from '@engine/input';

const inputManager = new InputManager(canvas);
const contextManager = new InputContextManager();

// Editor context
contextManager.push({
  name: 'Editor',
  bindings: [
    { action: 'delete', keys: ['Delete'], callback: () => deleteSelected() },
    { action: 'undo', keys: ['Control', 'Z'], callback: () => undo() },
  ],
});

// Game loop
function update() {
  inputManager.update();
  contextManager.processInput(inputManager);
  
  if (inputManager.keyboard.isKeyDown('W')) {
    moveForward();
  }
}
```

**Nie robi**:
- ❌ Nie modyfikuje Entity bezpośrednio (tylko emituje eventy)

---

## @engine/camera

**Odpowiedzialność**: Camera systems.

**Zależności**: `@engine/core`, `@engine/world`

**Eksporty**:

```typescript
import { Vec3, Mat4 } from '@engine/core';

export abstract class Camera {
  abstract getViewMatrix(): Mat4;
  abstract getProjectionMatrix(): Mat4;
}

export class OrbitCamera extends Camera {
  target: Vec3;
  distance: number;
  azimuth: number;
  elevation: number;
  
  constructor(target: Vec3, distance: number);
  
  rotate(deltaAzimuth: number, deltaElevation: number): void;
  zoom(delta: number): void;
  pan(deltaX: number, deltaY: number): void;
  
  getViewMatrix(): Mat4;
  getProjectionMatrix(): Mat4;
}

export class FPSCamera extends Camera {
  position: Vec3;
  yaw: number;
  pitch: number;
  fov: number;
  
  constructor(position: Vec3);
  
  rotate(deltaYaw: number, deltaPitch: number): void;
  move(forward: number, right: number, up: number): void;
  
  getViewMatrix(): Mat4;
  getProjectionMatrix(): Mat4;
  getForward(): Vec3;
  getRight(): Vec3;
}

export class CameraDirector {
  activeCamera: Camera;
  
  constructor(initialCamera: Camera);
  
  setCamera(camera: Camera): void;
  blendTo(camera: Camera, duration: number): void;
  
  update(dt: number): void;
  
  getViewMatrix(): Mat4;
  getProjectionMatrix(): Mat4;
}
```

**Przykład użycia**:

```typescript
import { CameraDirector, OrbitCamera, FPSCamera } from '@engine/camera';

const orbitCam = new OrbitCamera(Vec3.zero(), 10);
const fpsCam = new FPSCamera(Vec3.create(0, 1.6, 0));

const director = new CameraDirector(orbitCam);

// Switch to FPS (with blend)
director.blendTo(fpsCam, 0.5);  // 0.5 seconds

// Update
function update(dt: number) {
  director.update(dt);
  
  const viewMatrix = director.getViewMatrix();
  renderer.render(world, viewMatrix);
}
```

---

# Standard Library

## @engine/stdlib

**Odpowiedzialność**: Gotowe prefaby używane w większości gier.

**Zależności**: `@engine/core`, `@engine/world`, `@engine/assets`, `@engine/input`

**Eksporty**:

### CharacterController

```typescript
import { System } from '@engine/core';
import { EntityId, Transform, RigidBody } from '@engine/world';
import { InputManager } from '@engine/input';

export class CharacterController implements System {
  readonly requiredComponents = [Transform, RigidBody, CharacterControllerComponent];
  
  moveSpeed: number;
  jumpForce: number;
  
  constructor(world: World, inputManager: InputManager);
  
  fixedUpdate(dtFixed: number): void;
}

export class CharacterControllerComponent implements Component {
  readonly type = 'CharacterController';
  
  moveSpeed: number;
  jumpForce: number;
  isGrounded: boolean;
  
  constructor(moveSpeed: number, jumpForce: number);
}
```

### Animation

```typescript
export class AnimationSystem implements System {
  readonly requiredComponents = [Transform, AnimationComponent];
  
  constructor(world: World);
  
  update(dt: number): void;
  
  play(entity: EntityId, clipId: string): void;
  stop(entity: EntityId): void;
  blend(entity: EntityId, clipA: string, clipB: string, weight: number): void;
}

export class AnimationClip {
  id: string;
  duration: number;
  tracks: AnimationTrack[];
  
  constructor(id: string, duration: number);
}
```

### Audio

```typescript
export class AudioSystem implements System {
  constructor(world: World);
  
  play(clipId: string, position?: Vec3): void;
  stop(clipId: string): void;
  setVolume(clipId: string, volume: number): void;
  
  update(listenerPosition: Vec3): void;  // Spatial audio
}
```

**Przykład użycia**:

```typescript
import { CharacterController, AnimationSystem, AudioSystem } from '@engine/stdlib';

// Setup
const characterController = new CharacterController(world, inputManager);
world.addSystem(characterController);

const animationSystem = new AnimationSystem(world);
world.addSystem(animationSystem);

// Play animation
animationSystem.play(playerId, 'walk');
```

---

## Podsumowanie API

| Moduł | Główny Eksport | Główna Odpowiedzialność |
|-------|---------------|------------------------|
| `@engine/core` | `Vec3`, `Mat4`, `EventBus`, `JobSystem` | Foundation - math, ECS base, job scheduling |
| `@engine/world` | `World`, `Transform`, `PhysicsSystem` | ECS runtime - simulation, physics, scene |
| `@engine/gfx-webgpu` | `Renderer`, `ResourceCache`, `Material` | WebGPU rendering |
| `@engine/voxel` | `ChunkStore`, `ChunkMesher` | Voxel/microblock system |
| `@engine/assets` | `AssetManager`, `UGCPackSerializer` | Asset loading & streaming |
| `@engine/script` | `ScriptRuntime`, `LogicCubeSystem` | UGC scripting (sandbox) |
| `@engine/input` | `InputManager`, `InputContextManager` | Input handling |
| `@engine/camera` | `CameraDirector`, `OrbitCamera`, `FPSCamera` | Camera systems |
| `@engine/net` | `SnapshotReplicator`, `ReplayRecorder` | Multiplayer & replay |
| `@engine/stdlib` | `CharacterController`, `AnimationSystem`, `AudioSystem` | Standard prefabs |

---

## Następne Kroki

1. ✅ [CURRENT_STRUCTURE.md](./CURRENT_STRUCTURE.md)
2. ✅ [ARCHITECTURE.md](./ARCHITECTURE.md)
3. ✅ [TARGET_STRUCTURE.md](./TARGET_STRUCTURE.md)
4. ✅ [MODULE_SPECIFICATIONS.md](./MODULE_SPECIFICATIONS.md) (TEN DOKUMENT)
5. ⏭️ [FRAME_MODEL.md](./FRAME_MODEL.md)
6. ⏭️ [PERFORMANCE_PHILOSOPHY.md](./PERFORMANCE_PHILOSOPHY.md)
7. ⏭️ [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
8. ⏭️ [adr/001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md)


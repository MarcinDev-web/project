# Performance Philosophy

## Filozofia

Silnik musi działać **w przeglądarce** na **różnym sprzęcie**:
- 💻 Desktop (mocny GPU)
- 💼 Laptop (średni GPU, ograniczony thermal)
- 📱 Mobile (słaby GPU, touch, bateria)

**Cel**: 60 FPS na średnim sprzęcie, 30 FPS minimum na słabym.

## Zasady Ogólne

### 1. Profile First, Optimize Second

```
❌ ŹLE: "Ten kod wygląda powolny, przeoptymalizu ję"
✅ DOBRZE: "Profiler pokazuje 40% czasu w X, optymalizuję X"
```

**Narzędzia**:
- Chrome DevTools Performance tab
- WebGPU timestamp queries
- `console.time()` / `console.timeEnd()`

### 2. Do The Right Amount of Work

```
❌ ŹLE: Symuluj 10,000 entities niewidocznych dla gracza
✅ DOBRZE: Symuluj tylko to co w range (culling, streaming)
```

### 3. Do Work at The Right Time

```
❌ ŹLE: Generuj mesh podczas frame'u (16ms budget)
✅ DOBRZE: Generuj mesh w worker (background, bez blokady)
```

### 4. Do Work at The Right Place

```
❌ ŹLE: CPU liczy transform dla 10,000 vertices
✅ DOBRZE: GPU liczy transform w vertex shader
```

---

## Strategia 1: Workers dla Ciężkich Zadań

### Wszystko Co Ciężkie → Worker

| Zadanie | Czas | Worker? |
|---------|------|---------|
| Chunk meshing (voxel) | ~50ms | ✅ TAK |
| Asset loading (fetch + parse) | ~100ms | ✅ TAK |
| Pathfinding (A*) | ~20ms | ✅ TAK |
| Navmesh generation | ~500ms | ✅ TAK |
| Audio decoding | ~50ms | ✅ TAK |
| Transform hierarchy | ~1ms | ❌ NIE (main thread OK) |
| Frustum culling | ~2ms | ❌ NIE (main thread OK) |

### Przykład: Chunk Mesher

**❌ ŹLE (main thread)**:
```typescript
function generateChunkMesh(chunk: Chunk): MeshData {
  // 50ms work ❌ - blokuje frame!
  return greedyMeshing(chunk.blocks);
}

// Game loop
function frame() {
  const mesh = generateChunkMesh(chunk);  // ❌ LAG!
  render();
}
```

**✅ DOBRZE (worker)**:
```typescript
// Main thread
async function generateChunkMeshAsync(chunk: Chunk): Promise<MeshData> {
  const worker = new Worker('mesher.worker.js');
  
  return new Promise(resolve => {
    worker.postMessage({ blocks: chunk.blocks });
    worker.onmessage = (e) => resolve(e.data);
  });
}

// Game loop
function frame() {
  // Mesh generuje się w tle, nie blokuje
  render();
}

// Jak mesh gotowy:
generateChunkMeshAsync(chunk).then(mesh => {
  uploadToGPU(mesh);  // Szybkie (1-2ms)
});
```

### Worker Pool

Zarządzaj workerami przez `JobSystem`:

```typescript
const jobSystem = new JobSystem(4);  // 4 workers

jobSystem.schedule({
  execute: async () => await heavyComputation(),
  priority: TaskPriority.Background,
});
```

---

## Strategia 2: ECS i Structure of Arrays (SOA)

### Problem: Array of Structures (AOS)

```typescript
// ❌ AOS - cache misses
interface Entity {
  position: Vec3;     // 12 bytes
  velocity: Vec3;     // 12 bytes
  color: Vec3;        // 12 bytes
  // ... więcej danych
}

const entities: Entity[] = [/* 10,000 entities */];

// Iteruj position (potrzebujemy tylko position)
for (const entity of entities) {
  entity.position.x += dt;  // ❌ Ładuje całą strukturę (cache miss!)
}
```

**Cache miss**: CPU ładuje 64-byte cache line, ale używa tylko 12 bytes (position).

### Rozwiązanie: Structure of Arrays (SOA)

```typescript
// ✅ SOA - cache friendly
class TransformStore {
  positions: Float32Array;  // [x,y,z, x,y,z, x,y,z, ...]
  rotations: Float32Array;  // [x,y,z,w, x,y,z,w, ...]
  scales: Float32Array;     // [x,y,z, x,y,z, ...]
  
  count: number;
}

// Iteruj tylko position (linear memory access)
for (let i = 0; i < store.count; i++) {
  store.positions[i * 3 + 0] += dt;  // ✅ Sequential access, cache happy
}
```

**Korzyści**:
- ✅ Cache locality (CPU prefetch działa)
- ✅ SIMD możliwy (4 pozycje naraz)
- ✅ Przyszłe GPU compute (skopiuj całą tablicę na GPU)

### Kiedy SOA?

```
Hot path (update co frame):
  - Transform (position, rotation, scale)     → SOA
  - RigidBody (velocity, forces)              → SOA
  - Renderable (mesh/material IDs)            → SOA

Cold path (rzadko access):
  - Script (state object)                     → AOS OK
  - Light (settings)                          → AOS OK
```

---

## Strategia 3: Minimalizuj Bind Calls (GPU)

### Problem: Naiwne Renderowanie

```typescript
// ❌ 1000 meshów = 2000+ bind calls
for (const entity of entities) {
  pass.setPipeline(material.pipeline);        // Bind 1
  pass.setBindGroup(0, material.bindGroup);   // Bind 2
  pass.setVertexBuffer(0, mesh.vertexBuffer); // Bind 3
  pass.drawIndexed(mesh.indexCount);          // Draw
}

// 1000 entities × 3 binds = 3000 bind calls ❌
```

**Bind call = expensive** (GPU state change).

### Rozwiązanie 1: Batch by Material

```typescript
// ✅ Group by material
const batches = groupByMaterial(entities);

for (const batch of batches) {
  pass.setPipeline(batch.material.pipeline);     // Bind 1 raz
  pass.setBindGroup(0, batch.material.bindGroup); // Bind 1 raz
  
  for (const instance of batch.instances) {
    pass.setVertexBuffer(0, instance.mesh.vertexBuffer);
    pass.drawIndexed(instance.mesh.indexCount);
  }
}

// 10 materiałów × 2 binds = 20 bind calls ✅ (150× redukcja!)
```

### Rozwiązanie 2: Instancing

```typescript
// ✅ Instanced rendering (100 meshów → 1 draw call)
pass.setPipeline(material.pipeline);
pass.setBindGroup(0, material.bindGroup);
pass.setVertexBuffer(0, mesh.vertexBuffer);
pass.setVertexBuffer(1, instanceBuffer);  // World matrices
pass.drawIndexedInstanced(mesh.indexCount, 100);

// 100 entities → 3 binds + 1 draw = 4 calls ✅ (750× redukcja!)
```

### Rozwiązanie 3: Texture Atlas

```typescript
// ❌ 100 materiałów = 200 bind calls (albedo + normal)
for (const material of materials) {
  pass.setBindGroup(0, material.albedoTexture);  // Bind
  pass.setBindGroup(1, material.normalTexture);  // Bind
  // ...
}

// ✅ 100 materiałów w 1 atlas = 2 bind calls
const atlas = createTextureAtlas(materials);
pass.setBindGroup(0, atlas.albedoAtlas);   // Bind 1 raz
pass.setBindGroup(1, atlas.normalAtlas);   // Bind 1 raz

// Shader: sample z offset
vec2 uv = vUV * material.uvScale + material.uvOffset;
vec4 albedo = texture(atlasTexture, uv);
```

**Przed**: 100 materiałów = 200 bind calls
**Po**: 100 materiałów = 2 bind calls
**Redukcja**: **100×**

---

## Strategia 4: Streaming Assetów

### Problem: Load All Upfront

```typescript
// ❌ Ładuj wszystko na starcie (10 GB)
async function loadLevel() {
  await Promise.all([
    loadTexture('level_1_albedo.ktx2'),       // 50 MB
    loadTexture('level_1_normal.ktx2'),       // 50 MB
    loadMesh('level_1_building_1.glb'),       // 20 MB
    loadMesh('level_1_building_2.glb'),       // 20 MB
    // ... 500 more assets
  ]);
  
  // User czeka 2 minuty ❌
}
```

### Rozwiązanie: Streaming

**Faza 1: Skeleton (instant load)**
```typescript
// ✅ Załaduj szkielet (collider + lowpoly proxy)
await loadLevelSkeleton({
  collider: 'level_1_collision.bin',    // 1 MB
  proxy: 'level_1_proxy.glb',           // 5 MB (lowpoly)
});

// Gra playable w 5 sekund ✅
```

**Faza 2: Streaming (on-demand)**
```typescript
// ✅ Załaduj assety w range kamery
class AssetStreamingSystem {
  update(cameraPos: Vec3) {
    // Priority queue (distance to camera)
    const nearbyAssets = this.findAssetsInRange(cameraPos, 100);
    
    for (const asset of nearbyAssets) {
      if (!asset.loaded) {
        this.assetManager.load(asset.uri);  // Async
      }
    }
    
    // Evict dalekie assety (LRU)
    const farAssets = this.findAssetsOutOfRange(cameraPos, 200);
    for (const asset of farAssets) {
      this.assetManager.unload(asset.uri);
    }
  }
}
```

**Rezultat**:
- ✅ Instant playable (skeleton)
- ✅ HD tekstury ładują się w tle (nie blokują)
- ✅ Pamięć pod kontrolą (LRU eviction)

---

## Strategia 5: Fixed Timestep dla Logiki

### Problem: Variable Timestep

```typescript
// ❌ Variable dt - niestabilna fizyka
function frame(dt: number) {
  // dt varies: 16ms, 33ms, 8ms, 50ms (lag spike), ...
  
  velocity.y += gravity * dt;  // ❌ Różne wyniki per FPS!
  position.y += velocity.y * dt;
  
  // Multiplayer rozjeżdża się ❌
  // Replays nie działają ❌
}
```

**Problem**: Fizyka zależy od FPS. 30 FPS ≠ 60 FPS.

### Rozwiązanie: Fixed Timestep

```typescript
// ✅ Fixed timestep - stabilna fizyka
const FIXED_DT = 1 / 60;  // 60 Hz
let accumulator = 0;

function frame(dt: number) {
  accumulator += dt;
  
  while (accumulator >= FIXED_DT) {
    fixedUpdate(FIXED_DT);  // ✅ Zawsze 60 Hz
    accumulator -= FIXED_DT;
  }
  
  render();
}

function fixedUpdate(dt: number) {
  // dt = 1/60 zawsze
  velocity.y += gravity * dt;
  position.y += velocity.y * dt;
  
  // Deterministic ✅
  // Multiplayer sync ✅
  // Replays work ✅
}
```

**Korzyści**:
- ✅ Fizyka identyczna na 30 FPS i 60 FPS
- ✅ Multiplayer nie rozjeżdża się
- ✅ Replays działają (determinizm)
- ✅ Łatwiejsze debugowanie

---

## Strategia 6: Frustum Culling

### Problem: Render All

```typescript
// ❌ Renderuj wszystkie 10,000 entities
for (const entity of world.getAllEntities()) {
  renderEntity(entity);  // ❌ Większość off-screen!
}
```

**Problem**: 90% entities poza ekranem, ale GPU renderuje wszystko.

### Rozwiązanie: Frustum Culling

```typescript
// ✅ Renderuj tylko visible
function render(camera: Camera) {
  const frustum = buildFrustum(camera);
  
  for (const entity of world.getAllEntities()) {
    const bounds = getBounds(entity);
    
    if (frustumIntersects(frustum, bounds)) {
      renderEntity(entity);  // ✅ Tylko visible
    }
  }
}
```

**Resultaty** (example):
- Scena: 10,000 entities
- Visible: 500 entities (5%)
- GPU work: **95% redukcja**

---

## Strategia 7: Level of Detail (LOD)

### Problem: High Poly Wszędzie

```typescript
// ❌ 10k poly mesh dla obiektu 100m dalej
renderMesh('building_highpoly.glb');  // 10,000 triangles, 2 pixele na ekranie
```

**Problem**: GPU rasteryzuje 10k tris dla 2 pixelów.

### Rozwiązanie: LOD

```typescript
// ✅ LOD based on distance
const distance = Vec3.distance(entity.position, camera.position);

let meshId: string;
if (distance < 10) {
  meshId = 'building_lod0.glb';  // 10,000 tris
} else if (distance < 50) {
  meshId = 'building_lod1.glb';  // 2,000 tris
} else {
  meshId = 'building_lod2.glb';  // 500 tris
}

renderMesh(meshId);
```

**Resultat**:
- Bliskie: High poly (szczegóły widoczne)
- Średnie: Medium poly (dobre dla oko)
- Dalekie: Low poly (ledwo widać)
- GPU: **80% redukcja triangles**

---

## Strategia 8: Occlusion Culling (Advanced)

### Problem: Frustum Culling Nie Wystarczy

```typescript
// Budynek A (front, visible)
// Budynek B (za A, occluded)

// Frustum culling:
// - A: ✅ w frustum, render
// - B: ✅ w frustum, render (❌ ale occluded przez A!)
```

**Problem**: GPU renderuje B, ale A go zakrywa (wasted work).

### Rozwiązanie: Occlusion Queries (GPU)

```typescript
// 1. Render bounding boxes (cheap) do occlusion buffer
pass.setOcclusionQuery(true);
for (const entity of potentiallyVisible) {
  renderBoundingBox(entity);  // Simple box, cheap
}

// 2. GPU sprawdza ile pixeli visible
const visiblePixels = pass.getOcclusionQueryResult(entity);

// 3. Render tylko jeśli visible
if (visiblePixels > 0) {
  renderEntity(entity);  // ✅ Faktycznie visible
}
```

**Uwaga**: Occlusion queries mają latency (1-2 frames). Use z previous frame data.

---

## Strategia 9: Lazy Evaluation

### Problem: Oblicz Wszystko Always

```typescript
// ❌ Recompute world matrices co frame dla wszystkich entities
for (const entity of world.getAllEntities()) {
  updateWorldMatrix(entity);  // ❌ Nawet jeśli nie zmienił się!
}
```

### Rozwiązanie: Dirty Flags

```typescript
// ✅ Recompute tylko jeśli dirty
class Transform {
  private _position: Vec3;
  private _worldMatrix: Mat4;
  private _dirty = true;
  
  set position(value: Vec3) {
    this._position = value;
    this._dirty = true;  // Mark dirty
  }
  
  get worldMatrix(): Mat4 {
    if (this._dirty) {
      this._worldMatrix = computeWorldMatrix(this);
      this._dirty = false;
    }
    return this._worldMatrix;
  }
}
```

**Rezultat**:
- Statyczne entities: 0 work (nie dirty)
- Animowane entities: work tylko jeśli zmiana

---

## Strategia 10: Batch Small Updates

### Problem: Micro Updates GPU

```typescript
// ❌ Update uniform buffer 1000× per frame
for (const entity of entities) {
  device.queue.writeBuffer(uniformBuffer, 0, entity.data);  // ❌ 1000 writes!
}
```

**Problem**: Każdy `writeBuffer` = command submit (expensive).

### Rozwiązanie: Batch Updates

```typescript
// ✅ Batch do jednego buffer
const allData = new Float32Array(entities.length * uniformSize);

for (let i = 0; i < entities.length; i++) {
  allData.set(entities[i].data, i * uniformSize);
}

device.queue.writeBuffer(uniformBuffer, 0, allData);  // ✅ 1 write
```

---

## Benchmarks (Target)

### Desktop (RTX 3060, Ryzen 5600)

| Scenario | FPS Target | Actual |
|----------|------------|--------|
| Empty scene | 240 FPS | ✅ |
| 1,000 entities (no culling) | 120 FPS | ✅ |
| 10,000 entities (culling) | 60 FPS | ✅ |
| Complex scene (PBR, shadows) | 60 FPS | ✅ |

### Laptop (Integrated GPU, i5)

| Scenario | FPS Target | Actual |
|----------|------------|--------|
| Empty scene | 120 FPS | ✅ |
| 1,000 entities | 60 FPS | ✅ |
| 10,000 entities (culling) | 30 FPS | ⚠️ |
| Complex scene (low settings) | 30 FPS | ✅ |

### Mobile (Mid-range phone)

| Scenario | FPS Target | Actual |
|----------|------------|--------|
| Empty scene | 60 FPS | ✅ |
| 500 entities | 30 FPS | ✅ |
| 1,000 entities (culling, LOD) | 30 FPS | ⚠️ |

---

## Profiling Tools

### Chrome DevTools

```javascript
// Performance tab:
// 1. Otwórz DevTools (F12)
// 2. Performance tab
// 3. Record (Ctrl+E)
// 4. Play 5 sekund
// 5. Stop
// 6. Analyze flame graph

// Find hotspots:
// - Long frames (>16ms)
// - Long tasks (>50ms)
// - GPU usage
```

### WebGPU Timestamps

```typescript
// Query render pass timing
const querySet = device.createQuerySet({
  type: 'timestamp',
  count: 2,
});

pass.writeTimestamp(querySet, 0);  // Start
// ... render work ...
pass.writeTimestamp(querySet, 1);  // End

// Read results
const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
encoder.resolveQuerySet(querySet, 0, 2, buffer, 0);

await buffer.mapAsync(GPUMapMode.READ);
const times = new BigUint64Array(buffer.getMappedRange());
const duration = Number(times[1] - times[0]) / 1_000_000;  // ms
console.log('Render pass:', duration, 'ms');
```

### console.time

```typescript
console.time('PhysicsSystem.update');
physicsSystem.update(dt);
console.timeEnd('PhysicsSystem.update');

// Output: PhysicsSystem.update: 3.14ms
```

---

## Red Flags (Co Unikać)

### ❌ Synchronous Asset Loading

```typescript
// ❌ NIGDY - blokuje main thread
const image = new Image();
image.src = 'huge_texture.png';
document.body.appendChild(image);  // Waits for load ❌
```

### ❌ String Concatenation w Hot Path

```typescript
// ❌ Alokacja per frame
for (const entity of entities) {
  const key = 'entity_' + entity.id;  // ❌ New string allocation!
  cache.get(key);
}

// ✅ Pre-allocate keys
const keys = new Map<EntityId, string>();
for (const entity of entities) {
  cache.get(keys.get(entity.id));  // ✅ No allocation
}
```

### ❌ Array.push w Loop

```typescript
// ❌ Reallocation per push
const results = [];
for (let i = 0; i < 10000; i++) {
  results.push(i);  // ❌ Multiple reallocations
}

// ✅ Pre-allocate
const results = new Array(10000);
for (let i = 0; i < 10000; i++) {
  results[i] = i;  // ✅ No reallocation
}
```

---

## Podsumowanie

| Strategia | Kiedy | Korzyść |
|-----------|-------|---------|
| **Workers** | Heavy compute (>10ms) | Nie blokuje main thread |
| **SOA** | Hot data (update co frame) | Cache locality, SIMD |
| **Batch by Material** | Wiele meshów | Reduce bind calls (100×) |
| **Instancing** | Wiele identycznych meshów | 1 draw call zamiast N |
| **Texture Atlas** | Wiele materiałów | 2 binds zamiast 2N |
| **Streaming** | Duże levele | Instant playable, memory control |
| **Fixed Timestep** | Fizyka, logika | Determinizm, multiplayer |
| **Frustum Culling** | Dużo entities | Render tylko visible (95% redukcja) |
| **LOD** | Dalekie objects | Reduce triangles (80% redukcja) |
| **Dirty Flags** | Expensive compute | Only recompute when changed |

---

## Następne Kroki

1. ✅ [CURRENT_STRUCTURE.md](./CURRENT_STRUCTURE.md)
2. ✅ [ARCHITECTURE.md](./ARCHITECTURE.md)
3. ✅ [TARGET_STRUCTURE.md](./TARGET_STRUCTURE.md)
4. ✅ [MODULE_SPECIFICATIONS.md](./MODULE_SPECIFICATIONS.md)
5. ✅ [FRAME_MODEL.md](./FRAME_MODEL.md)
6. ✅ [PERFORMANCE_PHILOSOPHY.md](./PERFORMANCE_PHILOSOPHY.md) (TEN DOKUMENT)
7. ⏭️ [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
8. ⏭️ [adr/001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md)


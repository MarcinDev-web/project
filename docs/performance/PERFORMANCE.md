# Performance

**Zasady wydajności dla silnika 3D w przeglądarce**

## Cel

60 FPS na średnim sprzęcie, 30 FPS minimum na słabym.

## Główne Zasady

### 1. Profile First, Optimize Second
Nie optymalizuj bez profilowania. Używaj Chrome DevTools Performance, WebGPU timestamps, `console.time()`.

### 2. Do The Right Amount of Work
- Culling - nie przetwarzaj niewidocznych obiektów
- LOD - mniej szczegółów dla dalekich obiektów
- Streaming - ładuj tylko co potrzebne

### 3. Do Work at The Right Time
- Hot paths - max 16ms per frame dla 60 FPS
- Background tasks - używaj Web Workers
- Lazy loading - odkładaj non-critical work

### 4. Do Work at The Right Place
- CPU - logika, decision making
- GPU - transformacje, rendering, compute

## Hot Paths - Question Every Allocation

**Hot path** = kod wykonywany każdą klatkę dla wielu obiektów.

### Unikaj alokacji w hot paths

```typescript
// ❌ ŹLE - alokuje każdą klatkę
update() {
  const temp = new Vec3(); // ALLOCATION!
  for (entity of entities) {
    const result = entity.transform(temp); // ALLOCATION!
  }
}

// ✅ DOBRZE - reuse buffers
private tempVec = new Vec3();

update() {
  for (entity of entities) {
    entity.transform(this.tempVec); // No allocation
  }
}
```

### Pooling dla często tworzonych obiektów

```typescript
class EntityPool {
  private pool: Entity[] = [];
  
  acquire(): Entity {
    return this.pool.pop() ?? new Entity();
  }
  
  release(entity: Entity): void {
    entity.reset();
    this.pool.push(entity);
  }
}
```

### Prefer typed arrays dla bulk data

```typescript
// ❌ ŹLE - array of objects
const positions: Vec3[] = [];

// ✅ DOBRZE - flat typed array
const positions = new Float32Array(entityCount * 3);
```

## Cache Locality

**CPU cache miss = 100x wolniej niż hit**

### Structure of Arrays (SoA) > Array of Structures (AoS)

```typescript
// ❌ ŹLE - AoS, poor cache locality
class Entity {
  position: Vec3;
  velocity: Vec3;
  health: number;
}
const entities: Entity[] = [];

// ✅ DOBRZE - SoA, excellent cache locality
class EntitySystem {
  positions: Float32Array;  // [x,y,z, x,y,z, ...]
  velocities: Float32Array;
  health: Float32Array;
}
```

Kiedy update physics, CPU ładuje cały cache line (64 bytes = ~16 floats) → przy SoA dostajesz 5 pozycji za darmo.

## GPU Optimization

### Batch draw calls

```typescript
// ❌ ŹLE - 1000 draw calls
for (mesh of meshes) {
  device.draw(mesh);
}

// ✅ DOBRZE - 1 draw call, instancing
device.drawInstanced(mesh, meshes.length);
```

### Minimize state changes

```typescript
// ❌ ŹLE - bind texture każdą klatkę per material
materials.forEach(m => {
  device.bindTexture(m.albedo);
  device.draw();
});

// ✅ DOBRZE - texture atlas, bind raz
device.bindTexture(atlas);
materials.forEach(m => {
  device.setUVOffset(m.atlasOffset);
  device.draw();
});
```

100 materials: 200 binds → 2 binds (100x redukcja!)

### Shader optimization

```wgsl
// ❌ ŹLE - branch w shader
if (useTexture) {
  color = textureSample(albedo, uv);
} else {
  color = baseColor;
}

// ✅ DOBRZE - mix, no branch
let texColor = textureSample(albedo, uv);
color = mix(baseColor, texColor, f32(useTexture));
```

## Measurement

### Frame budget
```typescript
const frameStart = performance.now();
update();
render();
const frameDuration = performance.now() - frameStart;

if (frameDuration > 16.67) {
  console.warn(`Frame drop: ${frameDuration}ms`);
}
```

### Performance tests
```typescript
it('should process 10k entities <16ms', () => {
  const start = performance.now();
  system.update(entities);
  expect(performance.now() - start).toBeLessThan(16);
});
```

## Checklist per Feature

Przed merge nowej features:
- [ ] Profile w Chrome DevTools
- [ ] Nie alokuje w hot paths?
- [ ] Cache locality OK?
- [ ] GPU batching gdzie możliwe?
- [ ] Performance test dla critical paths?

## Referencje

- [WebGPU Best Practices](https://toji.dev/webgpu-best-practices/)
- [JavaScript Performance](https://web.dev/performance/)
- [Cache Locality](https://gameprogrammingpatterns.com/data-locality.html)

---

**Pamiętaj:** Premature optimization is the root of all evil. Profile first!

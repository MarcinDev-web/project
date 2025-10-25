# Frame Pipeline Model

## Przegląd

Ten dokument szczegółowo opisuje jak działa **pojedyncza klatka** (frame) w silniku. Pokazuje przepływ danych, systemy zaangażowane w każdym etapie i timing.

## Kluczowa Zasada: Fixed Timestep

Logika gry (fizyka, skrypty) działa z **fixed timestep** (60Hz), niezależnie od FPS renderu.

```
FPS = 30 (słaby laptop)  →  Logika dalej: 60 Hz
FPS = 120 (mocny PC)     →  Logika dalej: 60 Hz
```

**Dlaczego?**
- ✅ Determinizm (multiplayer nie rozjeżdża się)
- ✅ Replays działają poprawnie
- ✅ Fizyka stabilna

## Frame Pipeline Overview

```
┌──────────────────────────────────────────────────────────┐
│                    FRAME START                           │
│                  (requestAnimationFrame)                 │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │    1. INPUT COLLECTION             │
        │    (InputSystem)                   │
        │    • Keyboard, mouse, gamepad      │
        │    • Update InputState components  │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │    2. FIXED UPDATE LOOP            │
        │    (accumulator pattern, 60Hz)     │
        │                                    │
        │    while (accumulator >= dt):      │
        │      ┌────────────────────┐        │
        │      │ a. PhysicsSystem   │        │
        │      │ b. ScriptSystem    │        │
        │      │ c. CharacterSystem │        │
        │      └────────────────────┘        │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │    3. VARIABLE UPDATE              │
        │    (per frame, varies with FPS)    │
        │    • TransformSystem               │
        │    • AnimationSystem               │
        │    • CullingSystem                 │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │    4. RENDER                       │
        │    • Prepare frame                 │
        │    • Render Graph Execute          │
        │    • Present                       │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │    5. ASYNC JOBS                   │
        │    (background, workers)           │
        │    • Chunk meshing                 │
        │    • Asset loading                 │
        │    • AI pathfinding                │
        └────────────────────────────────────┘
```

## Szczegółowy Opis Etapów

### 1. INPUT COLLECTION

**Timing**: Start frame (przed logiką)

**Systemy**: `InputSystem`, `InputContextManager`

**Zadania**:
1. Zbierz surowe eventy (keyboard, mouse, gamepad, touch)
2. Przetłumacz na akcje (na podstawie aktywnego `InputContext`)
3. Aktualizuj `InputState` components

**Kod (pseudo)**:
```typescript
function collectInput() {
  inputManager.update();
  
  // Process current input context
  const context = contextManager.current();
  if (context) {
    for (const binding of context.bindings) {
      const value = evaluateBinding(binding, inputManager);
      if (value !== 0) {
        binding.callback(value);
      }
    }
  }
  
  // Update InputState components dla entites
  for (const entity of world.query(InputState)) {
    const inputState = world.getComponent(entity.id, InputState);
    inputState.forward = inputManager.keyboard.isKeyDown('W') ? 1 : 0;
    inputState.right = inputManager.keyboard.isKeyDown('D') ? 1 : 0;
    inputState.jump = inputManager.keyboard.isKeyPressed('Space');
    // ...
  }
}
```

**Rezultat**: `InputState` components gotowe do użycia w systemach.

---

### 2. FIXED UPDATE LOOP

**Timing**: 60 Hz (16.67 ms), niezależnie od FPS

**Systemy**: `PhysicsSystem`, `ScriptSystem`, `CharacterControllerSystem`, ...

**Pattern: Accumulator**

```typescript
const FIXED_DT = 1 / 60;  // 16.67 ms
let accumulator = 0;

function frame(deltaTime: number) {
  accumulator += deltaTime;
  
  // Fixed update (może wywołać 0, 1, 2+ razy per frame)
  while (accumulator >= FIXED_DT) {
    fixedUpdate(FIXED_DT);
    accumulator -= FIXED_DT;
  }
  
  // Variable update (1 raz per frame)
  update(deltaTime);
  
  // Render
  render();
}
```

**Dlaczego accumulator?**
- Jeśli frame trwa 33ms (30 FPS), fixed update wywoła się **2 razy** (2 × 16.67ms)
- Jeśli frame trwa 8ms (120 FPS), fixed update wywoła się **0 razy** (akumuluje)

#### 2a. PhysicsSystem.fixedUpdate()

**Zadania**:
1. Integruj prędkości (velocity → position)
2. Apply forces (grawitacja, user forces)
3. Detect collisions (broad phase + narrow phase)
4. Resolve collisions (impulses, constraints)
5. Update `RigidBody` components

**Kod (pseudo)**:
```typescript
class PhysicsSystem {
  fixedUpdate(dt: number) {
    // 1. Apply forces
    for (const entity of this.world.query(Transform, RigidBody)) {
      const rb = this.world.getComponent(entity.id, RigidBody);
      
      if (rb.useGravity && !rb.isKinematic) {
        rb.velocity.y += this.gravity * rb.gravityScale * dt;
      }
    }
    
    // 2. Integrate velocities
    for (const entity of this.world.query(Transform, RigidBody)) {
      const transform = this.world.getComponent(entity.id, Transform);
      const rb = this.world.getComponent(entity.id, RigidBody);
      
      if (!rb.isKinematic) {
        transform.position.x += rb.velocity.x * dt;
        transform.position.y += rb.velocity.y * dt;
        transform.position.z += rb.velocity.z * dt;
      }
    }
    
    // 3. Collision detection
    const collisions = this.detectCollisions();
    
    // 4. Resolve collisions
    for (const collision of collisions) {
      this.resolveCollision(collision);
    }
  }
}
```

**Rezultat**: `Transform` positions aktualne, `RigidBody` velocities poprawne.

#### 2b. ScriptSystem.fixedUpdate()

**Zadania**:
1. Tick wszystkich skryptów (LogicCubes, user scripts)
2. Execute w sandbox (ograniczone API)
3. Emit events

**Kod (pseudo)**:
```typescript
class ScriptSystem {
  fixedUpdate(dt: number) {
    for (const entity of this.world.query(Script)) {
      const script = this.world.getComponent(entity.id, Script);
      
      const context: ScriptContext = {
        entity: entity.id,
        world: this.world,
        events: this.world.events,
        deltaTime: dt,
      };
      
      try {
        this.scriptRuntime.executeScript(script, context);
      } catch (error) {
        console.error('Script error:', error);
      }
    }
  }
}
```

**Rezultat**: Skrypty usera wykonane, eventy wyemitowane.

#### 2c. CharacterControllerSystem.fixedUpdate()

**Zadania**:
1. Apply movement intent (na podstawie InputState)
2. Handle jump, crouch, sprint
3. Collision detection dla gracza

**Kod (pseudo)**:
```typescript
class CharacterControllerSystem {
  fixedUpdate(dt: number) {
    for (const entity of this.world.query(Transform, RigidBody, CharacterController, InputState)) {
      const transform = this.world.getComponent(entity.id, Transform);
      const rb = this.world.getComponent(entity.id, RigidBody);
      const controller = this.world.getComponent(entity.id, CharacterController);
      const inputState = this.world.getComponent(entity.id, InputState);
      
      // Movement
      const moveDir = new Vec3(inputState.right, 0, inputState.forward);
      Vec3.normalize(moveDir);
      
      const moveSpeed = controller.moveSpeed;
      rb.velocity.x = moveDir.x * moveSpeed;
      rb.velocity.z = moveDir.z * moveSpeed;
      
      // Jump
      if (inputState.jump && controller.isGrounded) {
        rb.velocity.y = controller.jumpForce;
        controller.isGrounded = false;
      }
      
      // Ground check (raycast down)
      const ray = { origin: transform.position, direction: Vec3.create(0, -1, 0) };
      const hit = this.physicsWorld.raycast(ray, 0.1);
      if (hit) {
        controller.isGrounded = true;
      }
    }
  }
}
```

**Rezultat**: Gracz porusza się zgodnie z inputem.

---

### 3. VARIABLE UPDATE

**Timing**: 1 raz per frame (varies z FPS: 30 Hz, 60 Hz, 120 Hz)

**Systemy**: `TransformSystem`, `AnimationSystem`, `CullingSystem`

#### 3a. TransformSystem.update()

**Zadania**:
1. Recompute global matrices (parent-child hierarchy)
2. Traverse hierarchy depth-first

**Kod (pseudo)**:
```typescript
class TransformSystem {
  update(dt: number) {
    // Start z root entities (parent = null)
    for (const entity of this.world.getRootEntities()) {
      this.updateTransformHierarchy(entity, Mat4.identity());
    }
  }
  
  private updateTransformHierarchy(entity: Entity, parentMatrix: Mat4) {
    const transform = this.world.getComponent(entity.id, Transform);
    
    // Compute local matrix
    const localMatrix = Mat4.identity();
    Mat4.translate(localMatrix, transform.position);
    Mat4.rotate(localMatrix, transform.rotation);
    Mat4.scale(localMatrix, transform.scale);
    
    // Compute world matrix
    transform.worldMatrix = Mat4.multiply(parentMatrix, localMatrix);
    
    // Recurse children
    for (const childId of transform.children) {
      const childEntity = this.world.getEntity(childId);
      if (childEntity) {
        this.updateTransformHierarchy(childEntity, transform.worldMatrix);
      }
    }
  }
}
```

**Rezultat**: `Transform.worldMatrix` aktualne dla wszystkich entities.

#### 3b. AnimationSystem.update()

**Zadania**:
1. Blend animations (state machine)
2. Sample animation clips (time → keyframe values)
3. Update skeleton transforms

**Kod (pseudo)**:
```typescript
class AnimationSystem {
  update(dt: number) {
    for (const entity of this.world.query(Transform, Animation, Skeleton)) {
      const animation = this.world.getComponent(entity.id, Animation);
      const skeleton = this.world.getComponent(entity.id, Skeleton);
      
      // Update time
      animation.time += dt;
      
      // Sample clip
      const clip = this.getClip(animation.currentClip);
      const pose = clip.sample(animation.time);
      
      // Apply to skeleton
      for (let i = 0; i < skeleton.bones.length; i++) {
        skeleton.bones[i].localTransform = pose[i];
      }
      
      // Update bone world matrices
      this.updateSkeletonHierarchy(skeleton);
    }
  }
}
```

**Rezultat**: Skeletal animations aktualne.

#### 3c. CullingSystem.update()

**Zadania**:
1. Frustum culling (które entities są w kamerze)
2. Occlusion hints (opcjonalne)
3. Build visible list

**Kod (pseudo)**:
```typescript
class CullingSystem {
  update(camera: Camera): EntityId[] {
    const frustum = this.buildFrustumFromCamera(camera);
    const visibleEntities: EntityId[] = [];
    
    for (const entity of this.world.query(Transform, Renderable)) {
      const transform = this.world.getComponent(entity.id, Transform);
      const renderable = this.world.getComponent(entity.id, Renderable);
      
      if (!renderable.visible) continue;
      
      // Get bounding box
      const bounds = this.getBoundsForEntity(entity.id);
      
      // Frustum test
      if (this.frustumIntersectsAABB(frustum, bounds)) {
        visibleEntities.push(entity.id);
      }
    }
    
    return visibleEntities;
  }
}
```

**Rezultat**: Lista visible entities gotowa dla renderera.

---

### 4. RENDER

**Timing**: 1 raz per frame

**Systemy**: `Renderer`, `RenderGraph`

#### 4a. Renderer.prepareFrame()

**Zadania**:
1. Pobierz visible entities z CullingSystem
2. Sort by material (reduce bind calls)
3. Pack instancing data (multiple meshes → 1 draw call)
4. Upload uniforms (camera, lights)

**Kod (pseudo)**:
```typescript
class Renderer {
  render(world: World, camera: Camera) {
    // 1. Get visible entities
    const visibleEntities = this.cullingSystem.update(camera);
    
    // 2. Group by material
    const batches = this.groupByMaterial(visibleEntities, world);
    
    // 3. Upload camera uniforms
    this.uploadCameraUniforms(camera);
    
    // 4. Execute render graph
    this.renderGraph.execute(batches);
  }
  
  private groupByMaterial(entities: EntityId[], world: World): RenderBatch[] {
    const batches = new Map<MaterialId, RenderBatch>();
    
    for (const entityId of entities) {
      const transform = world.getComponent(entityId, Transform);
      const renderable = world.getComponent(entityId, Renderable);
      
      if (!batches.has(renderable.materialId)) {
        batches.set(renderable.materialId, {
          materialId: renderable.materialId,
          instances: [],
        });
      }
      
      batches.get(renderable.materialId)!.instances.push({
        meshId: renderable.meshId,
        worldMatrix: transform.worldMatrix,
      });
    }
    
    return Array.from(batches.values());
  }
}
```

**Rezultat**: Render batches gotowe do narysowania.

#### 4b. Render Graph Execute

**Passy**:

```
┌─────────────────────────────────────┐
│  DepthPrepass (optional)            │
│  • Wypełnij depth buffer            │
│  • Early-Z (performance)            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  ShadowPass                         │
│  • Render depth from light POV      │
│  • Cascaded shadow maps (3-4)       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  MainLightingPass                   │
│  • Forward PBR rendering            │
│  • GGX BRDF                         │
│  • Directional + point lights       │
│  • Output: HDR (RGBA16F)            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  TransparentPass                    │
│  • Render transparent objects       │
│  • Back-to-front sorted             │
│  • Blend with opaque                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  PostProcessPass                    │
│  • Bloom (bright-pass + blur)       │
│  • Tonemap (ACES)                   │
│  • LUT (color grading)              │
│  • Gamma correction                 │
│  • Output: SDR (RGBA8)              │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  UIPass                             │
│  • Render UI elements               │
│  • Orthographic projection          │
│  • No lighting                      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Present                            │
│  • Swap buffers                     │
│  • Display to canvas                │
└─────────────────────────────────────┘
```

**MainLightingPass (pseudo)**:
```typescript
function mainLightingPass(encoder: GPUCommandEncoder, batches: RenderBatch[]) {
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: hdrTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
    }],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1.0,
    },
  });
  
  // Render batches
  for (const batch of batches) {
    const material = resourceCache.getMaterial(batch.materialId);
    
    pass.setPipeline(material.pipeline);
    pass.setBindGroup(0, material.bindGroup);  // Material
    pass.setBindGroup(1, sceneBindGroup);      // Camera, lights
    
    for (const instance of batch.instances) {
      const mesh = resourceCache.getMesh(instance.meshId);
      
      // Upload instance uniforms (world matrix)
      pass.setBindGroup(2, createInstanceBindGroup(instance.worldMatrix));
      
      // Draw
      pass.setVertexBuffer(0, mesh.vertexBuffer);
      pass.setIndexBuffer(mesh.indexBuffer, 'uint32');
      pass.drawIndexed(mesh.indexCount);
    }
  }
  
  pass.end();
}
```

**Rezultat**: Frame narysowany.

#### 4c. Present

```typescript
function present() {
  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
  
  // requestAnimationFrame automatically presents
}
```

---

### 5. ASYNC JOBS (Background)

**Timing**: Concurrent z main loop (workers)

**Systemy**: `JobSystem`, `ChunkMesher`, `AssetLoader`, `AIPathfinder`

**Przykład: Chunk Meshing**

```typescript
// Main thread
jobSystem.schedule({
  execute: async () => {
    const worker = new Worker('chunk-mesher.worker.js');
    
    worker.postMessage({
      chunkData: chunk.blocks,
      position: chunk.position,
    });
    
    const meshData = await new Promise(resolve => {
      worker.onmessage = (e) => resolve(e.data);
    });
    
    // Upload mesh to GPU (main thread)
    const meshId = resourceCache.uploadMesh(meshData);
    chunk.meshId = meshId;
  },
  priority: TaskPriority.Background,
});

// Worker (chunk-mesher.worker.js)
self.onmessage = (e) => {
  const { chunkData, position } = e.data;
  
  // Heavy meshing work
  const meshData = greedyMeshing(chunkData);
  
  self.postMessage(meshData);
};
```

**Rezultat**: Main thread nie blokuje się podczas ciężkich obliczeń.

---

## Timing Diagram

**60 FPS (16.67ms budget)**:

```
Frame 1 (16ms):
├─ Input      [0-1ms]
├─ Fixed      [1-9ms]  (1 iteration × 8ms)
│  ├─ Physics [3ms]
│  ├─ Scripts [3ms]
│  └─ Char    [2ms]
├─ Variable   [9-12ms]
│  ├─ Transform [1ms]
│  ├─ Anim      [1ms]
│  └─ Culling   [1ms]
└─ Render     [12-16ms]
   ├─ Shadow  [2ms]
   ├─ Main    [8ms]
   └─ Post    [2ms]

Total: 16ms ✅
```

**30 FPS (33ms budget)**:

```
Frame 1 (33ms):
├─ Input      [0-1ms]
├─ Fixed      [1-17ms]  (2 iterations × 8ms)
│  ├─ Physics [3ms × 2]
│  ├─ Scripts [3ms × 2]
│  └─ Char    [2ms × 2]
├─ Variable   [17-20ms]
└─ Render     [20-33ms]

Total: 33ms ✅
Logika: 60 Hz (2 iteracje) ✅
```

**120 FPS (8ms budget)**:

```
Frame 1 (8ms):
├─ Input      [0-1ms]
├─ Fixed      [skipped] (accumulator < 16.67ms)
├─ Variable   [1-4ms]
└─ Render     [4-8ms]

Total: 8ms ✅

Frame 2 (8ms):
├─ Input      [0-1ms]
├─ Fixed      [1-9ms]  (accumulator >= 16.67ms, 1 iteration)
├─ Variable   [overflow to next frame]
...

Średnio: Logika 60 Hz ✅, Render 120 Hz ✅
```

---

## Kluczowe Zasady

### 1. Renderer Nie Modyfikuje Stanu Gry

```typescript
// ✅ DOBRZE (renderer tylko czyta)
class Renderer {
  render(world: World, camera: Camera) {
    const transform = world.getComponent(entityId, Transform);
    renderMesh(transform.worldMatrix);  // Tylko czyta
  }
}

// ❌ ŹLE (renderer modyfikuje)
class Renderer {
  render(world: World, camera: Camera) {
    const transform = world.getComponent(entityId, Transform);
    transform.position.x += 1;  // ❌ NIGDY!
  }
}
```

### 2. Świat Jeden, Widoków Wiele

```typescript
// Jeden world, wiele kamer
const world = new World();

const mainCamera = new FPSCamera(...);
const minimapCamera = new OrbitCamera(...);

// Render oba viewy
renderer.render(world, mainCamera);     // Full screen
renderer.render(world, minimapCamera);  // Minimap viewport

// Świat symuluje się tylko 1 raz!
```

### 3. Fixed Timestep = Determinizm

```typescript
// Replay: zapisz tylko inputy + seed
const replay = {
  seed: 12345,
  inputs: [
    { frame: 0, key: 'W', down: true },
    { frame: 60, key: 'Space', down: true },
    // ...
  ],
};

// Odtwórz: deterministyczna symulacja
function playReplay(replay: Replay) {
  const world = new World();
  world.seed = replay.seed;
  
  for (let frame = 0; frame < 3600; frame++) {
    applyInputs(replay.inputs[frame]);
    world.fixedUpdate(1 / 60);  // Zawsze 60 Hz
  }
  
  // Wynik identyczny co oryginał ✅
}
```

---

## Optymalizacje

### 1. Early-Z (DepthPrepass)

Render depth first, potem color:
- GPU odrzuca pixele za wcześnie (depth fail)
- Oszczędność fragment shader invocations

### 2. Instancing

100 meshów tego samego typu → 1 draw call:
```typescript
pass.drawIndexedInstanced(mesh.indexCount, 100);
```

### 3. Frustum Culling

Nie renderuj co nie widać:
- 1000 entities w scenie
- 200 visible (frustum)
- Renderuj tylko 200 ✅

### 4. LOD (Level of Detail)

Dalekie obiekty = prostsze meshe:
- < 10m: high poly (10k verts)
- 10-50m: medium poly (2k verts)
- > 50m: low poly (500 verts)

---

## Następne Kroki

1. ✅ [CURRENT_STRUCTURE.md](./CURRENT_STRUCTURE.md)
2. ✅ [ARCHITECTURE.md](./ARCHITECTURE.md)
3. ✅ [TARGET_STRUCTURE.md](./TARGET_STRUCTURE.md)
4. ✅ [MODULE_SPECIFICATIONS.md](./MODULE_SPECIFICATIONS.md)
5. ✅ [FRAME_MODEL.md](./FRAME_MODEL.md) (TEN DOKUMENT)
6. ⏭️ [PERFORMANCE_PHILOSOPHY.md](./PERFORMANCE_PHILOSOPHY.md)
7. ⏭️ [MIGRATION_PLAN.md](./MIGRATION_PLAN.md)
8. ⏭️ [adr/001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md)


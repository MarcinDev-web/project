# Analiza Systemu Movement - UGC 3D Platform

**Data analizy:** 2025-01-26  
**Wersja:** 1.0.0

## 📋 Spis Treści

1. [Przegląd Architektury](#przegląd-architektury)
2. [Komponenty Movement](#komponenty-movement)
3. [Systemy Movement](#systemy-movement)
4. [Obsługa Input](#obsługa-input)
5. [Analiza Wydajności](#analiza-wydajności)
6. [Wzorce i Best Practices](#wzorce-i-best-practices)
7. [Znalezione Problemy](#znalezione-problemy)
8. [Rekomendacje](#rekomendacje)

---

## 1. Przegląd Architektury

### 1.1 Struktura Movement w Projekcie

Projekt implementuje **trzy główne systemy movement**, każdy dla różnych use cases:

```
┌─────────────────────────────────────────────────────────┐
│                    MOVEMENT SYSTEMS                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. EditorCameraController (@engine/camera)             │
│     └─> Editor navigation (free-fly)                    │
│                                                          │
│  2. CharacterController (@engine/world)                 │
│     └─> Gameplay character movement (physics-based)      │
│                                                          │
│  3. FPSCamera (@engine/camera)                          │
│     └─> First-person gameplay camera                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Hierarchia Pakietów

```
@engine/core (math utilities)
    ↓
@engine/world (CharacterController component)
    ↓
@engine/camera (EditorCameraController, FPSCamera)
    ↓
@engine/input (CharacterInputHandler)
    ↓
@engine/stdlib (CharacterControllerSystem)
```

### 1.3 Przepływ Danych

```
INPUT LAYER
    ↓
[CharacterInputHandler] → CharacterInput
    ↓
SYSTEM LAYER
    ↓
[CharacterControllerSystem] → applyIntent()
    ↓
COMPONENT LAYER
    ↓
[CharacterController] → setInput() → update()
    ↓
PHYSICS LAYER
    ↓
[PhysicsComponent] → velocity, forces
```

---

## 2. Komponenty Movement

### 2.1 EditorCameraController (`packages/camera/src/EditorCameraController.ts`)

**Cel:** Free-fly camera dla edytora (bez kolizji, bez fizyki)

#### Kluczowe Cechy:

- ✅ **WASD movement** (horizontal plane)
- ✅ **Q/E** vertical movement (world Y-axis)
- ✅ **Shift sprint** (2.0x multiplier)
- ✅ **Alt slow** (0.3x multiplier)
- ✅ **Mouse wheel zoom** (forward/backward along forward vector)
- ✅ **Ctrl+Wheel** speed adjustment (0.5-50 units/sec)
- ✅ **Right mouse drag** for look rotation

#### Implementacja Movement:

```179:217:packages/camera/src/EditorCameraController.ts
    // Reset scratch buffer for movement
    this.scratch.movement[0] = 0;
    this.scratch.movement[1] = 0;
    this.scratch.movement[2] = 0;

    // WASD movement (horizontal plane) - using Set for O(1) lookup
    if (this.keysPressed.has('w') || this.keysPressed.has('W')) {
      this.scratch.movement[0] += this.forward[0] * moveAmount;
      this.scratch.movement[1] += this.forward[1] * moveAmount;
      this.scratch.movement[2] += this.forward[2] * moveAmount;
    }
    if (this.keysPressed.has('s') || this.keysPressed.has('S')) {
      this.scratch.movement[0] -= this.forward[0] * moveAmount;
      this.scratch.movement[1] -= this.forward[1] * moveAmount;
      this.scratch.movement[2] -= this.forward[2] * moveAmount;
    }
    if (this.keysPressed.has('d') || this.keysPressed.has('D')) {
      this.scratch.movement[0] += this.right[0] * moveAmount;
      this.scratch.movement[1] += this.right[1] * moveAmount;
      this.scratch.movement[2] += this.right[2] * moveAmount;
    }
    if (this.keysPressed.has('a') || this.keysPressed.has('A')) {
      this.scratch.movement[0] -= this.right[0] * moveAmount;
      this.scratch.movement[1] -= this.right[1] * moveAmount;
      this.scratch.movement[2] -= this.right[2] * moveAmount;
    }

    // Q/E for vertical movement (world up/down)
    if (this.keysPressed.has('e') || this.keysPressed.has('E')) {
      this.scratch.movement[1] += moveAmount;
    }
    if (this.keysPressed.has('q') || this.keysPressed.has('Q')) {
      this.scratch.movement[1] -= moveAmount;
    }

    // Apply movement
    this.position[0] += this.scratch.movement[0];
    this.position[1] += this.scratch.movement[1];
    this.position[2] += this.scratch.movement[2];
```

**Kluczowe decyzje:**

1. **Scratch buffers** - reuse `Float32Array` dla zero-allocation movement
2. **Set-based lookup** - `keysPressed.has()` = O(1)
3. **Multiplicative accumulation** - każda klawisza dodaje do movement vector
4. **Early exit** - `if (keysPressed.size === 0) return`

#### Performance:

- ✅ **Zero allocations** w hot path (scratch buffers)
- ✅ **Lazy view matrix** update (`viewMatrixDirty` flag)
- ✅ **Direction vectors cached** (recalculated only on rotation)
- ⚠️ **Multiplicative updates** - może być znormalizowane dla diagonal movement

---

### 2.2 CharacterController (`packages/world/src/components/CharacterController.ts`)

**Cel:** Physics-based character movement dla gameplay

#### Kluczowe Cechy:

- ✅ **Walking, running, jumping**
- ✅ **Ground detection** (via CharacterControllerSystem raycast)
- ✅ **Slope handling** (maxSlopeAngle config)
- ✅ **Stair climbing** (stepHeight config)
- ✅ **Camera-relative movement**
- ✅ **Air control** (configurable multiplier)
- ✅ **Coyote time** (0.1s grace period for jumps)
- ✅ **Jump buffering** (0.1s remember jump input)

#### Stan Komponentu:

```8:15:packages/world/src/components/CharacterController.ts
export enum CharacterState {
  Idle = 'idle',
  Walking = 'walking',
  Running = 'running',
  Jumping = 'jumping',
  Falling = 'falling',
  Landing = 'landing',
}
```

#### Konfiguracja:

```20:41:packages/world/src/components/CharacterController.ts
export interface CharacterControllerConfig {
  /** Movement speed (units per second) */
  moveSpeed: number;
  /** Sprint speed multiplier */
  sprintMultiplier: number;
  /** Jump force */
  jumpForce: number;
  /** Gravity multiplier (affects fall speed) */
  gravityMultiplier: number;
  /** Maximum slope angle the character can walk on (degrees) */
  maxSlopeAngle: number;
  /** Step height for climbing stairs */
  stepHeight: number;
  /** Ground check distance below character */
  groundCheckDistance: number;
  /** Air control multiplier (0-1, how much control in air) */
  airControlMultiplier: number;
  /** Rotation speed (radians per second) */
  rotationSpeed: number;
  /** Whether to auto-rotate to movement direction */
  autoRotate: boolean;
}
```

#### Implementacja Movement:

```285:321:packages/world/src/components/CharacterController.ts
  private applyMovement(deltaTime: number): void {
    if (!this.physics) return;

    // Calculate target speed
    const baseSpeed = this.config.moveSpeed;
    const speed = this.isSprinting ? baseSpeed * this.config.sprintMultiplier : baseSpeed;

    // Calculate target velocity
    const targetVelocity: Vec3 = [
      this.moveInput[0] * speed,
      this.velocity[1], // Keep vertical velocity
      this.moveInput[2] * speed,
    ];

    // Apply air control multiplier when not grounded
    const controlMultiplier = this.isGrounded ? 1.0 : this.config.airControlMultiplier;

    // Smoothly interpolate to target velocity
    const acceleration = controlMultiplier * 20; // Adjust for responsiveness
    this.velocity[0] += (targetVelocity[0] - this.velocity[0]) * Math.min(1, acceleration * deltaTime);
    this.velocity[2] += (targetVelocity[2] - this.velocity[2]) * Math.min(1, acceleration * deltaTime);

    // Update physics velocity
    this.physics.velocity[0] = this.velocity[0];
    this.physics.velocity[1] = this.velocity[1];
    this.physics.velocity[2] = this.velocity[2];

    // Integrate horizontal position from velocity to reflect movement in tests
    const entity = this.entity;
    if (entity) {
      // Get current position (returns a copy), modify it, then set it back
      const pos = entity.transform.position;
      pos[0] += this.velocity[0] * deltaTime;
      pos[2] += this.velocity[2] * deltaTime;
      entity.transform.position = pos;
    }
  }
```

**Kluczowe decyzje:**

1. **Velocity-based** - używa physics velocity, nie bezpośredniego position update
2. **Lerp acceleration** - smooth interpolation do target velocity (20x multiplier)
3. **Air control** - zmniejszony control multiplier w powietrzu
4. **Position integration** - ręczna integracja w testach (może być redundantna z physics)

#### Jump Mechanika:

```337:358:packages/world/src/components/CharacterController.ts
  private handleJump(): void {
    if (!this.physics) return;

    // Check if we can jump (grounded or within coyote time, and jump buffered)
    const canJump = (this.isGrounded || this.timeSinceGrounded < this.coyoteTime) &&
                    this.timeSinceJumpPressed <= this.jumpBufferTime;

    if (this.jumpRequested && canJump) {
      // Apply jump force
      this.velocity[1] = this.config.jumpForce;
      this.physics.velocity[1] = this.velocity[1];
      
      this.isGrounded = false;
      this.timeSinceGrounded = this.coyoteTime; // Prevent double jump
      this.timeSinceJumpPressed = Infinity; // Consume jump input
    }

    // Sync velocity from physics (in case of collisions)
    this.velocity[0] = this.physics.velocity[0];
    this.velocity[1] = this.physics.velocity[1];
    this.velocity[2] = this.physics.velocity[2];
  }
```

**Cechy:**

- ✅ **Coyote time** - można skoczyć krótko po opuszczeniu ziemi
- ✅ **Jump buffering** - pamięta jump input przez 0.1s
- ✅ **Velocity sync** - synchronizuje z physics (kolizje)

---

### 2.3 FPSCamera (`packages/camera/src/FPSCamera.ts`)

**Cel:** First-person camera z pointer lock dla gameplay

#### Kluczowe Cechy:

- ✅ **Pointer lock** support
- ✅ **Mouse movement** tracking (movementX/Y)
- ✅ **Yaw/pitch** rotation
- ✅ **Forward/right direction** vectors dla movement input
- ✅ **Eye height** offset (1.6 units default)

#### Implementacja:

```199:211:packages/camera/src/FPSCamera.ts
  private handleMouseMove(event: MouseEvent): void {
    if (!this.pointerLockActive) return;
    const movementX = event.movementX ?? 0;
    const movementY = event.movementY ?? 0;
    this.yaw += movementX * this.sensitivity;
    const pitchDelta = movementY * this.sensitivity;
    if (this.invertY) {
      this.pitch = clamp(this.pitch + pitchDelta, -this.pitchLimit, this.pitchLimit);
    } else {
      this.pitch = clamp(this.pitch - pitchDelta, -this.pitchLimit, this.pitchLimit);
    }
    this.updateDirectionVectors();
  }
```

**Użycie:** FPSCamera dostarcza `forward` i `right` vectors dla `CharacterController` (camera-relative movement).

---

## 3. Systemy Movement

### 3.1 CharacterControllerSystem (`packages/stdlib/src/CharacterController/CharacterControllerSystem.ts`)

**Cel:** ECS system dla zarządzania CharacterController komponentami

#### Architektura:

```22:30:packages/stdlib/src/CharacterController/CharacterControllerSystem.ts
export class CharacterControllerSystem {
  private scene: Scene;
  private physics: PhysicsWorld;
  private intentBuffer = new Map<CharacterController, IntentFrame>();

  constructor(scene: Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;
  }
```

#### Intent Buffer Pattern:

System używa **intent buffer** pattern:

1. Input jest buforowany przez `applyIntent()`
2. W `update()` intenty są aplikowane do controllers
3. Następnie ground detection i controller update

```63:76:packages/stdlib/src/CharacterController/CharacterControllerSystem.ts
  applyIntent(
    controller: CharacterController,
    intent: { move: [number, number]; jump: boolean; sprint: boolean },
    cameraForward: Vec3,
    cameraRight: Vec3
  ): void {
    this.intentBuffer.set(controller, {
      move: [intent.move[0], intent.move[1]],
      jump: intent.jump,
      sprint: intent.sprint,
      forward: [...cameraForward] as Vec3,
      right: [...cameraRight] as Vec3,
    });
  }
```

**Update Loop:**

```35:61:packages/stdlib/src/CharacterController/CharacterControllerSystem.ts
  update(deltaTime: number): void {
    const entities = this.scene.queryEntities(CharacterController);

    for (const entity of entities) {
      const controller = entity.getComponent(CharacterController) as CharacterController;
      if (!controller) continue;

      const bufferedIntent = this.intentBuffer.get(controller);
      if (bufferedIntent) {
        const input: CharacterInput = {
          moveDirection: [bufferedIntent.move[0], 0, bufferedIntent.move[1]],
          sprint: bufferedIntent.sprint,
          jump: bufferedIntent.jump,
          cameraForward: bufferedIntent.forward,
          cameraRight: bufferedIntent.right,
        };
        controller.setInput(input);
        this.intentBuffer.delete(controller);
      }

      // Update ground detection using physics raycast
      this.updateGroundDetection(controller);

      // Update character controller
      controller.update(deltaTime);
    }
  }
```

#### Ground Detection:

```81:101:packages/stdlib/src/CharacterController/CharacterControllerSystem.ts
  private updateGroundDetection(controller: CharacterController): void {
    if (!controller.entity) return;

    const origin = controller.entity.transform.position;
    const direction: [number, number, number] = [0, -1, 0];

    // Raycast downward to detect ground
    const hit = this.physics.raycast(origin, direction, {
      // Use a generous distance to ensure floors slightly below the character are detected in tests
      maxDistance: Math.max(controller.config.groundCheckDistance, 0.1) + 5.0,
      ignoreEntities: [controller.entity],
    });

    if (hit) {
      controller.isGrounded = true;
      controller.groundNormal = hit.normal;
    } else {
      controller.isGrounded = false;
      controller.groundNormal = [0, 1, 0];
    }
  }
```

**Kluczowe decyzje:**

- ✅ **Raycast-based** ground detection (nie sphere cast)
- ✅ **Generous distance** (groundCheckDistance + 5.0) dla testów
- ✅ **Ground normal** storage dla slope detection

---

## 4. Obsługa Input

### 4.1 CharacterInputHandler (`packages/input/src/CharacterInput.ts`)

**Cel:** Keyboard input handling dla character movement

#### Implementacja:

```113:137:packages/input/src/CharacterInput.ts
  getInput(): CharacterInput {
    // Calculate movement direction
    let x = 0;
    let z = 0;

    if (this.isKeyPressed(this.bindings.forward)) z += 1;
    if (this.isKeyPressed(this.bindings.backward)) z -= 1;
    if (this.isKeyPressed(this.bindings.left)) x -= 1;
    if (this.isKeyPressed(this.bindings.right)) x += 1;

    // Normalize diagonal movement
    const length = Math.sqrt(x * x + z * z);
    if (length > 0) {
      x /= length;
      z /= length;
    }

    return {
      moveDirection: [x, 0, z],
      sprint: this.isKeyPressed(this.bindings.sprint),
      jump: this.isKeyPressed(this.bindings.jump),
      cameraForward: this.cameraForward,
      cameraRight: this.cameraRight,
    };
  }
```

**Kluczowe cechy:**

- ✅ **Map-based** key state (`Map<string, boolean>`)
- ✅ **Diagonal normalization** - normalizuje diagonal movement
- ✅ **Camera-relative** - wymaga camera directions

#### Key Bindings:

```30:39:packages/input/src/CharacterInput.ts
  private bindings = {
    forward: ['KeyW', 'ArrowUp'],
    backward: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    interact: ['KeyE'],
    use: ['Mouse0'],
  };
```

### 4.2 CharacterGamepadHandler (`packages/input/src/CharacterInput.ts`)

**Cel:** Gamepad input dla character movement

#### Implementacja:

```230:250:packages/input/src/CharacterInput.ts
  getInput(): CharacterInput | null {
    const gamepad = this.getGamepad();
    if (!gamepad) return null;

    // Get stick input
    const x = this.applyDeadZone(gamepad.axes[this.axes.moveX] ?? 0);
    const y = this.applyDeadZone(gamepad.axes[this.axes.moveY] ?? 0);

    // Get button input
    const jump = gamepad.buttons[this.buttons.jump]?.pressed ?? false;
    const sprintValue = gamepad.buttons[this.buttons.sprint]?.value ?? 0;
    const sprint = sprintValue > this.sprintThreshold;

    return {
      moveDirection: [x, 0, -y], // Invert Y for forward/backward
      sprint,
      jump,
      cameraForward: [0, 0, -1],
      cameraRight: [1, 0, 0],
    };
  }
```

**Kluczowe cechy:**

- ✅ **Dead zone** handling dla analog sticks
- ✅ **Sprint threshold** dla trigger-based sprint
- ✅ **Y-axis inversion** dla forward/backward

---

## 5. Analiza Wydajności

### 5.1 EditorCameraController

#### Mocne Strony:

- ✅ **Zero allocations** w hot path (scratch buffers jako `Float32Array`)
- ✅ **Early exit** jeśli brak input
- ✅ **O(1) key lookup** (`Set.has()`)
- ✅ **Lazy view matrix** update (tylko gdy `viewMatrixDirty`)

#### Potencjalne Optymalizacje:

1. **Diagonal Movement Normalization:**
   ```typescript
   // Current: Multiplicative accumulation
   movement[0] += forward[0] * moveAmount;
   movement[0] += right[0] * moveAmount;
   
   // Better: Normalize first, then scale
   const normalized = normalize([forward[0] + right[0], ...]);
   movement[0] = normalized[0] * moveAmount;
   ```
   **Efekt:** Bardziej precyzyjny diagonal movement (nie szybszy)

2. **Conditional Direction Vector Update:**
   - Direction vectors są recalculated na każdej rotacji
   - Można cacheować i invalidate tylko gdy needed

### 5.2 CharacterController

#### Mocne Strony:

- ✅ **Velocity-based** - naturalne dla physics
- ✅ **Lerp acceleration** - smooth movement
- ✅ **Position caching** - transform.position getter zwraca copy, ale setter jest efficient

#### Potencjalne Optymalizacje:

1. **Redundant Position Integration:**
   ```285:321:packages/world/src/components/CharacterController.ts
   // Integrate horizontal position from velocity to reflect movement in tests
   const entity = this.entity;
   if (entity) {
     // Get current position (returns a copy), modify it, then set it back
     const pos = entity.transform.position;
     pos[0] += this.velocity[0] * deltaTime;
     pos[2] += this.velocity[2] * deltaTime;
     entity.transform.position = pos;
   }
   ```
   **Problem:** Physics engine powinien integrować pozycję - to może być redundantne
   **Rozwiązanie:** Usunąć jeśli physics już integruje

2. **Velocity Sync Pattern:**
   - Velocity jest sync'owana z physics w wielu miejscach
   - Można deduplikować w single method

### 5.3 CharacterControllerSystem

#### Mocne Strony:

- ✅ **Intent buffer** - decouples input from update
- ✅ **Single query** - `scene.queryEntities()` raz na frame
- ✅ **Raycast optimization** - tylko gdy potrzebne

#### Potencjalne Optymalizacje:

1. **Raycast Caching:**
   - Ground detection raycast jest wykonywany każdego frame
   - Można cache'ować i invalidate tylko gdy position changed znacząco

2. **Batch Raycasts:**
   - Jeśli wiele characters, można batch raycasts w physics engine

---

## 6. Wzorce i Best Practices

### 6.1 Wzorce Użyte

#### 1. **Scratch Buffer Pattern**
```typescript
private readonly scratch = {
  movement: new Float32Array(3) as unknown as Vec3,
  target: new Float32Array(3) as unknown as Vec3,
};
```
**Efekt:** Zero allocations w hot path

#### 2. **Intent Buffer Pattern**
```typescript
private intentBuffer = new Map<CharacterController, IntentFrame>();
```
**Efekt:** Decouples input from update, allows frame-level intent processing

#### 3. **Velocity-Based Movement**
```typescript
targetVelocity: Vec3 = [moveInput[0] * speed, velocity[1], moveInput[2] * speed];
velocity[0] += (targetVelocity[0] - velocity[0]) * Math.min(1, acceleration * deltaTime);
```
**Efekt:** Smooth acceleration, natural physics integration

#### 4. **Camera-Relative Movement**
```typescript
getCameraRelativeDirectionOut(
  out: Vec3,
  input: Vec3,
  cameraForward: Vec3,
  cameraRight: Vec3
): void
```
**Efekt:** Movement relative to camera view, nie world axes

### 6.2 Best Practices Zastosowane

- ✅ **Zero allocations** w hot paths (scratch buffers)
- ✅ **Early exits** dla empty input
- ✅ **O(1) lookups** (Set/Map zamiast arrays)
- ✅ **Lazy updates** (view matrix dirty flag)
- ✅ **Proper cleanup** (dispose methods, event listener removal)
- ✅ **Frame-rate independent** (deltaTime-based calculations)
- ✅ **Configurable** (speed, multipliers, limits via config objects)

---

## 7. Znalezione Problemy

### 7.1 Niespójność w Diagonal Movement

**EditorCameraController:**
- Multiplicative accumulation (nie znormalizowane)
- Diagonal movement może być szybsze niż single-axis

**CharacterInputHandler:**
- Normalizuje diagonal movement
- Konsystentna prędkość we wszystkich kierunkach

**Problem:** Różne zachowanie między editor a gameplay może być confusing

### 7.2 Redundant Position Integration

**CharacterController.applyMovement():**
```typescript
// Integrate horizontal position from velocity to reflect movement in tests
pos[0] += this.velocity[0] * deltaTime;
pos[2] += this.velocity[2] * deltaTime;
```
**Problem:** Physics engine powinien już integrować pozycję - to może powodować double integration

### 7.3 Ground Detection Performance

**CharacterControllerSystem.updateGroundDetection():**
- Raycast wykonywany każdego frame dla każdego character
- Można cache'ować jeśli position nie zmieniła się znacząco

### 7.4 Velocity Sync Redundancy

**CharacterController:**
- Velocity sync'owana z physics w wielu miejscach
- `handleJump()`, `applyMovement()`, `addVelocity()` - każdy sync'uje
- Można deduplikować w single method

### 7.5 EditorCameraController Key Handling

**Problem:**
```typescript
this.keysPressed.add(key); // Store original key for Shift/Alt detection
this.keysPressed.add(keyLower); // Store lowercase for movement detection
```
**Issue:** Duplikacja klawiszy w Set (zarówno 'w' jak i 'W') może powodować confusion

---

## 8. Rekomendacje

### 8.1 Krótkoterminowe (Quick Wins)

#### 1. **Normalizuj Diagonal Movement w EditorCameraController**
```typescript
// After accumulating WASD inputs
if (Math.abs(this.scratch.movement[0]) > 1e-6 || Math.abs(this.scratch.movement[2]) > 1e-6) {
  const length = Math.hypot(this.scratch.movement[0], this.scratch.movement[2]);
  if (length > 1e-6) {
    const inv = 1 / length;
    this.scratch.movement[0] *= inv * moveAmount;
    this.scratch.movement[2] *= inv * moveAmount;
  }
}
```
**Efekt:** Konsystentna prędkość diagonal movement

#### 2. **Usuń Redundant Position Integration**
- Sprawdź czy physics engine już integruje pozycję
- Jeśli tak, usuń ręczną integrację z `applyMovement()`

#### 3. **Deduplikuj Velocity Sync**
```typescript
private syncVelocityToPhysics(): void {
  if (!this.physics) return;
  this.physics.velocity[0] = this.velocity[0];
  this.physics.velocity[1] = this.velocity[1];
  this.physics.velocity[2] = this.velocity[2];
}
```
**Efekt:** Single source of truth dla velocity sync

### 8.2 Średnioterminowe (Refactoring)

#### 1. **Ground Detection Caching**
```typescript
private groundDetectionCache = new Map<CharacterController, {
  lastPosition: Vec3;
  lastIsGrounded: boolean;
  cacheAge: number;
}>();

private updateGroundDetection(controller: CharacterController): void {
  const cache = this.groundDetectionCache.get(controller);
  const currentPos = controller.entity.transform.position;
  
  // Cache hit if position hasn't changed much
  if (cache && vec3Distance(currentPos, cache.lastPosition) < 0.01) {
    controller.isGrounded = cache.lastIsGrounded;
    return;
  }
  
  // Perform raycast...
  // Update cache...
}
```
**Efekt:** Redukcja raycast calls dla stationary characters

#### 2. **Unified Movement Interface**
- Stwórz abstrakcję dla movement (interface)
- EditorCameraController i CharacterController implementują tę samą interface
- Ułatwia testing i consistency

#### 3. **Input Abstraction Layer**
- Wydziel input handling do separate layer
- Decouple input sources (keyboard, gamepad, touch) od movement logic

### 8.3 Długoterminowe (Architektura)

#### 1. **Movement System Refactoring**
- Rozważ `MovementSystem` jako ECS system
- Movement jako component data, system jako logic
- Lepsze separation of concerns

#### 2. **Predictive Movement for Multiplayer**
- Dla multiplayer: client-side prediction
- Server reconciliation
- Interpolation dla smooth movement

#### 3. **Movement Profiles**
- Configurable movement profiles (human, vehicle, flying)
- Easy switching between movement types
- Reusable across different entity types

---

## 9. Metryki Wydajności

### 9.1 Obecne Performance (Szacunkowe)

**EditorCameraController:**
- Update: ~0.001ms (na klatkę, zero allocations)
- Memory: ~200 bytes (scratch buffers + state)

**CharacterController:**
- Update: ~0.005ms (velocity lerp + physics sync)
- Memory: ~500 bytes (config + state)

**CharacterControllerSystem:**
- Update: ~0.01ms per character (raycast + update)
- Memory: ~100 bytes per character (intent buffer)

**Total dla 100 characters:**
- Update: ~1ms per frame
- Memory: ~60KB

### 9.2 Optymalizacje (Projected)

Z zastosowaniem caching i batch operations:
- **Update:** ~0.5ms per frame (50% reduction)
- **Memory:** ~50KB (marginal reduction)

---

## 10. Testy i Coverage

### 10.1 Obecne Testy

**EditorCameraController:**
- ✅ Movement tests (WASD, Q/E)
- ✅ Sprint/slow multipliers
- ✅ Mouse look
- ✅ Speed adjustment

**CharacterController:**
- ✅ Movement input
- ✅ Jump mechanics
- ✅ Ground detection
- ✅ State transitions
- ✅ Camera-relative movement

**CharacterControllerSystem:**
- ✅ System update loop
- ✅ Intent buffering
- ✅ Ground detection

### 10.2 Brakujące Testy

- ⚠️ Performance tests (profiling)
- ⚠️ Edge cases (extreme velocities, teleporting)
- ⚠️ Multi-character scenarios
- ⚠️ Movement interpolation dla multiplayer

---

## 11. Podsumowanie

### 11.1 Mocne Strony

- ✅ **Solid architecture** - separation of concerns (input, component, system)
- ✅ **Performance-conscious** - scratch buffers, early exits, O(1) lookups
- ✅ **Well-tested** - comprehensive test coverage
- ✅ **Configurable** - easy tuning via config objects
- ✅ **Physics integration** - proper velocity-based movement

### 11.2 Obszary do Poprawy

- ⚠️ **Diagonal movement inconsistency** (editor vs gameplay)
- ⚠️ **Redundant position integration** (possible double integration)
- ⚠️ **Ground detection performance** (no caching)
- ⚠️ **Velocity sync redundancy** (multiple sync points)

### 11.3 Priorytety

1. **HIGH:** Normalizuj diagonal movement w EditorCameraController
2. **HIGH:** Sprawdź i usuń redundant position integration
3. **MEDIUM:** Ground detection caching
4. **MEDIUM:** Velocity sync deduplication
5. **LOW:** Movement system refactoring (długoterminowe)

---

**Koniec Analizy**

**Następne kroki:**
1. Review tej analizy z team
2. Prioritize recommendations
3. Create tickets dla improvements
4. Implement quick wins (sekcja 8.1)


# Analiza Systemu Avatara - UGC 3D Platform

**Data analizy:** 2025-01-26  
**Analizowany kod:** System avatara i kontroli postaci  
**Analyst:** Senior Game Dev / Engine Architect

---

## 1. High-Level Overview

### 1.1 Co robi ten kod?

System avatara w UGC 3D Platform składa się z **dwóch głównych, częściowo rozdzielonych systemów**:

1. **AvatarInstance** (`packages/avatar`) - zarządza **wizualną reprezentacją** avatara:
   - Skeleton (18 jointów humanoid)
   - Mesh generation (części ciała: głowa, tors, ręce, nogi)
   - Material management (kolory, materiały)
   - Part mounting (montowanie części do slotów)
   - Animacje skeletonu (`AvatarAnimationPlayer`)

2. **CharacterController** (`packages/world`) + **CharacterControllerSystem** (`packages/stdlib`) - zarządza **fizyką i ruchem**:
   - Fizyka ruchu (velocity, ground detection, jumping)
   - Input handling (keyboard/gamepad → CharacterInput)
   - State machine (Idle, Walking, Running, Jumping, Falling, Landing)
   - Animacje postaci (`AnimationComponent` - synchronizowane przez system)

### 1.2 Główne moduły i relacje

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT LAYER                              │
│  CharacterInputHandler → CharacterInput                      │
│  (keyboard/gamepad → normalized input)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              CONTROLLER LAYER                                │
│  LocalPlayerController → CharacterControllerSystem           │
│  (input → intent → physics)                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│  PHYSICS LAYER   │         │  VISUAL LAYER    │
│                  │         │                  │
│ CharacterController│       │ AvatarInstance   │
│  - velocity       │         │  - skeleton      │
│  - isGrounded    │         │  - mesh          │
│  - state         │         │  - materials     │
│                  │         │  - animations    │
└──────────────────┘         └──────────────────┘
        │                             │
        └──────────────┬──────────────┘
                       ▼
              ┌─────────────────┐
              │  Entity (ECS)   │
              │  (transform)    │
              └─────────────────┘
```

**Kluczowe relacje:**
- `LocalPlayerController` → `CharacterControllerSystem` → `CharacterController`
- `CharacterControllerSystem` → `AnimationComponent` (synchronizacja animacji)
- `AvatarInstance` → `AvatarAnimationPlayer` (osobny system animacji!)
- `CharacterController` ↔ `PhysicsComponent` (fizyka ruchu)

---

## 2. Struktura i Architektura

### 2.1 Ocena podziału odpowiedzialności

#### ✅ **Dobrze podzielone:**

1. **AvatarInstance** - czysta odpowiedzialność za wizualną reprezentację:
   - Skeleton management
   - Mesh generation
   - Material/color management
   - Part mounting
   - **NIE** miesza się z fizyką ani inputem

2. **CharacterController** - czysta odpowiedzialność za fizykę ruchu:
   - Velocity calculation
   - Ground detection (delegowane do systemu)
   - State machine (ruch)
   - **NIE** miesza się z renderingiem

3. **CharacterControllerSystem** - orchestrator:
   - Update loop dla wszystkich kontrolerów
   - Ground detection (raycasting)
   - Animation synchronization
   - Profile loading

#### ⚠️ **Problemy z odpowiedzialnościami:**

1. **DUPLIKACJA SYSTEMÓW ANIMACJI** (KRYTYCZNE):
   ```typescript
   // packages/avatar/src/avatar-instance.ts
   private readonly animator: AvatarAnimationPlayer;  // ← System 1
   
   // packages/stdlib/src/CharacterController/CharacterControllerSystem.ts
   const animationComponent = controller.entity.getComponent(AnimationComponent);  // ← System 2
   ```
   **Problem:** Dwa niezależne systemy animacji:
   - `AvatarAnimationPlayer` - dla skeletonu avatara (w `AvatarInstance`)
   - `AnimationComponent` - dla animacji postaci (synchronizowany przez `CharacterControllerSystem`)
   
   **Skutek:** Brak synchronizacji między animacjami avatara a animacjami postaci. Avatar może mieć inną animację niż postać!

2. **CharacterController miesza konfigurację z logiką:**
   ```typescript
   // packages/world/src/components/CharacterController.ts:96
   public config: CharacterControllerConfig;  // ← Public mutable config
   ```
   **Problem:** Config jest publiczny i mutowalny, co pozwala na zmiany w runtime bez walidacji.

3. **CharacterControllerSystem ma zbyt wiele odpowiedzialności:**
   - Ground detection (fizyka)
   - Animation synchronization (rendering)
   - Profile loading (asset management)
   - Intent buffering (input)
   
   **Lepszy podział:** Wydzielić `GroundDetectionSystem` i `AnimationSyncSystem`.

### 2.2 Propozycja lepszego podziału

```
┌─────────────────────────────────────────────────────────────┐
│              INPUT PROCESSING                                │
│  CharacterInputHandler → IntentBuffer                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              MOVEMENT PROCESSING                             │
│  CharacterControllerSystem (orchestrator)                   │
│    ├─ GroundDetectionSystem (raycasting)                    │
│    ├─ MovementProfileSystem (profile management)             │
│    └─ CharacterController (velocity, state)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ANIMATION SYNCHRONIZATION                       │
│  AnimationSyncSystem                                         │
│    ├─ CharacterController.state → AnimationComponent         │
│    └─ AvatarInstance.animator (jeśli zintegrowany)          │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Typy, Interfejsy, Dane

### 3.1 Ocena użycia typów

#### ✅ **Dobrze:**

1. **Silne typy dla jointów:**
   ```typescript
   export type AvatarJointName = 'Root' | 'Hips' | 'Spine' | ...;
   ```
   Type-safe, łatwe do refaktoryzacji.

2. **Enum dla stanów:**
   ```typescript
   export enum CharacterState {
     Idle = 'idle',
     Walking = 'walking',
     // ...
   }
   ```

3. **Readonly interfaces dla danych:**
   ```typescript
   export interface AvatarLoadout {
     readonly version: number;
     readonly parts: Partial<Record<AvatarSlot, AvatarLoadoutPart>>;
   }
   ```

#### ❌ **Problemy:**

1. **`any` w CharacterController (circular dependency workaround):**
   ```typescript
   // packages/world/src/components/CharacterController.ts:136
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   private currentProfile: any = null; // MovementProfile from @engine/stdlib
   ```
   **Problem:** Użycie `any` omija system typów.  
   **Rozwiązanie:** Wydzielić interfejs `MovementProfile` do wspólnego pakietu (`@engine/core` lub `@engine/world`).

2. **Magic strings w mapowaniu stanów:**
   ```typescript
   // packages/stdlib/src/CharacterController/CharacterControllerSystem.ts:26
   const STATE_TO_ANIMATION: Record<CharacterState, string> = {
     [CharacterState.Idle]: 'idle',
     [CharacterState.Walking]: 'walk',
     // ...
   };
   ```
   **Problem:** Stringi 'idle', 'walk' są magiczne - brak walidacji czy animacja istnieje.  
   **Rozwiązanie:** Enum lub const object dla nazw animacji.

3. **Brak walidacji w AvatarLoadout:**
   ```typescript
   // packages/avatar/src/avatar-instance.ts:134
   applyLoadout(loadout: AvatarLoadout): void {
     const validation = this.serializer.validate(loadout, this.partLibrary);
     if (!validation.valid) {
       console.warn('[AvatarInstance] Loadout validation failed:', validation.errors);
       // Continue applying valid parts, but log errors  ← ⚠️
     }
   ```
   **Problem:** Walidacja tylko loguje błędy, ale kontynuuje aplikację. Może prowadzić do częściowo zepsutego avatara.

4. **Brak typów dla IntentFrame:**
   ```typescript
   // packages/stdlib/src/CharacterController/CharacterControllerSystem.ts:9
   interface IntentFrame {  // ← Private interface, brak eksportu
     move: [number, number];
     jump: boolean;
     sprint: boolean;
     forward: Vec3;
     right: Vec3;
   }
   ```
   **Problem:** Brak możliwości testowania/extensibility.

### 3.2 Konkretne propozycje poprawy

#### Propozycja 1: Wydzielić MovementProfile interface

```typescript
// packages/world/src/movement/MovementProfile.ts
export interface MovementProfile {
  readonly id: string;
  readonly name: string;
  readonly config: CharacterControllerConfig;
  readonly extensions?: MovementProfileExtension[];
}

export interface MovementProfileExtension {
  onApply?(controller: CharacterController): void;
  modifyConfig?(config: CharacterControllerConfig): CharacterControllerConfig;
  update?(controller: CharacterController, deltaTime: number): void;
}
```

#### Propozycja 2: Enum dla nazw animacji

```typescript
// packages/stdlib/src/CharacterController/AnimationState.ts
export enum AnimationStateName {
  Idle = 'idle',
  Walk = 'walk',
  Run = 'run',
  Jump = 'jump',
  Fall = 'fall',
  Land = 'land',
}

const STATE_TO_ANIMATION: Record<CharacterState, AnimationStateName> = {
  [CharacterState.Idle]: AnimationStateName.Idle,
  [CharacterState.Walking]: AnimationStateName.Walk,
  // ...
};
```

#### Propozycja 3: Typ dla IntentFrame

```typescript
// packages/stdlib/src/CharacterController/IntentFrame.ts
export interface IntentFrame {
  readonly move: readonly [number, number];
  readonly jump: boolean;
  readonly sprint: boolean;
  readonly forward: Vec3;
  readonly right: Vec3;
}
```

---

## 4. Logika Ruchu, Animacji i Stanu Avatara

### 4.1 Flow: od inputu do reprezentacji

```
1. INPUT CAPTURE
   CharacterInputHandler.getInput()
   ↓
   CharacterInput { moveDirection, sprint, jump, cameraForward, cameraRight }

2. INTENT BUFFERING (LocalPlayerController)
   LocalPlayerController.update()
   ↓
   IntentFrame { move, jump, sprint, forward, right }
   ↓
   CharacterControllerSystem.applyIntent() → intentBuffer.set()

3. INPUT APPLICATION (CharacterControllerSystem.update)
   CharacterControllerSystem.update()
   ↓
   intentBuffer.get() → CharacterInput
   ↓
   controller.setInput(input)

4. MOVEMENT CALCULATION (CharacterController.update)
   CharacterController.update(deltaTime)
   ↓
   - applyMovement() → velocity calculation
   - handleJump() → jump mechanics
   - updateState() → CharacterState (Idle/Walking/Running/Jumping/Falling)
   ↓
   syncVelocityToPhysics() → PhysicsComponent.velocity

5. GROUND DETECTION (CharacterControllerSystem)
   updateGroundDetection(controller)
   ↓
   physics.raycast() → isGrounded, groundNormal
   ↓
   controller.isGrounded = ...

6. ANIMATION SYNC (CharacterControllerSystem)
   syncAnimation(controller)
   ↓
   CharacterState → AnimationStateName ('idle', 'walk', ...)
   ↓
   AnimationComponent.setActiveState(animationStateName)

7. VISUAL UPDATE (AvatarInstance - OSOBNY SYSTEM!)
   AvatarInstance.update(deltaTime)
   ↓
   AvatarAnimationPlayer.update() → skeleton transforms
   ↓
   syncJointEntities() → Entity.transform (joint positions/rotations)
```

### 4.2 Możliwe bugi i edge-case'y

#### 🐛 **BUG #1: Desync animacji avatara i postaci**

**Problem:**
- `CharacterControllerSystem` synchronizuje `AnimationComponent` z `CharacterState`
- `AvatarInstance` ma własny `AvatarAnimationPlayer`, który **NIE jest synchronizowany**
- Avatar może mieć inną animację niż postać!

**Przykład:**
```typescript
// CharacterControllerSystem.syncAnimation() → AnimationComponent.setActiveState('walk')
// Ale AvatarInstance.animator może mieć inną animację!
```

**Rozwiązanie:** Zintegrować `AvatarInstance.animator` z `CharacterControllerSystem` lub użyć jednego systemu animacji.

#### 🐛 **BUG #2: Ground detection cache może powodować desync**

**Problem:**
```typescript
// packages/stdlib/src/CharacterController/CharacterControllerSystem.ts:152
if (distance < 0.01 && !cache.lastIsGrounded) {
  // Use cached result only if character was in air
  controller.isGrounded = cache.lastIsGrounded;
  return;
}
```
**Edge case:** Jeśli postać stoi na poruszającej się platformie i nie porusza się (distance < 0.01), cache nie jest aktualizowany, więc `isGrounded` może być błędne.

**Rozwiązanie:** Dodać timeout dla cache lub sprawdzać velocity platformy.

#### 🐛 **BUG #3: Jump buffer może powodować podwójne skoki**

**Problem:**
```typescript
// packages/world/src/components/CharacterController.ts:416
const canJump =
  (this.isGrounded || this.timeSinceGrounded < this.coyoteTime) &&
  this.timeSinceJumpPressed <= this.jumpBufferTime;
```
**Edge case:** Jeśli gracz naciśnie jump tuż przed lądowaniem, jump buffer może pozwolić na skok natychmiast po lądowaniu, co może wyglądać jak podwójny skok.

**Rozwiązanie:** Dodać flagę `hasJumped` i resetować ją po lądowaniu.

#### 🐛 **BUG #4: Velocity smoothing może powodować "ślizganie się"**

**Problem:**
```typescript
// packages/world/src/components/CharacterController.ts:374
const smoothingTau = (this.config.velocitySmoothing ?? 0.1) / controlMultiplier;
const alpha = this.expDecayAlpha(smoothingTau, deltaTime);
this.velocity[0] += (targetVelocity[0] - this.velocity[0]) * alpha;
```
**Edge case:** Przy wysokim FPS (144+), smoothing może być zbyt wolny, powodując "ślizganie się" postaci po zatrzymaniu inputu.

**Rozwiązanie:** Dodać threshold dla zatrzymania (jeśli `targetVelocity ≈ 0` i `velocity < threshold`, ustaw `velocity = 0`).

#### 🐛 **BUG #5: Profile switching może powodować desync stanu**

**Problem:**
```typescript
// packages/stdlib/src/CharacterController/LocalPlayerController.ts:226
this.pawnController.applyProfile(profile);
```
**Edge case:** Jeśli profil zmienia `moveSpeed` podczas ruchu, velocity może być nieaktualne, powodując "teleportację" lub nagłe zatrzymanie.

**Rozwiązanie:** Skalować istniejącą velocity proporcjonalnie do zmiany `moveSpeed`.

### 4.3 Ocena logiki animacji i blendowania

#### ⚠️ **Brak blendowania animacji:**

`CharacterControllerSystem.syncAnimation()` używa prostego przełączania:
```typescript
animationComponent.setActiveState(animationStateName);
```
**Problem:** Brak crossfade/blendowania między animacjami → ostre przejścia.

**Rozwiązanie:** Dodać blend time do przejść:
```typescript
animationComponent.setActiveState(animationStateName, { blendTime: 0.2 });
```

#### ⚠️ **Brak synchronizacji z AvatarInstance:**

`AvatarInstance` ma własny system animacji, który **nie jest synchronizowany** z `CharacterControllerSystem`.

---

## 5. Wydajność

### 5.1 Potencjalne bottlenecky

#### 🔴 **HIGH PRIORITY:**

1. **Ground detection raycast w każdym framie:**
   ```typescript
   // packages/stdlib/src/CharacterController/CharacterControllerSystem.ts:166
   const hit = this.physics.raycast(originCopy, direction, {
     maxDistance: Math.max(controller.config.groundCheckDistance, 0.1) + 5.0,
     ignoreEntities: [controller.entity],
   });
   ```
   **Problem:** Raycast dla każdej postaci w każdym framie (nawet z cache, ale cache może być często invalidowany).  
   **Impact:** Przy 100 postaciach = 100 raycastów/frame.  
   **Rozwiązanie:** 
   - Użyć spatial hash dla cache (sprawdzać tylko gdy postać porusza się znacząco)
   - Batch raycasts (jeśli physics engine wspiera)

2. **syncJointEntities() iteruje po wszystkich jointach:**
   ```typescript
   // packages/avatar/src/avatar-instance.ts:215
   if (dirtyJoints.length === this.skeleton.getJointNames().length) {
     this.skeleton.forEachJoint((name) => {  // ← 18 jointów zawsze
       // ...
     });
   }
   ```
   **Problem:** Nawet z dirty tracking, jeśli wszystkie jointy są dirty (częste podczas animacji), iterujemy po wszystkich.  
   **Impact:** 18 jointów × 60 FPS × N avatary = dużo operacji.  
   **Rozwiązanie:** Batch update dla wszystkich avatary jednocześnie.

3. **Alokacje w hot-path:**
   ```typescript
   // packages/stdlib/src/CharacterController/CharacterControllerSystem.ts:133
   forward: [...cameraForward] as Vec3,  // ← Alokacja
   right: [...cameraRight] as Vec3,       // ← Alokacja
   ```
   **Problem:** Alokacje w `applyIntent()` (wywoływane co frame).  
   **Rozwiązanie:** Reuse bufferów lub użyć `Vec3Pool`.

4. **Map lookups w hot-path:**
   ```typescript
   // packages/stdlib/src/CharacterController/CharacterControllerSystem.ts:68
   const bufferedIntent = this.intentBuffer.get(controller);  // ← Map lookup
   ```
   **Problem:** Map lookup dla każdego kontrolera w każdym framie.  
   **Rozwiązanie:** Użyć WeakMap lub array z indexem (jeśli controller ma stable ID).

#### 🟡 **MEDIUM PRIORITY:**

5. **prepareTracks() alokuje nowe arrays:**
   ```typescript
   // packages/avatar/src/animation.ts:134
   const jointMap = new Map<AvatarJointName, PreparedJointKeyframe[]>();  // ← Alokacja
   ```
   **Problem:** Przy każdej zmianie animacji alokujemy nowe struktury.  
   **Rozwiązanie:** Pool tracks lub cache przygotowane tracks.

6. **updateWorldTransforms() iteruje po wszystkich jointach:**
   ```typescript
   // packages/avatar/src/skeleton.ts:325
   for (const joint of this.joints) {  // ← 18 jointów zawsze
     // ...
   }
   ```
   **Problem:** Nawet jeśli tylko jeden joint jest dirty, aktualizujemy wszystkie (bo world transforms zależą od parentów).  
   **Rozwiązanie:** To jest konieczne (hierarchia), ale można zoptymalizować przez batch matrix multiplication.

### 5.2 Konkretne optymalizacje

#### Optymalizacja 1: Spatial hash dla ground detection cache

```typescript
class GroundDetectionCache {
  private spatialHash = new Map<string, GroundDetectionCache>();
  private cellSize = 0.5; // meters

  getCache(position: Vec3): GroundDetectionCache | null {
    const key = this.getCellKey(position);
    return this.spatialHash.get(key) ?? null;
  }

  private getCellKey(position: Vec3): string {
    const x = Math.floor(position[0] / this.cellSize);
    const z = Math.floor(position[2] / this.cellSize);
    return `${x},${z}`;
  }
}
```

#### Optymalizacja 2: Vec3Pool dla reuse

```typescript
class Vec3Pool {
  private pool: Vec3[] = [];
  
  acquire(): Vec3 {
    return this.pool.pop() ?? [0, 0, 0];
  }
  
  release(vec: Vec3): void {
    vec[0] = 0;
    vec[1] = 0;
    vec[2] = 0;
    this.pool.push(vec);
  }
}
```

#### Optymalizacja 3: Batch joint updates

```typescript
class AvatarSystem {
  update(deltaTime: number): void {
    // Collect all dirty joints from all avatars
    const dirtyJoints = new Map<AvatarJointName, Entity[]>();
    for (const avatar of this.avatars) {
      for (const joint of avatar.getDirtyJoints()) {
        if (!dirtyJoints.has(joint)) {
          dirtyJoints.set(joint, []);
        }
        dirtyJoints.get(joint)!.push(avatar.getJointEntity(joint));
      }
    }
    
    // Batch update
    for (const [joint, entities] of dirtyJoints) {
      this.batchUpdateJoint(joint, entities);
    }
  }
}
```

---

## 6. Czytelność i Utrzymanie

### 6.1 Ocena nazewnictwa

#### ✅ **Dobre:**

- `AvatarInstance` - jasne, co reprezentuje
- `CharacterController` - standardowa nazwa w game dev
- `syncJointEntities()` - jasne, co robi
- `applyLoadout()` - czytelne API

#### ⚠️ **Problemy:**

1. **Niejasne nazwy:**
   ```typescript
   // packages/stdlib/src/CharacterController/LocalPlayerController.ts:61
   private readonly _cameraDirector: CameraDirector;  // ← Underscore prefix, ale nie używane
   ```
   **Problem:** `_cameraDirector` ma underscore (konwencja private), ale jest readonly i nie używane.  
   **Rozwiązanie:** Usunąć jeśli nieużywane lub zmienić nazwę.

2. **Magic numbers bez komentarzy:**
   ```typescript
   // packages/world/src/components/CharacterController.ts:123
   private readonly coyoteTime: number = 0.1;  // ← Co to jest?
   ```
   **Problem:** "Coyote time" to game dev term, ale brak komentarza wyjaśniającego.  
   **Rozwiązanie:** Dodać komentarz:
   ```typescript
   /** Coyote time: grace period for jumping after leaving ground (prevents frustrating missed jumps) */
   private readonly coyoteTime: number = 0.1;
   ```

3. **Niejasne nazwy metod:**
   ```typescript
   // packages/avatar/src/avatar-instance.ts:179
   ownsEntity(entity: Entity | null | undefined): boolean {
   ```
   **Problem:** "ownsEntity" - czy to sprawdza ownership czy tylko przynależność?  
   **Rozwiązanie:** `isEntityPartOfAvatar()` lub `containsEntity()`.

### 6.2 Długość funkcji i klas

#### ✅ **Dobre:**

- Większość funkcji < 50 linii
- `AvatarInstance` - dobrze podzielone na mniejsze metody

#### ⚠️ **Problemy:**

1. **CharacterController.update() - 45 linii:**
   ```typescript
   // packages/world/src/components/CharacterController.ts:268
   update(deltaTime: number): void {
     // 45 linii kodu
   }
   ```
   **Problem:** Długa metoda z wieloma odpowiedzialnościami.  
   **Rozwiązanie:** Wydzielić:
   ```typescript
   update(deltaTime: number): void {
     this.updateTimers(deltaTime);
     this.applyMovement(deltaTime);
     this.applyGravity(deltaTime);
     this.handleJump();
     this.updateState();
     this.updateRotation(deltaTime);
     this.resetJumpRequest();
   }
   ```

2. **CharacterControllerSystem.update() - 48 linii:**
   ```typescript
   // packages/stdlib/src/CharacterController/CharacterControllerSystem.ts:58
   update(deltaTime: number): void {
     // 48 linii kodu
   }
   ```
   **Problem:** Zbyt wiele odpowiedzialności w jednej metodzie.  
   **Rozwiązanie:** Wydzielić helper methods.

### 6.3 Najmniej czytelne fragmenty

#### Fragment 1: `getCameraRelativeDirectionOut()` - złożona matematyka bez komentarzy

```typescript
// packages/world/src/components/CharacterController.ts:469
private getCameraRelativeDirectionOut(
  out: Vec3,
  input: Vec3,
  cameraForward: Vec3,
  cameraRight: Vec3
): void {
  // Project camera forward onto horizontal plane
  const forward: Vec3 = [cameraForward[0], 0, cameraForward[2]];
  const right: Vec3 = [cameraRight[0], 0, cameraRight[2]];

  // Normalize
  const forwardNorm: Vec3 = [0, 0, 0];
  const rightNorm: Vec3 = [0, 0, 0];
  this.normalizeInto(forwardNorm, forward);
  this.normalizeInto(rightNorm, right);

  // Calculate movement direction
  out[0] = forwardNorm[0] * input[2] + rightNorm[0] * input[0];
  out[1] = 0;
  out[2] = forwardNorm[2] * input[2] + rightNorm[2] * input[0];
  this.normalizeInto(out, out);
}
```

**Problem:** Złożona matematyka bez wyjaśnienia, dlaczego `input[2]` i `input[0]` są używane w ten sposób.  
**Rozwiązanie:** Dodać komentarze wyjaśniające:
```typescript
/**
 * Converts camera-relative input to world-space movement direction.
 * 
 * Input format: [left/right, up/down, forward/backward]
 * Camera directions: forward (camera look), right (camera right)
 * 
 * Formula: worldDir = forwardNorm * input[2] + rightNorm * input[0]
 *          (forward component from input[2], right component from input[0])
 */
```

#### Fragment 2: `updateGroundDetection()` - złożona logika cache

```typescript
// packages/stdlib/src/CharacterController/CharacterControllerSystem.ts:142
private updateGroundDetection(controller: CharacterController): void {
  // ... 46 linii złożonej logiki cache
}
```

**Problem:** Złożona logika cache z wieloma warunkami.  
**Rozwiązanie:** Wydzielić do osobnej klasy:
```typescript
class GroundDetectionCache {
  shouldUseCache(position: Vec3, lastPosition: Vec3, wasGrounded: boolean): boolean {
    const distance = distanceVec3(position, lastPosition);
    return distance < 0.01 && !wasGrounded;
  }
  
  getCachedResult(): { isGrounded: boolean; groundNormal: Vec3 } | null {
    // ...
  }
}
```

#### Fragment 3: `sampleTrack()` - złożona interpolacja

```typescript
// packages/avatar/src/animation.ts:179
function sampleTrack(track: PreparedTrack, time: number): SampleResult {
  // ... 50 linii złożonej logiki interpolacji
}
```

**Problem:** Złożona logika interpolacji bez komentarzy wyjaśniających edge cases.  
**Rozwiązanie:** Dodać komentarze dla każdego case:
```typescript
/**
 * Samples animation track at given time using linear interpolation.
 * 
 * Cases:
 * - No frames: returns empty result
 * - Single frame: returns frame as-is
 * - Time before first frame: returns first frame
 * - Time after last frame: returns last frame
 * - Time between frames: interpolates position (lerp) and rotation (slerp)
 */
```

---

## 7. Bezpieczeństwo, Odporność, Błędy

### 7.1 Brakujące sprawdzenia i walidacje

#### 🔴 **KRYTYCZNE:**

1. **Brak walidacji w `applyProfile()`:**
   ```typescript
   // packages/world/src/components/CharacterController.ts:584
   applyProfile(profile: any): void {
     this.config = { ...profile.config };  // ← Co jeśli profile.config jest undefined?
   ```
   **Problem:** Brak sprawdzenia czy `profile.config` istnieje.  
   **Rozwiązanie:**
   ```typescript
   if (!profile?.config) {
     throw new Error(`Profile "${profile?.id ?? 'unknown'}" missing config`);
   }
   ```

2. **Brak sprawdzenia czy physics istnieje przed użyciem:**
   ```typescript
   // packages/world/src/components/CharacterController.ts:342
   private syncVelocityToPhysics(): void {
     if (!this.physics) return;  // ← Tylko return, brak logowania
     // ...
   }
   ```
   **Problem:** Ciche failowanie może maskować błędy.  
   **Rozwiązanie:** Dodać warning w dev mode:
   ```typescript
   if (!this.physics) {
     if (process.env.NODE_ENV === 'development') {
       console.warn('[CharacterController] Physics component missing');
     }
     return;
   }
   ```

3. **Brak walidacji w `setSlot()`:**
   ```typescript
   // packages/avatar/src/avatar-instance.ts:149
   setSlot(slot: AvatarSlot, part: AvatarLoadoutPart | null): void {
     const definition = this.resolveDefinition(slot, part.mesh);
     if (!definition) {
       console.warn(`[AvatarInstance] Missing definition for slot ${slot} part "${part.mesh}"`);
       this.selections.delete(slot);
       return;  // ← Ciche failowanie
     }
   ```
   **Problem:** Ciche failowanie może prowadzić do częściowo zepsutego avatara.  
   **Rozwiązanie:** Dodać opcję `strictMode`:
   ```typescript
   setSlot(slot: AvatarSlot, part: AvatarLoadoutPart | null, strictMode = false): void {
     const definition = this.resolveDefinition(slot, part.mesh);
     if (!definition) {
       if (strictMode) {
         throw new Error(`Missing definition for slot ${slot} part "${part.mesh}"`);
       }
       console.warn(...);
       return;
     }
   }
   ```

#### 🟡 **MEDIUM:**

4. **Brak sprawdzenia czy entity istnieje:**
   ```typescript
   // packages/world/src/components/CharacterController.ts:520
   getPosition(): Vec3 {
     const entity = this.entity;
     if (entity) {
       return [pos[0], pos[1], pos[2]] as Vec3;
     }
     return [0, 0, 0] as Vec3;  // ← Domyślna pozycja może być myląca
   }
   ```
   **Problem:** Zwraca `[0, 0, 0]` gdy entity nie istnieje, co może maskować błędy.  
   **Rozwiązanie:** Rzucić błąd lub zwrócić `null`:
   ```typescript
   getPosition(): Vec3 | null {
     const entity = this.entity;
     if (!entity) {
       return null;
     }
     return [entity.transform.position[0], entity.transform.position[1], entity.transform.position[2]] as Vec3;
   }
   ```

5. **Brak sprawdzenia czy animacja istnieje przed odtworzeniem:**
   ```typescript
   // packages/avatar/src/animation.ts:59
   play(animation: AvatarAnimation, time = 0): void {
     if (!(animation.length > 0)) {
       throw new Error(`Animation "${animation.name}" must have positive length`);
     }
     // ← Brak sprawdzenia czy animation.frames.length > 0
   ```
   **Problem:** Można odtworzyć animację bez klatek.  
   **Rozwiązanie:**
   ```typescript
   if (!(animation.length > 0)) {
     throw new Error(`Animation "${animation.name}" must have positive length`);
   }
   if (animation.frames.length === 0) {
     throw new Error(`Animation "${animation.name}" has no frames`);
   }
   ```

### 7.2 Defensywny kod

#### Propozycja: AvatarInstance z trybem strict

```typescript
export interface AvatarInstanceOptions {
  readonly name?: string;
  readonly partLibrary?: AvatarPartLibrary;
  readonly loadout?: AvatarLoadout;
  readonly materialResolver?: AvatarMaterialResolver;
  readonly strictMode?: boolean;  // ← Nowe
}

export class AvatarInstance {
  private readonly strictMode: boolean;

  constructor(parent: Entity, options: AvatarInstanceOptions = {}) {
    this.strictMode = options.strictMode ?? false;
    // ...
  }

  setSlot(slot: AvatarSlot, part: AvatarLoadoutPart | null): void {
    if (!part) {
      this.mountManager.unmountSlot(slot);
      this.selections.delete(slot);
      return;
    }

    const definition = this.resolveDefinition(slot, part.mesh);
    if (!definition) {
      const error = `Missing definition for slot ${slot} part "${part.mesh}"`;
      if (this.strictMode) {
        throw new Error(error);
      }
      console.warn(`[AvatarInstance] ${error}`);
      this.selections.delete(slot);
      return;
    }
    // ...
  }
}
```

#### Propozycja: CharacterController z walidacją config

```typescript
export class CharacterController extends Component implements MovementController {
  constructor(config: Partial<CharacterControllerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CHARACTER_CONFIG, ...config };
    this.validateConfig();  // ← Nowe
  }

  private validateConfig(): void {
    if (this.config.moveSpeed <= 0) {
      throw new Error('CharacterController: moveSpeed must be positive');
    }
    if (this.config.jumpForce <= 0) {
      throw new Error('CharacterController: jumpForce must be positive');
    }
    if (this.config.gravityMultiplier < 0) {
      throw new Error('CharacterController: gravityMultiplier cannot be negative');
    }
    // ...
  }
}
```

---

## 8. Sugestie Refaktoryzacji

### 8.1 Lista zadań (TODO)

#### 🔴 **HIGH PRIORITY:**

1. **Zintegrować systemy animacji** (AvatarInstance + AnimationComponent)
   - **Problem:** Dwa niezależne systemy animacji powodują desync
   - **Rozwiązanie:** 
     - Opcja A: Usunąć `AvatarAnimationPlayer`, użyć tylko `AnimationComponent`
     - Opcja B: Zintegrować `AvatarInstance.animator` z `CharacterControllerSystem`
   - **Szacunek:** 2-3 dni

2. **Wydzielić MovementProfile interface** (usunąć `any`)
   - **Problem:** `currentProfile: any` omija system typów
   - **Rozwiązanie:** Wydzielić `MovementProfile` do `@engine/world`
   - **Szacunek:** 1 dzień

3. **Dodać walidację w `applyProfile()`**
   - **Problem:** Brak sprawdzenia czy `profile.config` istnieje
   - **Rozwiązanie:** Dodać walidację i throw error
   - **Szacunek:** 2 godziny

4. **Optymalizować ground detection** (spatial hash cache)
   - **Problem:** Raycast dla każdej postaci w każdym framie
   - **Rozwiązanie:** Spatial hash cache + batch raycasts
   - **Szacunek:** 1 dzień

5. **Dodać blendowanie animacji**
   - **Problem:** Ostre przejścia między animacjami
   - **Rozwiązanie:** Crossfade/blend time w `AnimationComponent`
   - **Szacunek:** 1 dzień

#### 🟡 **MEDIUM PRIORITY:**

6. **Wydzielić GroundDetectionSystem**
   - **Problem:** `CharacterControllerSystem` ma zbyt wiele odpowiedzialności
   - **Rozwiązanie:** Wydzielić `GroundDetectionSystem`
   - **Szacunek:** 4 godziny

7. **Dodać enum dla nazw animacji**
   - **Problem:** Magic strings w `STATE_TO_ANIMATION`
   - **Rozwiązanie:** `AnimationStateName` enum
   - **Szacunek:** 2 godziny

8. **Refaktoryzować `CharacterController.update()`**
   - **Problem:** Długa metoda (45 linii)
   - **Rozwiązanie:** Wydzielić helper methods
   - **Szacunek:** 2 godziny

9. **Dodać Vec3Pool dla reuse**
   - **Problem:** Alokacje w hot-path
   - **Rozwiązanie:** Object pooling dla Vec3
   - **Szacunek:** 4 godziny

10. **Dodać strict mode dla AvatarInstance**
    - **Problem:** Ciche failowanie przy błędnych danych
    - **Rozwiązanie:** `strictMode` option + throw errors
    - **Szacunek:** 2 godziny

#### 🟢 **LOW PRIORITY:**

11. **Dodać komentarze do złożonych metod**
    - **Problem:** Brak komentarzy w `getCameraRelativeDirectionOut()`, `sampleTrack()`
    - **Rozwiązanie:** Dodać JSDoc komentarze
    - **Szacunek:** 1 godzina

12. **Refaktoryzować `updateGroundDetection()`**
    - **Problem:** Złożona logika cache
    - **Rozwiązanie:** Wydzielić `GroundDetectionCache` class
    - **Szacunek:** 2 godziny

13. **Poprawić nazewnictwo**
    - **Problem:** `ownsEntity()` - niejasne, `_cameraDirector` - nieużywane
    - **Rozwiązanie:** Zmienić nazwy
    - **Szacunek:** 1 godzina

### 8.2 Before/After przykłady

#### Przykład 1: Wydzielenie MovementProfile interface

**Before:**
```typescript
// packages/world/src/components/CharacterController.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
private currentProfile: any = null;

applyProfile(profile: any): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  this.config = { ...profile.config };
}
```

**After:**
```typescript
// packages/world/src/movement/MovementProfile.ts
export interface MovementProfile {
  readonly id: string;
  readonly name: string;
  readonly config: CharacterControllerConfig;
  readonly extensions?: MovementProfileExtension[];
}

// packages/world/src/components/CharacterController.ts
import type { MovementProfile } from '../movement/MovementProfile';

private currentProfile: MovementProfile | null = null;

applyProfile(profile: MovementProfile): void {
  if (!profile.config) {
    throw new Error(`Profile "${profile.id}" missing config`);
  }
  this.config = { ...profile.config };
}
```

#### Przykład 2: Refaktoryzacja CharacterController.update()

**Before:**
```typescript
update(deltaTime: number): void {
  this.ensurePhysicsComponent();
  if (!this.physics || !this.entity) return;
  this.timeSinceGrounded += deltaTime;
  this.timeSinceJumpPressed += deltaTime;
  this.applyMovement(deltaTime);
  if (this.config.gravityMultiplier !== 1.0) {
    this.applyCustomGravity(deltaTime);
  }
  this.handleJump();
  if (!this.isGrounded && this.velocity[1] > 0) {
    const damping = Math.pow(0.98, deltaTime * 60);
    this.velocity[1] *= damping;
    if (this.physics) {
      this.physics.velocity[1] = this.velocity[1];
    }
  }
  this.updateState();
  if (this.config.autoRotate) {
    this.autoRotateToMovement(deltaTime);
  }
  this.jumpRequested = false;
}
```

**After:**
```typescript
update(deltaTime: number): void {
  this.ensurePhysicsComponent();
  if (!this.physics || !this.entity) return;

  this.updateTimers(deltaTime);
  this.applyMovement(deltaTime);
  this.applyGravity(deltaTime);
  this.handleJump();
  this.applyAirDamping(deltaTime);
  this.updateState();
  this.updateRotation(deltaTime);
  this.resetJumpRequest();
}

private updateTimers(deltaTime: number): void {
  this.timeSinceGrounded += deltaTime;
  this.timeSinceJumpPressed += deltaTime;
}

private applyGravity(deltaTime: number): void {
  if (this.config.gravityMultiplier !== 1.0) {
    this.applyCustomGravity(deltaTime);
  }
}

private applyAirDamping(deltaTime: number): void {
  if (!this.isGrounded && this.velocity[1] > 0) {
    const damping = Math.pow(0.98, deltaTime * 60);
    this.velocity[1] *= damping;
    if (this.physics) {
      this.physics.velocity[1] = this.velocity[1];
    }
  }
}

private updateRotation(deltaTime: number): void {
  if (this.config.autoRotate) {
    this.autoRotateToMovement(deltaTime);
  }
}

private resetJumpRequest(): void {
  this.jumpRequested = false;
}
```

#### Przykład 3: Dodać blendowanie animacji

**Before:**
```typescript
syncAnimation(controller: CharacterController): void {
  const animationStateName = STATE_TO_ANIMATION[controller.state];
  if (!animationStateName) return;
  const currentState = animationComponent.getActiveState();
  if (currentState === animationStateName) return;
  animationComponent.setActiveState(animationStateName);
}
```

**After:**
```typescript
syncAnimation(controller: CharacterController): void {
  const animationStateName = STATE_TO_ANIMATION[controller.state];
  if (!animationStateName) return;
  const currentState = animationComponent.getActiveState();
  if (currentState === animationStateName) return;
  
  // Blend animation transitions
  const blendTime = this.getBlendTime(currentState, animationStateName);
  animationComponent.setActiveState(animationStateName, { blendTime });
}

private getBlendTime(from: string | null, to: string): number {
  // Fast transitions for similar states (idle <-> walk)
  if ((from === 'idle' && to === 'walk') || (from === 'walk' && to === 'idle')) {
    return 0.1;
  }
  // Slower transitions for different states (jump -> land)
  if (from === 'jump' && to === 'land') {
    return 0.2;
  }
  // Default blend time
  return 0.15;
}
```

---

## 9. Integracja z Resztą Silnika

### 9.1 Jak powinien być podłączony

#### Obecna integracja:

```
INPUT → LocalPlayerController → CharacterControllerSystem → CharacterController
                                                              ↓
                                                         PhysicsComponent
                                                              ↓
                                                         Entity.transform
                                                              ↓
                                                         AvatarInstance (OSOBNY!)
```

#### Problemy integracyjne:

1. **AvatarInstance nie jest zintegrowany z CharacterController:**
   - `AvatarInstance` tworzy własny `Entity` (root)
   - `CharacterController` jest na innym `Entity`
   - Brak automatycznego powiązania

2. **Dwa systemy animacji:**
   - `AnimationComponent` (synchronizowany przez `CharacterControllerSystem`)
   - `AvatarAnimationPlayer` (w `AvatarInstance`)
   - Brak synchronizacji między nimi

3. **Brak integracji z ECS:**
   - `AvatarInstance` nie jest komponentem ECS
   - Trzeba ręcznie synchronizować `Entity.transform` z `AvatarInstance.root`

### 9.2 Potencjalne problemy integracyjne

#### Problem 1: Desync pozycji avatara i kontrolera

**Scenariusz:**
```typescript
// CharacterController aktualizuje Entity.transform.position
controller.entity.transform.position = [10, 5, 10];

// Ale AvatarInstance ma własny root Entity
avatarInstance.getRootEntity().transform.position = [0, 0, 0];  // ← Desync!
```

**Rozwiązanie:** Automatyczna synchronizacja:
```typescript
class AvatarInstance {
  constructor(parent: Entity, options: AvatarInstanceOptions = {}) {
    // ...
    // Sync root position with parent
    this.syncRootTransform();
  }

  syncRootTransform(): void {
    const parent = this.root.parent;
    if (parent) {
      this.root.transform.position = parent.transform.position;
      this.root.transform.rotation = parent.transform.rotation;
    }
  }
}
```

#### Problem 2: Desync animacji

**Scenariusz:**
```typescript
// CharacterControllerSystem synchronizuje AnimationComponent
animationComponent.setActiveState('walk');

// Ale AvatarInstance ma własną animację
avatarInstance.playAnimation(idleAnimation);  // ← Desync!
```

**Rozwiązanie:** Zintegrować systemy:
```typescript
class CharacterControllerSystem {
  syncAnimation(controller: CharacterController): void {
    // Sync AnimationComponent
    const animationComponent = controller.entity.getComponent(AnimationComponent);
    if (animationComponent) {
      animationComponent.setActiveState(animationStateName);
    }

    // Sync AvatarInstance if present
    const avatarInstance = this.getAvatarInstance(controller.entity);
    if (avatarInstance) {
      const avatarAnimation = this.getAvatarAnimationForState(controller.state);
      if (avatarAnimation) {
        avatarInstance.playAnimation(avatarAnimation);
      }
    }
  }
}
```

#### Problem 3: Sync po sieci (multiplayer)

**Potencjalne problemy:**
- `CharacterController` ma `velocity`, `isGrounded`, `state` - trzeba synchronizować
- `AvatarInstance` ma `loadout`, `skeleton` - trzeba synchronizować
- Desync może powodować "teleportację" lub "latanie"

**Rozwiązanie:** Użyć `PlayerSync` systemu (już istnieje w `packages/net`):
```typescript
// Synchronizuj CharacterController state
PlayerSync.syncCharacterController(controller, networkState);

// Synchronizuj AvatarInstance loadout
PlayerSync.syncAvatarLoadout(avatarInstance, networkLoadout);
```

### 9.3 Propozycja lepszej integracji

#### Opcja A: AvatarInstance jako komponent ECS

```typescript
// packages/avatar/src/AvatarComponent.ts
export class AvatarComponent extends Component {
  static readonly type = 'Avatar';
  
  private instance: AvatarInstance;
  
  constructor(loadout: AvatarLoadout) {
    super();
    this.instance = new AvatarInstance(this.entity, { loadout });
  }
  
  update(deltaTime: number): void {
    this.instance.update(deltaTime);
  }
  
  dispose(): void {
    this.instance.dispose();
  }
}

// Użycie:
const entity = new Entity();
entity.addComponent(new CharacterController());
entity.addComponent(new AvatarComponent(loadout));
```

#### Opcja B: AvatarInstance wrapper dla CharacterController

```typescript
// packages/stdlib/src/CharacterController/AvatarCharacterController.ts
export class AvatarCharacterController extends CharacterController {
  private avatarInstance: AvatarInstance;
  
  constructor(config: Partial<CharacterControllerConfig>, loadout: AvatarLoadout) {
    super(config);
    this.avatarInstance = new AvatarInstance(this.entity, { loadout });
  }
  
  onAttach(): void {
    super.onAttach();
    // Sync avatar root with entity
    this.syncAvatarTransform();
  }
  
  update(deltaTime: number): void {
    super.update(deltaTime);
    this.avatarInstance.update(deltaTime);
    this.syncAvatarTransform();
  }
  
  private syncAvatarTransform(): void {
    const root = this.avatarInstance.getRootEntity();
    root.transform.position = this.entity.transform.position;
    root.transform.rotation = this.entity.transform.rotation;
  }
}
```

---

## 10. Podsumowanie i Lista Zadań

### 10.1 Najważniejsze problemy

1. 🔴 **DUPLIKACJA SYSTEMÓW ANIMACJI** - AvatarInstance i AnimationComponent nie są zsynchronizowane
2. 🔴 **BRAK INTEGRACJI** - AvatarInstance nie jest zintegrowany z CharacterController
3. 🔴 **WYDAJNOŚĆ** - Ground detection raycast w każdym framie dla każdej postaci
4. 🟡 **TYPY** - Użycie `any` dla MovementProfile (circular dependency workaround)
5. 🟡 **BEZPIECZEŃSTWO** - Brak walidacji w `applyProfile()`, ciche failowanie

### 10.2 Lista zadań do zrobienia (TODO/Jira)

#### 🔴 HIGH PRIORITY

- [ ] **AVATAR-001**: Zintegrować systemy animacji (AvatarInstance + AnimationComponent)
  - Opcja A: Usunąć AvatarAnimationPlayer, użyć tylko AnimationComponent
  - Opcja B: Zintegrować AvatarInstance.animator z CharacterControllerSystem
  - Szacunek: 2-3 dni
  - Zależności: Brak

- [ ] **AVATAR-002**: Wydzielić MovementProfile interface (usunąć `any`)
  - Utworzyć `packages/world/src/movement/MovementProfile.ts`
  - Zaktualizować CharacterController.applyProfile()
  - Szacunek: 1 dzień
  - Zależności: Brak

- [ ] **AVATAR-003**: Dodać walidację w `applyProfile()`
  - Sprawdzić czy `profile.config` istnieje
  - Throw error zamiast cichego failowania
  - Szacunek: 2 godziny
  - Zależności: AVATAR-002

- [ ] **AVATAR-004**: Optymalizować ground detection (spatial hash cache)
  - Utworzyć `GroundDetectionCache` z spatial hash
  - Batch raycasts jeśli physics engine wspiera
  - Szacunek: 1 dzień
  - Zależności: Brak

- [ ] **AVATAR-005**: Dodać blendowanie animacji
  - Dodać `blendTime` do `AnimationComponent.setActiveState()`
  - Implementować crossfade między animacjami
  - Szacunek: 1 dzień
  - Zależności: AVATAR-001

#### 🟡 MEDIUM PRIORITY

- [ ] **AVATAR-006**: Wydzielić GroundDetectionSystem
  - Utworzyć `packages/stdlib/src/CharacterController/GroundDetectionSystem.ts`
  - Przenieść logikę ground detection z CharacterControllerSystem
  - Szacunek: 4 godziny
  - Zależności: Brak

- [ ] **AVATAR-007**: Dodać enum dla nazw animacji
  - Utworzyć `AnimationStateName` enum
  - Zaktualizować `STATE_TO_ANIMATION` mapowanie
  - Szacunek: 2 godziny
  - Zależności: Brak

- [ ] **AVATAR-008**: Refaktoryzować `CharacterController.update()`
  - Wydzielić helper methods (updateTimers, applyGravity, etc.)
  - Szacunek: 2 godziny
  - Zależności: Brak

- [ ] **AVATAR-009**: Dodać Vec3Pool dla reuse
  - Utworzyć `Vec3Pool` class
  - Zastosować w CharacterControllerSystem.applyIntent()
  - Szacunek: 4 godziny
  - Zależności: Brak

- [ ] **AVATAR-010**: Dodać strict mode dla AvatarInstance
  - Dodać `strictMode` option do `AvatarInstanceOptions`
  - Throw errors zamiast console.warn w strict mode
  - Szacunek: 2 godziny
  - Zależności: Brak

#### 🟢 LOW PRIORITY

- [ ] **AVATAR-011**: Dodać komentarze do złożonych metod
  - JSDoc dla `getCameraRelativeDirectionOut()`
  - JSDoc dla `sampleTrack()`
  - JSDoc dla `updateGroundDetection()`
  - Szacunek: 1 godzina
  - Zależności: Brak

- [ ] **AVATAR-012**: Refaktoryzować `updateGroundDetection()`
  - Wydzielić `GroundDetectionCache` class
  - Uprościć logikę cache
  - Szacunek: 2 godziny
  - Zależności: AVATAR-006

- [ ] **AVATAR-013**: Poprawić nazewnictwo
  - Zmienić `ownsEntity()` na `isEntityPartOfAvatar()`
  - Usunąć nieużywane `_cameraDirector`
  - Szacunek: 1 godzina
  - Zależności: Brak

---

**Koniec analizy**


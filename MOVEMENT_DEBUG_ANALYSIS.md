# Code Review: Movement System Analysis

## Przepływ danych (Data Flow)

### 1. Input Detection ✅ DZIAŁA
**Plik:** `packages/input/src/sources/KeyboardInputSource.ts`
- Zdarzenia klawiatury są odbierane (`handleKeyDown`)
- Klawisze są zapisywane w `this.keys` Map
- `getInput()` zwraca poprawny input z `moveDirection: [x, 0, z]`

**Status:** ✅ DZIAŁA - logi pokazują "Movement key pressed"

### 2. CharacterInputHandler ✅ DZIAŁA
**Plik:** `packages/input/src/CharacterInput.ts`
- `getInput()` zwraca poprawny input z `moveDirection`
- `setCameraDirections()` jest wywoływane w `PlayingState.onUpdate()`

**Status:** ✅ DZIAŁA - logi pokazują poprawny input

### 3. LocalPlayerController ⚠️ POTENCJALNY PROBLEM
**Plik:** `packages/stdlib/src/CharacterController/LocalPlayerController.ts`

**Linia 125-221:** `update()` method

**Problemy znalezione:**

#### Problem 1: Używa kierunków z FPS kamery zamiast z CharacterInputHandler
```typescript
// Linia 169-172
const forwardReadonly = this.fpsCamera?.getForwardDirection() ?? [0, 0, -1];
const rightReadonly = this.fpsCamera?.getRightDirection() ?? [1, 0, 0];
```

**Analiza:** 
- `PlayingState.onUpdate()` wywołuje `updateCharacterInput(forward, right)` który ustawia kierunki w `CharacterInputHandler`
- Ale `LocalPlayerController` ignoruje te kierunki i używa własnych z `fpsCamera`
- To może być OK, jeśli `fpsCamera` jest zawsze dostępne i ma poprawne kierunki

#### Problem 2: Warunek `characterSystem` może być null
```typescript
// Linia 188-214
if (this.characterSystem) {
  if (this.pawnController instanceof CharacterController) {
    this.characterSystem.applyIntent(...);
  }
} else {
  this.pawnController.setInput(characterInput);
}
```

**Analiza:**
- Jeśli `characterSystem` jest null, używa `setInput()` bezpośrednio
- To może być problem, jeśli `CharacterController` wymaga `applyIntent()` dla camera-relative movement

#### Problem 3: Brak logów z `update()`
- Nie widzimy logów `[LocalPlayerController] update() - input received`
- To oznacza, że `update()` nie jest wywoływane LUB input jest zawsze `[0, 0, 0]`

### 4. PlayerSession ⚠️ POTENCJALNY PROBLEM
**Plik:** `packages/stdlib/src/CharacterController/PlayerSession.ts`

**Linia 51-61:** `update()` method

**Problemy znalezione:**

#### Problem: `controller` może być null
```typescript
if (!this.controller) {
  console.warn('[PlayerSession] update() called but controller is null');
  return;
}
```

**Analiza:**
- Jeśli `controller` jest null, `update()` się kończy
- `controller` jest przypisywany w `bindController()` (linia 36-44)
- W `spawnPlayer()` linia 966: `session.bindController(localController)` - powinno być OK

### 5. CharacterControllerSystem ✅ WYGLĄDA OK
**Plik:** `packages/stdlib/src/CharacterController/CharacterControllerSystem.ts`

**Linia 130-147:** `applyIntent()` method
- Zapisuje intent do `intentBuffer`

**Linia 73-86:** `update()` method
- Czyta z `intentBuffer` i aplikuje do controllera

**Status:** ✅ WYGLĄDA OK - logika jest poprawna

### 6. EditorModeManager ⚠️ POTENCJALNY PROBLEM
**Plik:** `apps/editor/src/editor/managers/EditorModeManager.ts`

**Linia 714-762:** `updatePlayMode()` method

**Problemy znalezione:**

#### Problem: Kolejność aktualizacji
```typescript
// Linia 729-753
while (this.playAccumulator >= fixedDeltaTime && steps < maxSubsteps) {
  this.physicsWorld?.update(fixedDeltaTime);
  this.groundDetectionSystem?.update(fixedDeltaTime);
  this.characterSystem?.update(fixedDeltaTime);  // ⚠️ To czyta z intentBuffer
  this.blockBehaviorSystem?.update(fixedDeltaTime);
  this.playerSession?.update(fixedDeltaTime);    // ⚠️ To zapisuje do intentBuffer
  this.stateMachine.update(fixedDeltaTime);
  ...
}
```

**PROBLEM ZNALEZIONY!** 🎯

**Kolejność jest ZŁA:**
1. `characterSystem.update()` - czyta z `intentBuffer` i aplikuje input
2. `playerSession.update()` - zapisuje do `intentBuffer` przez `applyIntent()`

**To oznacza:**
- W pierwszej klatce `characterSystem.update()` czyta pusty `intentBuffer`
- Potem `playerSession.update()` zapisuje intent do bufferu
- Intent jest aplikowany dopiero w **następnej klatce**

**Rozwiązanie:** `playerSession.update()` musi być wywoływane **PRZED** `characterSystem.update()`

## Główny Problem

**Plik:** `apps/editor/src/editor/managers/EditorModeManager.ts`
**Linia:** 733-735

**Błędna kolejność:**
```typescript
this.characterSystem?.update(fixedDeltaTime);  // Czyta z bufferu
this.playerSession?.update(fixedDeltaTime);    // Zapisuje do bufferu
```

**Poprawna kolejność:**
```typescript
this.playerSession?.update(fixedDeltaTime);    // Zapisuje do bufferu
this.characterSystem?.update(fixedDeltaTime);  // Czyta z bufferu
```

## Rozwiązanie

Zamienić kolejność wywołań w `updatePlayMode()`:

```typescript
// Ground detection must be updated before character controllers
this.groundDetectionSystem?.update(fixedDeltaTime);
this.playerSession?.update(fixedDeltaTime);      // ✅ Najpierw zapisz intent
this.characterSystem?.update(fixedDeltaTime);    // ✅ Potem aplikuj intent
this.blockBehaviorSystem?.update(fixedDeltaTime);
```

## Dodatkowe Problemy

1. **LocalPlayerController** używa kierunków z `fpsCamera` zamiast z `CharacterInputHandler` - może być OK, ale warto sprawdzić
2. **Brak walidacji** czy `playerSession` i `controller` istnieją przed użyciem
3. **Brak logów** w niektórych miejscach utrudnia debugowanie

## Rekomendacje

1. ✅ **KRYTYCZNE:** Zamienić kolejność `playerSession.update()` i `characterSystem.update()`
2. ⚠️ Dodać walidację czy `playerSession` i `controller` istnieją
3. ⚠️ Rozważyć użycie kierunków z `CharacterInputHandler` zamiast z `fpsCamera`
4. ⚠️ Dodać więcej logów debugowania w kluczowych miejscach


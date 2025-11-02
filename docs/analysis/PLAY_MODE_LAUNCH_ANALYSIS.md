# Analiza Uruchamiania Gier z Dashboard

**Data:** 2025-01-26  
**Autor:** AI Assistant  
**Status:** Analiza obecnego stanu

## 📋 Spis Treści

1. [Przegląd Architektury](#przegląd-architektury)
2. [Przepływ Uruchamiania](#przepływ-uruchamiania)
3. [State Machine](#state-machine)
4. [Loading Steps](#loading-steps)
5. [Obsługa Błędów](#obsługa-błędów)
6. [Współpraca Multiplayer](#współpraca-multiplayer)
7. [Problemy i Ryzyka](#problemy-i-ryzyka)
8. [Rekomendacje](#rekomendacje)

---

## 📐 Przegląd Architektury

### Komponenty Główne

```
EditorUI
  └─> EditorModeManager (orchestracja)
      └─> PlayModeStateMachine (stany)
          └─> LoadingState (proces ładowania)
              └─> LoadingStepsRegistry (kroki ładowania)
```

### Lokalizacja Komponentów

- **State Machine:** `apps/editor/src/editor/core/PlayModeStateMachine.ts`
- **Mode Manager:** `apps/editor/src/editor/managers/EditorModeManager.ts`
- **UI Integration:** `apps/editor/src/editor/ui/EditorUI.ts`
- **Loading Steps:** `apps/editor/src/editor/core/steps/*.ts`
- **States:** `apps/editor/src/editor/states/*.ts`

---

## 🔄 Przepływ Uruchamiania

### Entry Point

Uruchomienie play mode rozpoczyna się w `EditorUI`:

```typescript:894:894:apps/editor/src/editor/ui/EditorUI.ts
        this.modeManager.enterPlayMode();
```

### Pełny Przepływ

```
[User Action]
    ↓
[EditorUI.enterPlayMode()]
    ↓
[EditorModeManager.enterPlayMode()]
    ↓ (sprawdza collaboration)
    ↓ [JEŚLI collaboration active]
    ├─> CollaborationManager.requestPlayMode()
    │   └─> Czeka na akceptację wszystkich użytkowników
    │       └─> [Po akceptacji] enterPlayModeSync()
    ↓ [JEŚLI brak collaboration]
    ├─> EditorModeManager.enterPlayModeSync()
    ↓
[PlayModeStateMachine - Transitions]
    ↓
EDIT → PREFLIGHT → LOADING → PLAY_INTRO → PLAYING
```

### Szczegóły Transition

1. **EDIT → PREFLIGHT**
   - Walidacja sceny
   - Sprawdzenie gotowości renderera
   - Przygotowanie snapshot autoringu

2. **PREFLIGHT → LOADING**
   - Utworzenie manifestu play mode
   - Inicjalizacja loading overlay
   - Przygotowanie cancellation token

3. **LOADING → PLAY_INTRO**
   - Wykonanie wszystkich loading steps
   - Budowanie runtime world
   - Setup physics
   - Setup lighting
   - Update buffers

4. **PLAY_INTRO → PLAYING**
   - Spawn gracza
   - Konfiguracja kontrolera/kamery
   - Włączenie input handling
   - Inicjalizacja checkpoint system
   - Aktywacja gameplay context

5. **PLAYING ↔ PAUSED**
   - Pause menu
   - Time scaling
   - Opcjonalne wstrzymanie physics

6. **PAUSED/PLAYING → RETURN → EDIT**
   - Cleanup gracza
   - Restore autoring world
   - Przywrócenie kamery edytora
   - Restore selection

---

## 🎯 State Machine

### Stany

```typescript:6:14:apps/editor/src/editor/core/PlayModeStateMachine.ts
export enum PlayModeStateType {
  EDIT = 'EDIT',
  PREFLIGHT = 'PREFLIGHT',
  LOADING = 'LOADING',
  PLAY_INTRO = 'PLAY_INTRO',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  RETURN = 'RETURN',
}
```

### Diagram Przejść

```
┌─────┐
│ EDIT│
└──┬──┘
   │ enterPlayMode()
   ↓
┌──────────┐
│ PREFLIGHT│ → [Walidacja]
└────┬─────┘
     │
     ↓
┌─────────┐
│ LOADING │ → [Loading Steps]
└────┬────┘
     │
     ↓
┌────────────┐
│ PLAY_INTRO │ → [Spawn Player, Setup]
└────┬───────┘
     │
     ↓
┌─────────┐
│ PLAYING │ ←→ [PAUSED]
└────┬────┘
     │ exitPlayMode()
     ↓
┌────────┐
│ RETURN │ → [Cleanup]
└────┬───┘
     │
     ↓
┌─────┐
│ EDIT│
└─────┘
```

### Context Sharing

State machine używa `PlayModeContext` do przekazywania danych między stanami:

```typescript:19:32:apps/editor/src/editor/core/PlayModeStateMachine.ts
export interface PlayModeContext {
  /** Authoring world snapshot (JSON) for restoration */
  authoringSnapshot: string | null;
  /** Selection path for restoration */
  selectionPath: number[] | null;
  /** Built manifest for runtime */
  manifest: any | null;
  /** Error messages from validation */
  errors: string[];
  /** Warnings from validation */
  warnings: string[];
  /** Arbitrary state data */
  data: Map<string, any>;
}
```

**Uwaga:** `manifest` ma typ `any` - powinien być `PlayManifest | null`.

---

## 📦 Loading Steps

### Rejestr Kroków

Loading odbywa się przez system kroków (steps) rejestrowanych w `LoadingState`:

1. **SnapshotStep** - Snapshot autoring world
2. **BuildWorldStep** - Budowa runtime world
3. **PhysicsSetupStep** - Inicjalizacja physics
4. **LightSetupStep** - Konfiguracja oświetlenia
5. **BufferUpdateStep** - Aktualizacja bufferów renderowania
6. **PipelineWarmupStep** - Rozgrzewka pipeline'u renderowania

### Przykład Step

```typescript:3:36:apps/editor/src/editor/core/steps/BuildWorldStep.ts
export class BuildWorldStep implements LoadingStep {
  readonly name = 'Build runtime world';
  readonly weight = 5;
  readonly canRetry = true;
  readonly critical = true;

  async execute(context: LoadingContext): Promise<void> {
    // If chunked build is available, prefer it; otherwise, fall back to sync build
    const anyWorldManager = context.worldManager as unknown as {
      buildRuntimeWorldChunked?: (manifest: unknown, onProgress: (progress: number) => void) => Promise<unknown>;
      buildRuntimeWorld: (manifest: unknown) => unknown;
    };

    const onProgress = (ratio: number) => {
      if (context.cancelToken?.isCancelled()) {
        throw new Error('Cancelled');
      }
      const clamped = Math.max(0, Math.min(1, ratio));
      context.emitProgress({
        step: this.name,
        current: Math.floor(clamped * 100),
        total: 100,
        percentage: Math.floor(clamped * 100),
        message: 'Cloning entities...',
      });
    };

    if (typeof anyWorldManager.buildRuntimeWorldChunked === 'function') {
      await anyWorldManager.buildRuntimeWorldChunked(context.manifest, onProgress);
    } else {
      anyWorldManager.buildRuntimeWorld(context.manifest);
      onProgress(1);
    }
  }
}
```

### Chunked Loading

Niektóre kroki wspierają chunked loading (np. `buildRuntimeWorldChunked`) dla lepszego UX podczas ładowania dużych scen.

### Progress Reporting

Każdy step raportuje postęp przez `context.emitProgress()`, co jest wyświetlane w `LoadingOverlay`.

---

## ⚠️ Obsługa Błędów

### Cancellation Token

Loading można anulować przez `CancellationToken`:

```typescript:641:646:apps/editor/src/editor/managers/EditorModeManager.ts
  private ensureLoadingCancelToken(): CancellationToken {
    if (!this.loadingCancelToken) {
      this.loadingCancelToken = new CancellationToken();
    }
    return this.loadingCancelToken;
  }
```

### Error Handling w State Machine

State machine ma mechanizm obsługi błędów podczas transitions:

```typescript:160:179:apps/editor/src/editor/core/PlayModeStateMachine.ts
    } catch (error) {
      const phase = exitCompleted ? 'enter' : 'exit';
      Logger.error(`State transition failed during ${phase} ${previousState.type} → ${targetType}:`, error as Error);

      if (exitCompleted) {
        try {
          previousState.onEnter(this.context);
        } catch (restoreError) {
          Logger.error(`Failed to restore state ${previousState.type} after transition error:`, restoreError as Error);
          this.context.errors.push(
            `Transition recovery failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
          );
        }
      }

      this.currentState = previousState;
      this.context.errors.push(
        `Transition failed during ${phase}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
```

**Problem:** Po błędzie state machine wraca do poprzedniego stanu, ale nie ma automatycznego powrotu do EDIT - użytkownik może zostać w stanie pośrednim.

### Loading Step Errors

Loading steps mogą wyrzucić błędy, które są wyświetlane w `LoadingOverlay`:

```typescript:228:230:apps/editor/src/editor/managers/EditorModeManager.ts
      onStepError: (error, stepName) => {
        this.getLoadingOverlay().showError(`${stepName}: ${error}`, true);
      },
```

**Problem:** Błąd w step nie powoduje automatycznego abortu całego procesu - inne steps mogą się nadal wykonywać.

---

## 🌐 Współpraca Multiplayer

### Play Mode Request Flow

```typescript:424:435:apps/editor/src/editor/managers/EditorModeManager.ts
    // If collaboration is active, request Play Mode from other users
    if (this.config.collaborationManager?.isCollaborating()) {
      const requestId = this.config.collaborationManager.requestPlayMode();
      if (requestId) {
        Logger.debug('Play Mode request sent, waiting for responses...');
        // The actual Play Mode entry will be triggered by onPlayModeStarted callback
        return;
      }
    }

    // No collaboration or request failed, enter Play Mode directly
    this.enterPlayModeSync();
```

### PlayModeInviteDialog

Użytkownicy otrzymują dialog z zaproszeniem do play mode:

```typescript:1808:1833:apps/editor/src/editor/ui/EditorUI.ts
  private handlePlayModeRequest(fromUser: PublicUser, requestId: string): void {
    if (!this.collaborationManager) {
      return;
    }

    // Hide any existing dialog
    if (this.playModeInviteDialog) {
      this.playModeInviteDialog.hide();
    }

    // Create and show new dialog
    this.playModeInviteDialog = new PlayModeInviteDialog({
      fromUser,
      onAccept: () => {
        this.collaborationManager?.respondToPlayModeRequest(requestId, true);
        this.playModeInviteDialog = null;
      },
      onReject: () => {
        this.collaborationManager?.respondToPlayModeRequest(requestId, false);
        this.playModeInviteDialog = null;
      },
      timeout: 30000, // 30 seconds
    });

    this.playModeInviteDialog.show();
  }
```

**Problem:** Timeout 30 sekund może być zbyt krótki dla użytkowników zajętych innymi zadaniami.

### Synchronizacja Startu

Wszyscy użytkownicy wchodzą do play mode jednocześnie po akceptacji wszystkich:

```typescript:1839:1850:apps/editor/src/editor/ui/EditorUI.ts
  private handlePlayModeStart(): void {
    // Hide dialog if shown
    if (this.playModeInviteDialog) {
      this.playModeInviteDialog.hide();
      this.playModeInviteDialog = null;
    }

    // Enter Play Mode
    if (this.modeManager) {
      this.modeManager.enterPlayModeSync();
    }
  }
```

---

## 🔍 Problemy i Ryzyka

### 1. Brak Automatycznego Rollback

**Problem:** Jeśli loading step się nie powiedzie, state machine pozostaje w stanie pośrednim (np. LOADING), a nie wraca automatycznie do EDIT.

**Skutek:** Użytkownik może zostać w stanie, gdzie play mode nie działa, ale edit mode też nie jest dostępny.

**Lokalizacja:** `PlayModeStateMachine.transitionTo()` - brak automatycznego recovery do EDIT.

### 2. Brak Validacji Stanu Po Błędzie

**Problem:** Po błędzie transition, state machine nie sprawdza czy obecny stan jest nadal valid.

**Skutek:** Możliwy stan niekonsystentny (np. gracz spawnowany bez physics world).

### 3. Race Conditions w Multiplayer

**Problem:** Jeśli użytkownik odrzuci zaproszenie podczas gdy inny już akceptuje, może dojść do niesynchronizacji.

**Skutek:** Niektórzy użytkownicy w play mode, inni nie.

### 4. Brak Timeout dla Loading Steps

**Problem:** Loading steps nie mają timeout - mogą zawiesić się w nieskończoność.

**Skutek:** Play mode może się "zawiesić" podczas ładowania.

### 5. Memory Leaks w Cleanup

**Problem:** `cleanupPlayer()` może nie wyczyścić wszystkich zasobów jeśli wystąpi błąd podczas cleanup.

**Lokalizacja:** `EditorModeManager.cleanupPlayer()` - brak try-catch dla każdego cleanup step.

### 6. Type Safety

**Problem:** `PlayModeContext.manifest` ma typ `any`, co utrudnia type safety.

**Skutek:** Błędy kompilacji TypeScript mogą być niewykryte.

### 7. Brak Retry Mechanism

**Problem:** Chociaż steps mają `canRetry`, nie ma mechanizmu automatycznego retry.

**Skutek:** Błąd w step wymaga ręcznego ponownego uruchomienia.

### 8. Settle State Machine - Potencjalne Loop

**Problem:** `settleStateMachine()` ma limit 32 iteracji, ale jeśli state machine ciągle transitionuje, może osiągnąć limit.

**Lokalizacja:** `EditorModeManager.settleStateMachine()`.

---

## 💡 Rekomendacje

### Krótkoterminowe (Critical)

1. **Automatyczny Rollback do EDIT**
   - Jeśli loading step się nie powiedzie, automatycznie przejść do RETURN → EDIT
   - Dodać timeout dla loading steps (30 sekund)

2. **Lepsze Error Handling**
   - Wyświetlić błąd w UI z opcją "Return to Edit"
   - Logować wszystkie błędy do konsoli z stack trace

3. **Type Safety**
   - Zmienić `PlayModeContext.manifest` z `any` na `PlayManifest | null`
   - Dodać type guards

4. **Cleanup Guarantees**
   - Użyć `DisposableGroup` dla cleanup gracza
   - Try-catch dla każdego cleanup step

### Średnioterminowe (Important)

5. **Retry Mechanism**
   - Implementować automatyczny retry dla non-critical steps
   - UI dla manual retry dla critical steps

6. **Progress Tracking**
   - Lepsze progress reporting (szacowany czas, nazwa obecnego kroku)
   - Cancel button bardziej widoczny

7. **Multiplayer Improvements**
   - Większy timeout dla play mode request (60 sekund)
   - Status indicator dla oczekujących użytkowników
   - Graceful degradation jeśli niektórzy użytkownicy nie odpowiedzieli

8. **State Validation**
   - Dodać `validateState()` method dla każdego stanu
   - Sprawdzać konsystencję przed transition

### Długoterminowe (Nice to Have)

9. **Loading Optimization**
   - Progressive loading (możliwość wejścia do play mode przed pełnym załadowaniem)
   - Background loading dla assetów

10. **Monitoring & Analytics**
    - Track time w każdym stanie
    - Track błędów i ich częstotliwość
    - Performance metrics

11. **Unit Tests**
    - Testy dla każdego loading step
    - Testy dla error scenarios
    - Testy dla multiplayer synchronization

---

## 📝 Podobne Sytuacje

### Inne Miejsca z Launch Flow

1. **Template Loading**
   - `ProjectManager.newProjectFromTemplate()` - podobny loading flow
   - Można użyć tego samego loading system

2. **Scene Loading**
   - `ProjectManager.showLoadDialog()` - ładowanie scen z plików
   - Może skorzystać z LoadingState pattern

3. **Asset Loading**
   - W przyszłości może być podobny pattern dla asset loading

### Wzorce do Rozważenia

- **Promise-based loading** zamiast state machine (prostszy flow dla prostych przypadków)
- **React Suspense-like** pattern dla progressive loading
- **Command Pattern** dla undo/redo play mode transitions

---

## 🔗 Powiązane Pliki

- `apps/editor/src/editor/core/PlayModeStateMachine.ts` - State machine
- `apps/editor/src/editor/managers/EditorModeManager.ts` - Orchestracja
- `apps/editor/src/editor/ui/EditorUI.ts` - UI integration
- `apps/editor/src/editor/states/*.ts` - Stanowe implementacje
- `apps/editor/src/editor/core/steps/*.ts` - Loading steps
- `apps/editor/src/editor/core/LoadingOverlay.ts` - UI dla loading
- `apps/editor/src/editor/ui/PlayModeInviteDialog.ts` - Multiplayer dialog

---

## 📚 Referencje

- [State Machine Pattern](https://en.wikipedia.org/wiki/Finite-state_machine)
- [Loading States Best Practices](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [Error Handling Patterns](https://martinfowler.com/articles/replaceThrowWithNotification.html)

---

**Status:** Analiza zakończona - wymagane akcje w sekcji Rekomendacje.


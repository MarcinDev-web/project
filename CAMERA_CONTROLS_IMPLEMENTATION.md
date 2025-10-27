# Free-Fly Camera Implementation

## Podsumowanie

Dodano kompletny system free-fly camera controls do edytora, rozwiązując problem z brakiem możliwości poruszania się kamerą w scenach pełnych obiektów.

## Nowe funkcjonalności

### EditorCameraController

Nowa klasa (`packages/camera/src/EditorCameraController.ts`) zapewniająca kontrolę kamery w stylu "no-clip":

**Kontrolki:**
- **WSAD** - ruch w płaszczyźnie poziomej (forward/back/left/right)
- **Q** - ruch w dół (world down)
- **E** - ruch w górę (world up)
- **Prawy przycisk myszy + przeciągnij** - rozglądanie się (yaw/pitch)
- **Ctrl + scroll** - zmiana prędkości ruchu (0.5 - 50 units/s)
- **Shift (przytrzymaj)** - sprint (2x szybciej)
- **Alt (przytrzymaj)** - wolny ruch (0.3x prędkości)

**Konfiguracja:**
```typescript
new EditorCameraController(canvas, {
  moveSpeed: 5.0,              // Domyślna prędkość
  sprintMultiplier: 2.0,       // Mnożnik dla Shift
  slowMultiplier: 0.3,         // Mnożnik dla Alt
  lookSensitivity: 0.003,      // Czułość myszy
  pitchLimit: Math.PI/2 - 0.05,// Limit pitch (89°)
  initialPosition: [0, 2, 5],  // Początkowa pozycja
})
```

### Integracja z CameraDirector

**Nowy tryb kamery:**
- Dodano `'free-fly'` do `CameraMode` type
- CameraDirector automatycznie zarządza enable/disable kontrolek
- Update loop wywołuje `editorCamera.update(deltaTime)` w free-fly mode

**Auto-switching kontrolek:**
```typescript
case 'free-fly':
  editorCamera.enable();
  orbitControls.setEnabled(false);
  break;
case 'orbit':
  editorCamera.disable();
  orbitControls.setEnabled(true);
  break;
```

### Keyboard Shortcut

**Klawisz V** - przełącza między trybami:
- `Orbit` → `Free-Fly` → `Orbit` → ...
- Działa tylko w Edit mode (nie w Play)
- Wyświetla komunikat na status bar: "Camera: Orbit" / "Camera: Free-Fly"

### State Management

**Nowy Signal:**
```typescript
// apps/editor/src/editor/core/state.ts
export type CameraMode = 'orbit' | 'free-fly';

class EditorState {
  cameraMode: Signal<CameraMode>;
  // ...
}
```

**Reactive Effect:**
```typescript
// Automatycznie aktualizuje CameraDirector gdy zmienia się cameraMode
effect(() => {
  const cameraMode = this.state!.cameraMode.value;
  if (this.modeManager && this.state!.editorMode.value === 'edit') {
    const cameraDirector = this.modeManager.getCameraDirector();
    const directorMode = cameraMode === 'free-fly' ? 'free-fly' : 'orbit';
    cameraDirector.setMode(directorMode);
  }
});
```

## Zmiany w plikach

### Nowe pliki:
- `packages/camera/src/EditorCameraController.ts` - główna klasa
- `CAMERA_CONTROLS_IMPLEMENTATION.md` - ta dokumentacja

### Zmodyfikowane pliki:

**packages/camera/**
- `src/index.ts` - export EditorCameraController
- `src/CameraDirector.ts` - dodano 'free-fly' mode i integrację

**apps/editor/src/**
- `editor/core/state.ts` - dodano CameraMode type i signal
- `editor/ui/EditorUI.ts` - tworzenie EditorCameraController, reactive effect
- `editor/managers/EditorModeManager.ts` - przekazywanie editorCamera do CameraDirector
- `editor/controllers/KeyboardHandler.ts` - shortcut V

## Architektura

```
┌─────────────────────────────────────────────┐
│           EditorUI (orchestrator)           │
│  • Tworzy EditorCameraController            │
│  • Reactive effect na cameraMode signal     │
└────────────────┬────────────────────────────┘
                 │
                 ├──> EditorModeManager
                 │     └──> CameraDirector
                 │           ├──> OrbitControls (dla 'orbit')
                 │           ├──> FPSCamera (dla 'fps')
                 │           └──> EditorCameraController (dla 'free-fly')
                 │
                 └──> KeyboardHandler
                       └──> V key → toggle cameraMode.value
```

## Testowanie

**Manualnie:**
1. Uruchom: `pnpm dev`
2. Naciśnij **V** - status: "Camera: Free-Fly"
3. **WSAD** - poruszaj się
4. **Q/E** - góra/dół
5. **Prawy przycisk + przeciągnij** - rozglądaj się
6. **Ctrl + scroll** - zmień prędkość
7. **V** ponownie - powrót do Orbit

**Problem rozwiązany:**
✅ Można teraz latać przez całą scenę, nawet gdy jest pełna bloków  
✅ WSAD działa  
✅ Nie trzeba klikać na pustą powierzchnię  
✅ Scroll nadal działa (do zmiany prędkości w free-fly)

## Potencjalne ulepszenia (przyszłość)

1. **Persist cameraMode** - zapisywać do localStorage
2. **Smooth acceleration** - zamiast instant start/stop
3. **Collision detection** (opcjonalne) - dla realizmu
4. **Mouse sensitivity slider** w settings
5. **Różne profile prędkości** (slow/medium/fast)
6. **Shortcut hint** - tooltip przy przełączaniu trybu
7. **Icon w UI** - pokazujący aktywny tryb kamery

## Notes

- **Q/E konflikt**: Nie ma problemu - Q w placement mode działa tylko gdy `placementMode.isActive()`, a free-fly jest disabled podczas placement
- **Performance**: EditorCameraController nie alokuje w hot path (update loop), używa wbudowanych eventów
- **Dispose**: Automatyczne cleanup przez DisposableGroup w EditorUI
- **TypeScript strict**: ✅ Wszystko skompilowane bez błędów

---

**Implemented:** 2025-10-26  
**Author:** AI Assistant  
**Status:** ✅ Complete & Working


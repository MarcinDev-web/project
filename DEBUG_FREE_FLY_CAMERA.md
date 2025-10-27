# Debugging Free-Fly Camera

## Problemy które naprawiłem:

### 1. ❌ Konflikt klawiszy z KeyboardHandler
**Problem:** KeyboardHandler przechwytywał klawisze WSAD/QE/R do zmiany gizmo mode

**Rozwiązanie:** 
- W: zmienia gizmo na 'translate' → dodano `&& state.cameraMode.value !== 'free-fly'`
- E: zmienia gizmo na 'rotate' → dodano check
- R: zmienia gizmo na 'scale' → dodano check
- Q: rotate preview CCW → dodano check

### 2. ❌ Event propagation
**Problem:** Eventy z EditorCameraController docierały do KeyboardHandler

**Rozwiązanie:**
```typescript
event.preventDefault();
event.stopPropagation(); // Stop event from reaching KeyboardHandler
```

### 3. ❌ Case sensitivity
**Problem:** `keysPressed.has('w')` vs `keysPressed.has('W')`

**Rozwiązanie:**
```typescript
const hasW = Array.from(this.keysPressed).some(k => k.toLowerCase() === 'w');
```

## Jak przetestować:

1. Uruchom: `pnpm dev`
2. Otwórz console (F12)
3. Naciśnij **V** - sprawdź czy w console pojawia się:
   - `Camera mode: orbit → free-fly`
4. Sprawdź czy na status bar pojawia się "Camera: Free-Fly"
5. Naciśnij **W** - sprawdź w console czy:
   - EditorCameraController.handleKeyDown() jest wywoływany
   - KeyboardHandler NIE zmienia gizmo mode
6. Przytrzymaj **W** i sprawdź czy kamera się porusza

## Debug tips:

Dodaj do `EditorCameraController.update()`:
```typescript
if (this.keysPressed.size > 0) {
  console.log('Keys pressed:', Array.from(this.keysPressed), 'Movement:', movement);
}
```

Dodaj do `EditorCameraController.enable()`:
```typescript
console.log('EditorCameraController enabled');
```

Dodaj do `CameraDirector.setMode()`:
```typescript
console.log('CameraDirector.setMode:', mode, 'editorCamera:', this.editorCamera);
```

## Checklist:

- [x] KeyboardHandler nie przechwytuje WSAD w free-fly
- [x] EditorCameraController używa stopPropagation
- [x] Case-insensitive key checking
- [x] CameraDirector inicjalizuje stan kamery
- [ ] EditorCameraController enable() jest wywoływane
- [ ] Eventy keydown/keyup są rejestrowane
- [ ] Update loop wywołuje editorCamera.update()

## Potencjalne problemy:

1. **EditorCameraController nie jest enabled** - sprawdź czy `enable()` jest wywoływane
2. **Update loop nie działa** - sprawdź czy `update(deltaTime)` jest wywoływane co frame
3. **Mouse context menu blokuje** - prawy przycisk może pokazywać menu (już obsłużone przez preventDefault)
4. **Shift modifier conflict** - Shift może kolidować z innym
5. **Window blur** - gdy okno traci focus, klawisze zostają "stuck" (już obsłużone przez handleBlur)


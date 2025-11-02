# Analiza Problemów Systemu Placement

## ❌ Znalezione Problemy

### 1. **KRYTYCZNY: Race Condition w updatePreviewPosition**

**Problem:**
Wszystkie wywołania `updatePreviewPosition` są `void` (nie czekają na zakończenie). Funkcja jest `async` i wykonuje kolizję przez WASM/Worker, która może trwać dłużej niż czas między kolejnymi eventami mousemove.

```typescript
// EditorPlacementController.ts - linia 86, 91, 101, 112, etc.
void this.config.placementMode.updatePreviewPosition(adjacent, {
  ignoreEntities: [exclude],
  applySnap: false,
});
```

**Konsekwencje:**
- Stary collision check może nadpisać nowy (preview pokazuje błędny kolor)
- Preview może "teleportować się" gdy stare wywołania kończą się później
- Możliwe "flickering" między zielonym/czerwonym stanem
- W dużych scenach (500+ obiektów) może być widoczne opóźnienie

**Rozwiązanie:**
- Dodać `requestIdleCallback` lub throttling dla mousemove
- Albo użyć `lastUpdateId` do ignorowania starych wyników
- Albo kolejkowanie z debouncing

---

### 2. **ŚREDNI: Hardcoded Ground Plane (y=0)**

**Problem:**
Raycast do ground plane zawsze zakłada y=0:

```typescript
// EditorPlacementController.ts - linia 441
return [x, 0, z];  // ← Hardcoded y=0
```

**Konsekwencje:**
- Nie działa z terenem na innych wysokościach
- Nie działa z nachylonym terenem
- Nie wykrywa rzeczywistej powierzchni terenu

**Rozwiązanie:**
- Dodać raycast do mesha terenu zamiast fixed plane
- Albo configurable ground level
- Albo raycast do najbliższej entity w dół

---

### 3. **ŚREDNI: Brak Walidacji Camera Matrices**

**Problem:**
Walidacja jest, ale nie ma fallback jeśli walidacja failuje:

```typescript
// EditorPlacementController.ts - linia 222-224
if (!viewMatrix || !projectionMatrix) {
  Logger.warn('...');
  // ← Nie ma return null lub fallback tutaj!
} else {
  return this.raycaster.createRayFromScreen(...);
}
```

**Konsekwencje:**
- Jeśli matrices są null/undefined, kod kontynuuje do fallback, ale może być problem z timing
- W edge cases może zwrócić null zamiast ray

**Rozwiązanie:**
- Explicit return null lub immediate fallback
- Dodać więcej walidacji

---

### 4. **NISKI: Brak Throttling dla Mousemove**

**Problem:**
Każdy `mousemove` wywołuje `updatePreviewPosition`, które może być kosztowne (WASM collision check).

```typescript
// EditorPlacementController.ts - linia 71-115
this.config.canvas.addEventListener(
  'mousemove',
  (event: MouseEvent) => {
    // ← Brak throttling/debouncing
    if (!this.config.placementMode.isActive()) {
      return;
    }
    // ...
  }
);
```

**Konsekwencje:**
- Wysokie użycie CPU przy szybkim ruchu myszy
- Możliwe lag w UI
- Większe ryzyko race conditions

**Rozwiązanie:**
- Dodać `requestAnimationFrame` throttling
- Albo debounce z małym delay (16ms = 60fps)

---

### 5. **ŚREDNI: Rotacja Nie Czeka Na Collision Check**

**Problem:**
Po rotacji wywołanie `updatePreviewPosition` jest `void`:

```typescript
// PlacementMode.ts - linia 229
if (this.preview.position) {
  void this.updatePreviewPosition(this.preview.position);
}
```

**Konsekwencje:**
- Preview może pokazywać stary kolor po rotacji
- Możliwe race condition jeśli rotacja + mousemove jednocześnie

**Rozwiązanie:**
- To samo co problem #1 - potrzebny proper async handling

---

### 6. **NISKI: Brak Cleanup Preview Po Anulowaniu**

**Problem:**
Sprawdzam czy preview jest usuwany prawidłowo - wygląda OK, ale warto zweryfikować edge case gdy placementMode.cancelPlacement() jest wywołany podczas active updatePreviewPosition.

**Konsekwencje:**
- Teoretycznie możliwy memory leak jeśli preview entity nie jest usunięty
- Możliwe ghost entities w scenie

**Rozwiązanie:**
- Dodać check `if (!this.preview.active) return;` w updatePreviewPosition na początku (już jest!)
- Sprawdzić czy dispose() jest zawsze wywoływane

---

### 7. **ŚREDNI: Edge Case - Null Ray w createRayFromMouseEvent**

**Problem:**
Funkcja może zwrócić `null`, ale niektóre wywołania mogą nie obsługiwać tego:

```typescript
// EditorPlacementController.ts - linia 204
private createRayFromMouseEvent(...): { origin: Vec3; direction: Vec3 } | null {
  // ... może zwrócić null w edge cases
}
```

**Konsekwencje:**
- Jeśli ray jest null, fallback position jest używany (OK)
- Ale może być nieoczekiwane zachowanie

**Rozwiązanie:**
- Już jest obsłużone przez early return, ale można dodać więcej logowania

---

### 8. **NISKI: Brak Testów dla CameraDirector vs OrbitControls**

**Problem:**
Testy nie sprawdzają różnych trybów kamery:
- OrbitControls fallback
- CameraDirector (free-fly/FPS)
- Invalid matrices scenario

**Konsekwencje:**
- Możliwe nieoczekiwane błędy w różnych trybach kamery
- Nie wiemy czy fallback działa poprawnie

**Rozwiązanie:**
- Dodać testy dla różnych camera modes
- Test dla invalid matrices

---

### 9. **ŚREDNI: Brak Walidacji Scale = 0 w CollisionDetector**

**Problem:**
W CollisionDetector jest MIN_BOX_SIZE = 0.001, ale jeśli entity ma scale [0, 0, 0], może być problem:

```typescript
// CollisionDetector.ts - linia 135-137
const halfX = Math.max(Math.abs(scl[0]) / 2, CollisionDetector.MIN_BOX_SIZE);
// Ale co jeśli scale jest [0, 0, 0] przed max?
```

**Konsekwencje:**
- Teoretycznie może być division by zero lub NaN
- Choć min() już chroni przed tym

**Rozwiązanie:**
- Dodać explicit check dla scale = [0,0,0]
- Albo zwrócić early jeśli scale jest invalid

---

### 10. **KRYTYCZNY: Brak E2E Testów**

**Problem:**
E2E testy są placeholder/skip:

```typescript
// placement.spec.ts - linia 31
test.skip(); // Skip until full implementation
```

**Konsekwencje:**
- Nie wiemy czy cały flow działa end-to-end
- Możliwe błędy integracyjne nie są wykryte
- Nie testujemy rzeczywistego UX

**Rozwiązanie:**
- Zaimplementować przynajmniej podstawowe E2E testy
- Test: start placement → move mouse → double-click → verify entity placed

---

## 📊 Podsumowanie

| Priorytet | Liczba | Status |
|-----------|--------|--------|
| KRYTYCZNY | 2 | ⚠️ Wymaga naprawy |
| ŚREDNI | 4 | ⚠️ Warto naprawić |
| NISKI | 4 | 💡 Nice to have |

---

## ✅ Co Działa Dobrze

1. ✅ Wykluczanie kamer z collision (przetestowane)
2. ✅ Contact tolerance dla face-to-face (przetestowane)
3. ✅ Adjacent placement algorytm (działa)
4. ✅ Material ID selection (heurystyka OK)
5. ✅ Fallback hierarchy (adjacent → ground → fixed distance)
6. ✅ Disposable pattern (cleanup OK)
7. ✅ Type safety (TypeScript strict mode)
8. ✅ Performance optimization (WASM/Worker)

---

## 🔧 Rekomendacje

### Natychmiastowe (KRYTYCZNY):
1. **Naprawić race condition** w updatePreviewPosition (throttling + request ID)
2. **Zaimplementować E2E testy** (przynajmniej podstawowe)

### Wkrótce (ŚREDNI):
3. **Dodać terrain raycast** zamiast hardcoded y=0
4. **Poprawić walidację camera matrices** (explicit fallback)
5. **Dodać throttling** dla mousemove (requestAnimationFrame)

### W przyszłości (NISKI):
6. **Rozszerzyć testy** dla różnych camera modes
7. **Dodać więcej edge case handling**
8. **Performance profiling** w production scenarios

---

**Wniosek:** System działa **bardzo dobrze**, ale ma **2 krytyczne problemy** (race condition, brak E2E) i kilka **średnich problemów** (terrain, camera validation) które warto naprawić dla 100% niezawodności.


# Analiza: Placement i Kolizje z Kamerami

**Data:** 2025-01-26  
**Status:** Problem zidentyfikowany - wymaga poprawki

## Problem

System placement i kolizji może wykrywać fałszywe kolizje z encjami kamer w scenie, uniemożliwiając umieszczanie obiektów w pobliżu kamer.

## Analiza Kodu

### 1. Struktura Systemu

#### CollisionDetector
- **Lokalizacja:** `apps/editor/src/editor/placement/CollisionDetector.ts`
- **Metody sprawdzające kolizje:**
  - `checkCollision()` - używa AABB (Axis-Aligned Bounding Box)
  - `checkCollisionOBB()` - używa OBB (Oriented Bounding Box), bardziej precyzyjna

#### Kluczowy fragment:
```typescript:75:102:apps/editor/src/editor/placement/CollisionDetector.ts
  checkCollision(
    entity: Entity,
    position?: Vec3,
    rotation?: [number, number, number, number],
    scale?: Vec3,
    excludeEntities?: Set<Entity>
  ): CollisionResult {
    const entityBox = this.getBoundingBox(entity, position, rotation, scale);
    const collidingEntities: Entity[] = [];

    // Check against all active entities in scene
    const entities = this.scene.getActiveEntities();
    for (const other of entities) {
      // Skip self and excluded entities
      if (other === entity) continue;
      if (excludeEntities?.has(other)) continue;

      const otherBox = this.getBoundingBox(other);
      if (CollisionDetector.boxesIntersect(entityBox, otherBox)) {
        collidingEntities.push(other);
      }
    }
```

**Problem:** `getActiveEntities()` zwraca **WSZYSTKIE** aktywne encje w scenie, w tym kamery.

### 2. Kamery jako Encje

#### CameraComponent
- **Lokalizacja:** `packages/world/src/components/CameraComponent.ts`
- Kamery są **pełnoprawnymi encjami** w scenie z `CameraComponent`
- Mają transform (position, rotation, scale)
- Są przechowywane w `Scene._cameraMap`

#### Oznaczanie kamer:
```typescript:694:707:apps/editor/src/editor/ui/EditorToolbar.ts
  private handleCreateCamera(): Entity | null {
    const scene = this.config.state.scene.value;
    const cameraEntity = scene.createEntity('Camera');
    if (!cameraEntity.hasComponent(CameraComponent)) {
      cameraEntity.addComponent(new CameraComponent());
    }
    cameraEntity.userData.isCamera = true;
    cameraEntity.transform.position = [0, 3, 6];
    this.config.projectManager?.markUnsaved();
    scene.setPrimaryCamera(cameraEntity);
    // Replicate entity creation
    this.config.onEntityCreated?.(cameraEntity);
    return cameraEntity;
  }
```

**Ważne:** Kamery mają `userData.isCamera = true` dla łatwej identyfikacji.

### 3. Obliczanie Bounding Box

```typescript:116:137:apps/editor/src/editor/placement/CollisionDetector.ts
  getBoundingBox(
    entity: Entity,
    position?: Vec3,
    _rotation?: [number, number, number, number],
    scale?: Vec3
  ): BoundingBox {
    // Use provided values or entity's transform
    const pos = position ?? entity.transform.getWorldPosition();
    const scl = scale ?? entity.transform.scale;

    // For AABB, we ignore rotation and use axis-aligned box
    // Base box is centered at origin with size 1x1x1
    // Scale determines the actual size
    const halfX = Math.max(Math.abs(scl[0]) / 2, CollisionDetector.MIN_BOX_SIZE);
    const halfY = Math.max(Math.abs(scl[1]) / 2, CollisionDetector.MIN_BOX_SIZE);
    const halfZ = Math.max(Math.abs(scl[2]) / 2, CollisionDetector.MIN_BOX_SIZE);

    return {
      min: [pos[0] - halfX, pos[1] - halfY, pos[2] - halfZ],
      max: [pos[0] + halfX, pos[1] + halfY, pos[2] + halfZ],
    };
  }
```

**Problem:** Jeśli kamera ma `scale > 0` (np. domyślne [1, 1, 1]), otrzyma bounding box i będzie traktowana jako kolizja!

### 4. Aktualne Wykluczenia

#### Preview encje są wykluczane:
```typescript:221:224:apps/editor/src/editor/controllers/EditorPlacementController.ts
    // Exclude preview entity from raycast
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => e !== preview && !e.userData.isPreview);
```

**Ale:** W `CollisionDetector` nie ma podobnego filtrowania dla kamer.

## Wpływ na System

### Scenariusze Problematyczne

1. **Umieszczanie obiektu w pobliżu kamery:**
   - Kamera na pozycji [0, 3, 6] ze scale [1, 1, 1]
   - Bounding box kamery: min [-0.5, 2.5, 5.5], max [0.5, 3.5, 6.5]
   - Próba umieszczenia bloku w tym obszarze → **fałszywa kolizja**

2. **Kamery w scenie:**
   - Jeśli użytkownik utworzył wiele kamer do edycji różnych widoków
   - Każda kamera może blokować placement w swoim obszarze

3. **Kamery z niestandardowym scale:**
   - Jeśli kamera ma scale [2, 2, 2] → większy bounding box → większy obszar zablokowany

## Rozwiązanie

### Opcja 1: Wyklucz kamery w CollisionDetector (ZALECANE)

**Zmiany w `CollisionDetector.ts`:**

1. W metodzie `checkCollision()`:
```typescript
for (const other of entities) {
  // Skip self and excluded entities
  if (other === entity) continue;
  if (excludeEntities?.has(other)) continue;
  
  // Skip cameras (they are virtual, not physical objects)
  if (other.userData.isCamera === true) continue;
  
  const otherBox = this.getBoundingBox(other);
  // ...
}
```

2. W metodzie `checkCollisionOBB()` - w dwóch miejscach:
   - W pętli `candidates` (linia ~414)
   - W fallback TypeScript path (linia ~485)

### Opcja 2: Wyklucz kamery w PlacementMode

Dodaj filtry kamer w `PlacementMode.updatePreviewPosition()` przed wywołaniem `checkCollisionOBB()`.

**Problemy:**
- Wymaga zmian w wielu miejscach
- Kamery powinny być wykluczane również w innych kontekstach kolizji

### Opcja 3: Użyj CameraComponent do identyfikacji

Zamiast `userData.isCamera`, sprawdź czy encja ma `CameraComponent`:
```typescript
if (other.getComponent(CameraComponent)) continue;
```

**Zalety:**
- Nie polega na userData (może być nieustawione)
- Type-safe (sprawdza rzeczywisty komponent)

**Wady:**
- Wymaga importu `CameraComponent` w `CollisionDetector`

## Rekomendacja

**Zalecam Opcję 1 z użyciem CameraComponent (Opcja 3)**, ponieważ:
1. ✅ Kamery nie powinny uczestniczyć w fizycznych kolizjach
2. ✅ Sprawdzenie komponentu jest bardziej niezawodne niż userData
3. ✅ Rozwiązuje problem u źródła (w CollisionDetector)
4. ✅ Wpływa na wszystkie miejsca używające CollisionDetector

## Implementacja

### 1. Zmodyfikuj CollisionDetector.ts

Dodaj import:
```typescript
import { CameraComponent } from '@engine/world/components/CameraComponent';
```

Dodaj filtrowanie w `checkCollision()`:
```typescript
// Skip cameras (they are virtual, not physical objects)
if (other.getComponent(CameraComponent)) continue;
```

Dodaj filtrowanie w `checkCollisionOBB()` w obu miejscach.

### 2. Testy

Dodaj testy weryfikujące:
- ✅ Placement w pobliżu kamery nie wykrywa kolizji
- ✅ Placement na pozycji kamery nie wykrywa kolizji
- ✅ Normalne kolizje nadal działają
- ✅ Kamery z różnymi scale nie powodują kolizji

### 3. Edge Cases

- Kamery z scale [0, 0, 0] - już są obsłużone przez MIN_BOX_SIZE
- Kamery nieaktywne - już są filtrowane przez `getActiveEntities()`
- Kamery jako dzieci innych encji - już są obsłużone (transform hierarchy)

## Wpływ na Inne Systemy

### Pozytywny:
- ✅ Pattern placement nie będzie blokowany przez kamery
- ✅ BlockDragController może przeciągać przez obszar kamer
- ✅ Wszystkie systemy używające CollisionDetector zyskają

### Sprawdzenie wymagane:
- ⚠️ Czy inne systemy (fizyka, raycasting) też powinny ignorować kamery?
  - Raycasting już filtruje preview encje → może też potrzebować filtrowania kamer

## Podsumowanie

**Problem:** Kamery jako encje z bounding box mogą powodować fałszywe kolizje podczas placement.

**Rozwiązanie:** Wyklucz kamery (przez sprawdzenie CameraComponent) w metodach `checkCollision()` i `checkCollisionOBB()` w `CollisionDetector`.

**Priorytet:** Średni-Wysoki (blokuje funkcjonalność placement w pobliżu kamer)

**Szacowany czas:** 1-2 godziny (implementacja + testy)

---

## Dodatkowe Uwagi

### Czy kamery powinny mieć bounding box?

**Nie.** Kamery to obiekty wirtualne:
- Nie są renderowane jako geometria
- Nie uczestniczą w fizyce
- Nie powinny blokować placement

### Alternatywne podejście: Scale = [0, 0, 0] dla kamer

Można by ustawić domyślny scale kamer na [0, 0, 0], ale:
- ❌ Nie rozwiązuje problemu dla kamer ze scale > 0
- ❌ Może wpłynąć na inne systemy zależne od scale
- ❌ Mniej czytelne niż jawne wykluczenie

**Zalecenie:** Wyklucz kamery explicite w kodzie kolizji.


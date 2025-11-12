# Analiza Terrain Builder

**Data analizy:** 2025-01-26  
**Wersja:** 1.0.0

## 📋 Spis treści

1. [Przegląd architektury](#przegląd-architektury)
2. [Struktura komponentów](#struktura-komponentów)
3. [Analiza funkcjonalności](#analiza-funkcjonalności)
4. [Analiza jakości kodu](#analiza-jakości-kodu)
5. [Problemy i ograniczenia](#problemy-i-ograniczenia)
6. [Rekomendacje](#rekomendacje)
7. [Zależności](#zależności)

---

## 📐 Przegląd architektury

Terrain Builder jest modułem edytora odpowiedzialnym za tworzenie i edycję terenu opartego na heightmapach. Zaimplementowany zgodnie z wzorcem **orchestrator-controller-tool**, gdzie:

- **TerrainBuilderStudio** - główny orchestrator koordynujący wszystkie operacje
- **TerrainBuilderController** - kontroler obsługujący input i koordynujący narzędzia
- **Tools** - specjalistyczne narzędzia (HeightmapTerrainTool, TerrainSculptTool, TerrainBrush)
- **UI** - panel interfejsu użytkownika (TerrainPanel)

### Hierarchia odpowiedzialności

```
TerrainBuilderStudio (Orchestrator)
    ↓
TerrainBuilderController (Input/Coordination)
    ↓
┌─────────────────┬──────────────────┐
│ HeightmapTool   │ TerrainSculptTool │
│                 │       ↓          │
│                 │  TerrainBrush    │
└─────────────────┴──────────────────┘
    ↓
TerrainComponent (ECS Component)
    ↓
HeightmapTerrain (Data Model)
```

---

## 🏗️ Struktura komponentów

### 1. TerrainBuilderStudio

**Lokalizacja:** `apps/editor/src/editor/terrain/TerrainBuilderStudio.ts`

**Odpowiedzialności:**
- Koordynacja wszystkich operacji terrain buildera
- Publiczne API dla UI
- Zarządzanie trybami pracy (heightmap, sculpt)
- Delegacja operacji do kontrolera

**Kluczowe metody:**
- `createHeightmapTerrain()` - tworzenie nowego terenu
- `generateFromImage()` - generowanie z obrazu
- `activateSculptMode()` / `deactivateSculptMode()` - zarządzanie trybem rzeźbienia
- `setBrushOperation()` - ustawianie operacji pędzla
- `updateBrushConfig()` - aktualizacja konfiguracji pędzla
- `exportToImage()` - eksport do obrazu
- `applyNoise()` / `applySmooth()` - operacje globalne

**Stan:**
- `activeMode: 'heightmap' | 'sculpt' | null` - aktualny tryb pracy
- `controller: TerrainBuilderController` - instancja kontrolera
- `cleanup: (() => void) | null` - funkcja czyszczenia

**✅ Mocne strony:**
- Czyste publiczne API
- Dobra separacja odpowiedzialności
- Właściwe zarządzanie cyklem życia (dispose)

**⚠️ Problemy:**
- `activeMode` nie jest w pełni wykorzystywany (tylko 'sculpt' jest używany)
- Brak walidacji konfiguracji przed użyciem

---

### 2. TerrainBuilderController

**Lokalizacja:** `apps/editor/src/editor/terrain/controllers/TerrainBuilderController.ts`

**Odpowiedzialności:**
- Obsługa inputu (mysz, klawiatura)
- Raycasting do terenu
- Koordynacja operacji rzeźbienia
- Zarządzanie stanem aktywności

**Kluczowe metody:**
- `initialize()` - inicjalizacja handlerów inputu
- `activate()` / `deactivate()` - aktywacja/deaktywacja trybu edycji
- `setOperation()` - ustawianie operacji pędzla
- `raycastToTerrain()` - raycasting do powierzchni terenu
- `getTerrainEntity()` - znajdowanie entity z terenem

**Stan:**
- `isActive: boolean` - czy tryb edycji jest aktywny
- `isSculpting: boolean` - czy aktualnie rzeźbimy
- `currentOperation: BrushOperation` - aktualna operacja
- `sculptTool: TerrainSculptTool` - narzędzie rzeźbienia
- `heightmapTool: HeightmapTerrainTool` - narzędzie heightmap

**✅ Mocne strony:**
- Kompletna obsługa inputu
- Właściwe użycie AbortController do czyszczenia event listenerów
- Obsługa skrótów klawiszowych (R/L/S/F/P)
- Inwersja operacji przez Shift

**⚠️ Problemy:**

#### 2.1. Raycasting - uproszczony i nieprecyzyjny

```212:327:apps/editor/src/editor/terrain/controllers/TerrainBuilderController.ts
  private raycastToTerrain(event: MouseEvent): { position: Vec3; entity: Entity } | null {
    // ... kod raycastingu ...
    
    // Raycast to terrain (simplified: raycast to Y=0 plane or use proper raycaster)
    // For now, project to Y=0 plane
    if (rayDir[1] >= 0) {
      return null;
    }

    const t = -cameraPosition[1] / rayDir[1];
    // ...
    
    // Find terrain entity and get actual height
    const terrainEntity = this.getTerrainEntity();
    if (terrainEntity) {
      const terrain = this.sculptTool.getHeightmapTerrain();
      if (terrain) {
        position[1] = terrain.getHeightAt(position[0], position[2]);
        return { position, entity: terrainEntity };
      }
    }
```

**Problemy:**
- Używa uproszczonego raycastingu do płaszczyzny Y=0
- Nie uwzględnia transformacji entity (pozycja, rotacja, skala)
- FOV jest hardkodowany (45 stopni) zamiast używać rzeczywistego FOV kamery
- Nie używa dedykowanego systemu raycastingu z engine'a
- Może zwracać błędne pozycje dla terenu poza początkiem układu współrzędnych

**Rekomendacja:** Użyć dedykowanego systemu raycastingu z `@engine/world` lub `@engine/core`.

#### 2.2. Pobieranie kamery - skomplikowane i kruche

```218:244:apps/editor/src/editor/terrain/controllers/TerrainBuilderController.ts
    // Get camera info - use cameraDirector if available, otherwise use scene's primary camera
    let cameraPosition: Vec3 = [0, 2, 5];
    let forward: Vec3 = [0, -0.5, -1];

    if (this.config.cameraDirector) {
      // Try to get position from editor camera controller
      const editorCamera = (this.config.cameraDirector as unknown as { editorCamera?: { getPosition(): Vec3; getOrientation(): { yaw: number; pitch: number } }).editorCamera;
      if (editorCamera) {
        cameraPosition = editorCamera.getPosition();
        const orientation = editorCamera.getOrientation();
        // Calculate forward vector from yaw/pitch
        const cosPitch = Math.cos(orientation.pitch);
        forward = [
          Math.sin(orientation.yaw) * cosPitch,
          -Math.sin(orientation.pitch),
          -Math.cos(orientation.yaw) * cosPitch,
        ];
      }
    } else {
      // Extract camera position and forward direction from scene's primary camera
      const primaryCamera = this.config.scene.primaryCamera;
      if (primaryCamera) {
        const transform = primaryCamera.transform;
        cameraPosition = transform.getWorldPosition();
        forward = transform.getForward([0, 0, -1]);
      }
    }
```

**Problemy:**
- Używa type assertion (`as unknown as`) - kruche i niebezpieczne
- Fallback do domyślnych wartości `[0, 2, 5]` może być mylący
- Ręczne obliczanie forward vector z yaw/pitch jest podatne na błędy
- Brak walidacji czy kamera istnieje

**Rekomendacja:** Stworzyć dedykowaną funkcję helper do pobierania informacji o kamerze lub użyć istniejącego API.

#### 2.3. Wyszukiwanie terrain entity - nieefektywne

```333:360:apps/editor/src/editor/terrain/controllers/TerrainBuilderController.ts
  private getTerrainEntity(): Entity | null {
    const rootEntities = this.config.scene.rootEntities;
    
    // First, check root entities
    for (const entity of rootEntities) {
      if (entity.hasComponent(TerrainComponent)) {
        return entity;
      }
    }
    
    // If not found in root entities, search recursively through children
    for (const rootEntity of rootEntities) {
      let foundEntity: Entity | null = null;
      
      rootEntity.traverse((entity) => {
        if (entity.hasComponent(TerrainComponent)) {
          foundEntity = entity;
          return false; // Stop traversal once found
        }
      });
      
      if (foundEntity) {
        return foundEntity;
      }
    }
    
    return null;
  }
```

**Problemy:**
- Wyszukiwanie odbywa się przy każdym raycastingu (może być częste)
- Brak cache'owania wyniku
- Jeśli jest wiele terrain entities, zwraca tylko pierwszy (bez możliwości wyboru)

**Rekomendacja:** Cache'ować terrain entity i aktualizować tylko gdy scena się zmienia.

---

### 3. HeightmapTerrainTool

**Lokalizacja:** `apps/editor/src/editor/terrain/tools/HeightmapTerrainTool.ts`

**Odpowiedzialności:**
- Tworzenie heightmap terrain
- Import/export z obrazów
- Operacje globalne (noise, smooth)
- Generowanie mesh z heightmap

**Kluczowe metody:**
- `createTerrain()` - tworzenie nowego terenu
- `generateFromImage()` - generowanie z obrazu
- `exportToImage()` - eksport do obrazu PNG
- `updateTerrainMesh()` - aktualizacja mesh z heightmap
- `applyNoise()` / `applySmooth()` - operacje globalne

**✅ Mocne strony:**
- Kompletna funkcjonalność import/export
- Właściwa walidacja rozdzielczości (power of 2 + 1)
- Używa TerrainMeshGenerator do generowania mesh
- Poprawne zarządzanie danymi w TerrainComponent

**⚠️ Problemy:**

#### 3.1. Walidacja rozdzielczości - może być lepsza

```135:144:apps/editor/src/editor/terrain/tools/HeightmapTerrainTool.ts
    // Use image dimensions or config resolution (whichever is valid power of 2 + 1)
    const imageResolution = Math.min(image.width, image.height);
    const isValidResolution = (n: number): boolean => {
      return n > 1 && ((n - 1) & ((n - 1) - 1)) === 0;
    };

    let resolution = config.resolution ?? imageResolution;
    if (!isValidResolution(resolution)) {
      // Find nearest valid resolution
      resolution = Math.pow(2, Math.floor(Math.log2(resolution))) + 1;
    }
```

**Problemy:**
- Funkcja `isValidResolution` jest zdefiniowana lokalnie (może być użyteczna gdzie indziej)
- Zaokrąglanie w dół może znacznie zmniejszyć rozdzielczość (np. 513 → 257)
- Brak informacji dla użytkownika o zmianie rozdzielczości

**Rekomendacja:** Zaokrąglać do najbliższej poprawnej wartości (w górę lub w dół).

#### 3.2. Brak walidacji przed operacjami

```248:271:apps/editor/src/editor/terrain/tools/HeightmapTerrainTool.ts
  applyNoise(entity: Entity, scale: number, amplitude: number): void {
    const terrainComp = entity.getComponent(TerrainComponent);
    if (!terrainComp || !terrainComp.terrainData.heightmap) {
      return;
    }
    // ... tworzy nowy HeightmapTerrain za każdym razem ...
```

**Problemy:**
- Tworzy nowy `HeightmapTerrain` przy każdej operacji (nieefektywne)
- Brak walidacji parametrów (scale, amplitude, iterations)
- Ciche ignorowanie błędów (return bez komunikatu)

**Rekomendacja:** Dodać walidację i logowanie błędów.

---

### 4. TerrainSculptTool

**Lokalizacja:** `apps/editor/src/editor/terrain/tools/TerrainSculptTool.ts`

**Odpowiedzialności:**
- Interaktywne rzeźbienie terenu
- Operacje pędzla (raise, lower, smooth, flatten, pinch)
- Zarządzanie stanem heightmap podczas edycji
- Commit zmian do TerrainComponent

**Kluczowe metody:**
- `setTerrainEntity()` - ustawianie entity do rzeźbienia
- `sculptAt()` - aplikowanie operacji rzeźbienia
- `commitChanges()` - zapisywanie zmian do komponentu
- Metody prywatne dla każdej operacji (applyRaise, applyLower, etc.)

**✅ Mocne strony:**
- Kompletny zestaw operacji rzeźbienia
- Właściwe zarządzanie stanem (heightmapTerrain jako cache)
- Commit zmian dopiero po zakończeniu operacji
- Używa TerrainBrush do obliczeń falloff

**⚠️ Problemy:**

#### 4.1. Hardkodowany sample spacing

```150:159:apps/editor/src/editor/terrain/tools/TerrainSculptTool.ts
    const brushSize = this.brush.getConfig().size;

    // Get sample points within brush
    const samplePoints = this.brush.getSamplePoints(position, 0.5); // Sample every 0.5 units

    for (const point of samplePoints) {
      const currentHeight = this.heightmapTerrain.getHeightAt(point[0], point[2]);
      const delta = this.brush.calculateHeightDelta(position, point, 'raise', strength);
      const newHeight = currentHeight + delta;

      // Apply height change
      this.heightmapTerrain.setHeightAt(point[0], point[2], newHeight, brushSize * 0.1);
```

**Problemy:**
- `0.5` jest hardkodowane - powinno zależeć od rozdzielczości terenu
- `brushSize * 0.1` dla smooth radius jest hardkodowane
- Może być zbyt gęste dla dużych brush sizes (wydajność)
- Może być zbyt rzadkie dla małych brush sizes (jakość)

**Rekomendacja:** Obliczać sample spacing dynamicznie na podstawie rozdzielczości terenu i rozmiaru pędzla.

#### 4.2. Brak walidacji przed operacjami

```113:139:apps/editor/src/editor/terrain/tools/TerrainSculptTool.ts
  sculptAt(worldPosition: Vec3, config: SculptOperationConfig): void {
    if (!this.isActive || !this.heightmapTerrain) {
      return;
    }

    const { operation, strength, targetHeight } = config;

    switch (operation) {
      case 'raise':
        this.applyRaise(worldPosition, strength);
        break;
      // ...
      case 'flatten':
        if (targetHeight !== undefined) {
          this.applyFlatten(worldPosition, targetHeight, strength);
        }
        break;
```

**Problemy:**
- Brak walidacji czy pozycja jest w zakresie terenu
- Brak walidacji strength (może być ujemna lub bardzo duża)
- Dla 'flatten' - brak fallback jeśli targetHeight nie jest podany

**Rekomendacja:** Dodać walidację parametrów i logowanie błędów.

#### 4.3. CommitChanges nie aktualizuje mesh

```275:293:apps/editor/src/editor/terrain/tools/TerrainSculptTool.ts
  commitChanges(): void {
    if (!this.terrainComponent || !this.heightmapTerrain) {
      return;
    }

    // Export updated heightmap data
    const updatedData = this.heightmapTerrain.exportData();

    // Update component
    if (this.terrainComponent.terrainData.heightmap) {
      this.terrainComponent.terrainData.heightmap.heights = updatedData.heights;
      if (updatedData.minHeight !== undefined) {
        this.terrainComponent.terrainData.heightmap.minHeight = updatedData.minHeight;
      }
      if (updatedData.maxHeight !== undefined) {
        this.terrainComponent.terrainData.heightmap.maxHeight = updatedData.maxHeight;
      }
    }
  }
```

**Problemy:**
- Aktualizuje tylko dane heightmap, ale nie regeneruje mesh
- Mesh jest regenerowany tylko przez HeightmapTerrainTool.updateTerrainMesh()
- Może prowadzić do desynchronizacji między danymi a wizualizacją

**Rekomendacja:** Dodać opcjonalny callback do regeneracji mesh lub wywołać updateTerrainMesh.

---

### 5. TerrainBrush

**Lokalizacja:** `apps/editor/src/editor/terrain/tools/TerrainBrush.ts`

**Odpowiedzialności:**
- Obliczanie falloff pędzla
- Generowanie punktów próbkowania
- Obliczanie efektów operacji (raise, lower, smooth, flatten, pinch)

**Kluczowe metody:**
- `getInfluence()` - obliczanie wpływu pędzla na odległość
- `getSamplePoints()` - generowanie punktów próbkowania
- `calculateHeightDelta()` - obliczanie zmiany wysokości
- `calculateSmoothFactor()` / `calculateFlattenFactor()` / `calculatePinchFactor()` - faktory dla różnych operacji

**✅ Mocne strony:**
- Czysta implementacja falloff (linear, smooth, spherical)
- Wsparcie dla custom falloff curve
- Efektywne generowanie punktów próbkowania
- Dobrze zdefiniowane typy

**⚠️ Problemy:**

#### 5.1. Brak walidacji konfiguracji

```40:47:apps/editor/src/editor/terrain/tools/TerrainBrush.ts
  constructor(config: Partial<BrushConfig> = {}) {
    this.config = {
      size: 5.0,
      intensity: 1.0,
      falloff: 'smooth',
      ...config,
    };
  }
```

**Problemy:**
- Brak walidacji czy size > 0
- Brak walidacji czy intensity jest w zakresie [0, 1]
- Można ustawić nieprawidłowe wartości

**Rekomendacja:** Dodać walidację w konstruktorze i updateConfig.

#### 5.2. getSamplePoints może generować za dużo punktów

```163:184:apps/editor/src/editor/terrain/tools/TerrainBrush.ts
  getSamplePoints(center: Vec3, sampleSpacing: number): Vec3[] {
    const { size } = this.config;
    const points: Vec3[] = [];

    const steps = Math.ceil((size * 2) / sampleSpacing);
    const halfSteps = Math.floor(steps / 2);

    for (let z = -halfSteps; z <= halfSteps; z++) {
      for (let x = -halfSteps; x <= halfSteps; x++) {
        const worldX = center[0] + x * sampleSpacing;
        const worldZ = center[2] + z * sampleSpacing;
        const point: Vec3 = [worldX, center[1], worldZ];

        const distance = distanceVec3(center, point);
        if (distance <= size) {
          points.push(point);
        }
      }
    }

    return points;
  }
```

**Problemy:**
- Dla dużego brush size (np. 20) i małego sampleSpacing (0.5) generuje ~5000 punktów
- Każdy punkt wymaga obliczeń w pętli rzeźbienia
- Może być wolne dla dużych pędzli

**Rekomendacja:** Dodać limit punktów lub użyć bardziej efektywnego algorytmu próbkowania.

---

### 6. TerrainPanel

**Lokalizacja:** `apps/editor/src/editor/terrain/ui/TerrainPanel.ts`

**Odpowiedzialności:**
- UI dla terrain buildera
- Formularze tworzenia terenu
- Kontrolki pędzla
- Przyciski operacji rzeźbienia
- Import/export

**✅ Mocne strony:**
- Kompletny interfejs użytkownika
- Wszystkie funkcje są dostępne przez UI
- Właściwe użycie event listenerów

**⚠️ Problemy:**

#### 6.1. Brak walidacji inputu

```142:155:apps/editor/src/editor/terrain/ui/TerrainPanel.ts
    createButton.addEventListener('click', () => {
      const resolution = parseInt(resolutionSelect.value, 10);
      const size = parseFloat(sizeInput.value);

      const entity = this.config.terrainStudio.createHeightmapTerrain({
        resolution,
        size,
        minHeight: 0,
        maxHeight: 100,
      });

      this.setCurrentTerrain(entity);
      this.config.onTerrainCreated?.(entity);
    });
```

**Problemy:**
- Brak walidacji czy resolution jest poprawne (power of 2 + 1)
- Brak walidacji czy size > 0
- Brak obsługi błędów (co jeśli createHeightmapTerrain rzuci wyjątek?)

**Rekomendacja:** Dodać walidację i obsługę błędów.

#### 6.2. Hardkodowane wartości

```214:220:apps/editor/src/editor/terrain/ui/TerrainPanel.ts
    noiseButton.addEventListener('click', () => {
      if (!this.currentEntity) return;

      const scale = 5;
      const amplitude = 10;
      this.config.terrainStudio.applyNoise(this.currentEntity, scale, amplitude);
    });
```

**Problemy:**
- Scale i amplitude są hardkodowane
- Użytkownik nie może ich zmienić
- Podobnie dla smooth (iterations = 1)

**Rekomendacja:** Dodać inputy dla tych parametrów.

#### 6.3. Type assertion w setBrushOperation

```374:374:apps/editor/src/editor/terrain/ui/TerrainPanel.ts
        this.config.terrainStudio.setBrushOperation(op.key as any);
```

**Problemy:**
- Używa `as any` - omija type checking
- Może prowadzić do błędów runtime

**Rekomendacja:** Poprawić typy lub użyć type guard.

---

## 🔍 Analiza jakości kodu

### Zgodność z konwencjami projektu

✅ **Import Policy:**
- Wszystkie importy używają `@engine/*` aliases
- Brak relative paths do packages

✅ **Package Boundaries:**
- Kod należy do `apps/editor` (editor-specific)
- Używa pakietów engine'a poprawnie
- Brak circular dependencies

✅ **Code Style:**
- TypeScript strict mode
- Funkcje są małe i skupione
- Używa async/await
- Destructuring gdzie odpowiednie

⚠️ **TypeScript:**
- Kilka użyć `any` (TerrainPanel.ts:374)
- Type assertions (`as unknown as`) w TerrainBuilderController
- Brak explicit types dla niektórych publicznych API

✅ **Resource Management:**
- Wszystkie klasy mają `dispose()` metody
- AbortController używany do czyszczenia event listenerów
- Proper cleanup w EditorUI

### Testy

**Obecne testy:**
- `TerrainBrush.test.ts` - testy dla TerrainBrush

**Brakujące testy:**
- TerrainBuilderStudio
- TerrainBuilderController
- HeightmapTerrainTool
- TerrainSculptTool
- TerrainPanel

**Rekomendacja:** Dodać testy jednostkowe dla wszystkich komponentów, szczególnie:
- Raycasting logic
- Operacje rzeźbienia
- Import/export obrazów
- Walidacja rozdzielczości

### Wydajność

**Potencjalne problemy wydajnościowe:**

1. **Raycasting przy każdym mousemove** - może być częste (60+ razy/sekundę)
2. **getTerrainEntity() przy każdym raycastingu** - przeszukiwanie wszystkich entities
3. **getSamplePoints() dla dużych brush sizes** - może generować tysiące punktów
4. **Tworzenie nowego HeightmapTerrain przy każdej operacji** - w HeightmapTerrainTool
5. **Brak cache'owania mesh** - mesh jest regenerowany za każdym razem

**Rekomendacja:** 
- Cache'ować terrain entity
- Optymalizować raycasting (użyć dedykowanego systemu)
- Ograniczyć liczbę punktów próbkowania dla dużych pędzli
- Reużywać HeightmapTerrain instances
- Cache'ować mesh i aktualizować tylko zmienione regiony

---

## ⚠️ Problemy i ograniczenia

### Krytyczne

1. **Raycasting nie uwzględnia transformacji entity**
   - Teren musi być w pozycji [0, 0, 0]
   - Nie działa dla terenu z rotacją lub skalą
   - Nie działa dla wielu terrain entities

2. **Brak walidacji inputu**
   - Można utworzyć teren z nieprawidłową rozdzielczością
   - Brak obsługi błędów w UI

3. **CommitChanges nie aktualizuje mesh**
   - Mesh może być desynchronizowany z danymi
   - Wymaga ręcznego wywołania updateTerrainMesh

### Ważne

4. **Nieefektywne wyszukiwanie terrain entity**
   - Przeszukiwanie przy każdym raycastingu
   - Brak cache'owania

5. **Hardkodowane wartości**
   - Sample spacing (0.5)
   - Smooth radius (brushSize * 0.1)
   - FOV (45 stopni)
   - Parametry noise/smooth w UI

6. **Brak testów**
   - Tylko TerrainBrush ma testy
   - Brak testów dla głównych komponentów

### Mniejsze

7. **Type assertions i `any`**
   - Użycie `as unknown as` w TerrainBuilderController
   - `as any` w TerrainPanel

8. **Brak dokumentacji**
   - Brak JSDoc dla niektórych metod
   - Brak przykładów użycia

9. **Brak obsługi wielu terrain entities**
   - Zwraca tylko pierwszy znaleziony
   - Brak możliwości wyboru

---

## 💡 Rekomendacje

### Priorytet 1 (Krytyczne)

1. **Naprawić raycasting**
   - Użyć dedykowanego systemu raycastingu z engine'a
   - Uwzględnić transformacje entity
   - Użyć rzeczywistego FOV kamery

2. **Dodać walidację inputu**
   - Walidacja rozdzielczości (power of 2 + 1)
   - Walidacja parametrów pędzla
   - Obsługa błędów w UI

3. **Naprawić commitChanges**
   - Automatyczna regeneracja mesh po commit
   - Lub callback do HeightmapTerrainTool

### Priorytet 2 (Ważne)

4. **Optymalizacja wydajności**
   - Cache'owanie terrain entity
   - Optymalizacja getSamplePoints
   - Reużycie HeightmapTerrain instances
   - Cache'owanie mesh z aktualizacją regionów

5. **Dodać testy**
   - Testy jednostkowe dla wszystkich komponentów
   - Testy integracyjne dla workflow
   - Testy wydajnościowe dla dużych terenów

6. **Usunąć hardkodowane wartości**
   - Konfigurowalny sample spacing
   - Konfigurowalne parametry noise/smooth
   - Użycie rzeczywistego FOV kamery

### Priorytet 3 (Ulepszenia)

7. **Poprawić typy**
   - Usunąć `as any` i type assertions
   - Dodać explicit types dla publicznych API
   - Stworzyć dedykowane typy dla camera info

8. **Dodać dokumentację**
   - JSDoc dla wszystkich publicznych metod
   - Przykłady użycia
   - Diagramy architektury

9. **Wsparcie dla wielu terrain entities**
   - Wybór aktywnego terenu
   - Wizualizacja aktywnego terenu
   - Raycasting do konkretnego terenu

10. **Dodatkowe funkcje**
    - Undo/redo dla operacji rzeźbienia
    - Wizualizacja pędzla (preview na terenie)
    - Symetryczne rzeźbienie
    - Masek terenu (paintable areas)
    - LOD dla dużych terenów

---

## 📦 Zależności

### Zewnętrzne (Engine)

- `@engine/world` - Scene, Entity, TerrainComponent, MeshComponent
- `@engine/core` - Vec3, math utilities
- `@engine/camera` - OrbitControls, CameraDirector
- `@engine/voxel/terrain` - HeightmapTerrain, TerrainMeshGenerator

### Wewnętrzne (Editor)

- `EditorState` - stan edytora
- `Logger` - logowanie

### Brakujące zależności

- System raycastingu (powinien być w `@engine/world` lub `@engine/core`)
- Dedykowane API do pobierania informacji o kamerze

---

## 📊 Metryki

**Linie kodu:**
- TerrainBuilderStudio: ~157 linii
- TerrainBuilderController: ~390 linii
- HeightmapTerrainTool: ~309 linii
- TerrainSculptTool: ~313 linii
- TerrainBrush: ~195 linii
- TerrainPanel: ~505 linii
- **Razem: ~1869 linii**

**Pokrycie testami:**
- TerrainBrush: ✅ (testy obecne)
- Pozostałe: ❌ (brak testów)
- **Szacowane pokrycie: ~10%**

**Złożoność cyklomatyczna:**
- TerrainBuilderController.raycastToTerrain: ~15 (wysoka)
- TerrainSculptTool.sculptAt: ~5 (średnia)
- Pozostałe metody: ~1-3 (niska)

---

## ✅ Podsumowanie

Terrain Builder jest **dobrze zaprojektowanym modułem** z czystą architekturą i separacją odpowiedzialności. Główne problemy dotyczą:

1. **Raycastingu** - uproszczony i nieprecyzyjny
2. **Wydajności** - kilka miejsc do optymalizacji
3. **Testów** - brak testów dla większości komponentów
4. **Walidacji** - brak walidacji inputu i obsługi błędów

Moduł jest **funkcjonalny i użyteczny**, ale wymaga poprawek w krytycznych obszarach przed użyciem w produkcji.

**Ocena ogólna: 7/10**
- Architektura: 9/10
- Funkcjonalność: 8/10
- Jakość kodu: 7/10
- Testy: 2/10
- Wydajność: 6/10
- Dokumentacja: 5/10


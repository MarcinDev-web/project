# Analiza Avatar Builder - UGC 3D Platform

**Data analizy:** 2025-01-27  
**Wersja:** Production  
**Lokalizacja:** `apps/platform/src/components/avatar-builder/`

---

## Spis Treści

1. [Przegląd Architektury](#1-przegląd-architektury)
2. [Struktura Komponentów](#2-struktura-komponentów)
3. [Flow Użytkownika](#3-flow-użytkownika)
4. [Integracja z Silnikiem](#4-integracja-z-silnikiem)
5. [Zarządzanie Stanem](#5-zarządzanie-stanem)
6. [API i Persystencja](#6-api-i-persystencja)
7. [Problemy i Ograniczenia](#7-problemy-i-ograniczenia)
8. [Performance](#8-performance)
9. [UX i UI](#9-ux-i-ui)
10. [Rekomendacje](#10-rekomendacje)

---

## 1. Przegląd Architektury

### 1.1 Model Architektoniczny

Avatar Builder to **React-based UI** zintegrowany z **WebGPU game engine**:

```
┌─────────────────────────────────────────────────────────────┐
│              REACT UI LAYER                                  │
│  AvatarBuilderStudioPage                                     │
│    ├─ AvatarCustomizationPanel (sidebar)                    │
│    │   ├─ PartSelector                                       │
│    │   ├─ ColorPicker                                        │
│    │   ├─ MaterialSelector                                   │
│    │   └─ AvatarPreviewControls                             │
│    └─ AvatarBuilderViewport (canvas)                        │
│        └─ AvatarBuilderCore (engine bridge)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ENGINE LAYER                                    │
│  AvatarBuilderCore                                           │
│    ├─ Scene (world)                                          │
│    ├─ Renderer (WebGPU)                                      │
│    ├─ OrbitControls (camera)                                 │
│    └─ AvatarInstance (avatar)                                │
└──────────────────────────────────────────────────────────────┘
```

**Kluczowe cechy:**
- **Separation of concerns** - React UI oddzielony od logiki silnika
- **Unidirectional data flow** - loadout state w React, aplikowany do silnika
- **Lifecycle management** - proper cleanup przy unmount
- **Error handling** - graceful degradation przy błędach WebGPU

### 1.2 Hierarchia Komponentów

```
AvatarBuilderStudioPage (container)
├─ State management (loadout, validation, saving)
├─ API integration (load/save)
├─ AvatarCustomizationPanel (sidebar)
│   ├─ PartSelector
│   ├─ ColorPicker
│   ├─ MaterialSelector
│   └─ AvatarPreviewControls
└─ AvatarBuilderViewport (canvas)
    └─ AvatarBuilderCore (engine)
        ├─ Scene
        ├─ Renderer
        ├─ OrbitControls
        └─ AvatarInstance
```

---

## 2. Struktura Komponentów

### 2.1 AvatarBuilderStudioPage (162 linie)

**Odpowiedzialności:**
1. **State management** - loadout, loading, saving, validation errors
2. **API integration** - load/save loadoutów z serwera
3. **Migration** - migracja starych wersji loadoutów
4. **Layout** - container dla sidebar + viewport

**Kluczowe metody:**
```typescript
handleLoadoutChange(newLoadout)  // Update state + validate
handleSave()                     // Save to server + validate
handleReset()                     // Reset to default
```

**Flow inicjalizacji:**
1. Load saved loadout z API (jeśli istnieje)
2. Migrate loadout do aktualnej wersji
3. Validate loadout
4. Pass do AvatarBuilderViewport

**Problemy:**
- ⚠️ **Brak debounce** dla `handleLoadoutChange` - każda zmiana triggeruje walidację
- ⚠️ **Brak optimistic updates** - save czeka na response z serwera
- ✅ **Dobra obsługa błędów** - graceful fallback do default loadout

### 2.2 AvatarBuilderCore (556 linii)

**Odpowiedzialności:**
1. **Engine lifecycle** - inicjalizacja WebGPU, Scene, Renderer
2. **Avatar management** - tworzenie i aktualizacja AvatarInstance
3. **Material resolution** - integracja z MaterialCatalogService
4. **Loadout operations** - apply, serialize, validate
5. **Camera controls** - OrbitControls management
6. **Animation playback** - play/stop/reset animacji

**Kluczowe metody:**
```typescript
async initialize()                    // Init WebGPU + start loop
applyLoadout(loadout, silent?)         // Apply loadout to avatar
getCurrentLoadout()                   // Serialize current state
validateLoadout(loadout)               // Validate against library
playAnimation(animation)               // Play animation
setSlotColor(slot, colorSlot, color)  // Update color
setSlotMesh(slot, meshId)              // Update mesh
setSlotMaterial(slot, materialId)     // Update material
```

**Problemy:**
- ⚠️ **Duża klasa** (556 linii) - wiele odpowiedzialności
- ⚠️ **Brak error recovery** - jeśli WebGPU init failuje, brak retry
- ✅ **Dobra separacja** - material resolver wydzielony
- ✅ **Proper cleanup** - dispose() czyści wszystkie zasoby

### 2.3 AvatarBuilderViewport (197 linii)

**Odpowiedzialności:**
1. **Canvas management** - ref do canvas elementu
2. **Core lifecycle** - tworzenie i cleanup AvatarBuilderCore
3. **Loadout sync** - synchronizacja loadout z parent state
4. **Error display** - wyświetlanie błędów WebGPU

**Kluczowe features:**
- **Prevents infinite loops** - używa `lastLoadoutRef` do porównywania
- **Silent updates** - `applyLoadout(loadout, true)` nie triggeruje callback
- **Error handling** - graceful error display z instrukcjami

**Problemy:**
- ⚠️ **Deep equality check** - używa `JSON.stringify` (może być wolne dla dużych loadoutów)
- ✅ **Dobra obsługa błędów** - szczegółowe komunikaty dla użytkownika

### 2.4 AvatarCustomizationPanel (212 linii)

**Odpowiedzialności:**
1. **UI orchestration** - zarządzanie zakładkami (parts/colors/materials)
2. **Slot selection** - wybór części ciała do edycji
3. **Event handling** - delegacja do odpowiednich komponentów
4. **Validation display** - wyświetlanie błędów walidacji

**Struktura UI:**
```
Header (title + actions)
├─ Validation errors (if any)
├─ Reset/Save buttons
Tabs (Parts / Colors / Materials)
Content
├─ Slot selector (dropdown)
├─ PartSelector / ColorPicker / MaterialSelector (based on tab)
└─ Preview controls
```

**Problemy:**
- ⚠️ **Brak preview thumbnails** - tylko dropdown z nazwami
- ⚠️ **Brak undo/redo** - brak historii zmian
- ✅ **Czytelny layout** - dobrze zorganizowane zakładki

### 2.5 PartSelector (90 linii)

**Odpowiedzialności:**
1. **Part listing** - wyświetlanie dostępnych części dla slotu
2. **Selection** - wybór meshy z dropdown
3. **Library integration** - używa DEFAULT_AVATAR_PART_LIBRARY

**Features:**
- ✅ **Dynamic listing** - automatycznie znajduje części dla slotu
- ✅ **Sortowanie** - alfabetyczne sortowanie po displayName
- ⚠️ **Brak preview** - tylko tekstowe nazwy

**Problemy:**
- ⚠️ **Brak kategorii** - wszystkie części w jednym dropdown
- ⚠️ **Brak wyszukiwania** - przy wielu częściach może być problematyczne

### 2.6 ColorPicker (108 linii)

**Odpowiedzialności:**
1. **Color slots** - wyświetlanie dostępnych color slots dla części
2. **Color input** - hex input + native color picker
3. **Color resolution** - automatyczne wykrywanie color slots z definicji

**Features:**
- ✅ **Dynamic color slots** - automatycznie wykrywa z part definition
- ✅ **Dual input** - hex text + color picker
- ⚠️ **Brak presets** - brak gotowych palet kolorów

**Problemy:**
- ⚠️ **Brak RGB sliders** - tylko hex input
- ⚠️ **Brak color history** - brak ostatnio używanych kolorów

### 2.7 MaterialSelector (55 linii)

**Odpowiedzialności:**
1. **Material selection** - wybór materiału z dropdown
2. **Material catalog** - integracja z MaterialCatalogService
3. **Fallback** - domyślna lista jeśli brak catalog

**Features:**
- ✅ **Catalog integration** - używa MaterialCatalogService
- ⚠️ **Brak preview** - tylko tekstowe nazwy
- ⚠️ **Brak kategorii** - wszystkie materiały w jednym dropdown

**Problemy:**
- ⚠️ **Brak wizualizacji** - użytkownik nie widzi jak materiał wygląda
- ⚠️ **Brak filtrowania** - brak kategorii (metal, fabric, etc.)

### 2.8 MaterialCatalogService (265 linii)

**Odpowiedzialności:**
1. **Material registry** - centralny katalog materiałów
2. **Material resolution** - mapowanie string ID → AvatarMaterialBinding
3. **Metadata** - kategorie, opisy, właściwości (metallic, roughness)

**Features:**
- ✅ **15 domyślnych materiałów** - stone, wood, metal, glass, etc.
- ✅ **Kategorie** - basic, metal, fabric, stone, wood, special
- ✅ **Search** - wyszukiwanie po nazwie/opisie
- ✅ **Atlas mapping** - mapowanie do texture atlas (0-15)

**Problemy:**
- ⚠️ **Hardcoded materials** - brak możliwości dodania custom materiałów
- ⚠️ **Brak preview textures** - brak miniatur tekstur

### 2.9 AvatarLoadoutMigrator (147 linii)

**Odpowiedzialności:**
1. **Version management** - zarządzanie wersjami loadoutów
2. **Migration logic** - migracja między wersjami
3. **Normalization** - normalizacja struktury loadoutu

**Features:**
- ✅ **Current version: 2** - wsparcie dla v1 i v2
- ✅ **Step-by-step migration** - migracja przez wszystkie wersje
- ✅ **Backward compatibility** - zachowuje `mat` field dla kompatybilności

**Migration v1 → v2:**
- Normalizacja `material` field (preferuje `material` nad `mat`)
- Zachowuje `mat` dla backward compatibility

---

## 3. Flow Użytkownika

### 3.1 Inicjalizacja

```
1. User opens /avatar-builder
   ↓
2. AvatarBuilderStudioPage mounts
   ↓
3. Load saved loadout from API (if exists)
   ↓
4. Migrate loadout to current version
   ↓
5. Initialize AvatarBuilderViewport
   ↓
6. AvatarBuilderCore.initialize()
   ├─ Check WebGPU support
   ├─ Init renderer
   ├─ Create Scene + AvatarInstance
   ├─ Setup lighting
   └─ Start render loop
   ↓
7. Apply initial loadout
   ↓
8. Start idle animation
   ↓
9. Ready for customization
```

### 3.2 Customizacja Części

```
1. User selects slot from dropdown
   ↓
2. AvatarCustomizationPanel updates selectedSlot state
   ↓
3. PartSelector shows available parts for slot
   ↓
4. User selects mesh from dropdown
   ↓
5. handleMeshChange() called
   ↓
6. Update loadout state in AvatarBuilderStudioPage
   ↓
7. handleLoadoutChange() triggered
   ├─ Validate loadout
   ├─ Update validation errors
   └─ Pass to AvatarBuilderViewport
   ↓
8. AvatarBuilderViewport applies loadout (silent)
   ↓
9. AvatarBuilderCore.applyLoadout()
   ↓
10. AvatarInstance.applyLoadout()
    ├─ Unmount old part
    ├─ Mount new part
    └─ Update colors/materials
   ↓
11. Renderer updates (next frame)
   ↓
12. User sees updated avatar
```

### 3.3 Zmiana Koloru

```
1. User selects Colors tab
   ↓
2. ColorPicker shows color slots for selected part
   ↓
3. User changes color (hex input or color picker)
   ↓
4. handleColorChange() called
   ↓
5. Update loadout state
   ↓
6. Apply to avatar (same flow as parts)
```

### 3.4 Zapisywanie

```
1. User clicks Save button
   ↓
2. handleSave() called
   ↓
3. Validate loadout (if errors → show warning, return)
   ↓
4. Set isSaving = true
   ↓
5. Call profilesApi.saveAvatarLoadout()
   ↓
6. Wait for API response
   ↓
7. On success:
   ├─ Show success toast
   └─ Clear validation errors
   ↓
8. On error:
   ├─ Show error toast
   └─ Log error
   ↓
9. Set isSaving = false
```

---

## 4. Integracja z Silnikiem

### 4.1 AvatarInstance Integration

**AvatarBuilderCore używa AvatarInstance:**

```typescript
this.avatar = new AvatarInstance(avatarRoot, {
  name: 'BuilderAvatar',
  loadout,
  materialResolver: this.materialResolver,
});
```

**Operacje:**
- `applyLoadout()` - aplikuje loadout
- `serializeLoadout()` - serializuje aktualny stan
- `playAnimation()` - odtwarza animację
- `update(deltaTime)` - aktualizuje w każdym framie

**Synchronizacja:**
- Loadout changes → `applyLoadout()` → AvatarInstance
- AvatarInstance changes → `serializeLoadout()` → React state (via callback)

### 4.2 Renderer Integration

**WebGPU Renderer:**
```typescript
this.renderer = await initRenderer({
  canvas: this.canvas,
  scene: this.scene,
  getOrbitState: () => this.controls.getState(),
  onFrameUpdate: (deltaTime) => {
    if (this.avatar) {
      this.avatar.update(deltaTime);
    }
  },
});
```

**Features:**
- ✅ **Shadows enabled** - shadowQuality: 'med'
- ✅ **Orbit controls** - integrated z rendererem
- ✅ **Frame updates** - avatar.update() w każdym framie

### 4.3 Material Resolution

**MaterialCatalogService → AvatarMaterialResolver:**

```typescript
private createMaterialResolver(): AvatarMaterialResolver {
  return materialCatalogService.getResolver();
}
```

**Flow:**
1. Loadout zawiera `material: "mat_metal"`
2. AvatarInstance.applyLoadout() → AvatarMaterialManager
3. MaterialManager.resolveMaterialBinding("mat_metal")
4. MaterialCatalogService.resolveMaterial("mat_metal")
5. Returns `{ materialId: 3, metallic: 0.6, roughness: 0.25 }`
6. Applied to MaterialComponent

---

## 5. Zarządzanie Stanem

### 5.1 State Structure

**AvatarBuilderStudioPage state:**
```typescript
const [loadout, setLoadout] = useState<AvatarLoadout>(DEFAULT_AVATAR_LOADOUT);
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
const [builderCore, setBuilderCore] = useState<AvatarBuilderCore | null>(null);
const [validationErrors, setValidationErrors] = useState<string[]>([]);
```

**AvatarCustomizationPanel state:**
```typescript
const [selectedSlot, setSelectedSlot] = useState<AvatarSlot | null>(null);
const [activeTab, setActiveTab] = useState<'parts' | 'colors' | 'materials'>('parts');
```

### 5.2 State Flow

**Unidirectional:**
```
React State (loadout)
    ↓
handleLoadoutChange()
    ↓
Update state + validate
    ↓
Pass to AvatarBuilderViewport (prop)
    ↓
AvatarBuilderCore.applyLoadout()
    ↓
AvatarInstance.applyLoadout()
    ↓
Renderer updates
```

**Bidirectional (via callback):**
```
AvatarBuilderCore.applyLoadout()
    ↓
notifyLoadoutChange() (if not silent)
    ↓
onLoadoutChange callback
    ↓
handleLoadoutChange() in parent
    ↓
Update React state
```

**Problem:** Może powodować infinite loops jeśli nie używa `silent` flag.

**Rozwiązanie:** `AvatarBuilderViewport` używa `lastLoadoutRef` do porównywania i `silent` flag.

### 5.3 Validation State

**Validation flow:**
1. Loadout changes → `validateLoadout()` called
2. Validation errors stored in state
3. Displayed in UI (red box above Save button)
4. Save button disabled if errors exist

**Validation timing:**
- ✅ On loadout change
- ✅ Before save
- ⚠️ **Brak debounce** - może być kosztowne przy szybkich zmianach

---

## 6. API i Persystencja

### 6.1 API Endpoints

**Save loadout:**
```typescript
PUT /users/:userId/avatar-loadout
Body: AvatarLoadoutData (JSON)
```

**Load loadout:**
```typescript
GET /users/:userId/avatar-loadout
Response: AvatarLoadoutData | 404 (if not exists)
```

### 6.2 Data Conversion

**Engine format → API format:**
```typescript
AvatarLoadout (engine)
  ↓ loadoutToData()
AvatarLoadoutData (JSON)
  ↓ API call
Server storage
```

**API format → Engine format:**
```typescript
Server storage
  ↓ API response
AvatarLoadoutData (JSON)
  ↓ dataToLoadout()
AvatarLoadout (engine)
```

**Fields:**
- `version` - wersja loadoutu
- `parts` - Record<slot, { mesh, material?, colors? }>

### 6.3 Error Handling

**Load errors:**
- ✅ **404 handled gracefully** - używa default loadout
- ✅ **Network errors** - fallback do default + warning toast
- ⚠️ **Brak retry logic** - jeśli API failuje, brak automatycznego retry

**Save errors:**
- ✅ **Validation errors** - blokuje save, pokazuje błędy
- ✅ **Network errors** - error toast
- ⚠️ **Brak offline support** - brak cache dla offline editing

---

## 7. Problemy i Ograniczenia

### 7.1 Krytyczne Problemy

#### 7.1.1 Brak Undo/Redo
**Problem:** Użytkownik nie może cofnąć zmian.

**Impact:** Wysokie - frustrujące dla użytkownika.

**Rozwiązanie:**
```typescript
const [history, setHistory] = useState<AvatarLoadout[]>([]);
const [historyIndex, setHistoryIndex] = useState(-1);

const pushToHistory = (loadout: AvatarLoadout) => {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(loadout);
  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
};
```

#### 7.1.2 Brak Preview Thumbnails
**Problem:** Użytkownik nie widzi jak część wygląda przed wyborem.

**Impact:** Średnie - utrudnia wybór części.

**Rozwiązanie:** Render miniaturki dla każdej części w PartSelector.

#### 7.1.3 Brak Debounce dla Walidacji
**Problem:** Każda zmiana triggeruje pełną walidację.

**Impact:** Średnie - może być wolne przy szybkich zmianach.

**Rozwiązanie:**
```typescript
const debouncedValidate = useMemo(
  () => debounce((loadout: AvatarLoadout) => {
    if (builderCore) {
      const validation = builderCore.validateLoadout(loadout);
      setValidationErrors(validation.valid ? [] : [...validation.errors]);
    }
  }, 300),
  [builderCore]
);
```

### 7.2 Problemy UX

#### 7.2.1 Brak Kategorii w PartSelector
**Problem:** Wszystkie części w jednym dropdown - trudne do nawigacji.

**Rozwiązanie:** Grupowanie po kategoriach (core, cosmetic, equipment).

#### 7.2.2 Brak Wyszukiwania
**Problem:** Przy wielu częściach trudno znaleźć konkretną.

**Rozwiązanie:** Search input w PartSelector.

#### 7.2.3 Brak RGB Sliders w ColorPicker
**Problem:** Tylko hex input - mniej intuicyjne.

**Rozwiązanie:** Dodaj RGB/HSV sliders.

#### 7.2.4 Brak Material Preview
**Problem:** Użytkownik nie widzi jak materiał wygląda.

**Rozwiązanie:** Render miniaturki materiału lub preview sphere.

### 7.3 Problemy Techniczne

#### 7.3.1 Deep Equality Check
**Problem:** `JSON.stringify` dla porównywania loadoutów może być wolne.

**Rozwiązanie:** Użyj shallow comparison lub custom deep equal.

#### 7.3.2 Brak Error Recovery
**Problem:** Jeśli WebGPU init failuje, brak retry.

**Rozwiązanie:** Dodaj retry button w error display.

#### 7.3.3 Brak Optimistic Updates
**Problem:** Save czeka na response - brak immediate feedback.

**Rozwiązanie:** Optimistic update + rollback on error.

---

## 8. Performance

### 8.1 Render Performance

**Frame budget:**
- Avatar update: ~0.05-0.1ms per frame
- Render: ~16ms per frame (60 FPS target)
- **Total: ~16.1ms** - dobrze w budżecie

**Optimizations:**
- ✅ **Lazy updates** - avatar.update() tylko gdy potrzeba
- ✅ **Dirty tracking** - skeleton sync tylko dirty joints
- ⚠️ **Brak batching** - każda część = osobny draw call

### 8.2 State Update Performance

**Validation cost:**
- `validateLoadout()` - O(n) gdzie n = liczba części w loadout
- Wywoływane przy każdej zmianie (bez debounce)
- **Impact:** Niski dla małych loadoutów, średni dla dużych

**Loadout comparison:**
- `JSON.stringify()` - O(n) gdzie n = rozmiar loadout
- Wywoływane przy każdej zmianie prop
- **Impact:** Niski dla małych loadoutów

### 8.3 Memory Footprint

**Per avatar builder instance:**
- Scene: ~50 KB
- AvatarInstance: ~15 KB
- Renderer: ~500 KB (WebGPU context)
- React state: ~5 KB
- **Total: ~570 KB** - akceptowalne

---

## 9. UX i UI

### 9.1 Layout

**Obecny layout:**
```
┌─────────────────────────────────────────┐
│ Sidebar (400px) │ Viewport (flex)       │
│                 │                        │
│ Customization   │ 3D Avatar Preview     │
│ Panel           │                        │
│                 │                        │
│ - Parts         │ Orbit Controls         │
│ - Colors        │ (drag/scroll)          │
│ - Materials     │                        │
│                 │                        │
│ Preview         │                        │
│ Controls        │                        │
└─────────────────────────────────────────┘
```

**Ocena:**
- ✅ **Czytelny layout** - sidebar + viewport
- ✅ **Responsive** - sidebar ma min/max width
- ⚠️ **Brak mobile support** - fixed layout nie działa na mobile

### 9.2 Interakcje

**Obecne interakcje:**
- ✅ **Drag to rotate** - orbit controls
- ✅ **Scroll to zoom** - orbit controls
- ✅ **Dropdown selection** - parts/materials
- ✅ **Color picker** - native + hex input
- ⚠️ **Brak keyboard shortcuts** - brak undo (Ctrl+Z), reset (R), etc.

### 9.3 Feedback

**Obecny feedback:**
- ✅ **Validation errors** - czerwony box z błędami
- ✅ **Save status** - "Saving..." podczas zapisu
- ✅ **Toast notifications** - success/error toasts
- ⚠️ **Brak loading states** - brak skeleton loaders
- ⚠️ **Brak progress indicators** - brak progress bar dla save

---

## 10. Rekomendacje

### 10.1 Krótkoterminowe (P0 - 1-2 tygodnie)

#### 10.1.1 Dodaj Undo/Redo
**Priorytet:** 🔴 **Wysoki**  
**Effort:** 2-3 dni  
**Implementacja:**
- History stack w AvatarBuilderStudioPage
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- UI buttons dla undo/redo

#### 10.1.2 Debounce dla Walidacji
**Priorytet:** 🟡 **Średni**  
**Effort:** 2 godziny  
**Implementacja:**
- `useMemo` + `debounce` dla `validateLoadout`
- Delay: 300ms

#### 10.1.3 Error Recovery
**Priorytet:** 🟡 **Średni**  
**Effort:** 1 dzień  
**Implementacja:**
- Retry button w error display
- Better error messages z instrukcjami

### 10.2 Średnioterminowe (P1 - 1-2 miesiące)

#### 10.2.1 Preview Thumbnails
**Priorytet:** 🟡 **Średni**  
**Effort:** 1 tydzień  
**Implementacja:**
- Render miniaturki dla każdej części
- Cache thumbnails
- Lazy loading

#### 10.2.2 Kategorie i Wyszukiwanie
**Priorytet:** 🟡 **Średni**  
**Effort:** 3-5 dni  
**Implementacja:**
- Kategorie w PartSelector
- Search input z filtrowaniem
- Grouped dropdown

#### 10.2.3 RGB Sliders
**Priorytet:** 🟢 **Niski**  
**Effort:** 2 dni  
**Implementacja:**
- RGB/HSV sliders w ColorPicker
- Sync z hex input

### 10.3 Długoterminowe (P2 - 3+ miesiące)

#### 10.3.1 Material Preview
**Priorytet:** 🟡 **Średni**  
**Effort:** 1-2 tygodnie  
**Implementacja:**
- Preview sphere dla każdego materiału
- Real-time preview w MaterialSelector

#### 10.3.2 Mobile Support
**Priorytet:** 🟢 **Niski**  
**Effort:** 2-3 tygodnie  
**Implementacja:**
- Responsive layout
- Touch controls dla orbit
- Mobile-optimized UI

#### 10.3.3 Preset System
**Priorytet:** 🟢 **Niski**  
**Effort:** 1 tydzień  
**Implementacja:**
- Save/load presets
- Preset gallery
- Share presets

---

## Podsumowanie

### ✅ Co Działa Dobrze

1. **Architektura** - dobrze podzielona na warstwy
2. **Integracja** - płynna integracja z silnikiem
3. **Error handling** - dobra obsługa błędów WebGPU
4. **Validation** - automatyczna walidacja loadoutów
5. **Migration** - wsparcie dla migracji wersji
6. **Material system** - dobrze zintegrowany katalog materiałów

### ❌ Co Wymaga Poprawy

1. **UX** - brak undo/redo, preview thumbnails
2. **Performance** - brak debounce dla walidacji
3. **Error recovery** - brak retry dla błędów WebGPU
4. **Mobile** - brak wsparcia dla mobile
5. **Search/filter** - brak wyszukiwania części

### 🎯 Priorytety

**P0 (Krytyczne):**
- Undo/Redo system
- Debounce dla walidacji

**P1 (Wysokie):**
- Preview thumbnails
- Kategorie i wyszukiwanie
- Error recovery

**P2 (Średnie):**
- Material preview
- RGB sliders
- Mobile support

---

**Koniec analizy**


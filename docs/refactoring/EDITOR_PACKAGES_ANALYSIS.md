# Analiza spójności apps/editor z packages

**Data:** 2025-10-26  
**Status:** 🔴 Krytyczne problemy ze spójnością

## Podsumowanie wykonawcze

Aplikacja edytora (`apps/editor/src/`) zawiera znaczące duplikacje kodu i niespójności w relacji do współdzielonych pakietów (`packages/`). Identyfikuję **4 główne kategorie problemów**:

1. **Pełne duplikaty klas** - identyczny kod w dwóch miejscach
2. **Niespójne importy** - editor używa lokalnych kopii zamiast pakietów
3. **Różnice w implementacji** - Logger vs console.log
4. **Słabe wykorzystanie monorepo** - funkcjonalność która powinna być w pakietach

## Szczegółowa analiza problemów

### 🔴 Kategoria 1: Pełne duplikaty kodu

#### 1.1 CameraDirector
**Lokalizacje:**
- `apps/editor/src/editor/camera/CameraDirector.ts` (364 linie)
- `packages/camera/src/CameraDirector.ts` (367 linie)

**Status:** Prawie identyczne (99% zgodności)

**Różnice:**
```typescript
// apps/editor wersja
import { Logger } from '../../utils/logger';
import type { OrbitControls } from '@engine/camera';
Logger.debug(`Camera mode: ${this.currentMode} → ${mode}`);

// packages wersja
// Brak importu Logger
import type { OrbitControls } from './OrbitCamera';
console.debug(`Camera mode: ${this.currentMode} → ${mode}`);
```

**Stałe:**
```typescript
// packages wersja definiuje własne
const FOV_RADIANS = (2 * Math.PI) / 5;
const Z_NEAR = 0.1;
const Z_FAR = 100;

// apps wersja importuje
import { FOV_RADIANS, Z_FAR, Z_NEAR } from '@engine/gfx-webgpu/config';
```

**Rekomendacja:** ❌ Usuń `apps/editor/src/editor/camera/CameraDirector.ts`, używaj `@engine/camera`

---

#### 1.2 FPSCamera
**Lokalizacje:**
- `apps/editor/src/editor/camera/FPSCamera.ts` (184 linie)
- `packages/camera/src/FPSCamera.ts` (185 linie)

**Status:** 100% identyczne

**Rekomendacja:** ❌ Usuń `apps/editor/src/editor/camera/FPSCamera.ts`, używaj `@engine/camera`

---

#### 1.3 AssetImporter
**Lokalizacje:**
- `apps/editor/src/editor/assets/AssetImporter.ts` (51 linie)
- `packages/assets/src/loaders/AssetImporter.ts` (52 linie)

**Status:** 100% identyczne

**Rekomendacja:** ❌ Usuń `apps/editor/src/editor/assets/AssetImporter.ts`, używaj `@engine/assets`

---

#### 1.4 GltfOptimizer
**Lokalizacje:**
- `apps/editor/src/editor/assets/GltfOptimizer.ts` (225 linie)
- `packages/assets/src/loaders/GltfOptimizer.ts` (216 linie)

**Status:** Prawie identyczne

**Różnice:**
```typescript
// apps/editor wersja
import { Logger } from '../../utils/logger';
Logger.warn('GLTF optimization failed:', error as Error);

// packages wersja
console.warn('GLTF optimization failed:', error);
```

**Rekomendacja:** ❌ Usuń wersję edytora, używaj `@engine/assets`

---

### 🟡 Kategoria 2: Częściowe duplikaty z różnicami

#### 2.1 AssetRegistry
**Lokalizacje:**
- `apps/editor/src/editor/assets/AssetRegistry.ts` (689 linii)
- `packages/assets/src/core/AssetRegistry.ts` (688 linii)

**Status:** 95% zgodności

**Kluczowe różnice:**

**Importy:**
```typescript
// apps/editor wersja
import type { BlockDefinition } from '@engine/gfx-webgpu/blocks/BlockLibrary';
import { Logger } from '../../utils/logger';

// packages wersja
export type BlockDefinition = unknown; // placeholder
// brak importu Logger, używa console
```

**Typy metod:**
```typescript
// apps/editor wersja
public registerBlockAsset(block: BlockDefinition, options?: RegisterBlockAssetOptions): Asset

// packages wersja
public registerBlockAsset(
  block: BlockDefinition & { 
    id: string; 
    name: string; 
    category: string; 
    material: string; 
    textures: { top: { color: [number, number, number, number] } } 
  }, 
  options?: RegisterBlockAssetOptions
): Asset
```

**Użycie loggera:**
- Editor: `Logger.debug()`, `Logger.warn()`, `Logger.error()`
- Package: `console.debug()`, `console.warn()`, `console.error()`

**Rekomendacja:** ⚠️ Zrefaktoryzuj - stwórz wspólną wersję z konfiguracją loggera

---

#### 2.2 AssetTypes
**Lokalizacje:**
- `apps/editor/src/editor/assets/AssetTypes.ts` (394 linie)
- `packages/assets/src/core/AssetTypes.ts` (398 linie)

**Status:** 98% zgodności

**Różnice:**
```typescript
// apps/editor wersja
import type { RgbaColor } from '../../utils/colors';
import type { BlockDefinition } from '@engine/gfx-webgpu/blocks/BlockLibrary';

// packages wersja
export type RgbaColor = [number, number, number, number];
export type BlockDefinition = unknown;
```

**Rekomendacja:** ⚠️ Unifikuj - package powinien eksportować właściwe typy

---

### 🔴 Kategoria 3: Niespójne wzorce importów

#### Aktualne użycie w edytorze

**Import lokalny zamiast z pakietów:**
```typescript
// apps/editor/src/editor/managers/EditorModeManager.ts
import type { FPSCamera } from '../camera/FPSCamera';
import { CameraDirector } from '../camera/CameraDirector';
// ❌ Powinno być:
// import { FPSCamera, CameraDirector } from '@engine/camera';

// apps/editor/src/editor/ui/EditorUI.ts
import { FPSCamera } from '../camera/FPSCamera';
// ❌ Powinno być:
// import { FPSCamera } from '@engine/camera';

// apps/editor/src/editor/ui/CatalogPanel.ts
import { assetRegistry } from '../assets/AssetRegistry';
// ❌ Powinno być:
// import { assetRegistry } from '@engine/assets';

// apps/editor/src/editor/assets/AssetBrowser.ts
import { assetRegistry } from './AssetRegistry';
// ❌ Powinno być:
// import { assetRegistry } from '@engine/assets';
```

**Statystyki importów:**
- **75 plików** w `apps/editor/src` importuje z `@engine/*`
- **Wielokrotne pliki** używają lokalnych duplikatów zamiast pakietów
- **230+ eksportów** w `apps/editor/src/editor/` (wiele powinno być w pakietach)

---

### 🟡 Kategoria 4: Problemy z strukturą i odpowiedzialnością

#### Kod który powinien być w pakietach

**Kandydaci do przeniesienia:**

1. **DisposableGroup** (`apps/editor/src/editor/core/DisposableGroup.ts`)
   - Uniwersalny utility pattern
   - Powinno być w `@engine/core/utils`

2. **HistoryManager** (`apps/editor/src/editor/history/HistoryManager.ts`)
   - Generyczny undo/redo system
   - Powinno być w nowym pakiecie `@engine/history` lub `@engine/editor-utils`

3. **SnapSystem** (`apps/editor/src/editor/snap/SnapSystem.ts`)
   - Funkcjonalność snappingu może być używana w innych narzędziach
   - Powinno być w `@engine/editor-utils` lub `@engine/stdlib`

4. **GridRenderer** (`apps/editor/src/editor/grid/GridRenderer.ts`)
   - Grid rendering jest często używany
   - Powinno być w `@engine/gfx-webgpu` lub nowym `@engine/editor-gfx`

5. **Raycaster** (jeśli jest duplikat)
   - Powinien być tylko w `@engine/world`

---

## Analiza zależności pakietów

### Obecnie używane pakiety w edytorze

Zgodnie z `apps/editor/package.json`:

```json
{
  "dependencies": {
    "@engine/core": "workspace:*",
    "@engine/world": "workspace:*",
    "@engine/gfx-webgpu": "workspace:*",
    "@engine/assets": "workspace:*",      // ⚠️ Niedostatecznie używany
    "@engine/script": "workspace:*",
    "@engine/input": "workspace:*",
    "@engine/camera": "workspace:*",      // ⚠️ Niedostatecznie używany
    "@engine/stdlib": "workspace:*"
  }
}
```

### Eksporty pakietów

**@engine/camera:**
```typescript
export * from './OrbitCamera';
export * from './FPSCamera';          // ✅ Dostępne ale nieużywane
export * from './CameraDirector';     // ✅ Dostępne ale nieużywane
```

**@engine/assets:**
```typescript
// core exports
export * from './AssetTypes';         // ⚠️ Częściowo używane
export * from './AssetRegistry';      // ⚠️ Nieużywane (używa lokalna wersja)
export * from './RecentAssetsTracker';

// loaders exports
export * from './AssetImporter';      // ⚠️ Nieużywane (używa lokalna wersja)
export * from './GltfOptimizer';      // ⚠️ Nieużywane (używa lokalna wersja)
```

---

## Mapa problemów

```
apps/editor/src/editor/
├── assets/
│   ├── AssetRegistry.ts          ❌ DUPLIKAT packages/assets/src/core/AssetRegistry.ts
│   ├── AssetTypes.ts             ⚠️ CZĘŚCIOWY DUPLIKAT packages/assets/src/core/AssetTypes.ts
│   ├── AssetImporter.ts          ❌ DUPLIKAT packages/assets/src/loaders/AssetImporter.ts
│   ├── GltfOptimizer.ts          ❌ DUPLIKAT packages/assets/src/loaders/GltfOptimizer.ts
│   └── AssetBrowser.ts           ✅ OK (editor-specific)
│
├── camera/
│   ├── CameraDirector.ts         ❌ DUPLIKAT packages/camera/src/CameraDirector.ts
│   └── FPSCamera.ts              ❌ DUPLIKAT packages/camera/src/FPSCamera.ts
│
├── core/
│   ├── DisposableGroup.ts        ⚠️ KANDYDAT DO @engine/core/utils
│   ├── WorldManager.ts           ✅ OK (editor-specific)
│   ├── PlayModeStateMachine.ts   ✅ OK (editor-specific)
│   └── state.ts                  ✅ OK (editor state)
│
├── history/
│   └── HistoryManager.ts         ⚠️ KANDYDAT DO @engine/history
│
├── snap/
│   └── SnapSystem.ts             ⚠️ KANDYDAT DO @engine/editor-utils
│
├── grid/
│   └── GridRenderer.ts           ⚠️ KANDYDAT DO @engine/gfx-webgpu
│
└── [pozostałe katalogi]          ✅ OK (editor-specific UI/controllers)
```

---

## Wpływ na projekt

### Problemy techniczne

1. **Maintainability** 🔴
   - Zmiany muszą być robione w dwóch miejscach
   - Ryzyko rozsynchronizowania kodu
   - Trudniejsze code reviews

2. **Testing** 🔴
   - Testy duplikują się lub brakuje ich dla niektórych wersji
   - Trudno zapewnić coverage dla obu wersji

3. **Bundle size** 🟡
   - Potencjalne duplikaty w bundlu (zależnie od tree-shaking)
   - Mniejszy problem dzięki workspace links

4. **Developer Experience** 🔴
   - Niejasne gdzie szukać/modyfikować kod
   - Konfuzja przy importach
   - Trudniejszy onboarding

### Długoterminowe ryzyka

- **Refactoring debt** - każda zmiana wymaga synchronizacji
- **Bug propagation** - bugi mogą istnieć w jednej wersji ale nie drugiej
- **Team confusion** - różne członki zespołu mogą modyfikować różne wersje
- **Migration difficulty** - trudniejsze przeniesienie do nowej architektury

---

## Rekomendacje

### Priorytet 1: Usuń oczywiste duplikaty 🔴

**Natychmiastowe akcje:**

1. **Usuń duplikaty camera:**
   ```bash
   rm apps/editor/src/editor/camera/CameraDirector.ts
   rm apps/editor/src/editor/camera/FPSCamera.ts
   ```
   
   Aktualizuj importy:
   ```typescript
   // Zamień wszystkie wystąpienia:
   import { CameraDirector } from '../camera/CameraDirector'
   import { FPSCamera } from '../camera/FPSCamera'
   
   // Na:
   import { CameraDirector, FPSCamera } from '@engine/camera'
   ```

2. **Usuń duplikaty assets:**
   ```bash
   rm apps/editor/src/editor/assets/AssetImporter.ts
   rm apps/editor/src/editor/assets/GltfOptimizer.ts
   ```
   
   Aktualizuj importy:
   ```typescript
   // Zamień:
   import { AssetImporter } from './AssetImporter'
   import { GltfOptimizer } from './GltfOptimizer'
   
   // Na:
   import { AssetImporter, GltfOptimizer } from '@engine/assets'
   ```

**Pliki do zmiany:**
- `apps/editor/src/app.ts`
- `apps/editor/src/editor/managers/EditorModeManager.ts`
- `apps/editor/src/editor/ui/EditorUI.ts`
- `apps/editor/src/editor/states/*.ts` (6 plików)
- `apps/editor/src/editor/assets/AssetBrowser.ts`

---

### Priorytet 2: Zunifikuj AssetRegistry i AssetTypes ⚠️

**Opcja A: Pakiet jako źródło prawdy (preferowane)**

1. Rozszerz `packages/assets/src/core/AssetRegistry.ts`:
   ```typescript
   // Dodaj konfigurowalne logowanie
   export interface AssetRegistryConfig {
     logger?: {
       debug: (msg: string, ...args: unknown[]) => void;
       warn: (msg: string, ...args: unknown[]) => void;
       error: (msg: string, ...args: unknown[]) => void;
     };
   }
   
   export class AssetRegistry {
     private logger: AssetRegistryConfig['logger'];
     
     constructor(config?: AssetRegistryConfig) {
       this.logger = config?.logger ?? {
         debug: console.debug,
         warn: console.warn,
         error: console.error,
       };
     }
   }
   ```

2. W edytorze:
   ```typescript
   import { AssetRegistry } from '@engine/assets';
   import { Logger } from './utils/logger';
   
   export const assetRegistry = new AssetRegistry({
     logger: Logger
   });
   ```

3. Usuń `apps/editor/src/editor/assets/AssetRegistry.ts`

**Opcja B: Editor wersja jako wrapper**

Zachowaj `apps/editor/src/editor/assets/AssetRegistry.ts` jako cienki wrapper:
```typescript
import { AssetRegistry as BaseRegistry } from '@engine/assets';
import { Logger } from '../../utils/logger';

export class AssetRegistry extends BaseRegistry {
  // Override tylko metod z logging
  register(asset: Asset): void {
    Logger.debug('Registering asset:', asset.metadata.id);
    super.register(asset);
  }
}
```

---

### Priorytet 3: Przenieś utilities do pakietów 🟡

**Plan migracji:**

1. **Stwórz `@engine/editor-utils`:**
   ```bash
   mkdir -p packages/editor-utils/src
   ```

2. **Przenieś:**
   - `DisposableGroup` → `@engine/core/utils` (bardziej uniwersalny)
   - `HistoryManager` → `@engine/editor-utils`
   - `SnapSystem` → `@engine/editor-utils`
   - `GridRenderer` → `@engine/gfx-webgpu/debug` lub `@engine/editor-gfx`

3. **Aktualizuj `package.json`:**
   ```json
   {
     "name": "@engine/editor-utils",
     "dependencies": {
       "@engine/core": "workspace:*",
       "@engine/world": "workspace:*"
     }
   }
   ```

---

### Priorytet 4: Dokumentacja i guidelines 📚

**Stwórz dokument:** `docs/PACKAGE_GUIDELINES.md`

**Zawartość:**

```markdown
# Package Guidelines

## Zasady alokacji kodu

### Kod należy do `packages/` gdy:
- Jest reużywalny poza editorem
- Nie ma zależności od editor-specific UI
- Implementuje logikę biznesową/core functionality
- Może być używany w innych aplikacjach (playground, viewer, etc.)

### Kod należy do `apps/editor/` gdy:
- Jest ściśle związany z editor UI
- Zarządza editor-specific state
- Implementuje workflows/UX edytora
- Ma zależności od DOM/browser APIs specyficzne dla edytora

### Przykłady:

✅ `packages/`:
- Systemy kamer (FPSCamera, CameraDirector)
- Asset management (AssetRegistry)
- Rendering (GridRenderer jako debug tool)
- Math utilities
- ECS systems

✅ `apps/editor/`:
- EditorUI, panels, toolbars
- EditorModeManager
- Keyboard shortcuts specific to editor
- Project persistence UI
- Asset browser UI (używa AssetRegistry z pakietu)

### Import Policy:

❌ Nigdy:
```typescript
// W apps/editor/
import { Something } from '../../../packages/camera/src/Something'
```

✅ Zawsze:
```typescript
// W apps/editor/
import { Something } from '@engine/camera'
```
```

---

## Plan implementacji

### Faza 1: Quick wins (1-2 dni) 🚀

- [ ] Usuń `CameraDirector.ts` i `FPSCamera.ts` z apps/editor
- [ ] Usuń `AssetImporter.ts` i `GltfOptimizer.ts` z apps/editor
- [ ] Zaktualizuj wszystkie importy w plikach edytora
- [ ] Uruchom testy
- [ ] Fix ewentualne problemy z Logger vs console

**Risk:** Niskie  
**Impact:** Wysokie (eliminuje 4 duplikaty)

---

### Faza 2: Refactor AssetRegistry (2-3 dni) ⚙️

- [ ] Dodaj konfigurowalne logowanie do pakietu
- [ ] Zunifikuj AssetTypes (rozstrzygnij import dependencies)
- [ ] Migruj editor do używania pakietowej wersji
- [ ] Testy integracyjne
- [ ] Usuń editor lokalną wersję

**Risk:** Średnie (wymaga zmian w wielu miejscach)  
**Impact:** Wysokie (główny system zarządzania assetami)

---

### Faza 3: Migrate utilities (3-5 dni) 🔧

- [ ] Stwórz `@engine/editor-utils` package
- [ ] Przenieś `HistoryManager`
- [ ] Przenieś `SnapSystem`
- [ ] Oceń czy `GridRenderer` należy do `gfx-webgpu`
- [ ] Przenieś `DisposableGroup` do `@engine/core`
- [ ] Zaktualizuj testy

**Risk:** Średnie  
**Impact:** Średnie (lepsze organization)

---

### Faza 4: Documentation & Guidelines (1 dzień) 📝

- [ ] Napisz `PACKAGE_GUIDELINES.md`
- [ ] Zaktualizuj `ARCHITECTURE.md`
- [ ] Code review checklist dla przyszłych PR
- [ ] Team training/knowledge sharing

**Risk:** Niskie  
**Impact:** Wysokie long-term (zapobiega przyszłym problemom)

---

## Metryki sukcesu

### Przed refactoringiem:
- Duplikaty: **8 głównych plików**
- Linie zduplikowanego kodu: **~2000**
- Import inconsistencies: **~20 plików**
- Packages underutilized: **2 (@engine/camera, @engine/assets)**

### Po refactoringu (cel):
- Duplikaty: **0**
- Import przez `@engine/*`: **100%**
- Coverage pakietów: **>80%**
- Jasne separation of concerns: **Tak**

---

## Pytania do rozważenia

### 1. Logger strategy
**Pytanie:** Czy pakiety powinny mieć własny logger czy używać callbacków?

**Opcje:**
- A) Callback-based (inject logger from consumer)
- B) Własny logger interface w każdym pakiecie
- C) Shared `@engine/logging` package

**Rekomendacja:** Opcja A (flexibility) lub C (consistency)

---

### 2. AssetRegistry singleton
**Pytanie:** Czy `assetRegistry` powinien być singletonem w pakiecie?

**Current:**
```typescript
// packages/assets/src/core/AssetRegistry.ts
export const assetRegistry = new AssetRegistry();
```

**Pros:** Łatwy w użyciu  
**Cons:** Trudniejsze testowanie, mniej flexible

**Alternatywa:**
```typescript
// Eksportuj klasę, pozwól konsumentowi decydować
export class AssetRegistry { ... }

// W apps/editor tworz singleton
export const assetRegistry = new AssetRegistry({ logger: Logger });
```

---

### 3. Browser-specific code
**Pytanie:** Jak pakiety powinny radzić sobie z browser APIs?

**Przykład:** `FPSCamera` używa `document.addEventListener`

**Opcje:**
- A) Akceptuj browser dependency (pakiety są browser-only)
- B) Inject event handlers (więcej flexibilnosci, ale bardziej skomplikowane API)

**Rekomendacja:** A (projekt jest web-only obecnie)

---

## Wnioski

### Obecny stan
- **Silna duplikacja** kodu między apps/editor a packages
- **Niespójne wzorce** importów
- **Niedostateczne wykorzystanie** monorepo structure
- **Brak jasnych guidelines** gdzie umieszczać kod

### Po refactoringu
- ✅ Eliminacja duplikatów
- ✅ Konsystentne importy przez `@engine/*`
- ✅ Pakiety jako single source of truth
- ✅ Jasne separation of concerns
- ✅ Lepsza maintainability i testability

### Czas realizacji
**Szacowany effort:** 7-11 dni roboczych  
**Critical path:** Faza 1 → Faza 2 → Faza 3 → Faza 4  
**Możliwa paralelizacja:** Dokumentacja może być robiona równolegle

### ROI
**Wysokie** - Inwestycja zwraca się szybko przez:
- Łatwiejsze maintenance
- Szybsze onboarding nowych devów
- Mniej bugs z duplikacji
- Lepsza architektura dla przyszłego rozwoju

---

## Next Steps

1. **Review tego dokumentu** z zespołem
2. **Ustal priorytet** - czy robimy wszystko czy częściowo?
3. **Assign owners** - kto bierze Fazę 1, 2, etc.?
4. **Create tickets** - rozpisz Fazy na konkretne zadania
5. **Set timeline** - kiedy chcemy to mieć zrobione?
6. **Start z Fazą 1** - quick wins budują momentum

---

**Kontakt:** [Twoje imię/team]  
**Ostatnia aktualizacja:** 2025-10-26


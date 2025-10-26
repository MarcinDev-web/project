# Quick Fix Guide - Usuń duplikaty (Faza 1)

**Czas:** 1-2 dni  
**Trudność:** 🟢 Łatwe  
**Impact:** 🔴 Wysoki (eliminuje 4 główne duplikaty)

## Cel

Usunąć oczywiste 100% duplikaty między `apps/editor` a `packages` i zaktualizować importy.

## Przygotowanie

```bash
# 1. Upewnij się że jesteś na świeżym main
git checkout main
git pull origin main

# 2. Stwórz branch
git checkout -b refactor/remove-code-duplicates

# 3. Upewnij się że testy przechodzą przed zmianami
pnpm test
```

## Krok 1: Usuń duplikaty Camera (30 min)

### 1.1 Usuń pliki

```bash
rm apps/editor/src/editor/camera/CameraDirector.ts
rm apps/editor/src/editor/camera/FPSCamera.ts
```

### 1.2 Zaktualizuj importy (12 plików)

**Znajdź wszystkie wystąpienia:**
```bash
grep -r "from '../camera/CameraDirector'" apps/editor/src/
grep -r "from '../camera/FPSCamera'" apps/editor/src/
grep -r "from './CameraDirector'" apps/editor/src/editor/camera/
grep -r "from './FPSCamera'" apps/editor/src/editor/camera/
```

**Pliki do zmiany:**

#### `apps/editor/src/app.ts`
```diff
- import { createOrbitControls, type OrbitControls } from '@engine/camera';
+ import { createOrbitControls, type OrbitControls } from '@engine/camera';
  // (już OK - ten plik importuje poprawnie)
```

#### `apps/editor/src/editor/managers/EditorModeManager.ts`
```diff
- import type { FPSCamera } from '../camera/FPSCamera';
- import { CameraDirector } from '../camera/CameraDirector';
+ import type { FPSCamera, CameraDirector } from '@engine/camera';
```

#### `apps/editor/src/editor/ui/EditorUI.ts`
```diff
- import { FPSCamera } from '../camera/FPSCamera';
+ import { FPSCamera } from '@engine/camera';
```

#### `apps/editor/src/editor/states/ReturnState.ts`
```diff
- import type { CameraDirector } from '../camera/CameraDirector';
+ import type { CameraDirector } from '@engine/camera';
```

#### `apps/editor/src/editor/states/PlayingState.ts`
```diff
- import type { CameraDirector } from '../camera/CameraDirector';
+ import type { CameraDirector } from '@engine/camera';
```

#### `apps/editor/src/editor/states/PlayIntroState.ts`
```diff
- import type { CameraDirector } from '../camera/CameraDirector';
+ import type { CameraDirector } from '@engine/camera';
```

**Pozostałe pliki:** Użyj find & replace w edytorze:
- `../camera/CameraDirector` → `@engine/camera`
- `../camera/FPSCamera` → `@engine/camera`

### 1.3 Sprawdź czy folder jest pusty
```bash
ls -la apps/editor/src/editor/camera/
# Jeśli pusty, usuń folder
rmdir apps/editor/src/editor/camera/
```

---

## Krok 2: Usuń duplikaty Assets (30 min)

### 2.1 Usuń pliki

```bash
rm apps/editor/src/editor/assets/AssetImporter.ts
rm apps/editor/src/editor/assets/GltfOptimizer.ts
```

### 2.2 Zaktualizuj importy

**Znajdź wszystkie wystąpienia:**
```bash
grep -r "from './AssetImporter'" apps/editor/src/
grep -r "from './GltfOptimizer'" apps/editor/src/
```

**Pliki do zmiany:**

#### `apps/editor/src/editor/assets/AssetBrowser.ts`
```diff
- import { AssetImporter } from './AssetImporter';
- import { optimizeAndExtractLite } from './GltfOptimizer';
+ import { AssetImporter, optimizeAndExtractLite } from '@engine/assets';
```

**Jeśli są inne pliki importujące:** Użyj find & replace:
- `'./AssetImporter'` → `'@engine/assets'`
- `'./GltfOptimizer'` → `'@engine/assets'`

---

## Krok 3: Weryfikacja (30 min)

### 3.1 TypeScript compilation
```bash
pnpm -r build
```

Jeśli są błędy kompilacji:
- Sprawdź czy wszystkie importy zostały zaktualizowane
- Sprawdź czy eksporty w pakietach są poprawne

### 3.2 Uruchom testy
```bash
# Wszystkie testy
pnpm test

# Tylko editor tests
pnpm --filter @apps/editor test

# Tylko packages tests
pnpm --filter @engine/camera test
pnpm --filter @engine/assets test
```

### 3.3 Uruchom aplikację
```bash
pnpm --filter @apps/editor dev
```

Sprawdź czy:
- [ ] Aplikacja startuje bez błędów
- [ ] Kamera działa (orbit, FPS mode)
- [ ] Asset browser działa
- [ ] Import GLTF działa

---

## Krok 4: Potencjalne problemy i rozwiązania

### Problem 1: Logger not defined

**Objaw:**
```
Error: Logger is not defined in @engine/camera/CameraDirector
```

**Rozwiązanie A (szybkie):**
W `packages/camera/src/CameraDirector.ts`:
```typescript
// Na początku pliku zmień:
console.debug(...) // zamiast Logger.debug(...)
console.warn(...)  // zamiast Logger.warn(...)
```

**Rozwiązanie B (lepsze, ale dłuższe):**
Dodaj logger config do konstruktora:
```typescript
export interface CameraDirectorConfig {
  orbitControls: OrbitControls;
  fpsCamera: FPSCamera | null;
  canvas: HTMLCanvasElement;
  scene?: Scene;
  physicsWorld?: PhysicsWorld | null;
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
}

export class CameraDirector {
  private logger: CameraDirectorConfig['logger'];
  
  constructor(config: CameraDirectorConfig) {
    // ...
    this.logger = config.logger ?? {
      debug: console.debug,
      warn: console.warn,
    };
  }
  
  // W kodzie:
  this.logger.debug(`Camera mode: ${this.currentMode} → ${mode}`);
}
```

Potem w edytorze:
```typescript
import { Logger } from '../../utils/logger';

const director = new CameraDirector({
  // ...
  logger: {
    debug: Logger.debug.bind(Logger),
    warn: Logger.warn.bind(Logger),
  }
});
```

### Problem 2: Circular dependency

**Objaw:**
```
Warning: Circular dependency detected
```

**Rozwiązanie:**
- Sprawdź czy nie importujesz bezpośrednio z plików wewnętrznych pakietów
- Zawsze importuj z głównego index: `from '@engine/camera'` nie `from '@engine/camera/src/CameraDirector'`

### Problem 3: Type conflicts

**Objaw:**
```
Type 'CameraDirector' is not assignable to type 'CameraDirector'
```

**Rozwiązanie:**
- Upewnij się że nie ma mieszania importów (niektóre z lokalu, niektóre z pakietu)
- Usuń wszystkie pozostałości lokalnych plików
- Wyczyść cache: `rm -rf node_modules/.vite apps/editor/dist`

---

## Krok 5: Commit i Push

### 5.1 Review zmian
```bash
git status
git diff
```

### 5.2 Stage changes
```bash
git add apps/editor/src/
```

### 5.3 Commit
```bash
git commit -m "refactor: remove camera and asset duplicates from editor

- Remove duplicated CameraDirector and FPSCamera from apps/editor
- Remove duplicated AssetImporter and GltfOptimizer from apps/editor  
- Update all imports to use @engine/camera and @engine/assets packages
- Eliminates ~600 lines of duplicated code

Fixes #XXX"
```

### 5.4 Push
```bash
git push origin refactor/remove-code-duplicates
```

### 5.5 Create Pull Request
- Tytuł: `refactor: Remove camera and asset duplicates from editor`
- Description: Użyj template opisującego zmiany
- Assignees: Przypisz reviewerów
- Labels: `refactor`, `tech-debt`, `high-priority`

---

## Checklist końcowy

Przed utworzeniem PR upewnij się że:

- [ ] Wszystkie duplikaty zostały usunięte
- [ ] Wszystkie importy zostały zaktualizowane na `@engine/*`
- [ ] TypeScript compilation przechodzi bez błędów
- [ ] Wszystkie testy przechodzą
- [ ] Aplikacja startuje i działa poprawnie
- [ ] Żadne console errors w browser devtools
- [ ] Git commit ma sensowny message
- [ ] Branch został push'nięty

---

## Statystyki oczekiwane

```
Files changed:     ~15 plików
Insertions:        ~15 linii (nowe importy)
Deletions:         ~600 linii (usunięte duplikaty)
Net change:        -585 linii ✅
```

## Następne kroki

Po zmergowaniu tego PR:
1. **Faza 2:** Refactor AssetRegistry (2-3 dni)
2. **Faza 3:** Migrate utilities (3-5 dni)
3. **Faza 4:** Documentation (1 dzień)

---

## Pomoc

**Problem z importami?**
```bash
# Znajdź wszystkie importy z ../camera lub ../assets
grep -r "from '\.\./camera" apps/editor/src/
grep -r "from '\./Asset" apps/editor/src/editor/assets/
```

**Problem z testami?**
```bash
# Uruchom testy z verbose output
pnpm test -- --reporter=verbose

# Uruchom konkretny test file
pnpm test apps/editor/src/editor/managers/EditorModeManager.test.ts
```

**Problem z buildem?**
```bash
# Wyczyść cache i node_modules
rm -rf node_modules
rm -rf apps/editor/node_modules
rm -rf packages/*/node_modules
pnpm install

# Rebuild wszystko
pnpm -r build
```

---

📊 **Status tracker:**
```
[ ] Krok 1: Usuń camera duplicates
[ ] Krok 2: Usuń assets duplicates  
[ ] Krok 3: Weryfikacja
[ ] Krok 4: Rozwiąż problemy
[ ] Krok 5: Commit & Push
[ ] Krok 6: Create PR
[ ] Krok 7: Code review
[ ] Krok 8: Merge
```

**Good luck! 🚀**

---

📄 **Zobacz też:**
- [Pełna analiza](./EDITOR_PACKAGES_ANALYSIS.md)
- [Podsumowanie](./EDITOR_ANALYSIS_SUMMARY.md)
- [Diagram](./EDITOR_PACKAGES_DIAGRAM.md)


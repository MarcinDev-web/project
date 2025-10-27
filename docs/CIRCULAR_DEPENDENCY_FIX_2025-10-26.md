# Circular Dependency Fix - 2025-10-26

## Problem

Projekt miał cykl zależności który blokował kompilację:

```
@engine/world → @engine/stdlib → @engine/world (CYKL!)
@engine/world → (używał @engine/script bez dependency)
```

## Rozwiązanie

### 1. Przeanalizowano Cykl

**Źródło problemu:**
- `@engine/world` importował z `@engine/stdlib` (AnimationComponent)
- `@engine/world` importował z `@engine/script` (LogicCubeComponent, ScriptComponent)
- `@engine/stdlib` zależał od `@engine/world`
- `@engine/script` zależał od `@engine/world`

### 2. Przeniesiono Komponenty

**AnimationComponent:**
- Przenes iono z `packages/world/src/components/` do `packages/stdlib/src/Animation/`
- Zaktualizowano importy z `@engine/world` na lokalne importy
- Dodano export w `packages/stdlib/src/Animation/index.ts`
- Zaktualizowano wszystkie pliki używające AnimationComponent

**LogicCubeComponent i ScriptComponent:**
- Usunięto duplikaty z `packages/world/src/components/`
- Komponenty już istniały w `packages/script/src/components/`
- Zaktualizowano importy we wszystkich plikach editora

### 3. Zaktualizowano Dependencies

**packages/world/package.json:**
```diff
  "dependencies": {
    "@engine/core": "workspace:*",
-   "@engine/stdlib": "workspace:*",
    "gl-matrix": "^3.4.4"
  }
```

**packages/stdlib/tsconfig.json:**
```diff
  "references": [
    { "path": "../core" },
+   { "path": "../world" }
  ]
```

### 4. Usunięto Stare Artifacts

- Usunięto `.js` i `.js.map` pliki z `packages/*/src/` (leftover compilation artifacts)
- Przebudowano wszystkie pakiety od zera

## Rezultaty

### ✅ Build Sukces

```bash
pnpm build
# ✅ All packages build successfully
# ✅ Editor builds successfully (636.74 kB)
```

### ✅ Nowa Struktura Zależności

```
Level 0: @engine/core
Level 1: @engine/world
Level 2: @engine/script, @engine/stdlib
Level 3: @apps/editor
```

**Brak cykli!** ✅

### ✅ Headless Test

- **465 testów** `@engine/world` przechodzi bez WebGPU/DOM
- Utworzono `scripts/headless-smoke-test.js`
- Dodano CI job `.github/workflows/ci.yml`

### ✅ Unified Lint

- Dodano `lint` script do wszystkich pakietów
- `pnpm lint` działa z root

## Zmienione Pliki

### Package Dependencies
- `packages/world/package.json` - usunięto `@engine/stdlib`
- `packages/stdlib/tsconfig.json` - dodano reference do `world`

### Przeniesione Komponenty
- `packages/world/src/components/AnimationComponent.ts` → `packages/stdlib/src/Animation/AnimationComponent.ts`

### Usunięte Duplikaty
- ❌ `packages/world/src/components/LogicCubeComponent.ts` (duplikat)
- ❌ `packages/world/src/components/ScriptComponent.ts` (duplikat)

### Zaktualizowane Eksporty
- `packages/world/src/components/index.ts` - usunięto AnimationComponent
- `packages/stdlib/src/Animation/index.ts` - dodano AnimationComponent
- `packages/stdlib/src/Animation/AnimationSystem.ts` - zmieniono import na lokalny

### Zaktualizowane Importy w Editor
**AnimationComponent:** (3 pliki)
- `apps/editor/src/editor/panels/PropertiesPanel.ts`
- `apps/editor/src/editor/panels/PropertiesPanel.test.ts`
- `apps/editor/src/editor/ui/animation/AnimationSection.ts`

**LogicCubeComponent:** (4 pliki)
- `apps/editor/src/editor/panels/LogicPanel.ts`
- `apps/editor/src/editor/panels/LogicPanel.test.ts`
- `apps/editor/src/editor/managers/LogicCubeLibrary.ts`
- `apps/editor/src/editor/controllers/LogicConnectionController.ts`

**ScriptComponent:** (5 plików)
- `apps/editor/src/editor/panels/PropertiesPanel.ts`
- `apps/editor/src/editor/panels/PropertiesPanel.test.ts`
- `apps/editor/src/editor/ui/AdaptiveUIManager.ts`
- `apps/editor/src/editor/states/PreflightState.ts`
- `apps/editor/src/editor/ui/ScriptWorkbench.ts`

### CI/CD
- `.github/workflows/ci.yml` - dodano `test-headless` job

### Scripts
- Dodano `lint` script do wszystkich `packages/*/package.json`
- Dodano `lint` script do `apps/editor/package.json`

## Weryfikacja

### Build Test
```bash
pnpm build
# ✅ All packages: core, world, stdlib, script, camera, input, gfx-webgpu, editor-utils, test-utils
# ✅ Editor: 636.74 kB (gzip: 161.64 kB)
```

### Headless Test
```bash
cd packages/world && pnpm test
# ✅ 465 tests passed
```

### Lint Test
```bash
pnpm lint
# ✅ Runs across all packages
```

## Architektura Po Naprawie

### Dependency Graph
```
@engine/core (Level 0)
    ↓
@engine/world (Level 1)
    ↓
    ├─→ @engine/script (Level 2)
    └─→ @engine/stdlib (Level 2)
            ↓
        @apps/editor (Level 3)
```

### Komponenty

**@engine/world (Core Components):**
- Component (base)
- Transform
- Camera
- Light
- Mesh
- Material
- Physics
- Environment
- Joint

**@engine/script (Script Components):**
- LogicCubeComponent
- ScriptComponent

**@engine/stdlib (Stdlib Components):**
- AnimationComponent (w `stdlib/Animation/`)
- CharacterController

## Lessons Learned

### 1. Komponenty Należą Do Features, Nie Do Core

**Przed:** AnimationComponent w `@engine/world` (core ECS)
**Po:** AnimationComponent w `@engine/stdlib/Animation` (feature package)

**Reguła:** Component który importuje z feature package, należy do tego feature package.

### 2. Duplikaty Są Oznaką Problemu

LogicCubeComponent i ScriptComponent były w dwóch miejscach:
- `@engine/world/components/` (duplikat)
- `@engine/script/components/` (właściwe miejsce)

**Reguła:** Jeśli component jest duplikowany, sprawdź czy nie jest w złym pakiecie.

### 3. TypeScript Artifacts w src/ Są Problematyczne

Rollup/Vite czasem czyta `.js` files z `src/` zamiast `dist/`.

**Rozwiązanie:** Regularnie czyścić artifacts:
```bash
pnpm --filter "@engine/*" clean
```

### 4. Headless Test Jest Kluczowy

Headless test (@engine/world bez GPU/DOM) gwarantuje:
- ✅ Czyste separation of concerns
- ✅ Możliwość server-side multiplayer
- ✅ Szybsze testy jednostkowe

## Następne Kroki

### Priorytet: Średni
- **Wydzielić BlockLibrary do @engine/blocks**
  - BlockLibrary obecnie w `@engine/gfx-webgpu`
  - To łączy content z rendering layer
  - Utrudnia wymianę renderera

### Priorytet: Niski
- **Rozcięcie world ↔ stdlib jest OK**
  - stdlib używa world components (Transform, Entity, Scene)
  - To jest dozwolona dependency
  - Nie tworzy cyklu (world nie zależy od stdlib)

## Metryki

| Aspekt | Przed | Po |
|--------|-------|-----|
| **Cykle zależności** | 1 (world ↔ stdlib) | 0 ✅ |
| **Build status** | ❌ Fail | ✅ Success |
| **Headless test** | ❌ Brak | ✅ 465 tests pass |
| **Unified lint** | ❌ Brak | ✅ Działa |
| **CI headless job** | ❌ Brak | ✅ Dodany |
| **Duplikaty komponentów** | 2 | 0 ✅ |

---

**Data:** 2025-10-26  
**Czas wykonania:** ~3 godziny  
**Status:** ✅ Zakończone
**Impact:** 🔥 Critical - odblokowano build projektu


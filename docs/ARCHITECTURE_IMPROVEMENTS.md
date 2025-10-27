# Architecture Improvements - Rekomendacje

**Data utworzenia:** 2025-10-26  
**Status:** Propozycje ulepszeń po zakończeniu refactoringu

## Przegląd

Po zakończeniu migracji do modularnej architektury monorepo (Fazy 0-8) oraz eliminacji duplikacji kodu, zidentyfikowano dodatkowe możliwości ulepszeń architektury.

## Zrealizowane Usprawnienia (2025-10-26)

### ✅ 1. Usunięcie nieistniejących aliasów z tsconfig.json

**Problem:** Aliasy TypeScript wskazywały na nieistniejące pakiety (`@engine/assets`, `@engine/voxel`, `@engine/net`).

**Rozwiązanie:**
- Usunięto aliasy do pakietów, które nie istnieją lub są tylko placeholder README
- Dodano brakujące aliasy: `@engine/editor-utils`, `@engine/test-utils`
- Zaktualizowano dokumentację (ARCHITECTURE.md, README.md)

**Rezultat:** Czyste aliasy TS bez "martwych" referencji.

---

### ✅ 2. Synchronizacja dokumentacji tech stacku editora

**Problem:** `apps/editor/README.md` deklarował React + Tailwind CSS, mimo że editor używa vanilla TypeScript.

**Rozwiązanie:**
- Zaktualizowano README editora z rzeczywistym stackiem:
  - Vanilla TypeScript (bez frameworku UI)
  - @preact/signals-core (reactive state)
  - Custom CSS (glassmorphic styling)
- Usunięto zbędne `jsx: "react-jsx"` z tsconfig.json

**Rezultat:** Dokumentacja zgodna z rzeczywistością, brak mylących informacji.

---

### ✅ 3. Egzekwowanie granic modułów przez ESLint

**Problem:** Brak narzędziowego wymuszania zasady "importuj tylko z @engine/*, nie z wewnętrznych ścieżek".

**Rozwiązanie:**
- Dodano regułę ESLint `no-restricted-imports`:
  ```js
  patterns: [
    {
      group: ['**/packages/*/src/**', '../packages/*/src/**', '../../packages/*/src/**'],
      message: 'Import from @engine/* package name only, not internal src/ paths.'
    }
  ]
  ```
- Zaktualizowano ARCHITECTURE.md z sekcją "Egzekwowanie"

**Rezultat:** Naruszenia granic modułów są teraz wykrywane przez linter przed commitem.

---

## Propozycje Dalszych Ulepszeń

### 🔄 1. Wyodrębnienie BlockLibrary do @engine/blocks

**Priorytet:** Średni  
**Effort:** ~2-3 dni

**Problem:**
- `BlockLibrary` siedzi w `@engine/gfx-webgpu`
- To łączy "content" (definicje bloków) z warstwą renderera
- Utrudnia wymianę renderera (WebGPU → WebGL)

**Propozycja:**
```
packages/blocks/
  src/
    BlockLibrary.ts       # Core block registry
    BlockDefinition.ts    # Block metadata
    BlockTypes.ts         # Built-in block types
    index.ts
```

**Zależności:**
- `@engine/blocks` zależy od `@engine/core` (math, types)
- `@engine/gfx-webgpu` zależy od `@engine/blocks` (renderuje bloki)
- `@engine/world` może opcjonalnie używać `@engine/blocks`

**Korzyści:**
- Lepsze separation of concerns (content vs rendering)
- Łatwiejsza wymiana renderera
- Możliwość reużycia definicji bloków w różnych kontekstach (server, preview, etc.)

**Kroki:**
1. Utworzyć `packages/blocks/`
2. Przenieść `BlockLibrary`, `BlockDefinition` z `gfx-webgpu`
3. Zaktualizować importy w `gfx-webgpu` i `apps/editor`
4. Zaktualizować dokumentację

---

### 🔄 2. CI Job: Headless Test dla @engine/world

**Priorytet:** Wysoki  
**Effort:** ~1 dzień

**Problem:**
- Nie ma automatycznego sprawdzania, czy `@engine/world` działa bez DOM/WebGPU
- To kluczowe dla headless server (multiplayer)

**Propozycja:**
Dodać GitHub Actions job:
```yaml
headless-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: pnpm/action-setup@v2
    - run: pnpm install
    - run: cd packages/world && pnpm test
    - run: node --experimental-vm-modules scripts/headless-smoke-test.js
```

**Smoke test:**
```js
// scripts/headless-smoke-test.js
import { World, Scene, Entity } from '@engine/world';

const world = new World();
const scene = new Scene('Test');
const entity = scene.createEntity('Cube');

world.addScene(scene);
world.fixedUpdate(1/60);  // Simulate one tick

console.log('✅ Headless test passed - World works without GPU!');
```

**Korzyści:**
- Gwarantuje czystą separację World od renderera
- Łatwiejsze testowanie logiki bez GPU
- Podstawa dla przyszłego multiplayer server

---

### 🔄 3. Rozcięcie cyklu world ↔ stdlib

**Priorytet:** Niski  
**Effort:** ~3-5 dni

**Problem:**
- Dozwolony cykl `@engine/world ↔ @engine/stdlib`
- To łagodzi modularność

**Propozycja:**
Wydzielić interfejsy do `@engine/core`:
```
@engine/core/ecs/
  IComponent.ts          # Base component interface
  ISystem.ts             # Base system interface
  IComponentRegistry.ts  # Registry interface
```

Rezultat:
```
@engine/core → (interfaces)
@engine/world → (implementuje interfaces)
@engine/stdlib → (używa interfaces, zależy od core + world)
```

**Korzyści:**
- Eliminuje cykl
- Czystsze granice
- Łatwiejsze testowanie stdlib w izolacji

**Uwaga:** To jest bardziej "purist" improvement - obecny cykl jest akceptowalny i działa.

---

### 🔄 4. Package.json: Unified Lint Script

**Priorytet:** Niski  
**Effort:** ~1 godzina

**Problem:**
- `pnpm lint` nie działa (brak `lint` skryptu w pakietach)

**Propozycja:**
Dodać do każdego `packages/*/package.json`:
```json
"scripts": {
  "lint": "eslint src --max-warnings=0"
}
```

I w root `package.json`:
```json
"scripts": {
  "lint": "pnpm -r lint && eslint apps/editor/src --max-warnings=0"
}
```

**Korzyści:**
- Spójne linting across monorepo
- `pnpm lint` działa z root
- Pre-commit hooks mogą używać `pnpm lint`

---

### 🔄 5. Performance Baseline: Benchmarki per pakiet

**Priorytet:** Średni  
**Effort:** ~2-3 dni

**Problem:**
- Brak baseline performance metrics
- Ciężko śledzić regresje

**Propozycja:**
Dodać `__benchmarks__/` per pakiet z kluczowymi operacjami:

```typescript
// packages/core/__benchmarks__/vec3.bench.ts
import { bench } from 'vitest';
import { vec3Add, vec3Dot } from '../src/math';

bench('vec3Add', () => {
  const a = [1, 2, 3] as Vec3;
  const b = [4, 5, 6] as Vec3;
  vec3Add(a, b);
});
```

CI job:
```yaml
benchmark:
  runs-on: ubuntu-latest
  steps:
    - run: pnpm test:bench
    - uses: benchmark-action/github-action-benchmark@v1
      with:
        tool: 'vitest'
        output-file-path: benchmark-results.json
```

**Korzyści:**
- Automatyczne wykrywanie regresji performance
- Tracking trends over time
- Edukacja zespołu o kosztach operacji

---

## Rekomendowane Priorytety

### Sprint 1 (Krótkoterminowe - 1 tydzień)
1. ✅ **DONE:** Egzekwowanie granic modułów (ESLint)
2. ✅ **DONE:** Synchronizacja dokumentacji
3. 🔄 **TODO:** CI Job: Headless Test
4. 🔄 **TODO:** Unified Lint Script

### Sprint 2 (Średnioterminowe - 2 tygodnie)
5. 🔄 **TODO:** Wyodrębnienie BlockLibrary do @engine/blocks
6. 🔄 **TODO:** Performance Baseline: Benchmarki

### Backlog (Długoterminowe)
7. 🔄 **MAYBE:** Rozcięcie cyklu world ↔ stdlib (nice-to-have)

---

## Metryki Sukcesu

Po implementacji wszystkich ulepszeń:

| Metryka | Obecny Stan | Target |
|---------|-------------|--------|
| **Egzekwowanie granic** | ✅ ESLint rule | ✅ Done |
| **Headless test** | ❌ Brak | ✅ CI job |
| **Lint consistency** | ⚠️ Partial | ✅ Unified |
| **Block coupling** | ⚠️ W gfx-webgpu | ✅ Separate package |
| **Performance tracking** | ❌ Brak | ✅ Benchmarks w CI |
| **Cyclic dependencies** | ⚠️ 1 (world ↔ stdlib) | ⚠️ 1 (OK) lub ✅ 0 (ideal) |

---

## Referencje

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Główna dokumentacja architektury
- [ADR 001](./adr/001-modular-engine-architecture.md) - Decyzja o modularyzacji
- [REFACTORING_COMPLETE.md](./refactoring/REFACTORING_COMPLETE.md) - Historia refactoringu
- [PERFORMANCE.md](./PERFORMANCE.md) - Wytyczne performance

---

**Autor:** AI Assistant  
**Ostatnia aktualizacja:** 2025-10-26


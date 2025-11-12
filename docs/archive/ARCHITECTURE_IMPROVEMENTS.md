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

### ✅ 1. Wyodrębnienie BlockLibrary do @engine/blocks

**Status:** ✅ **DONE** (2025-10-26)

**Wykonane:**
- `@engine/blocks` pakiet już istnieje z `BlockLibrary`, `BlockDefinition`, `BlockTypes`
- Wszystkie importy w `@engine/gfx-webgpu` używają `@engine/blocks`
- `packages/gfx-webgpu/src/blocks/BlockLibrary.ts` jest tylko re-export dla backwards compatibility
- `@engine/world` używa `@engine/blocks` do `BlockBehaviorSystem`

**Rezultat:**
- Lepsze separation of concerns (content vs rendering)
- Łatwiejsza wymiana renderera
- Możliwość reużycia definicji bloków w różnych kontekstach

---

### ✅ 2. CI Job: Headless Test dla @engine/world

**Status:** ✅ **DONE** (2025-10-26)

**Wykonane:**
- ✅ Utworzono `scripts/headless-smoke-test.js` - smoke test bezpośrednio importujący i testujący `@engine/world`
- ✅ Dodano GitHub Actions workflow `.github/workflows/headless-test.yml`
- ✅ Dodano job `test-headless` do głównego workflow `.github/workflows/ci.yml`
- ✅ Smoke test weryfikuje: World, Scene, Entity creation oraz `fixedUpdate()` bez GPU/DOM

**Struktura:**
```yaml
# .github/workflows/ci.yml
test-headless:
  name: Headless Test (@engine/world)
  steps:
    - Build @engine/core
    - Build @engine/world
    - Run headless smoke test
```

**Smoke test (`scripts/headless-smoke-test.js`):**
- Tworzy World, Scene, Entity bez GPU/DOM
- Wykonuje `world.fixedUpdate(1/60)` aby zweryfikować działanie bez zależności renderera
- Zwraca exit code 0/1 dla CI

**Korzyści:**
- ✅ Gwarantuje czystą separację World od renderera
- ✅ Automatyczne wykrywanie naruszeń headless compatibility
- ✅ Podstawa dla przyszłego multiplayer server
- ✅ CI bez GPU zawsze sprawdza headless mode

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

### ✅ 4. Package.json: Unified Lint Script

**Status:** ✅ **DONE** (2025-10-26)

**Wykonane:**
- Wszystkie pakiety w `packages/*` mają już `lint` script: `"lint": "eslint src --max-warnings=0"`
- Root `package.json` ma `"lint": "pnpm -r lint"` który wywołuje lint we wszystkich workspace
- `apps/editor` i `apps/platform` również mają lint scripts
- `pnpm lint` działa poprawnie i sprawdza wszystkie pakiety

**Rezultat:**
- ✅ Spójne linting across monorepo
- ✅ `pnpm lint` działa z root
- ✅ Pre-commit hooks mogą używać `pnpm lint`

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
3. ✅ **DONE:** CI Job: Headless Test
4. ✅ **DONE:** Unified Lint Script

### Sprint 2 (Średnioterminowe - 2 tygodnie)
5. ✅ **DONE:** Wyodrębnienie BlockLibrary do @engine/blocks
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
| **Block coupling** | ✅ Separate package | ✅ Done |
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


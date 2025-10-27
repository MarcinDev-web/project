# ADR 001: Modularyzacja Architektury Silnika

## Status

**Zaakceptowano** - 2025-10-26

## Kontekst

### Obecny Stan

Projekt znajduje się w stanie hybrydowym z następującymi problemami:

1. **Duplikacje kodu**:
   - `src/scene/` vs `src/engine/scene/`
   - `src/physics/` vs `src/engine/physics/`
   - `src/animation/` vs `src/engine/animation/`
   - Import chaos: `src/scene/index.ts` importuje z `./engine/scene`

2. **Brak jasnych granic odpowiedzialności**:
   - Renderer wie o edytorze
   - Logika biznesowa zmieszana z infrastrukturą
   - Brak wyraźnego API publicznego

3. **Trudność w rozwoju**:
   - Ciężko wymienić komponenty (np. physics engine)
   - Niemożliwe odpalenie headless (bez GPU)
   - Edytor ma "backdoory" niedostępne dla userów

4. **Bezpieczeństwo UGC**:
   - Brak sandboxu dla user scripts
   - User ma potencjalnie dostęp do całego API
   - Ryzyko exploitów przez WebGPU

### Cele Biznesowe

Chcemy zbudować **platformę UGC 3D** (nextgen Roblox/Kogama) która:

- ✅ **Skaluje się** do dużych projektów (tysiące entities, duże levele)
- ✅ **Pozwala na wymianę** komponentów (renderer: WebGPU → WebGL, physics: własna → Rapier)
- ✅ **Separuje edytor od runtime** (edytor jako klient API, nie backdoor)
- ✅ **Jest bezpieczna** dla user-generated content (sandbox, moderacja)
- ✅ **Działa w przeglądarce** (WebGPU, Workers, streaming)
- ✅ **Wspiera multiplayer** (headless server, replikacja)

### Wymagania Techniczne

1. **Modularność**: Moduły muszą być wymienne bez przepisywania całego kodu
2. **Testowanie**: Każdy moduł testowany niezależnie
3. **Publikacja**: Możliwość pakowania jako SDK (npm)
4. **Headless**: Runtime bez GPU (server tick, testy)
5. **Bezpieczeństwo**: Sandbox dla user scripts

## Decyzja

Przenosimy architekturę projektu na **system modułów w monorepo** z czystym podziałem odpowiedzialności.

### Struktura Docelowa

```
ugc-3d-platform/
├── packages/              # Moduły silnika (@engine/*)
│   ├── core/              # @engine/core - Foundation (math, ECS base, event, job)
│   ├── world/             # @engine/world - ECS runtime (World, components, systems, physics)
│   ├── gfx-webgpu/        # @engine/gfx-webgpu - WebGPU renderer
│   ├── voxel/             # @engine/voxel - Voxel/microblock system (przyszłość)
│   ├── assets/            # @engine/assets - Asset loading & streaming
│   ├── script/            # @engine/script - UGC scripting (LogicCubes, sandbox)
│   ├── input/             # @engine/input - Input management
│   ├── camera/            # @engine/camera - Camera systems
│   ├── net/               # @engine/net - Multiplayer & replay (przyszłość)
│   └── stdlib/            # @engine/stdlib - Standard prefabs (animation, audio, character)
│
├── apps/                  # Aplikacje
│   ├── editor/            # Edytor (React + WebGPU canvas)
│   └── playground/        # Demo/sandbox (przyszłość)
│
└── docs/                  # Dokumentacja
    ├── adr/               # Architecture Decision Records (PL)
    └── ...
```

### Zasady Architektury

#### Zasada #0: Silnik = Runtime + API, Nie Singleton

```
Silnik = Runtime + API
Edytor = Klient API
Gra Usera = Klient API
```

Silnik **nie wie** co robisz. Daje prymitywy (Entity, Renderer, Physics), ty budujesz grę.

#### Zasada #1: Zależności Tylko w Dół

```
Level 0: @engine/core
Level 1: @engine/world, @engine/input
Level 2: @engine/gfx-webgpu, @engine/voxel, @engine/assets, @engine/script, @engine/camera
Level 3: @engine/stdlib
Level 4: apps/editor, apps/playground
```

**Reguła**: Core nie zna World. World nie zna Renderer. Renderer nie zna Editor.

#### Zasada #2: Edytor Używa Publicznego API

```typescript
// ❌ ŹLE - edytor ma backdoor
class EditorModeManager {
  private _hackIntoWorldState(world: World) {
    // Specjalny dostęp niedostępny dla userów
  }
}

// ✅ DOBRZE - edytor używa tego samego API co user
class EditorModeManager {
  createEntity() {
    return world.createEntity();  // Public API
  }
}
```

**Rezultat**: Co działa w edytorze, działa w grze usera. Zero niespodzianek.

#### Zasada #3: Moduły Nie Znają Swoich Konsumentów

```typescript
// ✅ DOBRZE - Renderer nie wie o edytorze
class Renderer {
  render(world: World, camera: Camera) {
    // Renderuj tylko na podstawie World i Camera
    // Nie wie czy to editor, gra, czy replay
  }
}

// ❌ ŹLE - Renderer wie o edytorze
class Renderer {
  render(world: World, camera: Camera, editorMode: boolean) {
    if (editorMode) {
      // Specjalna logika dla editora ❌
    }
  }
}
```

### Mapowanie: Obecna → Docelowa Struktura

| Moduł | Obecna Lokalizacja | Docelowa Lokalizacja | Akcja |
|-------|-------------------|---------------------|--------|
| **Math** | `src/math.ts` | `packages/core/src/math/` | Przenieś + modularyzuj |
| **ECS base** | `src/engine/scene/core/` | `packages/core/src/ecs/` | Przenieś tylko base |
| **EventBus** | `src/logic/EventBus.ts` | `packages/core/src/event/` | Przenieś |
| **ECS runtime** | `src/engine/scene/` | `packages/world/` | Przenieś |
| **Physics** | `src/physics/` | `packages/world/src/physics/` | Przenieś |
| **Renderer** | `src/rendering/` | `packages/gfx-webgpu/` | Przenieś + refactor |
| **LogicCubes** | `src/logic/` | `packages/script/src/LogicCubes/` | Przenieś |
| **Animation** | `src/animation/` | `packages/stdlib/src/Animation/` | Przenieś |
| **Audio** | `src/audio/` | `packages/stdlib/src/Audio/` | Przenieś |
| **Gameplay** | `src/gameplay/` | `packages/stdlib/src/CharacterController/` | Przenieś |
| **Edytor** | `src/editor/` + `src/app/` | `apps/editor/` | Przenieś + scal |
| **Duplikaty** | `src/scene/`, `src/engine/physics/`, ... | ❌ Usuń | Usuń duplikaty |

### Plan Migracji

**Strategia**: Gradual Refactor (8 faz, ~2-3 tygodnie)

1. **Faza 0**: Setup monorepo (pnpm workspaces, turbo)
2. **Faza 1**: `@engine/core` (math, ecs base, event, job)
3. **Faza 2**: `@engine/world` (ECS runtime, physics)
4. **Faza 3**: `@engine/gfx-webgpu` (renderer)
5. **Faza 4**: `@engine/script` (LogicCubes)
6. **Faza 5**: `@engine/stdlib` (animation, audio, character)
7. **Faza 6**: `@engine/assets`, `@engine/input`, `@engine/camera`
8. **Faza 7**: `apps/editor` (edytor jako aplikacja)
9. **Faza 8**: Cleanup (usuń `src/`, testy, docs)

**Po każdej fazie**:
- ✅ Projekt kompiluje się
- ✅ Wszystkie 358 testów przechodzą
- ✅ Atomiczny commit

Szczegóły: [MIGRATION_PLAN.md](../MIGRATION_PLAN.md)

## Konsekwencje

### Pozytywne

#### 1. Jasne Granice Odpowiedzialności

```typescript
// PRZED: Wszystko w src/
import { Scene } from './scene';  // Który scene? Duplikat?

// PO: Moduły z nazwami
import { Scene } from '@engine/world';  // ✅ Jasne
```

#### 2. Łatwa Wymiana Komponentów

```typescript
// Chcesz WebGL zamiast WebGPU?
// PRZED: Przepisz cały src/rendering/ (tysiące linii)

// PO: Wymień pakiet
// npm uninstall @engine/gfx-webgpu
// npm install @engine/gfx-webgl
// Edytor używa tego samego API
```

#### 3. Headless Server (Multiplayer)

```typescript
// PRZED: Nie można odpalić bez GPU (renderer wszędzie)

// PO: World działa bez GPU
import { World } from '@engine/world';
const world = new World();
world.fixedUpdate(1/60);  // Server tick ✅
```

#### 4. Bezpieczny Sandbox dla UGC

```typescript
// PRZED: User ma dostęp do wszystkiego

// PO: ScriptRuntime limituje API
const scriptRuntime = new ScriptRuntime();
const restrictedAPI = scriptRuntime.getRestrictedAPI();
// User dostaje tylko: getPosition, setPosition, emit, on
// BRAK: fetch, eval, WebGPU, DOM
```

#### 5. Możliwość Pakowania jako SDK

```bash
# User może użyć Twojego silnika
npm install @engine/core @engine/world @engine/gfx-webgpu

import { World } from '@engine/world';
const world = new World();
// Build własną grę na Twoim runtime
```

#### 6. Lepsze Testowanie

```bash
# PRZED: Test całego src/ naraz

# PO: Test per moduł
cd packages/core && npm test
cd packages/world && npm test
# Szybsze, izolowane testy
```

#### 7. Łatwiejszy Onboarding

```
PRZED: "Przeczytaj 27,000 linii w src/"
PO: "Zacznij od @engine/core (math, ECS), potem @engine/world"
```

#### 8. Przyszłe Możliwości

- **WebWorker runtime**: Odpuść World w workerze dla lepszego performance
- **Wiele rendererów**: WebGPU (desktop), WebGL (fallback), Canvas2D (minimal)
- **Monetyzacja**: Sprzedaj engine jako SDK (commercial license)

### Negatywne

#### 1. Początkowy Koszt Migracji

**Czas**: ~2-3 tygodnie full-time work

**Ryzyko**: Możliwe czasowe psucie testów podczas migracji

**Mitigacja**: Gradual refactor (8 faz), testy po każdej fazie

#### 2. Więcej Konfiguracji

**PRZED**: Jeden `tsconfig.json`, jeden `package.json`

**PO**: 
- 10+ `package.json` (per pakiet)
- 10+ `tsconfig.json`
- `pnpm-workspace.yaml`
- Path aliases

**Mitigacja**: Template dla nowych pakietów, generator CLI

#### 3. Wymaga Dyscypliny

**Problem**: Developer może zignorować granice modułów

```typescript
// ❌ Developer może spróbować:
import { InternalHelper } from '@engine/world/internal';  // ❌ Nie publiczne

// Trzeba enforceować przez:
// - Code review
// - Linter rules (no-restricted-imports)
// - TypeScript paths (hide internal)
```

**Mitigacja**:
- Code review guidelines
- ESLint rule: `no-restricted-imports`
- TypeScript `internal` folder nie w exports

#### 4. Początkowa Wolniejsza Kompilacja

**PRZED**: `tsc` kompiluje src/ (1 pass)

**PO**: `tsc` kompiluje 10 pakietów (10 passes)

**Mitigacja**:
- Turbo (cache kompilacji)
- Dev: `tsc --watch` tylko dla aktywnego pakietu
- CI: Parallel builds

#### 5. Learning Curve dla Zespołu

**Nowe koncepty**:
- Monorepo (pnpm workspaces)
- Package exports
- Path aliases
- Module boundaries

**Mitigacja**:
- Dokumentacja (TEN ADR + guides)
- Pair programming podczas migracji
- Weekly sync na pytania

## Alternatywy

### Alternatywa 1: Status Quo (Odrzucona)

**Opcja**: Zostać przy obecnej strukturze `src/`.

**Pros**:
- ✅ Zero pracy (0 dni)
- ✅ Nie trzeba zmieniać importów

**Cons**:
- ❌ Duplikacje kodu rosną
- ❌ Niemożliwa wymiana komponentów
- ❌ Brak headless server (multiplayer trudny)
- ❌ Brak sandboxu (UGC niebezpieczny)
- ❌ Trudny onboarding nowych devów
- ❌ Nie można spakować jako SDK

**Werdykt**: **Odrzucona**. Obecna struktura nie skaluje się do platformy UGC.

### Alternatywa 2: Big Bang Refactor (Odrzucona)

**Opcja**: Przepisać wszystko naraz w 1 tygodniu.

**Pros**:
- ✅ Szybkie (1 tydzień vs 3 tygodnie)
- ✅ Czysta implementacja od zera

**Cons**:
- ❌ **Wysokie ryzyko**: Projekt nie kompiluje się przez tydzień
- ❌ **Testy nie działają**: Ciężko sprawdzić czy działa
- ❌ **Merge hell**: Konflity z innymi branczami
- ❌ **Stres**: Presja czasu, łatwo popełnić błędy

**Werdykt**: **Odrzucona**. Zbyt ryzykowne. Prefer gradual refactor.

### Alternatywa 3: Polylith (Rozważona, Odrzucona)

**Opcja**: Użyć [Polylith](https://polylith.gitbook.io/) (brick-based architecture).

**Pros**:
- ✅ Maksymalna reusability (bricks)
- ✅ Incremental builds

**Cons**:
- ❌ Overengineering dla małego zespołu
- ❌ Learning curve (nowa metodologia)
- ❌ Małe community (TypeScript support słaby)

**Werdykt**: **Odrzucona**. Monorepo (pnpm) wystarczy. Polylith to overkill.

### Alternatywa 4: Mikroserwisy (Odrzucona)

**Opcja**: Rozdzielić na osobne repozytoria + npm packages.

**Pros**:
- ✅ Maksymalna separacja
- ✅ Możliwość osobnych release cycles

**Cons**:
- ❌ **Overhead**: 10 repozytoriów do zarządzania
- ❌ **Versioning hell**: Zsynchronizować wersje trudne
- ❌ **Dev experience**: Musisz `npm link` 10 pakietów lokalnie

**Werdykt**: **Odrzucona**. Monorepo daje separację bez overhead.

### Wybrana: Gradual Refactor w Monorepo

**Powody**:
- ✅ **Bezpieczne**: Projekt działa po każdej fazie
- ✅ **Iteracyjne**: Możliwość poprawek per faza
- ✅ **Uczenie się**: Zespół uczy się stopniowo
- ✅ **Review**: Code review per faza (małe PRy)
- ✅ **Rollback**: Możliwość wycofania pojedynczej fazy

## Implementacja

### Timeline

**Start**: 2025-10-26
**Koniec**: 2025-10-26 (zakończono szybciej niż planowano)

**Milestones**:
- ✅ 2025-10-26: Faza 0-8 (Wszystkie fazy zakończone)
- ✅ Utworzono modularną architekturę monorepo
- ✅ Wyeliminowano duplikacje kodu (-1823 linie)
- ✅ Dodano @engine/editor-utils i @engine/test-utils
- ✅ Wszystkie testy przechodzą (358 testów green)
- ✅ Dokumentacja zaktualizowana

### Kryteria Sukcesu

Po zakończeniu migracji:

1. ✅ **Zero duplikacji**: Wyeliminowano wszystkie duplikaty (-1823 linie)
2. ✅ **Wszystkie testy**: 358 testów green
3. ✅ **Edytor działa**: `apps/editor` kompiluje się i uruchamia
4. ✅ **Czyste zależności**: `core → world → {gfx, script, input, camera, stdlib}`
5. ✅ **Publikowalne**: Każdy pakiet ma prawidłowy `package.json` z `exports`
6. ✅ **Dokumentacja**: README per pakiet, ARCHITECTURE.md zaktualizowane
7. ✅ **Egzekwowanie granic**: ESLint `no-restricted-imports` blokuje naruszenia

### Rollback Plan

Jeśli migracja się nie uda (np. >50% testów failing):

1. **Revert do pre-migration state**:
   ```bash
   git revert HEAD~8..HEAD  # Cofnij 8 commitów (faz)
   ```

2. **Analiza**: Co poszło nie tak?
   - Testy? → Fix testów w osobnym PR
   - Importy? → Automated refactor tool
   - Performance? → Benchmark per faza

3. **Re-try**: Powtórz migrację z poprawkami

## Metryki

### Przed Migracją (Baseline)

| Metryka | Wartość |
|---------|---------|
| **Struktura** | Hybrid (src/ + src/engine/) |
| **Duplikacje** | 5 duplikatów (scene, physics, animation, audio, logic) |
| **LOC** | ~27,000 linii |
| **Testy** | 358 passing |
| **Build czas** | ~15s |
| **Bundle size** | ~500 KB (prod) |

### Po Migracji (Target)

| Metryka | Wartość | Cel |
|---------|---------|-----|
| **Struktura** | Monorepo (packages/ + apps/) | ✅ |
| **Duplikacje** | 0 | ✅ |
| **LOC** | ~27,000 (bez zmian) | ✅ |
| **Testy** | 358 passing | ✅ |
| **Build czas** | <20s (z cache: <5s) | ✅ |
| **Bundle size** | <500 KB (tree-shaking lepsze) | ✅ |
| **Pakiety** | 10 pakietów | ✅ |
| **Headless** | World działa bez GPU | ✅ |
| **Sandbox** | ScriptRuntime limituje API | ✅ |

## Referencje

### Dokumentacja

1. [ARCHITECTURE.md](../ARCHITECTURE.md) - Wizja modularnego silnika
2. [CURRENT_STRUCTURE.md](../CURRENT_STRUCTURE.md) - Analiza obecnej struktury
3. [TARGET_STRUCTURE.md](../TARGET_STRUCTURE.md) - Docelowa struktura
4. [MODULE_SPECIFICATIONS.md](../MODULE_SPECIFICATIONS.md) - API każdego modułu
5. [MIGRATION_PLAN.md](../MIGRATION_PLAN.md) - Szczegółowy plan migracji (8 faz)
6. [FRAME_MODEL.md](../FRAME_MODEL.md) - Jak działa frame
7. [PERFORMANCE_PHILOSOPHY.md](../PERFORMANCE_PHILOSOPHY.md) - Optymalizacje

### Inspiracje

- **Unity ECS** - Entity-Component-System design
- **Bevy (Rust)** - Modular game engine
- **PlayCanvas** - WebGL engine architecture
- **Roblox** - UGC platform sandbox
- **Turborepo** - Monorepo build system

### Zewnętrzne Zasoby

- [pnpm workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Monorepo best practices](https://monorepo.tools/)

## Autorzy

- Główny architekt: [TBD]
- Contributors: [TBD]
- Review: [TBD]

## Historia Zmian

| Data | Wersja | Zmiany |
|------|--------|--------|
| 2025-10-26 | 1.0 | Pierwsza wersja ADR (draft) |

---

## Podpisy

**Zaakceptowane przez**:

- [ ] Tech Lead
- [ ] Senior Developer
- [ ] Product Owner

**Data**: 2025-10-26


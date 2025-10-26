# Faza 3: Migrate Utilities to Packages - Szczegółowy Plan

**Status:** 📝 PLANNED (not started)  
**Estimated Time:** 3-5 dni roboczych  
**Complexity:** 🟡 Medium  
**Risk:** 🟡 Medium (wymaga nowego pakietu + dependencies update)

## 🎯 Cele Fazy 3

1. Stworzyć nowy pakiet `@engine/editor-utils` dla reużywalnych editor utilities
2. Przenieść `DisposableGroup` do `@engine/core/utils` (bardziej uniwersalny)
3. Przenieść `HistoryManager` + helpers do `@engine/editor-utils`
4. Przenieść `SnapSystem` do `@engine/editor-utils`
5. Ocenić czy `GridRenderer` należy do `@engine/gfx-webgpu` czy edytora

**Expected Impact:** ~1100 linii przeniesione z apps/ do packages/

---

## 📦 Struktura nowego pakietu

```
packages/editor-utils/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── src/
│   ├── index.ts
│   ├── HistoryManager.ts       (from apps/editor/src/editor/history/)
│   ├── HistoryHelpers.ts       (from apps/editor/src/editor/history/)
│   ├── SnapSystem.ts           (from apps/editor/src/editor/snap/)
│   └── SnapConfig.ts           (from apps/editor/src/editor/snap/)
└── __tests__/
    ├── HistoryManager.test.ts
    ├── HistoryHelpers.test.ts
    ├── SnapSystem.test.ts
    └── SnapConfig.test.ts
```

---

## 🔧 Implementacja - Krok po kroku

### TASK 1: Stwórz pakiet @engine/editor-utils (2h)

#### 1.1 Struktura katalogów
```bash
mkdir -p packages/editor-utils/src
mkdir -p packages/editor-utils/__tests__
```

#### 1.2 package.json
```json
{
  "name": "@engine/editor-utils",
  "version": "0.1.0",
  "description": "Reusable editor utilities and tools",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@engine/core": "workspace:*",
    "@engine/world": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^24.7.2",
    "typescript": "^5.9.3",
    "vitest": "^2.1.3"
  }
}
```

#### 1.3 tsconfig.json
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" },
    { "path": "../world" }
  ]
}
```

#### 1.4 vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

#### 1.5 README.md
```markdown
# @engine/editor-utils

Reusable utilities for building 3D editors and tools.

## Features

- **HistoryManager** - Undo/redo system with command pattern
- **SnapSystem** - Grid and object snapping utilities
- More utilities coming soon...

## Usage

\`\`\`typescript
import { HistoryManager, SnapSystem } from '@engine/editor-utils';

const history = new HistoryManager();
const snapSystem = new SnapSystem();
\`\`\`
```

#### 1.6 src/index.ts (placeholder)
```typescript
// Will be populated as we migrate utilities
```

#### 1.7 Verify package structure
```bash
cd packages/editor-utils
pnpm install
pnpm build  # Should succeed even with empty index
```

---

### TASK 2: Przenieś DisposableGroup do @engine/core (3h)

#### 2.1 Analiza zależności
**Current location:** `apps/editor/src/editor/core/DisposableGroup.ts`

**Dependencies check:**
```bash
grep -r "DisposableGroup" apps/editor/src/
```

**Expected usages:** EditorPanelManager, EditorVisualManager, inne managers

#### 2.2 Copy file to @engine/core
```bash
# Copy source
cp apps/editor/src/editor/core/DisposableGroup.ts packages/core/src/utils/DisposableGroup.ts

# Copy test
cp apps/editor/src/editor/core/DisposableGroup.test.ts packages/core/__tests__/DisposableGroup.test.ts
```

#### 2.3 Update package exports
**packages/core/src/utils/index.ts:**
```typescript
export * from './DisposableGroup';
export * from './Logger';  // if exists
// ... other utils
```

**packages/core/src/index.ts:**
```typescript
export * from './utils';
// Ensure utils are exported
```

#### 2.4 Update imports in editor (~5 files)
**Find all usages:**
```bash
grep -r "from '\.\./core/DisposableGroup'" apps/editor/src/
grep -r "from '\./DisposableGroup'" apps/editor/src/editor/core/
```

**Replace pattern:**
```diff
- import { DisposableGroup } from '../core/DisposableGroup';
+ import { DisposableGroup } from '@engine/core/utils';
```

**Files likely affected:**
- `apps/editor/src/editor/panels/EditorPanelManager.ts`
- `apps/editor/src/editor/visuals/EditorVisualManager.ts`
- `apps/editor/src/editor/ui/EditorUI.ts`
- Others...

#### 2.5 Delete from editor
```bash
rm apps/editor/src/editor/core/DisposableGroup.ts
rm apps/editor/src/editor/core/DisposableGroup.test.ts
```

#### 2.6 Verify
```bash
pnpm --filter @engine/core test
pnpm --filter @engine/core build
pnpm --filter @apps/editor build
```

---

### TASK 3: Przenieś HistoryManager do @engine/editor-utils (4h)

#### 3.1 Analiza plików
**Files to move:**
- `apps/editor/src/editor/history/HistoryManager.ts` (~200 linii)
- `apps/editor/src/editor/history/HistoryHelpers.ts` (~150 linii)
- `apps/editor/src/editor/history/HistoryManager.test.ts`
- `apps/editor/src/editor/history/HistoryHelpers.test.ts`

**Dependencies:**
```bash
grep -r "import.*from" apps/editor/src/editor/history/
```

**Expected deps:**
- `@engine/world` (Entity, Scene)
- `@engine/core` (maybe utils)

#### 3.2 Copy files
```bash
# Source files
cp apps/editor/src/editor/history/HistoryManager.ts packages/editor-utils/src/HistoryManager.ts
cp apps/editor/src/editor/history/HistoryHelpers.ts packages/editor-utils/src/HistoryHelpers.ts

# Tests
cp apps/editor/src/editor/history/HistoryManager.test.ts packages/editor-utils/__tests__/HistoryManager.test.ts
cp apps/editor/src/editor/history/HistoryHelpers.test.ts packages/editor-utils/__tests__/HistoryHelpers.test.ts
```

#### 3.3 Update relative imports w przenosionych plikach
**W HistoryManager.ts i HistoryHelpers.ts:**
```diff
- import { Logger } from '../../utils/logger';
+ // Remove Logger import - will be injected via config

- import type { Entity } from '@engine/world';
+ import type { Entity } from '@engine/world';  // OK, keep as is
```

**Dodaj logger config do HistoryManager:**
```typescript
export interface HistoryManagerConfig {
  logger?: {
    debug: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
  };
}

export class HistoryManager {
  private logger: HistoryManagerConfig['logger'];
  
  constructor(config?: HistoryManagerConfig) {
    this.logger = config?.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
    };
  }
  
  // Replace all Logger.debug/warn with this.logger?.debug/warn
}
```

#### 3.4 Update packages/editor-utils/src/index.ts
```typescript
export * from './HistoryManager';
export * from './HistoryHelpers';
```

#### 3.5 Find all HistoryManager usages in editor
```bash
grep -r "HistoryManager\|HistoryHelpers" apps/editor/src/ --include="*.ts"
```

**Files likely affected (~10 files):**
- `EditorUI.ts`
- `EditorModeManager.ts`
- `HistoryPanel.ts`
- `EditorPanelManager.ts`
- Others using undo/redo

#### 3.6 Update imports in editor
```diff
- import { HistoryManager } from '../history/HistoryManager';
- import { HistoryHelpers } from '../history/HistoryHelpers';
+ import { HistoryManager, HistoryHelpers } from '@engine/editor-utils';
```

**Update HistoryManager instantiation with logger:**
```typescript
import { Logger } from '../../utils/logger';

this.history = new HistoryManager({
  logger: {
    debug: Logger.debug.bind(Logger),
    warn: Logger.warn.bind(Logger),
  }
});
```

#### 3.7 Update apps/editor/package.json
```json
{
  "dependencies": {
    "@engine/editor-utils": "workspace:*"
  }
}
```

#### 3.8 Delete from editor
```bash
rm -rf apps/editor/src/editor/history/
```

#### 3.9 Verify
```bash
pnpm install  # Update workspace links
pnpm --filter @engine/editor-utils test
pnpm --filter @engine/editor-utils build
pnpm --filter @apps/editor build
```

---

### TASK 4: Przenieś SnapSystem do @engine/editor-utils (3h)

#### 4.1 Analiza plików
**Files to move:**
- `apps/editor/src/editor/snap/SnapSystem.ts` (~150 linii)
- `apps/editor/src/editor/snap/SnapConfig.ts` (~50 linii)
- `apps/editor/src/editor/snap/SnapSystem.test.ts`

**Dependencies:**
```bash
grep -r "import.*from" apps/editor/src/editor/snap/
```

**Expected deps:**
- `@engine/core/math` (Vec3)
- Minimal external dependencies

#### 4.2 Copy files
```bash
cp apps/editor/src/editor/snap/SnapSystem.ts packages/editor-utils/src/SnapSystem.ts
cp apps/editor/src/editor/snap/SnapConfig.ts packages/editor-utils/src/SnapConfig.ts
cp apps/editor/src/editor/snap/SnapSystem.test.ts packages/editor-utils/__tests__/SnapSystem.test.ts
```

#### 4.3 Update relative imports (if any)
```diff
- import { Logger } from '../../utils/logger';
+ // Remove if exists - use config pattern
```

#### 4.4 Update packages/editor-utils/src/index.ts
```typescript
export * from './HistoryManager';
export * from './HistoryHelpers';
export * from './SnapSystem';
export * from './SnapConfig';
```

#### 4.5 Find all SnapSystem usages
```bash
grep -r "SnapSystem\|SnapConfig" apps/editor/src/ --include="*.ts"
```

**Files likely affected (~6 files):**
- `PlacementMode.ts`
- `EditorPlacementController.ts`
- `GizmoController.ts`
- Others

#### 4.6 Update imports
```diff
- import { SnapSystem } from '../snap/SnapSystem';
- import { SnapConfig } from '../snap/SnapConfig';
+ import { SnapSystem, SnapConfig } from '@engine/editor-utils';
```

#### 4.7 Delete from editor
```bash
rm -rf apps/editor/src/editor/snap/
```

#### 4.8 Verify
```bash
pnpm --filter @engine/editor-utils build
pnpm --filter @apps/editor build
```

---

### TASK 5: Oceń GridRenderer placement (2h)

#### 5.1 Analiza GridRenderer
**Files:**
- `apps/editor/src/editor/grid/GridRenderer.ts` (~300 linii)
- `apps/editor/src/editor/grid/GridConfig.ts` (~50 linii)
- `apps/editor/src/editor/grid/GridShader.ts` (~100 linii)
- Tests

**Dependencies:**
```bash
grep -r "import.*from" apps/editor/src/editor/grid/
```

**Expected deps:**
- `@engine/gfx-webgpu` (WebGPU renderer, shaders)
- `@engine/core/math`

#### 5.2 Opcje placement

**Opcja A: @engine/gfx-webgpu/debug** (PREFEROWANE)
- Pro: GridRenderer jest rendering utility
- Pro: Może być używany jako debug visualization
- Pro: Naturalny fit w gfx-webgpu
- Con: Zwiększa size gfx-webgpu package

**Opcja B: @engine/editor-utils**
- Pro: Editor-specific utility
- Pro: Wszystkie editor utils w jednym miejscu
- Con: Wymaga dependency na @engine/gfx-webgpu
- Con: Nie idealny fit (rendering logic w utils package)

**Opcja C: Zostaw w apps/editor**
- Pro: Zero migration effort
- Pro: Może być bardziej editor-specific niż myślimy
- Con: Nie reużywalne

**Opcja D: Nowy pakiet @engine/editor-gfx**
- Pro: Czysty separation: editor rendering utilities
- Pro: Może zawierać więcej w przyszłości (gizmos, etc.)
- Con: Dodatkowy pakiet (może być overkill)

#### 5.3 Decyzja (do ustalenia)

**Rekomendacja:** **Opcja A** - `@engine/gfx-webgpu/debug/GridRenderer.ts`

**Uzasadnienie:**
- GridRenderer to rendering utility, nie editor workflow
- Naturalny fit w graphics package
- Może być używany w innych renderowanych aplikacjach
- Debug folder jasno oznacza przeznaczenie

**Implementacja jeśli Opcja A:**
```bash
mkdir -p packages/gfx-webgpu/src/debug
cp apps/editor/src/editor/grid/* packages/gfx-webgpu/src/debug/
```

**Update exports:** `packages/gfx-webgpu/src/index.ts`
```typescript
export * from './debug/GridRenderer';
export * from './debug/GridConfig';
```

**Update imports w edytorze:**
```diff
- import { GridRenderer } from '../grid/GridRenderer';
+ import { GridRenderer } from '@engine/gfx-webgpu';
```

**Jeśli Opcja C (zostaw w edytorze):**
- Skip ten task
- GridRenderer pozostaje w apps/editor/src/editor/grid/

---

### TASK 6: Update workspace dependencies (1h)

#### 6.1 Update root tsconfig.json references
**tsconfig.json:**
```json
{
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/world" },
    { "path": "./packages/editor-utils" },  // NEW
    // ... others
  ]
}
```

#### 6.2 Update apps/editor/package.json
```json
{
  "dependencies": {
    "@engine/core": "workspace:*",
    "@engine/world": "workspace:*",
    "@engine/gfx-webgpu": "workspace:*",
    "@engine/assets": "workspace:*",
    "@engine/script": "workspace:*",
    "@engine/input": "workspace:*",
    "@engine/camera": "workspace:*",
    "@engine/stdlib": "workspace:*",
    "@engine/editor-utils": "workspace:*"  // NEW
  }
}
```

#### 6.3 Install dependencies
```bash
pnpm install
```

---

### TASK 7: Comprehensive testing (4h)

#### 7.1 Unit tests
```bash
# Test new package
pnpm --filter @engine/editor-utils test

# Test core package (DisposableGroup)
pnpm --filter @engine/core test

# Test editor
pnpm --filter @apps/editor test
```

#### 7.2 Build verification
```bash
pnpm -r build
```

#### 7.3 Integration testing
```bash
pnpm --filter @apps/editor dev
```

**Manual checklist:**
- [ ] Undo/Redo działa (Ctrl+Z, Ctrl+Y)
- [ ] History panel pokazuje operacje
- [ ] Snap to grid działa
- [ ] Snap settings można zmieniać
- [ ] Grid renderuje się poprawnie
- [ ] Cleanup/dispose systems działają

---

## 📊 Expected Changes

### Nowe pliki
```
packages/editor-utils/
├── package.json              (+40 linii)
├── tsconfig.json             (+15 linii)
├── vitest.config.ts          (+10 linii)
├── README.md                 (+30 linii)
├── src/
│   ├── index.ts              (+4 linie)
│   ├── HistoryManager.ts     (+200 linii)
│   ├── HistoryHelpers.ts     (+150 linii)
│   ├── SnapSystem.ts         (+150 linii)
│   └── SnapConfig.ts         (+50 linii)
└── __tests__/                (+300 linii testów)

packages/core/src/utils/
└── DisposableGroup.ts        (+100 linii)

packages/gfx-webgpu/src/debug/ (jeśli Opcja A)
├── GridRenderer.ts           (+300 linii)
├── GridConfig.ts             (+50 linii)
└── GridShader.ts             (+100 linii)
```

### Usunięte pliki z apps/editor
```
apps/editor/src/editor/
├── core/DisposableGroup.ts       (-100 linii)
├── history/                      (-500 linii całość)
├── snap/                         (-250 linii całość)
└── grid/                         (-500 linii całość, jeśli przenosimy)
```

### Import updates w edytorze (~15-20 plików)

### Net Impact
- **If moving GridRenderer:** ~0 linii (przeniesione, nie usunięte)
- **If keeping GridRenderer:** ~0 linii
- **Main benefit:** Better organization, reusability

---

## 🔍 Szczegółowa analiza plików do przeniesienia

### DisposableGroup.ts
**Lines:** ~100  
**Dependencies:** None (pure utility)  
**Used by:** 
- EditorPanelManager
- EditorVisualManager
- Possibly others

**Complexity:** 🟢 Low

---

### HistoryManager.ts
**Lines:** ~200  
**Dependencies:** 
- `@engine/world` (Entity for serialization)
- Logger (będzie config)

**Used by:**
- EditorUI
- HistoryPanel
- EditorModeManager
- Possibly undo/redo shortcuts

**Complexity:** 🟡 Medium (wymaga logger config pattern)

---

### HistoryHelpers.ts
**Lines:** ~150  
**Dependencies:**
- `@engine/world` (Entity, Scene)
- HistoryManager (same package)

**Used by:**
- HistoryManager
- EditorModeManager
- Others doing entity serialization

**Complexity:** 🟢 Low

---

### SnapSystem.ts
**Lines:** ~150  
**Dependencies:**
- `@engine/core/math` (Vec3)
- SnapConfig (same folder)

**Used by:**
- PlacementMode
- EditorPlacementController
- GizmoController
- Others doing object placement

**Complexity:** 🟢 Low

---

### SnapConfig.ts
**Lines:** ~50  
**Dependencies:** None (pure config)  
**Used by:** SnapSystem

**Complexity:** 🟢 Low

---

### GridRenderer.ts
**Lines:** ~300  
**Dependencies:**
- `@engine/gfx-webgpu` (heavy dependency)
- `@engine/core/math`
- GridConfig, GridShader

**Used by:**
- EditorUI (głównie)
- Możliwe inne miejsca

**Complexity:** 🟡 Medium (rendering code)

**Decision needed:** Move vs Keep

---

## ⚠️ Potencjalne problemy

### Problem 1: Circular dependencies
**Risk:** Medium

**Mitigation:**
- @engine/editor-utils depends on @engine/core and @engine/world (OK)
- @engine/core/utils cannot depend on higher-level packages (OK)
- Verify no cycles after migration

**Check:**
```bash
pnpm list --depth=0 | grep -E "core|world|editor-utils"
```

---

### Problem 2: Logger pattern consistency
**Risk:** Low

**Solution:**
- Use same logger config pattern as CameraDirector and AssetRegistry
- Inject from editor, fallback to console
- Consistent across all packages

---

### Problem 3: Test dependencies
**Risk:** Low

**Solution:**
- Move tests with source code
- Ensure test environment (jsdom) is configured
- vitest.config.ts in each package

---

### Problem 4: Breaking changes in editor
**Risk:** Medium

**Mitigation:**
- Update wszystkie importy w tym samym commit
- Comprehensive testing przed commit
- Git bisect friendly commits (każdy utility osobno?)

---

## 📅 Timeline (3-5 dni)

### Day 1: Setup + DisposableGroup
- [ ] Stwórz @engine/editor-utils package (2h)
- [ ] Przenieś DisposableGroup do @engine/core (3h)
- [ ] Testing i fixes (1h)
- **End of day:** DisposableGroup w @engine/core, package setup done

### Day 2: HistoryManager
- [ ] Przenieś HistoryManager + helpers (2h)
- [ ] Add logger config pattern (1h)
- [ ] Update imports w edytorze (2h)
- [ ] Testing (1h)
- **End of day:** HistoryManager w @engine/editor-utils

### Day 3: SnapSystem
- [ ] Przenieś SnapSystem (1h)
- [ ] Update imports w edytorze (1h)
- [ ] Testing (1h)
- [ ] Comprehensive integration testing (2h)
- **End of day:** SnapSystem w @engine/editor-utils, all integrated

### Day 4: GridRenderer (if moving)
- [ ] Decide placement (opcja A vs C)
- [ ] Move to @engine/gfx-webgpu/debug (2h)
- [ ] Update imports (1h)
- [ ] Testing (2h)
- **End of day:** All utilities migrated

### Day 5: Polish & Documentation
- [ ] Fix any remaining issues (2h)
- [ ] Write @engine/editor-utils README (1h)
- [ ] Update ARCHITECTURE.md (1h)
- [ ] Final comprehensive testing (2h)
- **End of day:** Ready for PR

---

## 🧪 Testing Strategy

### Level 1: Unit Tests
- Each moved file should have working unit tests
- Run tests in new package location
- Verify no regressions

### Level 2: Build Verification
- TypeScript compilation clean
- No circular dependencies
- All packages build successfully

### Level 3: Integration Testing
- Editor builds and runs
- All features using utilities work
- Performance unchanged

### Level 4: Manual Testing
- Undo/redo functionality
- Snap to grid
- Grid display
- Disposal/cleanup

---

## 📝 Commit Strategy

**Option A: One big commit** (fast, harder to review)
```bash
git commit -m "refactor: migrate utilities to packages (Phase 3)"
```

**Option B: Separate commits** (RECOMMENDED)
```bash
git commit -m "feat: create @engine/editor-utils package"
git commit -m "refactor: move DisposableGroup to @engine/core/utils"
git commit -m "refactor: move HistoryManager to @engine/editor-utils"
git commit -m "refactor: move SnapSystem to @engine/editor-utils"
git commit -m "refactor: move GridRenderer to @engine/gfx-webgpu/debug"  # optional
```

**Benefit of B:**
- Git bisect friendly
- Easier code review
- Can revert individual changes if needed
- Clear commit history

---

## ✅ Success Criteria

### Must Have (przed merge):
- [ ] All migrated code builds without errors
- [ ] All tests passing (packages + editor)
- [ ] No circular dependencies
- [ ] Editor functionality unchanged
- [ ] Documentation updated

### Nice to Have:
- [ ] Performance same or better
- [ ] Bundle size same or smaller
- [ ] Code coverage maintained

---

## 🎯 Expected Impact Summary

### Code Organization
```
Before Phase 3:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
apps/editor/src/editor/
├── core/DisposableGroup.ts        (in app)
├── history/                       (in app)
├── snap/                          (in app)
└── grid/                          (in app)

packages/
└── [no editor utilities]

After Phase 3:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
apps/editor/src/editor/
└── [editor-specific code only]

packages/
├── core/src/utils/
│   └── DisposableGroup.ts         ✅ Reusable
├── editor-utils/src/
│   ├── HistoryManager.ts          ✅ Reusable
│   ├── HistoryHelpers.ts          ✅ Reusable
│   ├── SnapSystem.ts              ✅ Reusable
│   └── SnapConfig.ts              ✅ Reusable
└── gfx-webgpu/src/debug/
    └── GridRenderer.ts             ✅ Reusable (if moved)
```

### Reusability
- HistoryManager → Can be used in any tool needing undo/redo
- SnapSystem → Can be used in any 3D editor/modeler
- GridRenderer → Can be used in any 3D visualization
- DisposableGroup → Can be used anywhere for resource management

### Maintenance
- Single source of truth for each utility
- Easier to test in isolation
- Clear package boundaries
- Better discoverability

---

## 🚀 How to Start Phase 3

### When current PR is merged:
```bash
# Pull merged changes
git checkout main
git pull origin main

# Create new branch for Phase 3
git checkout -b refactor/migrate-editor-utilities

# Start with TASK 1
# Follow step-by-step plan above
```

### Or if starting before merge:
```bash
# Base Phase 3 on current branch
git checkout refactor/remove-code-duplicates

# Create feature branch from it
git checkout -b refactor/migrate-editor-utilities

# Start implementation
```

---

## 📚 Files to Review

Before starting Phase 3, review:
1. Current files to move (understand dependencies)
2. Package structure (where things should go)
3. Import patterns (consistency)
4. Test coverage (what needs to move)

**Commands:**
```bash
# Analyze DisposableGroup
cat apps/editor/src/editor/core/DisposableGroup.ts

# Analyze HistoryManager
cat apps/editor/src/editor/history/HistoryManager.ts

# Analyze SnapSystem
cat apps/editor/src/editor/snap/SnapSystem.ts

# Analyze GridRenderer
cat apps/editor/src/editor/grid/GridRenderer.ts
```

---

## ❓ Questions to Answer Before Starting

1. **GridRenderer placement?**
   - Move to @engine/gfx-webgpu/debug?
   - Move to @engine/editor-utils?
   - Keep in apps/editor?

2. **Package naming?**
   - @engine/editor-utils (OK)
   - @engine/editor-tools (alternative)
   - @engine/history + @engine/snap (separate small packages)

3. **All at once or incremental?**
   - All utilities in one PR
   - Each utility in separate commit
   - Each utility in separate PR (overkill)

4. **Tests migration?**
   - Move all tests with source
   - Rewrite tests in packages
   - Keep some tests in editor (integration)

---

**Status:** 📝 **PLAN READY**  
**Next:** Uzyskaj feedback na Phase 1-2, potem start Phase 3

**Estimated total for Phase 3:** 3-5 dni roboczych  
**Complexity:** Medium  
**Impact:** High (better organization, reusability)


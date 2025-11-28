# Test Infrastructure Guide

> Kompleksowy przewodnik po infrastrukturze testowej dla UGC 3D Platform

## Spis treści

- [Przegląd](#przegląd)
- [Typy testów](#typy-testów)
- [Integration Tests](#integration-tests)
- [Performance Tests](#performance-tests)
- [Visual Regression Tests](#visual-regression-tests)
- [Komendy](#komendy)
- [CI/CD](#cicd)
- [Best Practices](#best-practices)

---

## Przegląd

Infrastruktura testowa składa się z trzech głównych modułów w `@engine/test-utils`:

| Moduł | Cel | Narzędzie |
|-------|-----|-----------|
| **integration** | Testy interakcji między pakietami | Vitest |
| **performance** | Testy regresji wydajności | Vitest + baselines |
| **visual** | Testy regresji wizualnej | Playwright + WebGPU |

---

## Typy testów

### 1. Unit Tests (istniejące)
- Testują pojedyncze funkcje/klasy w izolacji
- Szybkie, bez zależności zewnętrznych
- Uruchamiane przy każdym PR

### 2. Integration Tests (nowe)
- Testują interakcje między pakietami `@engine/*`
- Weryfikują poprawność granic pakietów
- Testują przepływ zdarzeń między modułami

### 3. Performance Tests (nowe)
- Śledzą wydajność względem baseline'ów
- Wykrywają regresje wydajności
- Egzekwują budżety czasowe

### 4. Visual Regression Tests (rozbudowane)
- Porównują renderowane obrazy z golden masters
- Wykrywają wizualne regresje w shaderach
- Używają WebGPU przez Playwright

---

## Integration Tests

### Importowanie

```typescript
import {
  createIntegrationContext,
  createEventCapture,
  runIntegrationScenario,
  packageMocks,
  validatePackageBoundaries,
  expectCrossPackageSuccess,
} from '@engine/test-utils';
```

### Walidacja granic pakietów

```typescript
// Sprawdź czy import jest dozwolony
const isValid = validatePackageBoundaries('@engine/world', '@engine/core');
// true - world może importować z core

const isInvalid = validatePackageBoundaries('@engine/core', '@engine/world');
// false - core NIE może importować z world (circular dep)
```

### Event Capture

```typescript
const capture = createEventCapture<{ value: number }>();

// Przechwytuj zdarzenia
capture.capture('entity:created', { value: 1 });
capture.capture('entity:destroyed', { value: 2 });

// Filtruj po typie
const createEvents = capture.getByType('entity:created');

// Czekaj na zdarzenie (async)
const data = await capture.waitFor('entity:updated', 5000);
```

### Package Mocks

```typescript
// Mock EventBus
const eventBus = packageMocks.createEventBusMock();
eventBus.on('test', handler);
eventBus.emit('test', data);

// Mock Entity
const entity = packageMocks.createEntityMock(1, 'TestEntity');
entity.addComponent('transform', { x: 0, y: 0, z: 0 });

// Mock Scene
const scene = packageMocks.createSceneMock();
const entity = scene.createEntity('Entity');
scene.query(['transform', 'mesh']); // Query entities
```

### Integration Scenarios

```typescript
const result = await runIntegrationScenario({
  name: 'World-Animation Integration',
  packages: ['@engine/world', '@engine/animation'],
  setup: () => ({
    scene: packageMocks.createSceneMock(),
    animSystem: packageMocks.createAnimationSystemMock(),
  }),
  teardown: (ctx) => {
    ctx.scene.dispose();
  },
  steps: [
    {
      name: 'Create animated entity',
      action: (ctx) => {
        const entity = ctx.scene.createEntity('Animated');
        entity.addComponent('animation', { clips: [] });
        ctx.animSystem.play();
      },
      validate: (ctx) => {
        expect(ctx.animSystem.play).toHaveBeenCalled();
      },
    },
  ],
});

expectCrossPackageSuccess(result);
```

---

## Performance Tests

### Importowanie

```typescript
import {
  runPerformanceTest,
  measureIterations,
  createFrameTimeTracker,
  expectWithinBudget,
  expectNoRegression,
  performanceBudgets,
  generatePerformanceReport,
} from '@engine/test-utils';
```

### Podstawowy test wydajności

```typescript
const result = await runPerformanceTest(
  {
    name: 'entity-creation-1k',
    metricType: 'time_ms',
    budget: {
      max: 100, // max 100ms
      maxRegressionPercent: 15, // max 15% regression
    },
    warmupIterations: 5,
    iterations: 50,
  },
  () => {
    // Kod do zmierzenia
    for (let i = 0; i < 1000; i++) {
      scene.createEntity(`Entity${i}`);
    }
  }
);

expectWithinBudget(result);
```

### Pre-defined Budgets

```typescript
// 60 FPS budget (16.67ms per frame)
performanceBudgets.frame60fps

// 30 FPS budget (33.33ms per frame)
performanceBudgets.frame30fps

// Startup time
performanceBudgets.startup // max 3000ms

// Entity creation
performanceBudgets.entityCreation1k // max 100ms

// Physics step
performanceBudgets.physicsStep // max 8ms
```

### Frame Time Tracking

```typescript
const tracker = createFrameTimeTracker();

// W pętli renderowania
for (let frame = 0; frame < 100; frame++) {
  const start = performance.now();
  renderFrame();
  tracker.record(performance.now() - start);
}

const frameTimeStats = tracker.getStats();
const fpsStats = tracker.getFps();

console.log(`Mean frame time: ${frameTimeStats.mean}ms`);
console.log(`Mean FPS: ${fpsStats.mean}`);
```

### Baseline Management

Baselines są zapisywane w `test-results/performance-baselines.json`:

```typescript
// Automatyczne porównanie z baseline
const result = await runPerformanceTest({
  name: 'my-operation',
  metricType: 'time_ms',
  budget: { maxRegressionPercent: 10 },
  updateBaseline: false, // true = update baseline on success
}, fn);

// Sprawdź regresję
expectNoRegression(result, 10); // max 10% regression
```

### Report Generation

```typescript
const results = [result1, result2, result3];
const report = generatePerformanceReport(results);

printPerformanceReport(report);
// === Performance Test Report ===
// ✓ entity-creation-1k (5% change)
//     Mean: 45.23ms
//     P95: 52.10ms
// ✗ physics-step (25% change)
//     Mean: 12.45ms
//     ⚠ Regression 25% exceeds threshold 10%
```

---

## Visual Regression Tests

### Importowanie

```typescript
import {
  compareImages,
  createGoldenMasterRunner,
  expectVisualMatch,
  expectImagesSimilar,
  visualPresets,
} from '@engine/test-utils';
```

### Golden Master Testing

```typescript
const runner = createGoldenMasterRunner({
  goldenDir: 'test-results/goldens',
  actualDir: 'test-results/actual',
  diffDir: 'test-results/diffs',
  defaultOptions: visualPresets.standard,
  updateOnMissing: true, // Create golden if missing
});

// Porównaj obraz z golden master
const result = runner.compare('my-render-test', capturedImage);
expectVisualMatch(result);
```

### Visual Presets

```typescript
// Exact match (no tolerance)
visualPresets.exact
// { maxDiffPercent: 0, pixelThreshold: 0 }

// Strict match
visualPresets.strict
// { maxDiffPercent: 0.01, pixelThreshold: 1 }

// Standard match (recommended)
visualPresets.standard
// { maxDiffPercent: 0.1, pixelThreshold: 5, ignoreAntialiasing: true }

// Lenient match (for dynamic content)
visualPresets.lenient
// { maxDiffPercent: 1, pixelThreshold: 10 }

// Clouds (high tolerance for noise)
visualPresets.clouds
// { maxDiffPercent: 5, pixelThreshold: 15 }
```

### Playwright WebGPU Tests

```typescript
// packages/gfx-webgpu/tests/visual/my-shader.spec.ts
import { test, expect } from '@playwright/test';
import { ensureWebGPU } from '../helpers/webgpu';

test('renders my shader correctly', async ({ page }) => {
  await ensureWebGPU(page);
  
  await page.evaluate(async () => {
    // Setup WebGPU and render
    const canvas = document.createElement('canvas');
    canvas.id = 'test-canvas';
    // ... render code ...
  });
  
  const canvas = page.locator('#test-canvas');
  await expect(canvas).toHaveScreenshot('my-shader.png', {
    maxDiffPixelRatio: 0.01,
  });
});
```

### Ignoring Regions

```typescript
const result = compareImages(expected, actual, {
  ignoreRegions: [
    { x: 0, y: 0, width: 100, height: 20 }, // Ignore timestamp area
  ],
});
```

---

## Komendy

### Test Commands

```bash
# Unit tests
pnpm test:unit              # Run all unit tests
pnpm test:unit:fast         # Fast run (no coverage)
pnpm test:watch             # Watch mode
pnpm test:changed           # Only changed files

# Integration tests
pnpm test:integration       # Run integration tests

# Performance tests
pnpm test:perf              # Run performance tests
pnpm update:baselines       # Update performance baselines

# Visual tests
pnpm test:visual            # Run visual regression tests
pnpm test:webgpu            # Run all WebGPU tests
pnpm update:goldens         # Update golden masters

# All tests
pnpm test:infra             # Run test infrastructure
pnpm test:infra:all         # Run all tests in CI mode
```

### Running Specific Tests

```bash
# Run specific test file
pnpm vitest run path/to/test.ts

# Run tests matching pattern
pnpm vitest run --grep "entity creation"

# Run with coverage
pnpm test:coverage
```

---

## CI/CD

### GitHub Actions Workflow

Workflow `.github/workflows/test-infrastructure.yml` uruchamia:

1. **Unit Tests** - Na każdym PR
2. **Integration Tests** - Na każdym PR
3. **Performance Tests** - Na każdym PR + nightly (baselines)
4. **Visual Tests** - Na każdym PR

### Nightly Baseline Updates

Baselines są aktualizowane automatycznie co noc o 3:00 UTC.

### Manual Baseline Update

```bash
# W GitHub Actions:
# Actions → Test Infrastructure → Run workflow → update_baselines: true
```

### Artifacts

- `performance-results` - Wyniki testów wydajności (30 dni)
- `performance-baselines` - Baselines (90 dni)
- `visual-test-results` - Wyniki testów wizualnych (7 dni)
- `visual-goldens` - Golden masters (30 dni)

---

## Best Practices

### Integration Tests

1. **Testuj granice pakietów** - Używaj `validatePackageBoundaries()`
2. **Używaj event capture** - Do weryfikacji przepływu zdarzeń
3. **Dispose w teardown** - Zawsze cleanup w `teardown`
4. **Izoluj testy** - Każdy test ma fresh context

### Performance Tests

1. **Warmup** - Zawsze używaj warmup iterations
2. **Dostateczna liczba próbek** - Min. 30 iterations
3. **Realistyczne budżety** - Nie za ciasne, nie za luźne
4. **Monitoruj regresje** - Ustaw `maxRegressionPercent`
5. **Aktualizuj baselines świadomie** - Tylko po review

### Visual Tests

1. **Deterministyczne renderowanie** - Unikaj noise/randomness
2. **Małe rozdzielczości** - 256x256 wystarczy dla wielu testów
3. **Używaj presetów** - `visualPresets.standard` dla większości
4. **Ignore anti-aliasing** - `ignoreAntialiasing: true`
5. **Dokumentuj tolerancje** - Komentuj nietypowe thresholds

### General

1. **Nazwy testów** - Opisowe, wskazujące co testują
2. **Assertions** - Używaj dedykowanych assertions
3. **Error messages** - Dodawaj kontekst do failures
4. **Cleanup** - Dispose, clearMocks, clearTimers
5. **Timeout** - Ustaw sensowne timeouts

---

## Troubleshooting

### "WebGPU not available"

```bash
# Upewnij się, że Chromium jest zainstalowany
pnpm exec playwright install chromium --with-deps
```

### "Baseline not found"

```bash
# Utwórz baseline przy pierwszym uruchomieniu
pnpm test:perf --update-baselines
```

### "Visual diff too high"

```bash
# Sprawdź diff image w test-results/diffs/
# Jeśli zmiana jest zamierzona:
pnpm update:goldens
```

### "Integration test timeout"

```typescript
// Zwiększ timeout w config
const result = await runIntegrationScenario({
  // ...
  steps: [
    { name: 'Slow step', action: fn, timeout: 10000 },
  ],
});
```

---

## Powiązane dokumenty

- [AI_CONTEXT.md](../../AI_CONTEXT.md) - Kontekst projektu
- [CODEBASE_PATTERNS.md](../../CODEBASE_PATTERNS.md) - Wzorce projektowe
- [docs/TESTING.md](../TESTING.md) - Ogólna dokumentacja testów
- [TEST_COMMANDS_CHEATSHEET.md](../../TEST_COMMANDS_CHEATSHEET.md) - Ściągawka komend

---

**Ostatnia aktualizacja:** Listopad 2025  
**Maintainer:** Tech Team


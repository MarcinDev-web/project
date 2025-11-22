# 🤖 Test Automation Guide

Kompleksowy przewodnik po automatyzacji testów w projekcie.

## 📋 Spis Treści

- [Przegląd](#przegląd)
- [CI/CD Pipeline](#cicd-pipeline)
- [Pre-commit Hooks](#pre-commit-hooks)
- [Coverage Tracking](#coverage-tracking)
- [Test Utilities](#test-utilities)
- [Best Practices](#best-practices)

## Przegląd

Projekt wykorzystuje kompletną automatyzację testów:

- ✅ **GitHub Actions CI/CD** - automatyczne testy dla każdego PR/push
- ✅ **Pre-commit Hooks** - testy przed commitem (tylko zmienione pliki)
- ✅ **Coverage Tracking** - śledzenie pokrycia kodu testami
- ✅ **Test Utilities** - reużywalne mocki, fixtures, helpery
- ✅ **Snapshot Testing** - stabilność serializacji
- ✅ **Test Sharding** - równoległe uruchamianie testów w CI

## CI/CD Pipeline

### Workflow: `.github/workflows/ci.yml`

```yaml
# Automatyczne uruchomienie dla:
- push do main/develop
- pull requests
- manual trigger (workflow_dispatch)
```

#### Jobs:

1. **Lint** - sprawdzanie stylu kodu
2. **Unit Tests (4 shardy)** - testy jednostkowe z podziałem
3. **Integration Tests** - testy integracyjne
4. **Build** - budowanie pakietów
5. **Test Report** - raport pokrycia kodu

#### Test Sharding

Testy są dzielone na 4 równoległe joby dla szybszego wykonania:

```bash
# W CI każdy shard działa równolegle
pnpm test:unit -- --shard=1/4  # Job 1
pnpm test:unit -- --shard=2/4  # Job 2
pnpm test:unit -- --shard=3/4  # Job 3
pnpm test:unit -- --shard=4/4  # Job 4
```

#### Cache Strategy

- **pnpm cache** - zależności są cachowane między runami
- **Vitest cache** - wyniki testów są cachowane
- **Artifacts** - build i coverage są zapisywane na 7 dni

## Pre-commit Hooks

### Instalacja

```bash
# Automatyczna instalacja po `pnpm install`
pnpm install
```

Hooks są zarządzane przez **Husky** i **lint-staged**.

### Pre-commit

Uruchamia się **przed commitem**:

```bash
# Dla plików TypeScript
- ESLint --fix (auto-naprawa)
- Vitest related (tylko testy powiązane ze zmianami)

# Dla plików JSON/MD/YAML
- Prettier --write (formatowanie)
```

### Pre-push

Uruchamia się **przed pushem**:

```bash
# Pełna suite testów jednostkowych (szybka wersja)
pnpm test:unit:fast
```

### Konfiguracja

```json
// package.json
"lint-staged": {
  "*.{ts,tsx}": [
    "eslint --fix",
    "vitest related --run --coverage.enabled=false"
  ],
  "*.{json,md,yml,yaml}": [
    "prettier --write"
  ]
}
```

## Coverage Tracking

### Lokalne uruchomienie

```bash
# Unit tests z coverage
pnpm test:unit:coverage

# Integration tests z coverage
pnpm test:integration -- --coverage

# Wszystko
pnpm test:coverage

# Zobacz raport w przeglądarce
open coverage/index.html
```

### Konfiguracja

**Thresholds (vitest.workspace.ts):**

```typescript
coverage: {
  thresholds: {
    lines: 60,      // 60% linii kodu
    functions: 60,  // 60% funkcji
    branches: 50,   // 50% gałęzi
    statements: 60, // 60% instrukcji
  },
  perFile: true,    // Sprawdzanie per plik
}
```

### CI Coverage Report

- **Codecov** - uploadowanie coverage do Codecov
- **PR Comments** - automatyczne komentarze z pokryciem w PR
- **GitHub Summary** - podsumowanie w CI runs

### .codecov.yml

```yaml
coverage:
  range: "50...90"  # Zakres kolorowania
  status:
    project:
      target: auto  # Porównanie z bazą
      threshold: 1% # Tolerancja spadku
```

## Test Utilities

### Instalacja

```bash
pnpm add -D @engine/test-utils
```

### Użycie

#### Mocks

```typescript
import { createMockCanvas, createMockGPUDevice } from '@engine/test-utils';

test('renders', () => {
  const canvas = createMockCanvas(800, 600);
  renderer.setCanvas(canvas);
  expect(canvas.getContext).toHaveBeenCalled();
});
```

#### Fixtures

```typescript
import { vec3Fixtures, entityFixtures, sceneFixtures } from '@engine/test-utils';

test('creates entity', () => {
  const entity = entityFixtures.withTransform();
  scene.addEntity(entity);
  expect(scene.entities).toHaveLength(1);
});
```

#### Assertions

```typescript
import { expectVec3ToBeCloseTo, expectToExecuteWithin } from '@engine/test-utils';

test('calculates position', () => {
  const pos = calculatePosition();
  expectVec3ToBeCloseTo(pos, [1, 2, 3], 2);
});

test('performance', async () => {
  await expectToExecuteWithin(() => {
    system.update(entities);
  }, 16); // 60 FPS target
});
```

#### Helpers

```typescript
import { waitFor, benchmark, randomData } from '@engine/test-utils';

test('async operation', async () => {
  await waitFor(() => entity.isLoaded, 5000);
  expect(entity.isLoaded).toBe(true);
});

test('performance benchmark', async () => {
  const bench = benchmark(() => compute(), 1000);
  const results = await bench();
  expect(results.average).toBeLessThan(1);
});

test('random data', () => {
  const num = randomData.int(0, 100);
  const str = randomData.string(10);
  expect(num).toBeGreaterThanOrEqual(0);
  expect(str).toHaveLength(10);
});
```

#### Snapshots

```typescript
import { expectSceneToMatchSnapshot } from '@engine/test-utils';

test('serialization snapshot', () => {
  const scene = createTestScene();
  expectSceneToMatchSnapshot(scene, {
    exclude: ['_internal', 'timestamp'],
    sortArrays: true,
  });
});
```

## Best Practices

### ✅ DO

1. **Używaj test:watch podczas development**
   ```bash
   pnpm test:watch
   ```

2. **Uruchamiaj test:changed przed commitem**
   ```bash
   pnpm test:changed
   ```

3. **Sprawdzaj coverage okresowo**
   ```bash
   pnpm test:coverage
   ```

4. **Używaj test utilities zamiast tworzyć własne mocki**
   ```typescript
   // ✅ GOOD
   import { createMockCanvas } from '@engine/test-utils';
   
   // ❌ BAD - reinventing the wheel
   const canvas = { /* ... */ };
   ```

5. **Pisz snapshots dla serializacji**
   ```typescript
   expectSceneToMatchSnapshot(scene);
   ```

### ❌ DON'T

1. **Nie skipuj testów bez powodu**
   ```typescript
   // ❌ BAD
   it.skip('test', () => { /* ... */ });
   ```

2. **Nie commituj failing testów**
   - Pre-commit hook powinien to złapać

3. **Nie ignoruj coverage warnings**
   - Monitoruj thresholds

4. **Nie duplikuj mock logic**
   - Używaj @engine/test-utils

5. **Nie testuj implementation details**
   - Test behavior, not internals

## Komendy

### Development

```bash
pnpm test:watch         # Watch mode (fastest feedback)
pnpm test:changed       # Tylko zmienione (pre-commit)
pnpm test:unit:fast     # Szybki run bez coverage
pnpm test:ui            # Vitest UI (visual)
```

### CI/Production

```bash
pnpm test:ci            # Optymalizowane dla CI
pnpm test:coverage      # Z pełnym coverage
pnpm test:affected      # Bail on first failure
```

### Debugging

```bash
# Konkretny plik
pnpm test:unit -- path/to/file.test.ts

# Verbose output
pnpm test:unit -- --reporter=verbose

# Grep pattern
pnpm test:unit -- -t "specific test name"

# Tylko failed
pnpm test:unit -- --only-failed
```

## Metryki

### Obecna wydajność

- **Test Execution**: ~8.7s (79% szybsze niż wcześniej)
- **CI Total Time**: ~5-7 minut (z shardingiem)
- **Pre-commit**: ~2-5s (tylko zmienione pliki)
- **Watch Mode**: ~1-3s (instant feedback)

### Coverage Targets

- **Unit Tests**: 60% lines, 60% functions
- **Integration Tests**: 50% lines, 50% functions
- **Critical Paths**: 80%+ (ręczna weryfikacja)

## Troubleshooting

### Pre-commit hook nie działa

```bash
# Reinstalacja hooks
rm -rf .husky
pnpm install
```

### Testy timeout

```typescript
// Zwiększ timeout dla konkretnego testu
test('slow test', async () => {
  // ...
}, 10000); // 10s timeout
```

### Coverage nie generuje się

```bash
# Sprawdź czy @vitest/coverage-v8 jest zainstalowany
pnpm add -D @vitest/coverage-v8

# Wymuś rebuild
rm -rf coverage node_modules/.vitest
pnpm test:coverage
```

### CI fails ale lokalnie działa

```bash
# Sprawdź różnice w environment
pnpm test:ci  # Lokalnie symuluj CI

# Sprawdź cache
rm -rf node_modules/.vitest
```

## Dalsze Ulepszenia

Potencjalne przyszłe ulepszenia:

1. **Mutation Testing** - testowanie jakości testów
2. **Visual Regression Testing** - screenshot diffing
3. **E2E Tests** - Playwright dla full user flows
4. **Performance Regression** - continuous benchmarking
5. **Test Generation** - AI-assisted test creation

## Więcej Informacji

- [TEST_COMMANDS_CHEATSHEET.md](../TEST_COMMANDS_CHEATSHEET.md) - Quick reference
- [docs/TESTING.md](./TESTING.md) - Philosophy
- [docs/TEST_OPTIMIZATION.md](./TEST_OPTIMIZATION.md) - Performance
- [@engine/test-utils README](../packages/test-utils/README.md) - API docs

---

**Pytania?** Zobacz dokumentację lub przeglądaj istniejące testy jako przykłady.


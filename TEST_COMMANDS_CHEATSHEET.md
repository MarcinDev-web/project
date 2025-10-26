# 🧪 Test Commands - Cheat Sheet

## Quick Reference

### 🚀 Development (najszybsze)

```bash
# Watch mode - uruchamia related tests przy zmianie
pnpm test:watch

# Single run - najszybsza opcja
pnpm test:unit:fast

# Tylko zmienione pliki
pnpm test:changed
```

### 🔍 Debugging

```bash
# Verbose output z czasami
pnpm test:unit -- --reporter=verbose

# Konkretny plik
pnpm test:unit -- path/to/file.test.ts

# Pattern matching
pnpm test:unit -- --grep="Animation"

# Bail on first failure
pnpm test:affected
```

### 🎯 Selective Testing

```bash
# Tylko testy unit
pnpm test:unit

# Tylko testy integration
pnpm test:integration

# Wszystkie testy
pnpm test
```

### 🔄 CI/CD

```bash
# Optymalizowane dla CI
pnpm test:ci

# Z coverage (wolniejsze)
pnpm test:unit -- --coverage
```

## Czas wykonania

| Komenda | Czas | Use Case |
|---------|------|----------|
| `test:unit:fast` | ~8s | Szybki feedback |
| `test:changed` | ~2-5s | Pre-commit |
| `test:watch` | ~1-3s | Live development |
| `test:unit` | ~10s | Full unit suite |
| `test:integration` | ~15s | Integration suite |

## Environment Tips

### Automatyczny wybór

Nie musisz nic robić - environment jest wybierany automatycznie:

| Location | Environment | Speed |
|----------|-------------|-------|
| `packages/**/*.test.ts` | node | ⚡⚡⚡ |
| `apps/editor/**/*.test.ts` | jsdom | ⚡⚡ |
| `**/*UI*.test.ts` | jsdom | ⚡⚡ |

### Ręczne polyfills (jeśli potrzebne)

```typescript
import { initWebGPUPolyfills } from '../test/setup';

beforeAll(() => {
  initWebGPUPolyfills();
});
```

## Performance Tricks

### ✅ Szybkie testy

```typescript
// Concurrent dla niezależnych testów
describe.concurrent('Utils', () => {
  test('fast operation 1', () => { /* ... */ });
  test('fast operation 2', () => { /* ... */ });
});

// Umieść pure logic w packages/
// packages/core/math.test.ts → automatycznie node env
```

### ❌ Unikaj

```typescript
// ❌ Nie importuj zbędnych dependencies w top-level
import { HeavyModule } from './heavy';  // ładowane dla każdego testu

// ✅ Import wewnątrz testu
test('uses heavy module', async () => {
  const { HeavyModule } = await import('./heavy');
  // ...
});

// ❌ Nie zostawiaj listeners/timers
test('animation', () => {
  setInterval(() => {}, 100);  // LEAK!
});

// ✅ Zawsze cleanup
afterEach(() => {
  vi.clearAllTimers();
});
```

## Vitest UI (experimental)

```bash
# Visual test runner
pnpm exec vitest --ui

# Opens browser at localhost:51204
```

## Common Patterns

### Setup/Teardown

```typescript
describe('Feature', () => {
  let scene: Scene;
  let system: System;

  beforeEach(() => {
    scene = new Scene();
    system = new System(scene);
  });

  afterEach(() => {
    system.dispose();
    scene.dispose();
  });

  test('works', () => {
    expect(system.isReady()).toBe(true);
  });
});
```

### Async tests

```typescript
// ✅ async/await
test('loads data', async () => {
  const data = await loadData();
  expect(data).toBeDefined();
});

// ✅ With timeout
test('slow operation', async () => {
  await slowOperation();
}, 10000);  // 10s timeout
```

### Mocking

```typescript
// Mock module
vi.mock('@engine/world', () => ({
  Scene: vi.fn(),
  Entity: vi.fn(),
}));

// Mock function
const mockFn = vi.fn();
mockFn.mockReturnValue(42);

// Clear after test
afterEach(() => {
  vi.clearAllMocks();
});
```

## Filter Shortcuts

```bash
# By file pattern
pnpm test:unit -- Animation

# By test name
pnpm test:unit -- -t "should render"

# Exclude pattern
pnpm test:unit -- --exclude="**/integration/**"
```

## Debugging Failed Tests

### 1. Verbose output

```bash
pnpm test:unit -- --reporter=verbose path/to/failing.test.ts
```

### 2. Only failed test

```bash
pnpm test:unit -- --reporter=verbose -t "specific test name"
```

### 3. Check environment

```typescript
// Add to test
console.log('Environment:', typeof window);
// node: 'undefined'
// jsdom: 'object'
```

### 4. Isolate test

```bash
# Run only one test file
pnpm test:unit -- --isolate path/to/test.ts
```

## Watch Mode Tips

```bash
# Domyślnie
pnpm test:watch

# W watch mode, dostępne komendy:
# [a] - run all tests
# [f] - run failed tests
# [u] - update snapshots
# [p] - filter by pattern
# [q] - quit
```

## Advanced

### Coverage

```bash
# Generate coverage report
pnpm test:unit -- --coverage

# View in browser
open coverage/index.html
```

### Benchmarking

```typescript
import { bench } from 'vitest';

bench('fast operation', () => {
  compute(100);
});

bench('slow operation', () => {
  compute(10000);
});
```

### Custom reporter

```bash
# JSON output
pnpm test:unit -- --reporter=json > test-results.json

# JUnit XML (for CI)
pnpm test:unit -- --reporter=junit
```

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests timeout | Increase timeout: `test('name', async () => {}, 10000)` |
| Memory leak | Check `afterEach` cleanup |
| Flaky tests | Check for shared state, use proper mocks |
| Slow tests | Move to packages/ for node env |
| Import errors | Check `deps.inline` in vitest.workspace.ts |

## More Help

- [`docs/TEST_OPTIMIZATION.md`](docs/TEST_OPTIMIZATION.md) - Full optimization guide
- [`TEST_OPTIMIZATION_SUMMARY.md`](TEST_OPTIMIZATION_SUMMARY.md) - Quick summary
- [`docs/TESTING.md`](docs/TESTING.md) - Testing philosophy
- [Vitest Docs](https://vitest.dev/) - Official documentation

---

**Pro Tip**: Używaj `pnpm test:watch` podczas development dla natychmiastowego feedbacku! ⚡


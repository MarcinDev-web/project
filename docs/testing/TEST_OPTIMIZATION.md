# Test Optimization Guide

## Osiągnięte rezultaty

Po zastosowaniu optymalizacji, czas wykonywania testów został zredukowany o **79%**:

- **Przed**: 41.27s
- **Po**: 8.64s
- **Przyspieszenie**: ~4.8x

### Szczegółowy breakdown

| Metric | Przed | Po | Poprawa |
|--------|-------|-----|---------|
| Environment setup | 279.20s | 50ms | **558x szybciej** |
| Transform | 12.84s | 6.87s | 47% szybciej |
| Test execution | 22.31s | 4.44s | 80% szybciej |
| **Total** | **41.27s** | **8.64s** | **79% szybciej** |

## Zastosowane optymalizacje

### 1. **Selektywne użycie environment**

```typescript
// vitest.workspace.ts
{
  environment: 'node',  // Domyślnie node (szybszy)
  environmentMatchGlobs: [
    // jsdom tylko dla testów wymagających DOM
    ['**/editor/**/*.test.ts', 'jsdom'],
    ['**/*UI*.test.ts', 'jsdom'],
  ]
}
```

**Korzyść**: Node environment jest ~558x szybszy niż jsdom przy inicjalizacji.

### 2. **Wyłączenie izolacji na poziomie plików**

```typescript
{
  isolate: false,  // Izolacja na poziomie testów, nie plików
  poolOptions: {
    threads: {
      isolate: false,
      useAtomics: true,  // Shared memory dla workerów
    }
  }
}
```

**Korzyść**: Redukcja overhead z tworzenia nowych worker processów dla każdego pliku testowego.

### 3. **Optymalizacja thread pool**

```typescript
const cpuCount = getSuggestedThreadCount();

{
  poolOptions: {
    threads: {
      minThreads: Math.max(2, Math.floor(cpuCount / 2)),
      maxThreads: cpuCount,
      useAtomics: true,
    }
  }
}
```

**Korzyść**: Wykorzystanie wszystkich dostępnych CPU cores z odpowiednim balansem.

### 4. **Różne pool types dla różnych testów**

- **Unit tests**: `pool: 'threads'` - szybsze dla CPU-bound operations
- **Integration tests**: `pool: 'forks'` - lepsze dla I/O operations

### 5. **Inlining dependencies**

```typescript
{
  deps: {
    inline: [/@engine\/.*/],  // Inline własnych packages
  }
}
```

**Korzyść**: Eliminacja overhead z rozwiązywania external modules.

### 6. **Caching**

```typescript
{
  cache: {
    dir: 'node_modules/.vitest/cache',
  }
}
```

**Korzyść**: Przechowywanie skompilowanych testów między uruchomieniami.

### 7. **Lazy loading polyfills**

```typescript
// apps/editor/src/test/setup.ts
export function initBrowserPolyfills() {
  // Ładowane tylko gdy potrzebne
}

export function initWebGPUPolyfills() {
  // Ładowane tylko dla testów WebGPU
}
```

**Korzyść**: Setup file nie obciąża każdego testu niepotrzebnymi polyfills.

### 8. **Optymalizacja esbuild**

```typescript
// vitest.config.ts
{
  esbuild: {
    target: 'esnext',
    keepNames: true,
  }
}
```

**Korzyść**: Szybsza transpilacja TypeScript.

## Nowe komendy testowe

### Szybkie testy (domyślne)

```bash
pnpm test:unit:fast
```

Uruchamia testy unit bez coverage i z basic reporter - najszybszy sposób.

### Testy tylko zmienionych plików

```bash
pnpm test:changed
```

Uruchamia tylko testy dla zmienionych plików (idealne dla pre-commit).

### Testy z bail on first failure

```bash
pnpm test:affected
```

Zatrzymuje się po pierwszym błędzie - szybki feedback podczas developmentu.

### Watch mode

```bash
pnpm test:watch
```

Watch mode z `--related` - uruchamia tylko related tests.

### CI mode

```bash
pnpm test:ci
```

Zoptymalizowany dla CI - bez coverage, verbose reporter.

## Best practices

### 1. Wybór environment

- **Testy logiki biznesowej**: Używaj `node` environment (domyślnie)
- **Testy UI/DOM**: Umieść w `apps/editor/**/*.test.ts` (automatycznie jsdom)
- **Testy komponentów**: Nazwij plik `*UI*.test.ts` lub `*Browser*.test.ts`

### 2. Polyfills

```typescript
// Dla testów wymagających WebGPU
import { initWebGPUPolyfills } from '../test/setup';

beforeAll(() => {
  initWebGPUPolyfills();
});
```

### 3. Test organization

- **Unit tests**: Małe, szybkie, izolowane
- **Integration tests**: Nazwij `*.integration.test.ts` (automatycznie fork pool)
- **Performance tests**: Używaj `describe.concurrent` dla równoległego wykonania

### 4. Debugging slow tests

```bash
# Znajdź najwolniejsze testy
vitest run --reporter=verbose | grep -E "Duration|SLOW"

# Profile specific test
vitest run --project unit --reporter=verbose path/to/test.ts
```

## Troubleshooting

### Testy timeout w watch mode

```typescript
// Zwiększ timeout dla specific testów
test('slow operation', async () => {
  // ...
}, 10000); // 10s timeout
```

### Problemy z shared state

Jeśli testy interferują ze sobą po wyłączeniu izolacji:

```typescript
// Dodaj proper cleanup w afterEach
afterEach(() => {
  // Reset global state
  // Clear mocks
  // Dispose resources
});
```

### Memory leaks w długich test suites

```typescript
// W vitest.workspace.ts, dodaj:
{
  poolOptions: {
    threads: {
      maxThreads: Math.min(cpuCount, 4), // Ogranicz threads
    }
  }
}
```

## Planowane optymalizacje (Roadmap)

1. **Test sharding dla CI**: Podział testów na wiele parallel jobs (GitHub Actions matrix strategies)
2. **Custom test sequencer**: Priorytetyzacja testów (uruchamianie najszybszych lub ostatnio zmienionych najpierw)
3. **Global setup optimization**: Jednokrotny setup kosztownych zasobów (database/fixtures) per worker
4. **Mock optimization**: Efektywniejsze cache'owanie skompilowanych mocków między testami


## Monitoring wydajności

```bash
# Benchmark current performance
pnpm test:unit --reporter=verbose | tee test-benchmark.txt

# Compare with baseline
diff test-benchmark-baseline.txt test-benchmark.txt
```

## Konfiguracja per-package

Każdy package może mieć własny `vitest.config.ts` dla specific optimizations:

```typescript
// packages/core/vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',  // Core zawsze node
    globals: true,
  },
});
```

## Więcej informacji

- [Vitest Performance Guide](https://vitest.dev/guide/improving-performance.html)
- [Test Philosophy](./TESTING.md)
- [Architecture](./ARCHITECTURE.md)


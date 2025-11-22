# Testing

**Zasady testowania w projekcie**

## Filozofia

**Test behavior, not implementation** - testujemy co robi kod, nie jak to robi.

## Reguły

### Co testować
- ✅ Business logic (transformacje danych, obliczenia)
- ✅ Public APIs pakietów
- ✅ Edge cases i error handling
- ✅ Critical user paths (E2E)
- ❌ Private implementation details
- ❌ Framework/library internals
- ❌ Getters/setters bez logiki

### Struktura testów

```typescript
describe('FeatureName', () => {
  describe('specificBehavior', () => {
    it('should do X when Y', () => {
      // Arrange
      const input = ...;
      
      // Act
      const result = doSomething(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Mock external dependencies

```typescript
// Dobrze
const mockPhysics = {
  simulate: vi.fn(),
  raycast: vi.fn(() => [])
};

// Źle - mockowanie implementacji wewnętrznej
vi.spyOn(privateMethod, 'internalCalculation');
```

### Kategorie testów

**Unit Tests** - pojedyncze funkcje/klasy
- Szybkie (<50ms)
- Izolowane
- Mock wszystkich zależności
- Lokalizacja: `packages/*/tests/*.test.ts`

**Integration Tests** - współpraca komponentów
- Średnie (~200ms)
- Realne zależności gdzie możliwe
- Mock tylko I/O (network, filesystem)
- Lokalizacja: `apps/editor/__tests__/*.integration.test.ts`

**E2E Tests** - complete user flows (future)
- Wolne (>1s)
- Pełny stack
- Browser automation

## Uruchamianie

```bash
# Wszystkie testy
pnpm test

# Konkretny pakiet
pnpm --filter @engine/world test

# Watch mode
pnpm test:watch

# Coverage (future)
pnpm test:coverage
```

## Workspace Config

`vitest.workspace.ts` dzieli testy na:
- `unit` - szybkie, izolowane testy
- `integration` - testy integracyjne

## Performance Tests

Dla hot paths:
```typescript
it('should process 10k entities <16ms', () => {
  const start = performance.now();
  system.update(entities); // 10k entities
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(16); // 60 FPS
});
```

## Best Practices

1. **Jeden assert per test** - łatwiejsze debugowanie
2. **Descriptive names** - `it('should X when Y')`
3. **Setup w beforeEach** - DRY
4. **Cleanup w afterEach** - no leaks
5. **Test edge cases** - null, undefined, empty, max values
6. **Avoid brittle tests** - nie testuj order, timing, internal state

## Anti-patterns

❌ Testing implementation
```typescript
expect(obj.internalArray.length).toBe(3); // BAD
expect(obj.getCount()).toBe(3); // GOOD
```

❌ Over-mocking
```typescript
vi.spyOn(Math, 'random'); // BAD - testuj z real Math
```

❌ Test interdependence
```typescript
// BAD - test zależy od kolejności
let sharedState;
it('test 1', () => { sharedState = ...; });
it('test 2', () => { expect(sharedState)...; });
```

---

**Więcej:** Zobacz testy w `packages/*/tests/` jako przykłady

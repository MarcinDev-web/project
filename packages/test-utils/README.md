# @engine/test-utils

Reusable test utilities, mocks, fixtures, and helpers for consistent testing across all packages.

## Installation

```bash
pnpm add -D @engine/test-utils
```

## Usage

### Mocks

Pre-configured mock objects for common APIs:

```typescript
import { createMockCanvas, createMockGPUDevice, createMockAnimationFrame } from '@engine/test-utils';

test('renders to canvas', () => {
  const canvas = createMockCanvas(800, 600);
  renderer.setCanvas(canvas);
  // ...
});

test('uses WebGPU', () => {
  const device = createMockGPUDevice();
  renderer.setDevice(device);
  // ...
});

test('animates', () => {
  const { requestAnimationFrame, tick } = createMockAnimationFrame();
  global.requestAnimationFrame = requestAnimationFrame;
  
  startAnimation();
  tick(16); // Advance one frame
  // ...
});
```

### Fixtures

Pre-configured test data:

```typescript
import { vec3Fixtures, transformFixtures, entityFixtures } from '@engine/test-utils';

test('transforms entity', () => {
  const entity = entityFixtures.withTransform();
  const offset = vec3Fixtures.unitX;
  // ...
});

test('handles large scenes', () => {
  const entities = performanceFixtures.largeEntitySet(10000);
  scene.addEntities(entities);
  // ...
});
```

### Assertions

Custom assertions for common patterns:

```typescript
import { expectVec3ToBeCloseTo, expectToExecuteWithin } from '@engine/test-utils';

test('calculates position', () => {
  const result = calculatePosition();
  expectVec3ToBeCloseTo(result, [1, 2, 3]);
});

test('performs fast enough', async () => {
  await expectToExecuteWithin(() => {
    system.update(entities);
  }, 16); // Must complete within 16ms (60 FPS)
});
```

### Helpers

Utility functions for test flow:

```typescript
import { waitFor, benchmark, createTestContext } from '@engine/test-utils';

test('waits for async condition', async () => {
  await waitFor(() => entity.isLoaded, 5000);
  expect(entity.isLoaded).toBe(true);
});

test('benchmarks performance', async () => {
  const bench = benchmark(() => system.update(), 1000);
  const results = await bench();
  
  console.log(`Average: ${results.average}ms`);
  expect(results.average).toBeLessThan(16);
});

// Setup/teardown helper
const ctx = createTestContext(
  () => new System(),
  (sys) => sys.dispose()
);

beforeEach(ctx.beforeEach);
afterEach(ctx.afterEach);

test('uses context', () => {
  const system = ctx.getContext();
  // ...
});
```

## Best Practices

1. **Reuse mocks** - Don't recreate common mocks in every test
2. **Use fixtures** - Share test data across tests
3. **Custom assertions** - Make tests more readable
4. **Helper functions** - Reduce boilerplate in tests

## API Reference

See source files for full API:
- `mocks/` - Mock objects
- `fixtures/` - Test data
- `assertions/` - Custom assertions
- `helpers/` - Utility functions


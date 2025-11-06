# Performance Benchmarks

Automated performance benchmarking scripts for Forge Engine.

## Scripts

- `collision.ts` - Collision detection performance benchmarks
- `rendering.ts` - Rendering performance benchmarks

## Running Benchmarks

```bash
# Run collision benchmarks
node --import tsx scripts/benchmark/collision.ts

# Run rendering benchmarks
node --import tsx scripts/benchmark/rendering.ts
```

## Output

Results are written to `benchmarks/` directory:
- `collision-results.json` - Collision performance metrics
- `rendering-results.json` - Rendering performance metrics

## Performance Budgets

Performance budgets should be defined in CI/CD:
- Collision detection: < 16ms for 1000 objects
- Frame time: < 16.67ms (60 FPS target)
- Memory: < configured threshold

## Trend Tracking

CI/CD should track performance trends over time and alert on regressions.


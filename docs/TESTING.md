# Testing Workflow

This project uses [Vitest](https://vitest.dev) with a workspace configuration that splits tests into two projects:

- **unit**: `jsdom` environment for most tests (includes DOM/canvas/localStorage support)
- **integration**: `jsdom` environment for explicitly integration-focused tests

Both projects run in parallel with dynamic thread pooling based on CPU count.

## Naming conventions

| Test Type | File suffix | Environment |
|-----------|-------------|-------------|
| Standard tests | `.test.ts`, `.spec.ts` | `jsdom` (unit project)
| Integration/UI/interaction | `.integration.test.ts`, `.interaction.test.ts`, `.ui.test.ts` | `jsdom` (integration project)

Most tests use the standard `.test.ts` suffix. Use `.integration.test.ts` for:
- Complex multi-component integration scenarios
- End-to-end editor workflows
- Tests that benefit from logical separation

## Commands

- `npm run test:unit` — run standard test suites in parallel (most tests)
- `npm run test:integration` — run integration-specific suites
- `npm run test:all` — run both projects (default for `npm test`)
- `npm run test:watch` — watch unit suites with related test detection
- `npm run test:profile` — run unit suites serially with verbose output to identify slow tests
- `npm run test:fast` — minimal dot reporter for quick feedback
- `npm run test:changed` — re-run only tests affected by git changes
- `npm run test:ui` — launch Vitest UI for integration suites
- `npm run test:coverage` — generate code coverage report

## Performance optimizations

1. **Parallel execution**: Tests run across multiple threads (CPU count - 1)
2. **Shared setup**: Common polyfills and mocks in `src/test/setup.ts` reduce per-test overhead
3. **Workspace isolation**: Unit and integration projects can run independently
4. **Fast feedback**: `test:fast` and `test:changed` provide quick iteration cycles

## Best practices

- **Mock heavy dependencies**: GPU/canvas/WebGPU mocks are in `src/test/setup.ts` to avoid duplication
- **Use test helpers**: Prefer factories in `src/__tests__/helpers/` over inline fixtures
- **Profile slow tests**: Run `npm run test:profile` to identify bottlenecks, then optimize or split tests
- **CI strategy**: Use `npm run test:all` in CI pipelines for complete coverage
- **Pre-commit**: The `precommit` script runs `test:unit` for fast validation

## Troubleshooting

- **Tests timing out**: Increase `testTimeout` in `vitest.workspace.ts` (currently 5000ms)
- **DOM not available**: Ensure test uses `.test.ts` suffix (not `.spec.ts` in node-only contexts)
- **Slow test runs**: Check `test:profile` output and consider mocking expensive operations
- **Flaky tests**: Verify proper cleanup in `afterEach` hooks and avoid shared mutable state

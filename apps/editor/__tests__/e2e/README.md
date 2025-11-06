# E2E Tests for Editor

This directory contains end-to-end tests for critical user paths in the Forge Engine editor.

## Setup

E2E tests use Playwright for browser automation. Ensure Playwright is installed:

```bash
npx playwright install
```

## Running Tests

```bash
# Run all E2E tests
npx playwright test apps/editor/__tests__/e2e/

# Run with UI mode (interactive)
npx playwright test apps/editor/__tests__/e2e/ --ui

# Update screenshots
npx playwright test apps/editor/__tests__/e2e/ --update-snapshots
```

## Test Structure

- `placement.spec.ts` - Block placement workflow tests
- `play-mode.spec.ts` - Play mode functionality tests
- `visual-regression.spec.ts` - Visual regression tests

## Current Status

**Note:** E2E tests are currently placeholders. Full implementation requires:

1. Editor state setup/teardown
2. Mock WebGPU context
3. Interaction simulation (clicks, keyboard)
4. Assertion helpers for editor state

## Future Work

- Full placement workflow tests
- Undo/redo functionality tests
- LogicCube visual scripting tests
- Multi-entity interaction tests
- Performance regression tests


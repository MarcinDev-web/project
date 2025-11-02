# Alias Configuration Guide

This document describes where and why path aliases (`@engine/*`) are configured in the FORGE Engine monorepo.

## Overview

Path aliases allow imports like `import { Vec3 } from '@engine/core'` instead of relative paths like `import { Vec3 } from '../../../packages/core/src'`. This provides:

- **Consistency** - Same import style across all packages
- **Refactoring safety** - Moving files doesn't break imports
- **Clarity** - Clear package boundaries

## Configuration Locations

### 1. Root `tsconfig.json`

**Purpose:** TypeScript compiler configuration for the entire monorepo  
**Location:** `tsconfig.json` (root)  
**Scope:** All TypeScript files in `packages/` and `apps/`

```json
{
  "compilerOptions": {
    "paths": {
      "@engine/core": ["./packages/core/src"],
      "@engine/core/*": ["./packages/core/src/*"],
      // ... other aliases
    }
  }
}
```

**Used by:**
- TypeScript compiler for type checking
- IDE autocomplete and go-to-definition
- Type checking in editors

### 2. `vitest.workspace.ts`

**Purpose:** Vitest test runner configuration  
**Location:** `vitest.workspace.ts` (root)  
**Scope:** All test files (`*.test.ts`, `*.spec.ts`)

Aliases are defined in both `unit` and `integration` test projects:

```typescript
resolve: {
  alias: {
    '@engine/core': resolve(__dirname, 'packages/core/src'),
    '@engine/core/*': resolve(__dirname, 'packages/core/src/*'),
    // ... other aliases
  }
}
```

**Used by:**
- Vitest for resolving imports in test files
- Test execution (both unit and integration)

**Note:** Alias configuration is duplicated in both projects for clarity.

### 3. `apps/editor/vite.config.ts`

**Purpose:** Vite bundler configuration for the editor app  
**Location:** `apps/editor/vite.config.ts`  
**Scope:** Editor application code

```typescript
resolve: {
  alias: {
    '@engine/core': path.resolve(__dirname, '../../packages/core/src'),
    '@engine/core/*': path.resolve(__dirname, '../../packages/core/src/*'),
    // ... other aliases
  }
}
```

**Used by:**
- Vite dev server (hot reload, HMR)
- Production builds (`pnpm build:editor`)
- Import resolution during development

### 4. `apps/editor/tsconfig.json`

**Purpose:** TypeScript configuration for the editor app  
**Location:** `apps/editor/tsconfig.json`  
**Scope:** Editor application code

```json
{
  "compilerOptions": {
    "paths": {
      "@engine/core": ["../../packages/core/src"],
      "@engine/core/*": ["../../packages/core/src/*"],
      // ... other aliases
    }
  }
}
```

**Used by:**
- TypeScript compiler for editor code
- IDE features (IntelliSense, etc.)

## Alias List

All packages use the `@engine/` prefix:

- `@engine/core` - Foundation (math, ECS, events)
- `@engine/world` - ECS runtime, scene management
- `@engine/gfx-webgpu` - WebGPU renderer
- `@engine/script` - Visual scripting (LogicCubes)
- `@engine/input` - Input management
- `@engine/camera` - Camera systems
- `@engine/stdlib` - Standard library
- `@engine/editor-utils` - Editor utilities
- `@engine/test-utils` - Test utilities
- `@engine/wasm-collision` - WASM collision detection
- `@engine/animation` - Animation system
- `@engine/avatar` - Avatar system
- `@engine/world-templates` - World templates

Each package has two aliases:
- `@engine/package-name` - Points to `packages/package-name/src/index.ts`
- `@engine/package-name/*` - Points to `packages/package-name/src/*` for sub-imports

## Maintenance

### Adding a New Package

When adding a new package, add aliases to **all 4 locations**:

1. `tsconfig.json` (root)
2. `vitest.workspace.ts` (both unit and integration projects)
3. `apps/editor/vite.config.ts`
4. `apps/editor/tsconfig.json`

### Verifying Configuration

Run the following to ensure aliases are consistent:

```bash
# Check TypeScript compilation
pnpm build

# Check tests
pnpm test:unit

# Check editor dev server
pnpm dev:editor
```

## Common Issues

### "Cannot find module '@engine/...'"

**Cause:** Alias not configured in the required location  
**Solution:** Add alias to all 4 configuration files listed above

### Alias works in tests but not in app

**Cause:** Missing alias in `apps/editor/vite.config.ts` or `apps/editor/tsconfig.json`  
**Solution:** Add alias to editor-specific configs

### TypeScript finds it but runtime doesn't

**Cause:** Missing alias in `vite.config.ts` (Vite needs runtime resolution)  
**Solution:** Ensure alias exists in `apps/editor/vite.config.ts`

## Rationale for Multiple Configs

While it seems redundant, each tool needs its own configuration:

- **TypeScript** (`tsconfig.json`) - For type checking and IDE support
- **Vitest** (`vitest.workspace.ts`) - For test execution and resolution
- **Vite** (`vite.config.ts`) - For bundling and dev server
- **Editor TS** (`apps/editor/tsconfig.json`) - Editor-specific type checking

Each tool has different resolution algorithms and needs explicit configuration.

## Future Improvements

Consider:
- Shared alias config file that all tools import
- Script to validate alias consistency
- Automated alias generation from package.json

## Related Documentation

- [Package Guidelines](PACKAGE_GUIDELINES.md) - Where code belongs
- [Architecture](ARCHITECTURE.md) - System design
- [Import Policy](AI_CONTEXT.md#import-policy) - Always use `@engine/*` aliases


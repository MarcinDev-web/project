# Quick Start for AI Assistants

> **⚡ 2-minute context for Claude 4.5 Sonnet, GPT-5**

## 🎯 What is this?

**WebGPU 3D game engine** - TypeScript monorepo with modular architecture.

## 📁 Structure

```
packages/          → @engine/* modules (reusable engine code)
apps/editor/       → 3D scene editor app
docs/              → Documentation
```

## 🚨 Critical Rules

### 1. ALWAYS use `@engine/*` imports

```typescript
// ✅ CORRECT
import { Vec3 } from '@engine/core';
import { Scene } from '@engine/world';

// ❌ NEVER
import { Vec3 } from '../../../packages/core/src/math/Vec3';
```

### 2. NO duplication between packages and apps

```typescript
// ❌ NEVER create in apps/
apps/editor/src/utils/history.ts

// ✅ EXISTS in packages/
packages/editor-utils/src/HistoryManager.ts
```

### 3. NO circular dependencies

```
✅ Allowed:  core → world → gfx-webgpu
❌ Forbidden: world → core → world
```

## 🎨 Code Style

```typescript
// ✅ Functional, async/await, destructuring
export async function loadAsset(url: string): Promise<Asset> {
  const response = await fetch(url);
  return await response.json();
}

// ✅ No any (or comment why)
function parse(data: unknown): Result { // Use unknown
  if (typeof data === 'string') { /* ... */ }
}

// ✅ Cleanup resources
class System implements Disposable {
  dispose(): void {
    this.resources.forEach(r => r.dispose());
  }
}
```

## 🧪 Testing

```typescript
// ✅ Test behavior (not implementation)
test('entity position updates', () => {
  const entity = new Entity();
  entity.setPosition(1, 2, 3);
  expect(entity.getPosition()).toEqual([1, 2, 3]);
});

// ✅ Always cleanup
afterEach(() => {
  system.dispose();
  vi.clearAllMocks();
});

// ✅ Use WASM mocks from test-utils
import { mockWasmCollision } from '@engine/test-utils/mocks';
vi.mock('@engine/wasm-collision', () => ({ default: mockWasmCollision }));
```

## 🚀 Commands

```bash
pnpm dev              # Start editor
pnpm test:watch       # Watch mode tests
pnpm test:changed     # Only changed files
pnpm build            # Build all
```

## 📖 Full Documentation

**Read these in order:**

1. **[AI_CONTEXT.md](AI_CONTEXT.md)** - Complete context (15 min read)
2. **[CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md)** - Design patterns
3. **[docs/guidelines/PACKAGE_GUIDELINES.md](docs/guidelines/PACKAGE_GUIDELINES.md)** - Where code belongs

## ✅ Before Generating Code

- [ ] Where does this belong? (Check PACKAGE_GUIDELINES.md)
- [ ] Does this already exist? (Search first)
- [ ] Using `@engine/*` imports?
- [ ] Added tests?
- [ ] Cleanup in `dispose()`?

## 🔥 Common Mistakes

❌ Relative imports between packages  
❌ Duplicating package code in apps  
❌ Circular dependencies  
❌ Allocations in hot paths (render/physics loops)  
❌ Forgetting cleanup (listeners, timers, resources)  
❌ Using `any` without justification  

## 💡 Pro Tips

- **Package decision:** "This goes in `@engine/X` because..."
- **Search first:** Don't duplicate existing code
- **Follow patterns:** Look at similar code in same package
- **Test immediately:** Don't defer
- **Think disposal:** Every resource needs cleanup

---

**That's it! Now read [AI_CONTEXT.md](AI_CONTEXT.md) for complete details.**


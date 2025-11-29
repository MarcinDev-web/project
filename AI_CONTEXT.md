# AI Context - Complete Project Guide

> **🌟 The Single Source of Truth for AI Assistants & Developers**
> Read this file to understand the architectural decisions, patterns, and rules of the Forge Engine project.

## 1. Project Overview

**Forge Engine** is a modular, high-performance 3D game engine built with **WebGPU** and **TypeScript**. It is designed for User Generated Content (UGC) with a professional scene editor and multiplayer capabilities.

### Key Characteristics
- **Monorepo**: Managed with `pnpm workspaces`.
- **ECS Architecture**: Entity-Component-System pattern for game logic.
- **WebGPU**: Modern graphics API for high-performance rendering.
- **Strict Boundaries**: Clear separation between engine core, specific systems, and applications.
- **Performance First**: Zero-allocation goals for hot paths (render loop, physics).

---

## 2. Mental Model

To work effectively in this codebase, adopt the following mental models:

### 2.1. The Engine Layer Cake
The project is organized in strict layers. Dependencies flow **downwards**.

- **Level 4 (Apps)**: `apps/editor`, `apps/player`. The end products. They glue everything together.
- **Level 3 (Gameplay)**: `@engine/stdlib`, `@engine/network`. High-level game systems.
- **Level 2 (Systems)**: `@engine/gfx-webgpu`, `@engine/physics`, `@engine/script`. Specialized domains.
- **Level 1 (Runtime)**: `@engine/world`. The ECS runtime that orchestrates entities and systems.
- **Level 0 (Foundation)**: `@engine/core`. Math, basic types, events, utilities. **No dependencies.**

### 2.2. The ECS Pattern
Logic is separated from data.
- **Entities**: ID containers (integers/UUIDs).
- **Components**: Pure data classes (schema + state). **NO LOGIC.**
- **Systems**: Logic that operates on entities with specific components.

### 2.3. The Disposable Lifecycle
Since we interact with GPU and WASM resources, garbage collection is not enough.
- **Everything** that allocates non-JS resources (GPU buffers, event listeners) must implement `Disposable`.
- **Ownership**: If you create it, you dispose it.
- **Hierarchy**: Parent disposes children.

---

## 3. Architecture & Structure

### 3.1. Directory Layout
```text
root/
├── packages/              # Shared Engine Code (The "Engine")
│   ├── core/              # Math, Events, JobSystem (Level 0)
│   ├── world/             # ECS Runtime, Physics (Level 1)
│   ├── gfx-webgpu/        # Rendering Pipeline (Level 2)
│   ├── stdlib/            # Standard Game Systems (Level 3)
│   ├── ...                # Other specialized packages
├── apps/                  # End-user Applications
│   ├── editor/            # 3D Scene Editor (React + Engine)
│   ├── player/            # Game Client
│   ├── platform/          # Web Dashboard
│   ├── net-server/        # Backend API
│   └── collab-server/     # Multiplayer Signaling
├── docs/                  # Documentation
└── scripts/               # Build & Maintenance Scripts
```

### 3.2. Core Packages
| Package | Description | Level |
|---|---|---|
| **@engine/core** | Foundation. Math library (`Vec3`, `Mat4`), `EventBus`, `Disposable`. | 0 |
| **@engine/brand** | Branding assets, logos, and theme constants. | 0 |
| **@engine/world** | The ECS definition. `Entity`, `Scene`, `System`, `Query`. | 1 |
| **@engine/input** | Input handling (Keyboard, Mouse, Gamepad). | 1 |
| **@engine/editor-utils** | Reusable editor logic (History, Snapping) - decoupling apps from engine. | 1 |
| **@engine/asset-pipeline** | Asset loading and processing (GLTF, Textures). | 1 |
| **@engine/microblocks** | Low-level voxel/block data structures and optimization. | 1 |
| **@engine/gfx-webgpu** | The Renderer. Manages Device, Pipeline, Shaders, Textures. | 2 |
| **@engine/script** | Visual scripting system (LogicCubes). | 2 |
| **@engine/physics** | Physics simulation (Rapier/PhysX integration). | 2 |
| **@engine/voxel** | Voxel terrain engine and meshing. | 2 |
| **@engine/blocks** | High-level block definitions and logic. | 2 |
| **@engine/stdlib** | Common gameplay elements: CharacterController, AnimationSystem. | 3 |
| **@engine/net** | Multiplayer networking and replication. | 3 |
| **@engine/economy** | Economy systems (Inventory, Trading). | 3 |
| **@engine/gateway** | API Gateway, Rate Limiting, and backend services. | 3 |
| **@engine/ui** | Shared React UI components and styles. | 3 |

### 3.3. Dependency Rules
- **Strict Unidirectional Flow**: Apps depend on Packages. Packages depend on lower-level Packages.
- **No Cycles**: `core` never imports `world`. `world` never imports `gfx`. `stdlib` imports from `world` (not vice versa).

---

## 4. Critical Rules (Non-Negotiable)

### 4.1. Import Policy 🚨
**ALWAYS** use the package alias. **NEVER** import from specific files inside another package.

```typescript
// ✅ CORRECT
import { Vec3 } from '@engine/core';
import { Scene } from '@engine/world';

// ❌ WRONG (Breaks encapsulation)
import { Vec3 } from '../../../packages/core/src/math/Vec3';
import { Scene } from '@engine/world/src/Scene';
```

### 4.2. No Logic in Components
Components should be simple data containers with optional serialization logic.

```typescript
// ✅ CORRECT
class HealthComponent extends Component {
  public current: number = 100;
  public max: number = 100;
}

// ❌ WRONG
class HealthComponent extends Component {
  takeDamage(amount: number) { // Logic belongs in a System!
    this.current -= amount;
  }
}
```

### 4.3. Explicit Disposal
Every class that manages resources MUST implement `Disposable`.

```typescript
class MySystem implements Disposable {
  private resources = new DisposableGroup();

  constructor() {
    this.resources.add(new GPUBuffer(...));
  }

  dispose() {
    this.resources.dispose();
  }
}
```

### 4.4. No "Any"
Strict TypeScript is enforced. Do not use `any` unless absolutely necessary for boundary interop, and always comment why.

---

## 5. Code Style & Conventions

### 5.1. Naming
- **Classes/Interfaces**: `PascalCase` (`MeshRenderer`, `ITransform`)
- **Variables/Functions**: `camelCase` (`createEntity`, `isValid`)
- **Constants**: `UPPER_SNAKE_CASE` (`MAX_PARTICLES`, `DEFAULT_CONFIG`)
- **Private properties**: `camelCase` (prefer `private` keyword over `_` prefix, though `_` is acceptable for backing fields).

### 5.2. Files
- **One Class Per File**: Generally preferred.
- **Index Exports**: Each package must export its public API via `index.ts`.
- **Barrel Files**: Use `index.ts` in subdirectories to group exports, but avoid deep nesting if it causes circular deps.

### 5.3. Performance Patterns
- **Allocation-Free Hot Paths**: In `update()` loops (Systems), avoid `new Vec3()`, `[]`, or `() => {}`.
- **Object Pools**: Use pools for frequent transient objects.
- **Scratch Variables**: Use module-level scratch variables for math operations to avoid GC.

```typescript
// ✅ Performance Friendly
const scratchVec = new Vec3();

class MovementSystem extends System {
  update() {
    for (const entity of this.query) {
      // Reuse scratchVec instead of creating new Vec3 every frame
      scratchVec.copy(entity.pos).add(velocity);
    }
  }
}
```

---

## 6. Testing Philosophy

We use **Vitest**.

### 6.1. Principles
- **Behavior over Implementation**: Test what it does, not internal state.
- **Fast Unit Tests**: Most tests should be unit tests in `packages/*/src/__tests__`.
- **Mocking**: Mock external dependencies (Network, GPU, FileSystem) using `@engine/test-utils`.

### 6.2. Test Structure
```typescript
describe('SystemName', () => {
  it('should perform action when condition met', () => {
    // Arrange
    const scene = new Scene();
    const entity = new Entity();
    
    // Act
    system.update(0.16);
    
    // Assert
    expect(entity.getComponent(Transform).position).toEqual(expected);
  });
});
```

### 6.3. Running Tests
- `pnpm test` - Run all tests.
- `pnpm test:watch` - Watch mode (best for dev).
- `pnpm --filter @engine/world test` - Run tests for specific package.

---

## 7. Common Tasks & Workflows

### 7.1. Creating a New Component
1.  Define the Component class in the appropriate package (usually `@engine/world` or `@engine/stdlib`).
2.  Implement `serialize/deserialize` if it needs to be saved.
3.  Register it in the `ComponentRegistry` (if applicable) or just export it.

### 7.2. Creating a New System
1.  Create class extending `System`.
2.  Define `update(dt: number)`.
3.  Use `this.query` or `scene.query()` to find entities.
4.  Implement logic.

### 7.3. Adding a Feature to Editor
1.  Check `packages/editor-utils` first for reusable logic.
2.  If UI-only, add to `apps/editor/src/components`.
3.  If it involves engine state, ensure it goes through `EditorState` or Commands.

### 7.4. Debugging
- Use `measure:heap` scripts to check for memory leaks.
- Use `verify:cost` to check bundle size impact.

---

## 8. Checklist for Changes

Before you consider a task done:

- [ ] **Placement**: Is the code in the right package? (See `PACKAGE_GUIDELINES.md`)
- [ ] **Imports**: Are all imports using `@engine/*`?
- [ ] **Tests**: Are there unit tests for the new behavior?
- [ ] **Disposal**: Did you implement `dispose()` for new resources?
- [ ] **Performance**: Did you avoid allocations in `update()` loops?
- [ ] **Build**: Does `pnpm build` pass?
- [ ] **Lint**: Does `pnpm lint` pass?

---

## 9. Reference Documentation
- **Design Patterns**: [CODEBASE_PATTERNS.md](./CODEBASE_PATTERNS.md)
- **Architecture**: [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)
- **Testing**: [docs/testing/TESTING.md](./docs/testing/TESTING.md)
- **Package Guidelines**: [docs/guidelines/PACKAGE_GUIDELINES.md](./docs/guidelines/PACKAGE_GUIDELINES.md)

---

## 10. Recent Changes & History (Oct-Nov 2025)

### 10.1. Major Refactoring (Oct 2025)
- **Created `@engine/editor-utils`**: Decoupled editor logic (History, Snapping) from `apps/editor`.
- **Removed Duplication**: Eliminated 6 major code duplications (-1823 lines).
- **Import Consistency**: Enforced 100% usage of `@engine/*` aliases.

### 10.2. Removed Features
- **Workflow System**: Removed legacy workflow engine in favor of new scripting.
- **Asset Library (Legacy)**: Replaced by `@engine/asset-pipeline`.

### 10.3. Documentation
- **AI Context**: Added comprehensive AI documentation (this file, `CODEBASE_PATTERNS.md`).
- **Package Guidelines**: Clarified decision tree for new code.

### 10.4. New Features (Nov 2025)

#### Physics & Collision
- **DynamicBVH** (`@engine/world/physics`): Dynamic Bounding Volume Hierarchy with incremental updates. Better than Octree for non-uniform distributions. Uses Surface Area Heuristic (SAH) for insertion.
- **WASM Collision Mock** (`@engine/test-utils`): Comprehensive mock for `@engine/wasm-collision` - supports OBB, sphere, capsule, ray intersections and batch operations.

#### Animation
- **AnimatorOptimized** (`@engine/animation`): WASM-accelerated animation sampling with temporal coherence hints. Binary search O(log n) for interval finding vs O(n) linear.

#### Gameplay
- **WeaponComponent Enhanced** (`@engine/world`): Extended with attachment modifiers, ammo types, effective stat calculations. Supports `StatModifiers` for damage, fire rate, range, spread, etc.

#### UI Package
- **@engine/ui Components**: Exported shared React components - `Button`, `Card`, `Input`, `Modal`.

### 10.5. Testing Improvements (Nov 2025)
- Added `mockWasmCollision` and `initWasmCollision` exports from `@engine/test-utils/mocks`.
- Enhanced mock coverage for WASM modules (animation, ecs-core, collision).

> **Note**: This file is the primary context for AI agents. If you find discrepancies between this file and the code, trust the code but update this file.

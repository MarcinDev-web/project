# Package Guidelines - Where Does Code Belong?

**Version:** 1.1
**Last Updated:** 2025-11-22
**Mandatory for all code contributions**

## TL;DR

- **Reusable logic?** → `packages/`
- **Editor UI/UX?** → `apps/editor/`
- **Always import:** `@engine/*` (never relative paths to packages)
- **If duplicating:** STOP and ask if it belongs in a package

---

## 🌳 Decision Tree

```
                    [Adding new code]
                            │
                            ↓
            ┌───────────────────────────────┐
            │ Is it reusable outside        │
            │ the current app?              │
            └───────────────────────────────┘
                    │               │
                  YES              NO
                    ↓               ↓
    ┌───────────────────────┐   ┌──────────────────────┐
    │ Does it have          │   │ apps/[app-name]/     │
    │ DOM/UI dependencies?  │   │ ✅ App-specific      │
    └───────────────────────┘   └──────────────────────┘
            │           │
           YES         NO
            ↓           ↓
    ┌──────────────┐  ┌─────────────────────┐
    │ apps/editor/ │  │ What type of code?  │
    │ (UI logic)   │  └─────────────────────┘
    └──────────────┘            │
                                ↓
                    ┌───────────────────────┐
                    │ Choose package:       │
                    │ - Core utility?       │
                    │   → @engine/core      │
                    │ - Rendering?          │
                    │   → @engine/gfx-webgpu│
                    │ - ECS/World?          │
                    │   → @engine/world     │
                    │ - Assets?             │
                    │   → @engine/asset-    │
                    │     pipeline          │
                    │ - Camera?             │
                    │   → @engine/camera    │
                    │ - Editor tool?        │
                    │   → @engine/editor-   │
                    │     utils             │
                    └───────────────────────┘
```

---

## 📦 Package Descriptions

### @engine/core
**Purpose:** Foundation layer - math, utils, core patterns

**Belongs here:**
- Math utilities (Vec3, Mat4, Quat, AABB)
- Universal patterns (DisposableGroup, EventBus)
- Job system
- Core utilities (UUID, BitFlags, Logger)

**Examples:**
- ✅ `DisposableGroup` - resource cleanup pattern
- ✅ `Vec3Add` - vector math
- ✅ `EventEmitter` - pub/sub pattern

**Doesn't belong:**
- ❌ Editor-specific utilities
- ❌ Rendering code
- ❌ UI components

---

### @engine/world
**Purpose:** ECS runtime, scene management, physics

**Belongs here:**
- Entity, Component, System classes
- Scene graph management
- Physics simulation
- Serialization
- Components (Transform, Mesh, Material, Light, etc.)

**Examples:**
- ✅ `Entity` class
- ✅ `PhysicsWorld`
- ✅ `TransformComponent`

**Doesn't belong:**
- ❌ Rendering implementation
- ❌ Editor-specific components
- ❌ UI management

---

### @engine/gfx-webgpu
**Purpose:** WebGPU rendering

**Belongs here:**
- Renderer implementation
- Shaders (WGSL)
- Materials, textures
- Shadow mapping
- Post-processing
- Block rendering

**Examples:**
- ✅ `Renderer` class
- ✅ PBR shader
- ✅ `BlockLibrary`

**Doesn't belong:**
- ❌ Editor UI for materials
- ❌ Asset loading logic
- ❌ Game logic

---

### @engine/asset-pipeline
**Purpose:** Asset loading, processing, and parsing

**Belongs here:**
- GLTF/GLB parsing and loading
- Texture loading
- Asset optimization pipelines
- Asset format definitions

**Examples:**
- ✅ `AssetPipeline` class
- ✅ `TextureLoader`
- ✅ `parseGlb`

**Doesn't belong:**
- ❌ Asset browser UI
- ❌ Asset placement logic
- ❌ Game logic using assets

---

### @engine/camera
**Purpose:** Camera systems

**Belongs here:**
- Camera controllers (Orbit, FPS)
- Camera blending (CameraDirector)
- View/projection matrix generation

**Examples:**
- ✅ `FPSCamera` - first-person camera
- ✅ `OrbitCamera` - orbit controls
- ✅ `CameraDirector` - mode switching

**Doesn't belong:**
- ❌ Editor camera UI
- ❌ Camera gizmos
- ❌ Editor-specific camera workflows

---

### @engine/input
**Purpose:** Input management

**Belongs here:**
- Keyboard, mouse, gamepad handling
- Input context system
- Character input

**Examples:**
- ✅ `InputContextManager`
- ✅ `CharacterInputHandler`

**Doesn't belong:**
- ❌ Editor keyboard shortcuts
- ❌ UI event handlers
- ❌ Editor-specific bindings

---

### @engine/script
**Purpose:** Visual scripting system

**Belongs here:**
- LogicCube system
- Behavior trees
- Coroutines
- Script execution

**Examples:**
- ✅ `LogicCubeSystem`
- ✅ `BehaviorExecutor`

**Doesn't belong:**
- ❌ Script editor UI
- ❌ LogicCube palette UI
- ❌ Editor workflows

---

### @engine/stdlib
**Purpose:** Standard library - common gameplay systems

**Belongs here:**
- Animation system
- Audio manager
- Character controllers
- Player session

**Examples:**
- ✅ `AnimationStateMachine`
- ✅ `CharacterController`
- ✅ `AudioManager`

**Doesn't belong:**
- ❌ Editor-specific systems
- ❌ UI components
- ❌ Editor tools

---

### @engine/editor-utils [NEW]
**Purpose:** Reusable editor utilities and tools

**Belongs here:**
- Undo/redo systems
- Grid snapping
- Editor helpers that other tools could use
- NOT editor UI, but editor LOGIC

**Examples:**
- ✅ `HistoryManager` - undo/redo system
- ✅ `SnapSystem` - grid snapping
- ✅ `HistoryHelpers` - entity path utils

**Doesn't belong:**
- ❌ Editor panels
- ❌ Toolbar UI
- ❌ Editor-specific UI components

---

### apps/editor
**Purpose:** 3D scene editor application

**Belongs here:**
- UI components (panels, toolbars, menus)
- Editor workflows (modes, states)
- Editor state management
- Controllers specific to editor
- Keyboard shortcuts
- Project persistence UI

**Examples:**
- ✅ `EditorUI` - main editor interface
- ✅ `CatalogPanel` - asset browser UI
- ✅ `EditorModeManager` - edit/play state machine
- ✅ `KeyboardHandler` - editor shortcuts
- ✅ `GridRenderer` - editor grid display

**Doesn't belong:**
- ❌ Reusable camera logic (→ @engine/camera)
- ❌ Asset management logic (→ @engine/asset-pipeline)
- ❌ Generic utilities (→ @engine/core or @engine/editor-utils)

---

## ✅ DO - Correct Patterns

### Pattern 1: Package Imports

```typescript
// ✅ CORRECT - Always use @engine/* imports
import { FPSCamera, CameraDirector } from '@engine/camera';
import { AssetPipeline } from '@engine/asset-pipeline';
import { HistoryManager, SnapSystem } from '@engine/editor-utils';
import { DisposableGroup } from '@engine/core/utils';
import { Entity, Scene } from '@engine/world';
```

### Pattern 2: Logger Injection

```typescript
// ✅ CORRECT - Packages accept optional logger
// In package:
export interface MySystemConfig {
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

export class MySystem {
  private logger: MySystemConfig['logger'];
  
  constructor(config?: MySystemConfig) {
    this.logger = config?.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
  }
}

// In application:
import { MySystem } from '@engine/my-package';
import { Logger } from './utils/logger';

const system = new MySystem({
  logger: {
    debug: Logger.debug.bind(Logger),
    warn: Logger.warn.bind(Logger),
    error: Logger.error.bind(Logger),
  }
});
```

### Pattern 3: Type Re-exports

```typescript
// ✅ CORRECT - App can re-export package types for convenience
// apps/editor/src/editor/assets/AssetService.ts
import { AssetPipeline } from '@engine/asset-pipeline';

// Re-export types
export type { ParsedGlb, RawTexture } from '@engine/asset-pipeline';

// Create singleton
export const assetPipeline = new AssetPipeline();
```

### Pattern 4: Utility in Core

```typescript
// ✅ CORRECT - Universal utility in @engine/core
// packages/core/src/utils/DisposableGroup.ts
export class DisposableGroup {
  // Universal resource management
  // No app-specific code
  // Can be used anywhere
}
```

---

## ❌ DON'T - Anti-patterns

### Anti-pattern 1: Local Duplicates

```typescript
// ❌ WRONG - Creating local copy of package code
// apps/editor/src/utils/MyCameraController.ts
export class MyCameraController {
  // This is a duplicate of @engine/camera/FPSCamera
  // Don't do this! Use the package version.
}

// ✅ CORRECT - Import from package
import { FPSCamera } from '@engine/camera';
```

### Anti-pattern 2: Bypassing Package API

```typescript
// ❌ WRONG - Direct import from package internals
import { Something } from '../../../packages/camera/src/internal/Something';

// ✅ CORRECT - Import from package public API
import { Something } from '@engine/camera';
```

### Anti-pattern 3: Mixed Imports

```typescript
// ❌ WRONG - Mixing local and package imports
import { CameraA } from '../camera/CameraA';  // Local
import { CameraB } from '@engine/camera';      // Package

// ✅ CORRECT - All from package
import { CameraA, CameraB } from '@engine/camera';
```

### Anti-pattern 4: Shared Logic in Apps

```typescript
// ❌ WRONG - Reusable snap logic in apps/
// apps/editor/src/utils/SnapHelper.ts
export function snapToGrid(pos: Vec3): Vec3 {
  // This could be used in other tools!
  // Should be in @engine/editor-utils
}

// ✅ CORRECT - In package
// packages/editor-utils/src/SnapSystem.ts
export class SnapSystem {
  snapPosition(pos: Vec3): Vec3 { ... }
}
```

### Anti-pattern 5: UI in Packages

```typescript
// ❌ WRONG - DOM manipulation in package
// packages/camera/src/CameraUI.ts
export class CameraUI {
  private panel: HTMLElement;  // NO! Packages shouldn't have UI
  
  createPanel() {
    this.panel = document.createElement('div');  // NO!
  }
}

// ✅ CORRECT - UI in app
// apps/editor/src/editor/ui/CameraPanel.ts
import { FPSCamera } from '@engine/camera';

export class CameraPanel {
  // UI logic here, uses camera from package
}
```

---

## 🎯 Real-World Examples

### Example 1: Adding New Feature "Terrain Editor"

**Question:** Where do I put terrain generation code?

**Analysis:**
- Terrain generation algorithm → Reusable? YES
- Terrain UI (brush, settings) → Reusable? NO

**Answer:**
```typescript
// packages/world/src/terrain/TerrainGenerator.ts
export class TerrainGenerator {
  generate(config: TerrainConfig): Entity {
    // Algorithm here
  }
}

// apps/editor/src/editor/tools/TerrainTool.ts
import { TerrainGenerator } from '@engine/world';

export class TerrainTool {
  // UI and editor integration here
  private generator = new TerrainGenerator();
}
```

---

### Example 2: Adding "Measurement Tool"

**Question:** Where do I put distance measurement?

**Analysis:**
- Distance calculation → Reusable? YES (math)
- Measurement UI/gizmo → Reusable? MAYBE (could be editor-utils)
- Editor integration → Reusable? NO

**Answer:**
```typescript
// Already exists in @engine/core/math
import { vec3Distance } from '@engine/core/math';

// packages/editor-utils/src/MeasurementHelper.ts [NEW]
export class MeasurementHelper {
  measureDistance(a: Vec3, b: Vec3): number {
    return vec3Distance(a, b);
  }
  
  measureAngle(a: Vec3, b: Vec3, c: Vec3): number {
    // Calculation logic
  }
}

// apps/editor/src/editor/tools/MeasurementTool.ts
import { MeasurementHelper } from '@engine/editor-utils';

export class MeasurementTool {
  // Gizmo rendering, UI, user interaction
  private helper = new MeasurementHelper();
}
```

---

### Example 3: Adding "Undo/Redo for New System"

**Question:** Should I create my own undo/redo?

**Answer:** NO! Use existing `HistoryManager`

```typescript
// ✅ CORRECT - Use package
import { HistoryManager } from '@engine/editor-utils';

class MyFeature {
  constructor(private history: HistoryManager) {}
  
  doSomething() {
    const snapshot = this.createSnapshot();
    this.history.push(snapshot);
  }
}
```

**DON'T create:**
- ❌ `MyFeatureHistory.ts` (duplicate undo system)
- ❌ `UndoManager.ts` (duplicate of HistoryManager)
- ❌ Custom undo implementation

**DO:**
- ✅ Use `HistoryManager` from `@engine/editor-utils`
- ✅ Extend if needed (create PR to package)
- ✅ Share improvements with all users

---

## 📋 Package Selection Matrix

| Code Type | Examples | Package | Rationale |
|-----------|----------|---------|-----------|
| Math utils | `clamp()`, `lerp()` | @engine/core | Universal |
| Resource management | `DisposableGroup` | @engine/core/utils | Universal pattern |
| ECS logic | `Component`, `System` | @engine/world | ECS domain |
| Rendering | Shaders, materials | @engine/gfx-webgpu | Rendering domain |
| Asset loading | GLTF loader | @engine/asset-pipeline | Asset domain |
| Asset UI | Asset browser | apps/editor | Editor UI |
| Camera logic | FPS controls | @engine/camera | Reusable camera |
| Camera UI | Camera settings panel | apps/editor | Editor UI |
| Undo/redo | HistoryManager | @engine/editor-utils | Editor tool |
| Grid snapping | SnapSystem | @engine/editor-utils | Editor tool |
| Editor toolbar | Toolbar component | apps/editor | Editor UI |
| Editor shortcuts | KeyboardHandler | apps/editor | Editor-specific |

---

## 🔍 When to Create New Package

### Create new package when:

✅ **Multiple apps would benefit**
- Playground needs it
- Future viewer needs it
- Other tools would use it

✅ **Clear domain boundary**
- Well-defined responsibility
- Logical grouping
- Won't create confusion

✅ **Independent from app UI**
- Pure logic, no DOM
- No app-specific workflows
- Configurable/flexible

✅ **Will grow significantly**
- More features planned
- Justifies separate package
- Worth maintaining separately

### Don't create new package when:

❌ **Only one app uses it**
- Only editor needs it
- Tightly coupled with editor

❌ **Very small and unlikely to grow**
- < 100 lines
- Simple utility
- Better in existing package

❌ **Creates circular dependencies**
- Would depend on higher-level packages
- Package dependency graph would cycle

❌ **Unclear domain**
- "Utils" package without focus
- Mixing unrelated code
- No clear responsibility

---

## 🚫 Import Policy

### Always ✅

```typescript
// From apps or packages
import { Something } from '@engine/package-name';
import { SomethingElse } from '@engine/package-name/subpath';
```

### Never ❌

```typescript
// Relative path to packages
import { Bad } from '../../../packages/camera/src/Camera';

// Local duplicate
import { Bad } from './MyLocalCamera';  // When package version exists

// Package internals
import { Bad } from '@engine/camera/src/internal/Something';
```

### Exception: Within same package

```typescript
// ✅ OK within package
// packages/camera/src/CameraDirector.ts
import { FPSCamera } from './FPSCamera';  // Same package
import type { OrbitControls } from './OrbitCamera';  // Same package

// But still prefer index export:
import { FPSCamera, OrbitControls } from './index';
```

---

## 🛡️ Logger Pattern (Standard)

All packages that log should follow this pattern:

### In Package

```typescript
export interface PackageConfig {
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

export class Package {
  private logger: PackageConfig['logger'];
  
  constructor(config?: PackageConfig) {
    this.logger = config?.logger ?? {
      debug: console.debug.bind(console),
      warn: console.warn.bind(console),
      error: (msg, err) => console.error(msg, err),
    };
  }
  
  doSomething() {
    this.logger?.debug('Doing something...');
  }
}
```

### In Application

```typescript
import { Package } from '@engine/my-package';
import { Logger } from './utils/logger';

const pkg = new Package({
  logger: {
    debug: Logger.debug.bind(Logger),
    warn: Logger.warn.bind(Logger),
    error: Logger.error.bind(Logger),
  }
});
```

### Why This Pattern?

- ✅ Packages remain flexible (can use any logger)
- ✅ Apps control logging behavior
- ✅ No package dependency on app logger
- ✅ Fallback to console for standalone use
- ✅ Testable (mock logger easily)

---

## 🔄 Refactoring Checklist

### Before moving code to a package:

- [ ] Code has no app-specific dependencies
- [ ] Code doesn't use DOM directly (or make it injectable)
- [ ] Code doesn't import from apps/
- [ ] Tests can be moved with it
- [ ] Public API is clean and documented
- [ ] Logger pattern used (if logging)

### After moving code:

- [ ] Update all imports in apps to use @engine/*
- [ ] Delete original files from apps/
- [ ] Export from package index.ts
- [ ] Add package to app's package.json if needed
- [ ] Run `pnpm install`
- [ ] Build succeeds: `pnpm -r build`
- [ ] Tests pass: `pnpm test`
- [ ] Manual testing done

---

## 🎓 Learning from Recent Refactoring

### What We Did Right ✅

1. **Clear analysis upfront**
   - Identified all duplicates
   - Planned 4 phases
   - Documented everything

2. **Logger config pattern**
   - Packages accept optional logger
   - Apps inject their logger
   - Clean dependency inversion

3. **Incremental approach**
   - Phase 1: Obvious duplicates
   - Phase 2: Complex unification
   - Phase 3: Utilities migration
   - Each phase buildable and testable

4. **Complete testing**
   - Unit tests
   - Build verification
   - Manual testing checklist

### What to Avoid ❌

1. **Creating local copies**
   - We had 6 duplicate files
   - Maintenance nightmare
   - Fixed by using packages properly

2. **Inconsistent imports**
   - Some files used local, some package
   - Confusing and error-prone
   - Fixed by 100% @engine/* imports

3. **Shared logic in apps/**
   - DisposableGroup was in apps/editor
   - Should have been in packages from start
   - Now in @engine/core/utils

---

## 📝 Code Review Checklist

Use this when reviewing PRs:

### Architecture
- [ ] New code in correct package?
- [ ] No duplication of existing code?
- [ ] Imports use @engine/* format?
- [ ] No local copies of package code?

### If Adding to Package:
- [ ] Really reusable outside app?
- [ ] No app-specific dependencies?
- [ ] Logger pattern if logging?
- [ ] Tests included?
- [ ] README updated?

### If Adding to App:
- [ ] Really app-specific?
- [ ] Not duplicating package code?
- [ ] Uses package versions of utilities?
- [ ] Imports from @engine/*?

---

## ❓ FAQ

### Q: Where do editor keyboard shortcuts go?
**A:** `apps/editor` - editor-specific, not reusable

### Q: Where does camera blending logic go?
**A:** `@engine/camera` - reusable camera feature

### Q: Where does asset browser UI go?
**A:** `apps/editor` - UI component

### Q: Where does asset filtering logic go?
**A:** `@engine/asset-pipeline` - reusable asset logic

### Q: I need undo/redo, where do I start?
**A:** Use `HistoryManager` from `@engine/editor-utils`, don't create your own

### Q: I need grid snapping, where is it?
**A:** Use `SnapSystem` from `@engine/editor-utils`

### Q: Can I import from package src/ directly?
**A:** NO! Always import from package root: `@engine/package-name`

### Q: What if I'm unsure?
**A:** Ask in #engineering, check similar code, review this guide

### Q: Can package import from app?
**A:** NO! Never. Packages are lower level, can't depend on apps.

### Q: Can app import from package?
**A:** YES! That's the whole point. Use `@engine/*` imports.

---

## 🎯 Quick Reference

```
┌────────────────────────────────────────────────────────┐
│                   WHERE DOES IT GO?                    │
└────────────────────────────────────────────────────────┘

Math utility          → @engine/core
Universal pattern     → @engine/core/utils
ECS component         → @engine/world
Rendering logic       → @engine/gfx-webgpu
Asset loading         → @engine/asset-pipeline
Camera system         → @engine/camera
Input handling        → @engine/input
Scripting             → @engine/script
Animation/Audio       → @engine/stdlib
Editor tool (no UI)   → @engine/editor-utils
Editor UI/workflow    → apps/editor
```

---

## 📞 Getting Help

**Questions?**
1. Check this document
2. Look for similar existing code
3. Review recent refactoring (docs/REFACTORING_COMPLETE.md)
4. Ask in #engineering

**Found duplication?**
1. DON'T create local copy
2. Check if it exists in packages
3. If yes → use package version
4. If no → consider moving to package

**Creating new package?**
1. Discuss with team first
2. Ensure clear domain boundary
3. Follow structure of existing packages
4. Document in README

---

## 📚 Related Documents

- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - System architecture
- [CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md) - Review guide
- [TEAM_ONBOARDING.md](./TEAM_ONBOARDING.md) - New developer guide

---

**Remember:** When in doubt, ask! Better to ask than create duplication.

**Last Updated:** 2025-11-22  
**Version:** 1.1  
**Based on:** Refactoring Phases 1-3 learnings


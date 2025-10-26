# Team Onboarding - Package Architecture

**For:** New developers joining the project  
**Time to read:** 10-15 minutes  
**Must read before:** Making your first PR

## 👋 Welcome!

This project uses a **modular monorepo architecture** with clear separation between:
- **packages/** - Shared, reusable code
- **apps/** - Applications (editor, playground, etc.)

**Key principle:** Reusable logic goes in packages, app-specific UI goes in apps.

---

## 🚀 Quick Start

### 1. Understand the Structure (5 min)

```
project/
├── packages/              # Shared code (@engine/*)
│   ├── core/             # Foundation (math, utils)
│   ├── world/            # ECS runtime
│   ├── gfx-webgpu/       # Rendering
│   ├── assets/           # Asset management
│   ├── camera/           # Camera systems
│   ├── input/            # Input handling
│   ├── script/           # Visual scripting
│   ├── stdlib/           # Standard library
│   └── editor-utils/     # Editor tools (NEW)
│
└── apps/                 # Applications
    └── editor/           # 3D scene editor
```

### 2. Key Rules (remember these!)

✅ **Always import from packages using:**
```typescript
import { Something } from '@engine/package-name';
```

❌ **Never use relative paths to packages:**
```typescript
import { Bad } from '../../../packages/...';  // DON'T!
```

✅ **Reusable code → packages/**
❌ **UI/UX code → apps/**

### 3. Read These Docs (15 min)

**Must read:**
1. [PACKAGE_GUIDELINES.md](./PACKAGE_GUIDELINES.md) - Where code belongs (5 min)
2. [CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md) - How we review (5 min)

**Good to read:**
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - System design (15 min)
4. [TESTING.md](./TESTING.md) - Testing philosophy (10 min)

---

## 🎯 Common Scenarios

### Scenario 1: "I need to add a new UI panel"

**Question:** Where does it go?

**Answer:** `apps/editor/src/editor/panels/MyPanel.ts`

**Why:** UI components are editor-specific, not reusable.

**Example:**
```typescript
// apps/editor/src/editor/panels/TerrainPanel.ts
export class TerrainPanel {
  private panel: HTMLElement;
  
  create() {
    this.panel = document.createElement('div');
    // UI logic here
  }
}
```

---

### Scenario 2: "I need camera controls"

**Question:** Do I create MyCameraController?

**Answer:** NO! Use `@engine/camera`

**Existing cameras:**
- `FPSCamera` - First-person controls
- `OrbitCamera` - Orbit/pan/zoom
- `CameraDirector` - Mode switching

**Example:**
```typescript
// ✅ CORRECT
import { FPSCamera } from '@engine/camera';

const camera = new FPSCamera(canvas, {
  sensitivity: 0.002,
  eyeHeight: 1.6
});
```

---

### Scenario 3: "I need undo/redo"

**Question:** Should I create my own undo system?

**Answer:** NO! Use `HistoryManager` from `@engine/editor-utils`

**Example:**
```typescript
// ✅ CORRECT
import { HistoryManager, type SceneSnapshot } from '@engine/editor-utils';

const history = new HistoryManager(100); // max 100 snapshots

// Save state
const snapshot: SceneSnapshot = {
  sceneJSON: JSON.stringify(scene.toJSON()),
  selectedPath: computeEntityPath(scene, selected),
  description: 'Added cube',
  timestamp: Date.now()
};
history.push(snapshot);

// Undo
const previous = history.undo();
if (previous) {
  restoreFromSnapshot(previous);
}
```

---

### Scenario 4: "I need grid snapping"

**Question:** Where is snap-to-grid?

**Answer:** `SnapSystem` from `@engine/editor-utils`

**Example:**
```typescript
// ✅ CORRECT
import { SnapSystem } from '@engine/editor-utils';

const snap = new SnapSystem({
  enabled: true,
  increment: 0.5,  // 0.5 unit grid
});

const snapped = snap.snapPosition([1.3, 2.7, 3.1]);
// Result: [1.5, 2.5, 3.0]
```

---

### Scenario 5: "I need to manage cleanup"

**Question:** How do I clean up resources?

**Answer:** Use `DisposableGroup` from `@engine/core/utils`

**Example:**
```typescript
// ✅ CORRECT
import { DisposableGroup } from '@engine/core/utils';

class MyComponent {
  private disposables = new DisposableGroup();
  
  initialize() {
    const handler = () => console.log('click');
    document.addEventListener('click', handler);
    this.disposables.add(() => 
      document.removeEventListener('click', handler)
    );
  }
  
  dispose() {
    this.disposables.dispose();  // Cleans up everything
  }
}
```

---

### Scenario 6: "I'm adding math utility"

**Question:** Where does `clamp()` go?

**Answer:** Check if it exists first! If not, add to `@engine/core/math`

**Before adding:**
```bash
# Search if it exists
grep -r "clamp" packages/core/src/math/
```

**If doesn't exist:**
```typescript
// packages/core/src/math/utils.ts
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

---

## 📦 Package Quickref

| Need | Package | Import |
|------|---------|--------|
| Math (Vec3, Mat4) | @engine/core | `import { Vec3 } from '@engine/core/math'` |
| DisposableGroup | @engine/core | `import { DisposableGroup } from '@engine/core/utils'` |
| Entity, Scene | @engine/world | `import { Entity, Scene } from '@engine/world'` |
| Components | @engine/world | `import { TransformComponent } from '@engine/world'` |
| Renderer | @engine/gfx-webgpu | `import { initRenderer } from '@engine/gfx-webgpu'` |
| AssetRegistry | @engine/assets | `import { assetRegistry } from '@engine/assets'` |
| FPS Camera | @engine/camera | `import { FPSCamera } from '@engine/camera'` |
| Input | @engine/input | `import { InputContextManager } from '@engine/input'` |
| LogicCubes | @engine/script | `import { LogicCubeSystem } from '@engine/script'` |
| Animation | @engine/stdlib | `import { AnimationStateMachine } from '@engine/stdlib'` |
| HistoryManager | @engine/editor-utils | `import { HistoryManager } from '@engine/editor-utils'` |
| SnapSystem | @engine/editor-utils | `import { SnapSystem } from '@engine/editor-utils'` |

---

## ⚡ Quick Tips

### Tip 1: Always search first
```bash
# Before creating something new, search if it exists
grep -r "MyFeature" packages/
```

### Tip 2: Check package exports
```typescript
// See what's available in a package
// packages/camera/src/index.ts
export * from './FPSCamera';
export * from './OrbitCamera';
export * from './CameraDirector';
```

### Tip 3: Use TypeScript autocomplete
```typescript
// Type "@engine/" and let autocomplete show packages
import { } from '@engine/
//                    ^ Press Ctrl+Space here
```

### Tip 4: Follow existing patterns
- Look at similar existing code
- Use same import style
- Follow same structure
- Copy-paste is OK for boilerplate

### Tip 5: When in doubt, ask!
- Check [PACKAGE_GUIDELINES.md](./PACKAGE_GUIDELINES.md)
- Ask in #engineering
- Ping a senior developer
- Better to ask than duplicate

---

## 🚫 Common Mistakes (Avoid These!)

### Mistake 1: Creating duplicate
```typescript
// ❌ WRONG
// apps/editor/src/utils/MyFPSCamera.ts
export class MyFPSCamera {
  // Duplicate of @engine/camera/FPSCamera
}

// ✅ RIGHT
import { FPSCamera } from '@engine/camera';
```

### Mistake 2: Relative package imports
```typescript
// ❌ WRONG
import { Camera } from '../../../packages/camera/src/Camera';

// ✅ RIGHT
import { Camera } from '@engine/camera';
```

### Mistake 3: Reusable logic in apps/
```typescript
// ❌ WRONG - in apps/editor/utils/snap.ts
export function snapToGrid(pos: Vec3) {
  // This could be used elsewhere!
}

// ✅ RIGHT - in packages/editor-utils/src/SnapSystem.ts
export class SnapSystem {
  snapPosition(pos: Vec3): Vec3 { ... }
}
```

### Mistake 4: UI in packages
```typescript
// ❌ WRONG - in packages/camera/src/CameraUI.ts
export class CameraUI {
  createPanel() {
    return document.createElement('div');  // NO!
  }
}

// ✅ RIGHT - in apps/editor/ui/CameraPanel.ts
export class CameraPanel {
  // UI here, uses camera from package
}
```

---

## 📚 Learning Path

### Week 1: Basics
- [ ] Read this document
- [ ] Read PACKAGE_GUIDELINES.md
- [ ] Explore package structure
- [ ] Make small PR (fix typo, update comment)

### Week 2: Contributing
- [ ] Pick a small issue
- [ ] Follow package guidelines
- [ ] Submit PR
- [ ] Address review comments

### Month 1: Proficiency
- [ ] Understand all packages
- [ ] Can place code correctly
- [ ] Review other PRs
- [ ] Help other new devs

---

## 🎓 Resources

### Documentation
- [PACKAGE_GUIDELINES.md](./PACKAGE_GUIDELINES.md) - **START HERE**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md) - Review guide
- [TESTING.md](./TESTING.md) - Test philosophy
- [PERFORMANCE.md](./PERFORMANCE.md) - Performance tips

### Recent Changes
- [REFACTORING_COMPLETE.md](./REFACTORING_COMPLETE.md) - What we just did
- [MIGRATION_SUCCESS_METRICS.md](./MIGRATION_SUCCESS_METRICS.md) - Before/after

### Examples
Look at existing code in packages/:
- `packages/camera/src/FPSCamera.ts` - Clean camera implementation
- `packages/assets/src/core/AssetRegistry.ts` - Logger config pattern
- `packages/editor-utils/src/HistoryManager.ts` - Editor utility
- `packages/core/src/utils/DisposableGroup.ts` - Universal utility

---

## 💬 Communication

### Gdzie pytać?
- **Architecture questions:** #engineering
- **Bug reports:** GitHub Issues
- **General help:** #engineering
- **Urgent:** Ping @tech-lead

### Przed zapytaniem:
1. Przeczytaj PACKAGE_GUIDELINES.md
2. Sprawdź czy odpowiedź jest w docs/
3. Szukaj podobnego kodu w projekcie
4. Potem pytaj (będziesz miał kontekst!)

---

## ✅ Your First PR Checklist

Before submitting:
- [ ] Code in correct package (used decision tree)
- [ ] Imports use `@engine/*` format
- [ ] No duplication of existing code
- [ ] Tests included and passing
- [ ] Followed existing patterns
- [ ] Self-reviewed using CODE_REVIEW_CHECKLIST.md

After submitting:
- [ ] CI/CD green
- [ ] Addressed review comments
- [ ] Manual testing done (if UI)
- [ ] Documentation updated (if needed)

---

## 🎯 Success Criteria

You're onboarded when you can:
- ✅ Determine where new code belongs
- ✅ Import correctly from packages
- ✅ Avoid duplicating existing code
- ✅ Follow project patterns
- ✅ Review others' code using checklist

**Time to proficiency:** ~2-4 weeks with active coding

---

## 🌟 Pro Tips from Experienced Devs

### Tip 1: "When adding feature, check packages first"
Before creating new code, search packages:
```bash
grep -r "featureName" packages/
```
Might already exist!

### Tip 2: "Wrapper pattern for singletons"
Editor often creates singletons with Logger:
```typescript
// apps/editor/src/editor/assets/AssetRegistry.ts
import { AssetRegistry } from '@engine/assets';
import { Logger } from '../../utils/logger';

export const assetRegistry = new AssetRegistry({
  logger: { debug: Logger.debug.bind(Logger), ... }
});
```
Follow this pattern for consistency.

### Tip 3: "Use existing utilities"
Don't reinvent:
- DisposableGroup (cleanup)
- HistoryManager (undo/redo)
- SnapSystem (grid snapping)
- Math functions (Vec3, Mat4)

Check packages before writing!

### Tip 4: "Match existing code style"
Look at similar files:
- Same import order
- Same naming conventions
- Same patterns
- Consistency matters

### Tip 5: "Document decisions"
If something is non-obvious, add comment:
```typescript
// Use 'any' to prevent circular dependency between assets and gfx-webgpu
export type BlockDefinition = any;
```

---

## 🔍 How to Find Things

### Finding a feature
```bash
# Search all packages
grep -r "FeatureName" packages/

# Search specific package
grep -r "FeatureName" packages/camera/src/

# Find type definitions
grep -r "export.*interface.*MyType" packages/
```

### Finding where something is used
```bash
# Find all imports of something
grep -r "import.*FPSCamera" apps/ packages/

# Find usages
grep -r "new FPSCamera" apps/ packages/
```

### Understanding dependencies
```bash
# See package dependencies
cat packages/editor-utils/package.json

# See workspace structure
cat pnpm-workspace.yaml
```

---

## 📖 Recent Major Change (Oct 2025)

**What happened:**
- Massive refactoring eliminated code duplication
- Created @engine/editor-utils package
- Moved utilities from apps/ to packages/
- Fixed critical WebGPU shader bug

**What it means for you:**
- ✅ Cleaner codebase (easier to understand)
- ✅ Clear guidelines (easier to contribute)
- ✅ Better structure (easier to find code)
- ✅ More reusable packages (easier to build features)

**See:** [REFACTORING_COMPLETE.md](./REFACTORING_COMPLETE.md) for details

---

## ❓ FAQ

### Q: I'm confused where to put my code
**A:** Use the decision tree in [PACKAGE_GUIDELINES.md](./PACKAGE_GUIDELINES.md)

### Q: Can I create a new package?
**A:** Discuss with team first. Usually add to existing package.

### Q: I found duplicate code, what do I do?
**A:** Create issue or PR to consolidate. Use package version.

### Q: Tests are failing, help!
**A:** 
1. Read error message carefully
2. Check if you're importing correctly (`@engine/*`)
3. Run `pnpm install` (might need workspace links)
4. Ask in #engineering

### Q: Build is failing
**A:**
```bash
# Clean and rebuild
rm -rf node_modules dist
pnpm install
pnpm -r build
```

### Q: Where do I find examples?
**A:** Look at existing code in packages/ and apps/editor/
Every package has good examples.

---

## 🎓 Learning Exercises

### Exercise 1: Trace an Import
Pick a file in apps/editor, trace where imports come from:
```typescript
import { FPSCamera } from '@engine/camera';
// → packages/camera/src/FPSCamera.ts
```

### Exercise 2: Find a Utility
Need grid snapping? Find it:
```bash
grep -r "snap" packages/*/src/index.ts
# Found in: packages/editor-utils/src/index.ts
```

### Exercise 3: Review a PR
- Pick a merged PR
- Apply CODE_REVIEW_CHECKLIST.md
- See if you can spot issues
- Learn from patterns

---

## 👥 Who to Ask

| Question Type | Ask |
|---------------|-----|
| Package architecture | Tech Lead |
| Where to put code | Senior Dev or check guidelines |
| Import issues | Any dev |
| Testing | See TESTING.md or #testing |
| Performance | See PERFORMANCE.md or #performance |
| Build issues | #engineering |

---

## ✅ Onboarding Checklist

Day 1:
- [ ] Read this document
- [ ] Read PACKAGE_GUIDELINES.md
- [ ] Explore project structure
- [ ] Run editor locally

Week 1:
- [ ] Read ARCHITECTURE.md
- [ ] Read CODE_REVIEW_CHECKLIST.md
- [ ] Made first small PR
- [ ] Understand package structure

Week 2-4:
- [ ] Contributed to multiple packages
- [ ] Comfortable with guidelines
- [ ] Can review others' PRs
- [ ] Understand monorepo benefits

---

## 🎯 Success Indicators

You're fully onboarded when you:
- ✅ Know where to put new code without asking
- ✅ Imports are always `@engine/*`
- ✅ Never duplicate package code
- ✅ Follow established patterns
- ✅ Can help onboard others

**Welcome to the team! 🚀**

---

**Questions?** Ask in #engineering  
**Version:** 1.0  
**Last Updated:** 2025-10-26


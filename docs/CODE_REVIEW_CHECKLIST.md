# Code Review Checklist

**Version:** 1.0  
**Mandatory for all PRs**

Use this checklist when reviewing code to maintain quality and prevent duplication.

---

## 📋 General Review

### PR Quality
- [ ] PR description is clear and explains what/why
- [ ] Commit messages follow convention
- [ ] No unnecessary files (dist/, node_modules/, .DS_Store)
- [ ] Code is well-organized and readable
- [ ] No commented-out code (unless with TODO)

### Testing
- [ ] Tests are included for new code
- [ ] All tests pass (CI/CD green)
- [ ] Test coverage maintained or improved
- [ ] Edge cases are tested
- [ ] No flaky tests introduced

---

## 🏗️ Architecture & Organization

### Package Placement ⭐ CRITICAL

- [ ] **New code is in the correct package** (see [PACKAGE_GUIDELINES.md](./PACKAGE_GUIDELINES.md))
- [ ] **No code duplication** between packages and apps
- [ ] **Reusable code is in packages/**, not apps/
- [ ] **Editor-specific UI is in apps/editor**, not packages/

**Decision tree:**
1. Reusable outside app? → `packages/`
2. App-specific UI/UX? → `apps/[app-name]/`
3. Universal utility? → `@engine/core/utils`
4. Editor tool? → `@engine/editor-utils`

### Imports ⭐ CRITICAL

- [ ] **All package imports use `@engine/*` format**
- [ ] **No relative imports to packages/** (`../../../packages/...`)
- [ ] **No local duplicates** of package code
- [ ] **Import statements are organized** (external, then @engine/*, then relative)
- [ ] **No mixing** local and package imports for same thing

**Red flag example:**
```typescript
// ❌ BAD
import { CameraA } from '../camera/CameraA';  // Local copy
import { CameraB } from '@engine/camera';      // Package

// ✅ GOOD  
import { CameraA, CameraB } from '@engine/camera';
```

### Dependencies

- [ ] New dependencies are justified and documented
- [ ] **No circular dependencies** created
- [ ] package.json dependencies are minimal
- [ ] Workspace dependencies use `workspace:*`
- [ ] devDependencies vs dependencies correct

**Check circular deps:**
```bash
pnpm list --depth=0 | grep -E "packageA|packageB"
```

---

## 💻 Code Quality

### TypeScript

- [ ] **No `any` without explanation comment**
- [ ] Prefer `unknown` over `any` when type truly unknown
- [ ] Type inference used where obvious
- [ ] Explicit types for public APIs
- [ ] Strict null checks respected
- [ ] No type assertions without reason

**Good:**
```typescript
// Has comment explaining why
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BlockDefinition = any; // Prevents circular dependency
```

**Bad:**
```typescript
const data: any = someFunction();  // No explanation
```

### Patterns

- [ ] **Logger pattern** used correctly (injectable config)
- [ ] **DisposableGroup** used for cleanup where appropriate
- [ ] Error handling is consistent
- [ ] Async/await over raw Promises
- [ ] Destructuring for readability

### Code Style (per user guidelines)

- [ ] Functions < 50 lines ideally
- [ ] Functional components/hooks over classes (React)
- [ ] Async/await over raw Promises
- [ ] Props/state destructured

---

## ⚡ Performance

### Allocations
- [ ] No obvious allocations in hot paths (loops, render)
- [ ] Arrays/objects reused where possible
- [ ] Consider cache locality for data structures

### Optimization
- [ ] Caching appropriate (not over-caching)
- [ ] Batch operations where possible
- [ ] Lazy load non-critical resources
- [ ] No unnecessary re-renders (if UI)

**Red flags:**
- Creating objects in render loop
- Unnecessary array copies
- Synchronous operations blocking UI

---

## 🧪 Testing (per user guidelines)

### Test Quality
- [ ] **Test behavior, not implementation**
- [ ] **External dependencies are mocked**
- [ ] **E2E for critical user paths** (if applicable)
- [ ] **Unit tests for business logic**
- [ ] Tests are readable and well-named

### Coverage
- [ ] New code has tests
- [ ] Happy path tested
- [ ] Error cases tested
- [ ] Edge cases considered

---

## 📝 Documentation

### Code Documentation
- [ ] Public APIs have JSDoc comments (in English)
- [ ] Complex logic has inline comments (in Polish per guidelines)
- [ ] README updated if new package
- [ ] ARCHITECTURE.md updated if significant change

### Comments Quality
```typescript
// ✅ GOOD - Explains WHY
// Use any to prevent circular dependency between assets and gfx-webgpu
export type BlockDefinition = any;

// ❌ BAD - Explains WHAT (code is self-explanatory)
// Set x to 5
const x = 5;
```

---

## 🚩 Red Flags - STOP and Discuss

### Critical Issues (Must Fix)

#### Duplication
- [ ] ⛔ **Code copied from another file**
- [ ] ⛔ **Similar logic in apps/ and packages/**
- [ ] ⛔ **"TODO: unify with X" comments**

**Action:** Consolidate, use package version, or justify

#### Import Violations
- [ ] ⛔ **Relative imports to packages/** (`../../../packages/...`)
- [ ] ⛔ **Local duplicates of package code**
- [ ] ⛔ **Importing from package internals** (`@engine/pkg/src/internal/...`)

**Action:** Change to `@engine/*` imports, remove duplicates

#### Architecture Violations
- [ ] ⛔ **Shared logic in apps/** (should be in packages/)
- [ ] ⛔ **UI code in packages/** (should be in apps/)
- [ ] ⛔ **Circular dependencies**

**Action:** Refactor to correct location

### High Priority (Should Fix)

#### Performance
- [ ] ⚠️ Unnecessary allocations in loops
- [ ] ⚠️ Missing memoization for expensive operations
- [ ] ⚠️ Synchronous operations blocking render
- [ ] ⚠️ Bundle size increase > 50kB

**Action:** Optimize or justify

#### Testing
- [ ] ⚠️ No tests for new code
- [ ] ⚠️ Tests testing implementation not behavior
- [ ] ⚠️ Flaky tests
- [ ] ⚠️ Test coverage decreased

**Action:** Add tests, fix flaky tests

---

## ✅ Approval Checklist

### Before approving PR:

**Architecture:**
- [ ] Code in correct location (packages vs apps)
- [ ] No duplication
- [ ] Imports consistent
- [ ] Dependencies clean

**Quality:**
- [ ] TypeScript types correct
- [ ] No obvious bugs
- [ ] Error handling adequate
- [ ] Performance acceptable

**Testing:**
- [ ] Tests pass
- [ ] Coverage adequate
- [ ] Manual testing done (if UI changes)

**Documentation:**
- [ ] Code documented
- [ ] README updated if needed
- [ ] Breaking changes documented

**Final:**
- [ ] No red flags unresolved
- [ ] Changes align with architecture
- [ ] Ready for production

---

## 💬 Review Comments - Templates

### Requesting Changes

**Duplication:**
```
This appears to duplicate code from @engine/camera/FPSCamera. 
Can we use the package version instead?

See: packages/camera/src/FPSCamera.ts
Guidelines: docs/PACKAGE_GUIDELINES.md
```

**Wrong Package:**
```
This logic seems reusable outside the editor. Should it be in 
@engine/editor-utils instead of apps/editor/?

Guidelines: docs/PACKAGE_GUIDELINES.md - Decision Tree
```

**Import Issue:**
```
Please change this import to use @engine/* format:

- import { Something } from '../../../packages/...'
+ import { Something } from '@engine/package-name'

See: docs/PACKAGE_GUIDELINES.md - Import Policy
```

### Suggestions

**Performance:**
```
Consider caching this result - it's computed in a loop.

Suggestion:
const cached = useMemo(() => expensiveOperation(), [deps]);
```

**Testing:**
```
Could we add a test for the error case?

Example test case:
- What happens when input is null?
- What happens when API fails?
```

---

## 🎓 Learning Resources

### For Reviewers
1. Read [PACKAGE_GUIDELINES.md](./PACKAGE_GUIDELINES.md)
2. Review [REFACTORING_COMPLETE.md](./REFACTORING_COMPLETE.md)
3. Understand package structure
4. Know common anti-patterns

### For Authors
Before submitting PR:
1. Self-review using this checklist
2. Run `pnpm test` locally
3. Run `pnpm -r build` locally
4. Check imports use @engine/*
5. Verify no duplication

---

## 🔄 Process

### PR Submitted
1. Autor runs self-review
2. CI/CD runs automated checks
3. Reviewer uses this checklist
4. Comments/requests posted
5. Autor addresses feedback
6. Re-review
7. Approval

### Approval Criteria
- ✅ All checkboxes above reviewed
- ✅ No critical red flags
- ✅ Tests pass
- ✅ Documentation adequate
- ✅ Architecture correct

---

## 📊 Metrics to Track

### Per PR:
- Lines added/removed
- Test coverage change
- Bundle size impact
- Build time impact

### Team-wide:
- Code duplication instances
- Import consistency %
- Package vs app code ratio
- Review cycle time

---

**Remember:** Quality code review prevents bugs, duplication, and technical debt!

**Use this checklist for every PR.**

---

**Version:** 1.0  
**Last Updated:** 2025-10-26  
**Maintainer:** Tech Lead


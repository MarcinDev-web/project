# AI Prompts & Examples

> **Example prompts and workflows for AI assistants working on UGC 3D Platform**

## 🎯 How to Use This File

This document provides:
- Example prompts for common tasks
- Expected AI workflow patterns
- Context loading strategies
- Best practices for AI-assisted development

---

## 📚 Context Loading Strategy

### Initial Context (First Interaction)

**Prompt:**
```
I'm working on the UGC 3D Platform. Please read:
1. AI_CONTEXT.md - for project overview and rules
2. CODEBASE_PATTERNS.md - for design patterns
3. docs/guidelines/PACKAGE_GUIDELINES.md - for package organization

Then let me know you're ready to help.
```

**Expected AI Response Pattern:**
```
I've read the context files. I understand this is a:
- WebGPU-based 3D game engine
- TypeScript monorepo with pnpm workspaces
- Modular architecture with strict boundaries
- ECS-based entity system

Key rules I'll follow:
- Always use @engine/* imports
- No duplication between packages and apps
- Test behavior not implementation
- Every resource needs dispose()

What would you like to work on?
```

---

## 🛠️ Common Task Prompts

### 1. Creating a New Component

**Prompt:**
```
I need to create a new component called ParticleComponent that will:
- Store particle system data (count, lifetime, spawn rate)
- Be serializable
- Belong to @engine/world package

Please:
1. Check if similar component exists
2. Create the component following existing patterns
3. Add it to the package exports
4. Write comprehensive tests
```

**Expected AI Workflow:**
1. Search for existing particle-related code
2. Review similar components (e.g., MeshComponent, TransformComponent)
3. Generate component following the pattern
4. Add to `packages/world/src/components/ParticleComponent.ts`
5. Export from `packages/world/src/index.ts`
6. Create test file `packages/world/__tests__/ParticleComponent.test.ts`
7. Verify no linter errors

---

### 2. Adding a New System

**Prompt:**
```
Create a ParticleSystem that:
- Processes entities with ParticleComponent
- Updates particle positions each frame
- Spawns new particles based on spawn rate
- Removes dead particles

Follow the ECS pattern and include tests.
```

**Expected AI Workflow:**
1. Review existing systems (e.g., PhysicsSystem, TransformSystem)
2. Create `packages/world/src/systems/ParticleSystem.ts`
3. Implement system following patterns:
   - Constructor takes required dependencies
   - `update(entities: Entity[], dt: number): void` method
   - Proper resource cleanup in `dispose()`
4. Add tests with proper setup/teardown
5. Consider performance (object pooling, batch operations)

---

### 3. Refactoring Code to Package

**Prompt:**
```
I found duplicated code in apps/editor/src/utils/selectionHelper.ts
that should be in a package. Can you:
1. Determine which package it belongs to
2. Move it to the correct location
3. Update all imports
4. Ensure tests still pass
```

**Expected AI Workflow:**
1. Read the code to understand functionality
2. Check PACKAGE_GUIDELINES.md for decision tree
3. Determine correct package (likely @engine/editor-utils)
4. Create file in package
5. Search for all usages: `grep -r "selectionHelper" apps/`
6. Update all imports to use @engine/* alias
7. Run `pnpm test:changed` to verify
8. Remove old file

---

### 4. Debugging Test Failure

**Prompt:**
```
Test "TransformComponent updates correctly" is failing with:
"Expected [1, 2, 3] but got [0, 0, 0]"

Please help debug this.
```

**Expected AI Workflow:**
1. Ask to see the test code
2. Check test setup/teardown
3. Verify component initialization
4. Check for state leakage between tests
5. Look for missing cleanup
6. Suggest fix with explanation
7. Verify fix doesn't break other tests

---

### 5. Performance Optimization

**Prompt:**
```
The renderer is allocating too many Vec3 objects in the render loop.
Can you optimize this while maintaining functionality?
```

**Expected AI Workflow:**
1. Identify hot path allocations
2. Suggest object pooling or reuse pattern
3. Show before/after code
4. Explain performance impact
5. Ensure tests still pass
6. Consider adding performance benchmark test

---

## 🎨 Architecture Decision Prompts

### Where Does This Code Belong?

**Prompt:**
```
I want to add [FEATURE_DESCRIPTION]. 
Where should this code live?
```

**Expected AI Response Pattern:**
```
Let me check PACKAGE_GUIDELINES.md...

Based on the decision tree:
- Is it reusable? [YES/NO]
- Is it app-specific UI? [YES/NO]
- What does it depend on? [LIST]

This should go in: @engine/[PACKAGE]
Because: [REASONING]

Would you like me to:
1. Create the file structure
2. Implement the feature
3. Add tests
```

---

### Avoiding Circular Dependencies

**Prompt:**
```
I need @engine/world to use a utility from @engine/gfx-webgpu,
but this would create a circular dependency. How should I resolve this?
```

**Expected AI Response Pattern:**
```
This would violate the dependency hierarchy:
- @engine/world is Level 1
- @engine/gfx-webgpu is Level 2
- Higher-level cannot depend on lower-level

Options:
1. Move utility to @engine/core (if truly fundamental)
2. Move utility to @engine/world (if world-specific)
3. Create shared utility in lower-level package
4. Refactor to avoid dependency (preferred)

I recommend: [OPTION] because [REASONING]

Would you like me to implement this approach?
```

---

## 🧪 Testing Prompts

### Writing Behavior Tests

**Prompt:**
```
Write comprehensive tests for MyComponent that test behavior,
not implementation. Include:
- Happy path
- Edge cases
- Error conditions
- Cleanup
```

**Expected AI Test Structure:**
```typescript
describe('MyComponent', () => {
  let component: MyComponent;
  
  beforeEach(() => {
    component = new MyComponent({ /* ... */ });
  });
  
  afterEach(() => {
    component.dispose();
  });
  
  describe('initialization', () => {
    test('initializes with correct default values', () => {
      // Test observable behavior
    });
  });
  
  describe('operations', () => {
    test('performs operation correctly', () => {
      // Arrange, Act, Assert
    });
    
    test('handles edge case', () => {
      // Edge case behavior
    });
  });
  
  describe('error handling', () => {
    test('throws on invalid input', () => {
      // Error behavior
    });
  });
  
  describe('cleanup', () => {
    test('disposes resources correctly', () => {
      // Verify cleanup
    });
  });
});
```

---

## 🔍 Code Review Prompts

### Self-Review

**Prompt:**
```
Review my changes against CODE_REVIEW_CHECKLIST.md:

[PASTE CODE OR DIFF]
```

**Expected AI Response Pattern:**
```
Reviewing against checklist...

✅ Architecture:
- Uses @engine/* imports
- No circular dependencies
- Correct package placement

✅ Code Quality:
- TypeScript strict mode compliant
- No any without justification
- Proper error handling

⚠️ Issues Found:
1. Missing cleanup in dispose() method (line 45)
2. Should use object pool in render loop (line 78)

✅ Testing:
- Tests present and comprehensive
- Behavior tested, not implementation
- Proper cleanup in afterEach

Suggestions:
1. Add dispose() call for eventBus
2. Consider using Vec3Pool for temp vectors

Would you like me to fix these issues?
```

---

## 💡 Learning & Exploration Prompts

### Understanding Existing Code

**Prompt:**
```
Explain how the LogicCube system works, including:
- Architecture
- Key components
- How cubes connect
- How execution works
```

**Expected AI Response:**
```
The LogicCube system is a visual scripting framework:

Architecture:
- Base class: LogicCube (abstract)
- Types: Trigger, Action, Condition, Data, Gate
- Manager: LogicCubeSystem
- Connections: LogicConnectionManager

Key Components:
1. LogicCube - Base class for all cube types
2. LogicCubeComponent - ECS component that holds cubes
3. LogicCubeSystem - Processes cubes each frame
4. LogicConnectionManager - Manages cube connections

Execution Flow:
1. Trigger activates (e.g., player enters zone)
2. Signal flows through connections
3. Conditions evaluate (gate the signal)
4. Actions execute (e.g., play sound)

Example:
[CODE EXAMPLE]

Would you like me to:
- Show more examples
- Explain a specific cube type
- Show how to create custom cubes
```

---

## 🚀 Performance Analysis Prompts

**Prompt:**
```
Analyze the performance of [SYSTEM/COMPONENT] and suggest optimizations.
Focus on:
- Allocation patterns
- Cache locality
- Batch opportunities
```

**Expected AI Response:**
```
Performance Analysis for [SYSTEM]:

🔴 Issues Found:
1. Allocating Vec3 in render loop (60 times/sec)
   - Line 45: `const temp = new Vec3()`
   - Impact: GC pressure, frame drops

2. Non-contiguous data access
   - Line 78: Multiple component lookups per entity
   - Impact: Cache misses

3. Unbatched operations
   - Line 120: Setting uniform per entity
   - Impact: GPU state changes

✅ Suggested Optimizations:

1. Object Pooling:
[CODE EXAMPLE]

2. Data-Oriented Design:
[CODE EXAMPLE]

3. Batching:
[CODE EXAMPLE]

Expected Impact:
- 70% reduction in allocations
- 2x better cache hit rate
- 10x fewer GPU state changes

Would you like me to implement these optimizations?
```

---

## 🔧 Maintenance Prompts

### Documentation Update

**Prompt:**
```
I've added a new feature [FEATURE]. Please update:
1. Package README
2. Main documentation
3. Add example to examples/
```

---

### Dependency Update

**Prompt:**
```
Check if we should update our dependencies. Consider:
- Security vulnerabilities
- Breaking changes
- Compatibility with WebGPU spec
```

---

## 📊 Best Practices

### For AI Assistants

1. **Always read context first**
   - AI_CONTEXT.md before any code generation
   - CODEBASE_PATTERNS.md for patterns
   - PACKAGE_GUIDELINES.md for placement

2. **Search before creating**
   - Check if code already exists
   - Look for similar patterns
   - Avoid duplication

3. **Follow the checklist**
   - Every code change should pass CODE_REVIEW_CHECKLIST.md
   - Self-review before suggesting

4. **Explain decisions**
   - Why this package?
   - Why this pattern?
   - What are the tradeoffs?

5. **Test immediately**
   - Don't defer testing
   - Include in same response
   - Verify tests pass

### For Users

1. **Provide context**
   - Mention AI_CONTEXT.md in first prompt
   - Share relevant code snippets
   - Explain the goal, not just the task

2. **Be specific**
   - "Add particle system to @engine/world" vs "Add particles"
   - Include acceptance criteria
   - Mention constraints

3. **Iterate**
   - Review AI suggestions
   - Ask for alternatives
   - Request explanations

4. **Verify**
   - Run tests after changes
   - Check linter
   - Review against checklist

---

## 🎓 Training Examples

### Example 1: Good Interaction

```
User: I need to add a HealthComponent. It should:
      - Store current/max health
      - Emit events on damage/heal/death
      - Be serializable
      
AI:   I'll create this in @engine/world following the component pattern.
      
      [Shows code with proper structure, events, serialization]
      
      I've also added comprehensive tests covering:
      - Initialization
      - Damage/heal operations
      - Death threshold
      - Event emission
      - Serialization roundtrip
      
      Should I also create a HealthSystem to process health regeneration?

User: Yes, with configurable regen rate.

AI:   [Creates system with tests]
```

### Example 2: Course Correction

```
User: Add a utility to apps/editor/src/utils/mathHelper.ts

AI:   Before I do that, I notice this might belong in a package instead.
      
      Looking at the functionality, this seems like general math utilities
      that could be reused. According to PACKAGE_GUIDELINES.md, this should
      go in @engine/core/src/math/utils.ts
      
      Should I:
      1. Add to @engine/core (reusable)
      2. Keep in apps/editor (editor-specific)
      
      Which matches your use case?

User: You're right, it's reusable. Put it in @engine/core.

AI:   [Creates in correct location with proper exports and tests]
```

---

## 📖 Reference

For complete details, always refer to:
- [AI_CONTEXT.md](AI_CONTEXT.md) - Complete context guide
- [CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md) - Design patterns
- [docs/guidelines/PACKAGE_GUIDELINES.md](docs/guidelines/PACKAGE_GUIDELINES.md) - Package organization

---

**These prompts are guidelines. Adapt them to your specific needs and workflow.**


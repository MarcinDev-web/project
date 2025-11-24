# Documentation Index

Complete documentation for the UGC 3D Platform project.

## 🤖 For AI Assistants (Claude 4.5 Sonnet, GPT-5)

**📖 Not sure which file to read? Check [../AI_FILES_INDEX.md](../AI_FILES_INDEX.md) first!**

**Start here for AI-powered development:**

- **[../AI_CONTEXT.md](../AI_CONTEXT.md)** ⭐ **CRITICAL** - Comprehensive context guide for AI assistants
  - Project structure and mental model
  - Architectural rules and patterns
  - Code style and conventions
  - Testing philosophy
  - Common tasks and pitfalls
  - Quick reference for all common operations

- **[../CODEBASE_PATTERNS.md](../CODEBASE_PATTERNS.md)** ⭐ **ESSENTIAL** - Design patterns and idioms
  - Component pattern (ECS)
  - Disposable pattern
  - Event bus pattern
  - Factory, Command, Observer patterns
  - Performance patterns
  - Testing patterns

- **[../AI_PROMPTS.md](../AI_PROMPTS.md)** - Example prompts and workflows
  - Context loading strategies
  - Common task prompts
  - Architecture decision prompts
  - Testing and code review prompts

- **[../QUICK_START_AI.md](../QUICK_START_AI.md)** - ⚡ 2-minute quick reference
- **[../.cursorrules](../.cursorrules)** - Cursor IDE configuration (auto-loaded)

**These files provide the context needed for AI assistants to:**
- Generate high-quality, consistent code
- Make correct architectural decisions
- Follow project conventions automatically
- Avoid common pitfalls and anti-patterns
- Write appropriate tests

---

## 📖 Core Documentation

### Architecture & Design
- **[architecture/](./architecture/)** - System architecture and design
  - [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) - System architecture and package structure
  - [ALIAS_CONFIGURATION.md](./architecture/ALIAS_CONFIGURATION.md) - Alias configuration guide
  - [WASM_FUTURE_MODULES.md](./architecture/WASM_FUTURE_MODULES.md) - Future WASM modules

### Performance
- **[performance/](./performance/)** - Performance guidelines and optimization
  - [PERFORMANCE.md](./performance/PERFORMANCE.md) - General performance guide
  - [PERFORMANCE_OPTIMIZATIONS.md](./performance/PERFORMANCE_OPTIMIZATIONS.md) - Optimization techniques
  - [SIMD_OPTIMIZATIONS.md](./performance/SIMD_OPTIMIZATIONS.md) - SIMD optimizations
  - [MEASURE_JS_HEAP.md](./performance/MEASURE_JS_HEAP.md) - Memory profiling
  - [BENCHMARKING_GUIDE.md](./performance/BENCHMARKING_GUIDE.md) - Benchmarking guide

### Testing
- **[testing/](./testing/)** - Testing philosophy and automation
  - [TESTING.md](./testing/TESTING.md) - Testing philosophy
  - [TESTING_AUTOMATION.md](./testing/TESTING_AUTOMATION.md) - Automation guide
  - [TEST_OPTIMIZATION.md](./testing/TEST_OPTIMIZATION.md) - Test optimization

### Gameplay & Analysis
- **[gameplay/](./gameplay/)** - Gameplay systems analysis
  - [GAMEPLAY_ANALYSIS.md](./gameplay/GAMEPLAY_ANALYSIS.md) - Gameplay analysis
  - [MOVEMENT_ANALYSIS.md](./gameplay/MOVEMENT_ANALYSIS.md) - Movement system analysis
  - [MULTIPLAYER_USAGE.md](./gameplay/MULTIPLAYER_USAGE.md) - Multiplayer usage
  - [MULTIPLAYER_READINESS_REPORT.md](./gameplay/MULTIPLAYER_READINESS_REPORT.md) - Multiplayer readiness

### Scripting & Logic
- **[scripting/](./scripting/)** - Visual scripting documentation
  - [LOGIC_CUBES.md](./scripting/LOGIC_CUBES.md) - LogicCubes reference guide

### Automation & Release
- **[automation/](./automation/)** - Release and CI/CD automation
  - [AUTOMATION_QUICK_START.md](./automation/AUTOMATION_QUICK_START.md) - Quick start for automation
  - [AUTOMATION_ROADMAP.md](./automation/AUTOMATION_ROADMAP.md) - Roadmap
  - [RELEASE_AUTOMATION.md](./automation/RELEASE_AUTOMATION.md) - Release process
  - [RELEASE_API.md](./automation/RELEASE_API.md) - Release API

### Branding
- **[branding/](./branding/)** - Project branding
  - [BRANDING.md](./branding/BRANDING.md) - Branding guidelines
  - [BRANDING_CHANGELOG.md](./branding/BRANDING_CHANGELOG.md) - Branding changes

### Technical Details
- **[technical/](./technical/)** - Technical specifications
  - [FRAME_MODEL.md](./technical/FRAME_MODEL.md) - Rendering frame model
  - [PLAY_MODE.md](./technical/PLAY_MODE.md) - Play mode state machine
  - [WEBGPU_FEATURE_POLICY.md](./technical/WEBGPU_FEATURE_POLICY.md) - WebGPU feature tiers
  - [RUNTIME_DETERMINISM_AND_SERIALIZATION.md](./technical/RUNTIME_DETERMINISM_AND_SERIALIZATION.md) - Time model, RNG, units
  - [UGC_SECURITY_MODEL.md](./technical/UGC_SECURITY_MODEL.md) - UGC sandbox
  - [SECURITY.md](./technical/SECURITY.md) - General security guide
  - [README_PLATFORM.md](./technical/README_PLATFORM.md) - Platform readme

### Architecture Decisions
- **[adr/](./adr/)** - Architecture Decision Records
  - [001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md)
  - [002-shader-tests.md](./adr/002-shader-tests.md)
  - [003-wasm-collision.md](./adr/003-wasm-collision.md)

---

## 📋 Guidelines (MUST READ for Contributors)

**Location:** [guidelines/](./guidelines/)

### Essential Guidelines
1. **[PACKAGE_GUIDELINES.md](./guidelines/PACKAGE_GUIDELINES.md)** ⭐ **MANDATORY**
   - Where does code belong? (decision tree)
   - Package descriptions and examples
   - Import policy and patterns

2. **[CODE_REVIEW_CHECKLIST.md](./guidelines/CODE_REVIEW_CHECKLIST.md)** ⭐ **USE FOR ALL PRS**
   - Architecture verification
   - Quality checklist
   - Red flags

3. **[TEAM_ONBOARDING.md](./guidelines/TEAM_ONBOARDING.md)** ⭐ **NEW DEVS START HERE**
   - Quick start (10-15 min)
   - Common scenarios
   - FAQ

**See:** [guidelines/README.md](./guidelines/README.md) for index

---

## 🔧 Refactoring (October 2025) - Completed

**Summary:**
- Eliminated 6 major duplicates (-1823 lines)
- Created @engine/editor-utils package
- 100% import consistency achieved

---

## 🚀 Quick Links

### For AI Assistants (Claude, GPT)
1. **Start:** [../AI_CONTEXT.md](../AI_CONTEXT.md) - Complete context guide
2. **Patterns:** [../CODEBASE_PATTERNS.md](../CODEBASE_PATTERNS.md) - Design patterns
3. **Prompts:** [../AI_PROMPTS.md](../AI_PROMPTS.md) - Example workflows
4. **Quick:** [../QUICK_START_AI.md](../QUICK_START_AI.md) - 2-minute reference
5. **Guidelines:** [guidelines/PACKAGE_GUIDELINES.md](./guidelines/PACKAGE_GUIDELINES.md) - Where code belongs

### For New Developers
1. Start: [guidelines/TEAM_ONBOARDING.md](./guidelines/TEAM_ONBOARDING.md)
2. Read: [guidelines/PACKAGE_GUIDELINES.md](./guidelines/PACKAGE_GUIDELINES.md)
3. Review: [architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md)

### For Contributors
1. Before coding: [guidelines/PACKAGE_GUIDELINES.md](./guidelines/PACKAGE_GUIDELINES.md)
2. Before PR: [guidelines/CODE_REVIEW_CHECKLIST.md](./guidelines/CODE_REVIEW_CHECKLIST.md)
3. Testing: [testing/TESTING.md](./testing/TESTING.md)

### For Reviewers
1. Use: [guidelines/CODE_REVIEW_CHECKLIST.md](./guidelines/CODE_REVIEW_CHECKLIST.md)
2. Reference: [guidelines/PACKAGE_GUIDELINES.md](./guidelines/PACKAGE_GUIDELINES.md)

---

## 📁 Documentation Structure

```
forge-engine/
├── AI_CONTEXT.md                    # 🤖 AI assistant guide ⭐
├── AI_FILES_INDEX.md                # 🤖 Quick index for finding docs
├── CODEBASE_PATTERNS.md             # 🤖 Design patterns ⭐
├── AI_PROMPTS.md                    # 🤖 Example prompts & workflows
├── QUICK_START_AI.md                # 🤖 2-minute quick start
├── .cursorrules                     # 🤖 Cursor IDE config
├── README.md                        # Project overview
├── TEST_COMMANDS_CHEATSHEET.md      # Testing commands
└── docs/
    ├── README.md (this file)
    ├── architecture/                # System design ⭐
    │   └── ARCHITECTURE.md
    ├── performance/                 # Performance guide
    │   └── PERFORMANCE.md
    ├── testing/                     # Testing philosophy
    │   └── TESTING.md
    ├── guidelines/                  # Development guidelines ⭐
    │   ├── PACKAGE_GUIDELINES.md    # Where code belongs
    │   └── ...
    ├── deployment/                  # Deployment documentation
    ├── technical/                   # Technical specs
    │   └── ...
    ├── gameplay/                    # Gameplay analysis
    ├── automation/                  # Release automation
    ├── branding/                    # Branding
    └── adr/                         # Architecture decisions
```

---

**Last Updated:** 2025-11-22
**Maintainer:** Tech Team

**Note:** Documentation has been reorganized to improve discoverability.

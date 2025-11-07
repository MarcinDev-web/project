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
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and package structure
- **[PERFORMANCE.md](./PERFORMANCE.md)** - Performance guidelines and optimization
- **[TESTING.md](./TESTING.md)** - Testing philosophy and practices

### Technical Details
- **[technical/](./technical/)** - Technical specifications
  - [FRAME_MODEL.md](./technical/FRAME_MODEL.md) - Rendering frame model
  - [PLAY_MODE.md](./technical/PLAY_MODE.md) - Play mode state machine
  - [WEBGPU_FEATURE_POLICY.md](./technical/WEBGPU_FEATURE_POLICY.md) - WebGPU feature tiers, adapter selection, device-loss & fallback
  - [RUNTIME_DETERMINISM_AND_SERIALIZATION.md](./technical/RUNTIME_DETERMINISM_AND_SERIALIZATION.md) - Time model, RNG, units, serialization versioning
  - [UGC_SECURITY_MODEL.md](./technical/UGC_SECURITY_MODEL.md) - UGC sandbox, capabilities, and asset validation pipeline

### Architecture Decisions
- **[adr/](./adr/)** - Architecture Decision Records
  - [001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md)

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

## 🔧 Refactoring (October 2025) - Archived

**Location:** [archive/](./archive/)

**Note:** Refactoring documentation has been moved to the archive as the refactoring work is complete.

**Summary:**
- Eliminated 6 major duplicates (-1823 lines)
- Created @engine/editor-utils package
- 100% import consistency achieved
- Comprehensive documentation (24+ files)

**Key archived files:**
- [REFACTORING_COMPLETE.md](./archive/REFACTORING_COMPLETE.md) - Complete overview
- [MIGRATION_SUCCESS_METRICS.md](./archive/MIGRATION_SUCCESS_METRICS.md) - Metrics and results

---

## 🐛 Issues & Fixes

**Location:** [issues/](./issues/)

- **[SHADER_NON_UNIFORM_CONTROL_FLOW.md](./issues/SHADER_NON_UNIFORM_CONTROL_FLOW.md)** - WebGPU shader fix

---

## 📊 Analysis & Reports

**Current analyses:**
- **[GAMEPLAY_ANALYSIS.md](./GAMEPLAY_ANALYSIS.md)** - Gameplay systems analysis
- **[TEST_OPTIMIZATION.md](./TEST_OPTIMIZATION.md)** - Test optimization report
- **[TESTING_AUTOMATION.md](./TESTING_AUTOMATION.md)** - Test automation guide
- **[analysis/](./analysis/)** - Current analysis documents
  - [HOTBAR_PLACEMENT_ANALYSIS.md](./analysis/HOTBAR_PLACEMENT_ANALYSIS.md) - Hotbar placement integration
  - [PLACEMENT_ANALYSIS_PROBLEMS.md](./analysis/PLACEMENT_ANALYSIS_PROBLEMS.md) - Placement system issues

**Archived analyses:**
- See [archive/](./archive/) for historical analysis documents and completed refactoring documentation

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
3. Review: [ARCHITECTURE.md](./ARCHITECTURE.md)

### For Contributors
1. Before coding: [guidelines/PACKAGE_GUIDELINES.md](./guidelines/PACKAGE_GUIDELINES.md)
2. Before PR: [guidelines/CODE_REVIEW_CHECKLIST.md](./guidelines/CODE_REVIEW_CHECKLIST.md)
3. Testing: [TESTING.md](./TESTING.md)

### For Reviewers
1. Use: [guidelines/CODE_REVIEW_CHECKLIST.md](./guidelines/CODE_REVIEW_CHECKLIST.md)
2. Reference: [guidelines/PACKAGE_GUIDELINES.md](./guidelines/PACKAGE_GUIDELINES.md)

---

## 📁 Documentation Structure

```
ugc-3d-platform/
├── AI_CONTEXT.md                    # 🤖 AI assistant guide ⭐
├── CODEBASE_PATTERNS.md             # 🤖 Design patterns ⭐
├── AI_PROMPTS.md                    # 🤖 Example prompts & workflows
├── QUICK_START_AI.md                # 🤖 2-minute quick start
├── .cursorrules                     # 🤖 Cursor IDE config
├── README.md                        # Project overview
├── TEST_COMMANDS_CHEATSHEET.md      # Testing commands
└── docs/
    ├── README.md (this file)
    ├── ARCHITECTURE.md              # System design ⭐
    ├── PERFORMANCE.md               # Performance guide
    ├── TESTING.md                   # Testing philosophy
    ├── guidelines/                  # Development guidelines ⭐
    │   ├── README.md
    │   ├── PACKAGE_GUIDELINES.md         # Where code belongs
    │   ├── CODE_REVIEW_CHECKLIST.md      # PR review checklist
    │   └── TEAM_ONBOARDING.md            # New dev guide
    ├── archive/                    # Archived documentation
    │   ├── REFACTORING_COMPLETE.md      # Oct 2025 refactoring summary
    │   ├── MIGRATION_SUCCESS_METRICS.md
    │   ├── [completed refactoring docs]
    │   └── [historical analyses]
    ├── analysis/                   # Current analysis documents
    │   ├── HOTBAR_PLACEMENT_ANALYSIS.md
    │   ├── PLACEMENT_ANALYSIS_PROBLEMS.md
    │   └── [other analyses]
    ├── technical/                   # Technical specs
    │   ├── FRAME_MODEL.md
    │   └── PLAY_MODE.md
    ├── adr/                         # Architecture decisions
    │   └── 001-modular-engine-architecture.md
    ├── issues/                      # Issue documentation
    │   └── SHADER_NON_UNIFORM_CONTROL_FLOW.md
    └── [various analysis docs]
```

---

**Last Updated:** 2025-11-02  
**Maintainer:** Tech Lead

**Note:** Documentation has been reorganized. Historical analyses and completed refactoring documentation are now in [archive/](./archive/).

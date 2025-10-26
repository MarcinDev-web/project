# Documentation Index

Complete documentation for the UGC 3D Platform project.

## 📖 Core Documentation

### Architecture & Design
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and package structure
- **[PERFORMANCE.md](./PERFORMANCE.md)** - Performance guidelines and optimization
- **[TESTING.md](./TESTING.md)** - Testing philosophy and practices

### Technical Details
- **[technical/](./technical/)** - Technical specifications
  - [FRAME_MODEL.md](./technical/FRAME_MODEL.md) - Rendering frame model
  - [PLAY_MODE.md](./technical/PLAY_MODE.md) - Play mode state machine

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

## 🔧 Refactoring (October 2025)

**Location:** [refactoring/](./refactoring/)

### Summary
**[REFACTORING_COMPLETE.md](./refactoring/REFACTORING_COMPLETE.md)** - Complete overview

**Results:**
- Eliminated 6 major duplicates (-1823 lines)
- Created @engine/editor-utils package
- 100% import consistency achieved
- Comprehensive documentation (24+ files)

**See:** [refactoring/README.md](./refactoring/README.md) for all refactoring docs

---

## 🐛 Issues & Fixes

**Location:** [issues/](./issues/)

- **[SHADER_NON_UNIFORM_CONTROL_FLOW.md](./issues/SHADER_NON_UNIFORM_CONTROL_FLOW.md)** - WebGPU shader fix

---

## 📊 Analysis & Reports

- **[GAMEPLAY_ANALYSIS.md](./GAMEPLAY_ANALYSIS.md)** - Gameplay systems analysis
- **[TEST_OPTIMIZATION.md](./TEST_OPTIMIZATION.md)** - Test optimization report
- **[TESTING_AUTOMATION.md](./TESTING_AUTOMATION.md)** - Test automation guide
- **[WORKFLOW_SIMPLIFICATION.md](./WORKFLOW_SIMPLIFICATION.md)** - Workflow improvements

---

## 🚀 Quick Links

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
docs/
├── README.md (this file)
├── ARCHITECTURE.md           # System design ⭐
├── PERFORMANCE.md            # Performance guide
├── TESTING.md                # Testing philosophy
├── guidelines/               # Development guidelines ⭐
│   ├── README.md
│   ├── PACKAGE_GUIDELINES.md      # Where code belongs
│   ├── CODE_REVIEW_CHECKLIST.md   # PR review checklist
│   └── TEAM_ONBOARDING.md         # New dev guide
├── refactoring/              # Oct 2025 refactoring
│   ├── README.md
│   ├── REFACTORING_COMPLETE.md    # Complete summary
│   ├── MIGRATION_SUCCESS_METRICS.md
│   ├── EDITOR_PACKAGES_ANALYSIS.md
│   └── [phase summaries]
├── technical/                # Technical specs
│   ├── FRAME_MODEL.md
│   └── PLAY_MODE.md
├── adr/                      # Architecture decisions
│   └── 001-modular-engine-architecture.md
├── issues/                   # Issue documentation
│   └── SHADER_NON_UNIFORM_CONTROL_FLOW.md
└── [various analysis docs]
```

---

**Last Updated:** 2025-10-26  
**Maintainer:** Tech Lead

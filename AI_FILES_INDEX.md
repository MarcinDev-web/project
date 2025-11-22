# AI Documentation - Quick Index

> **🚀 Start here to find the right documentation for your needs**

## 🎯 Which File Should I Use?

### For AI Assistants

| Need | File | Time | Description |
|---|---|---|----|
| **First time setup** | [AI_CONTEXT.md](AI_CONTEXT.md) | 15 min | Complete context - read this first! |
| **Quick task** | [QUICK_START_AI.md](QUICK_START_AI.md) | 2 min | Instant reference for simple tasks |
| **Looking for pattern** | [CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md) | 5 min | All design patterns and idioms |
| **Need prompt example** | [AI_PROMPTS.md](AI_PROMPTS.md) | 5 min | Example prompts and workflows |
| **Using Cursor IDE** | [.cursorrules](.cursorrules) | Auto | Automatically loaded rules |

### For Developers

| Task | Primary File | Supporting Files |
|---|----|---|
| **Explaining project to AI** | [AI_CONTEXT.md](AI_CONTEXT.md) | - |
| **Writing prompts** | [AI_PROMPTS.md](AI_PROMPTS.md) | [QUICK_START_AI.md](QUICK_START_AI.md) |
| **Understanding patterns** | [CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md) | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) |
| **Quick reference** | [QUICK_START_AI.md](QUICK_START_AI.md) | [TEST_COMMANDS_CHEATSHEET.md](TEST_COMMANDS_CHEATSHEET.md) |

---

## 📁 All AI Documentation Files

### 1. 🌟 AI_CONTEXT.md
**The Complete Guide**

```
📖 Length: ~800 lines (15-minute read)
🎯 Purpose: Comprehensive context for AI assistants
⚡ When: First interaction, or complex tasks
```

**Contains:**
- Project structure and mental model
- Critical architectural rules
- Code style and conventions
- Testing philosophy
- Common tasks and patterns
- Pitfalls to avoid
- System overviews
- Development commands
- Checklist for changes

**Start with this if:**
- First time using AI with this project
- Need complete understanding
- Making architectural decisions
- Reviewing code

---

### 2. 🎨 CODEBASE_PATTERNS.md
**Design Patterns Reference**

```
📖 Length: ~600 lines (10-minute read)
🎯 Purpose: Document all patterns and idioms
⚡ When: Need to follow or understand a pattern
```

**Contains:**
- 8 major design patterns (detailed)
- Common idioms
- Naming conventions
- File organization
- Testing patterns
- Performance patterns
- Advanced patterns

**Use this when:**
- Implementing a new feature
- Refactoring code
- Need to follow existing patterns
- Learning the codebase

---

### 3. 💬 AI_PROMPTS.md
**Example Prompts & Workflows**

```
📖 Length: ~500 lines (8-minute read)
🎯 Purpose: Show effective AI interaction patterns
⚡ When: Need prompt examples or workflow guidance
```

**Contains:**
- Context loading strategies
- Common task prompts
- Architecture decision prompts
- Debugging workflows
- Performance optimization
- Code review patterns
- Training examples

**Use this when:**
- First time prompting AI
- Stuck on how to ask something
- Want to see best practices
- Teaching others

---

### 4. ⚡ QUICK_START_AI.md
**2-Minute Quick Reference**

```
📖 Length: ~150 lines (2-minute read)
🎯 Purpose: Instant context for simple tasks
⚡ When: Quick tasks, refresher
```

**Contains:**
- What is this project
- Critical rules (top 3)
- Code style examples
- Testing examples
- Commands
- Checklist
- Common mistakes

**Use this when:**
- Simple, quick tasks
- Need a refresher
- Time-constrained
- Know the project basics

---

### 5. ⚙️ .cursorrules
**Cursor IDE Configuration**

```
📖 Length: ~200 lines (auto-loaded)
🎯 Purpose: Automatic context in Cursor IDE
⚡ When: Using Cursor IDE (always)
```

**Contains:**
- Context files to read
- Critical rules
- Code checklist
- Common patterns
- References

**Use this when:**
- Using Cursor IDE (automatic)
- Want IDE-specific guidance

---

### 6. 📋 AI_DOCUMENTATION_CHANGELOG.md
**Change History**

```
📖 Length: Variable
🎯 Purpose: Track documentation evolution
⚡ When: Understanding what changed
```

**Contains:**
- Version history
- New files and updates
- Rationale for changes
- Impact metrics
- Future improvements

**Use this when:**
- Need to know what changed
- Understanding documentation evolution
- Planning improvements

---

## 🗺️ Recommended Reading Paths

### Path 1: Complete Understanding (50 minutes)
**For: First-time setup, complex project work**

1. [QUICK_START_AI.md](QUICK_START_AI.md) - 2 min (overview)
2. [AI_CONTEXT.md](AI_CONTEXT.md) - 15 min (complete context)
3. [CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md) - 10 min (patterns)
4. [AI_PROMPTS.md](AI_PROMPTS.md) - 8 min (workflows)
5. [docs/guidelines/PACKAGE_GUIDELINES.md](docs/guidelines/PACKAGE_GUIDELINES.md) - 10 min (decisions)
6. [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) - 5 min (architecture)

**Result:** Complete mastery of the codebase context

---

### Path 2: Quick Start (10 minutes)
**For: Simple tasks, time-constrained**

1. [QUICK_START_AI.md](QUICK_START_AI.md) - 2 min (overview)
2. [AI_CONTEXT.md](AI_CONTEXT.md) - 5 min (skim key sections)
3. [AI_PROMPTS.md](AI_PROMPTS.md) - 3 min (find relevant prompt)

**Result:** Enough context for simple tasks

---

### Path 3: Pattern Learning (20 minutes)
**For: Learning codebase patterns**

1. [QUICK_START_AI.md](QUICK_START_AI.md) - 2 min (overview)
2. [CODEBASE_PATTERNS.md](CODEBASE_PATTERNS.md) - 10 min (all patterns)
3. [AI_CONTEXT.md](AI_CONTEXT.md) - 5 min (read "Common Tasks" section)
4. Look at actual code examples in packages/ - 3 min

**Result:** Understanding of all patterns used

---

### Path 4: Effective Prompting (15 minutes)
**For: Learning to work with AI assistants**

1. [QUICK_START_AI.md](QUICK_START_AI.md) - 2 min (overview)
2. [AI_PROMPTS.md](AI_PROMPTS.md) - 8 min (all examples)
3. [AI_CONTEXT.md](AI_CONTEXT.md) - 5 min (skim for context)

**Result:** Know how to prompt AI effectively

---

## 🎯 Decision Tree

```
START HERE
    |
    ├─→ First time?
    │   └─→ YES → Read AI_CONTEXT.md (Path 1: Complete Understanding)
    │   └─→ NO  → Continue
    |
    ├─→ Quick task?
    │   └─→ YES → QUICK_START_AI.md (Path 2: Quick Start)
    │   └─→ NO  → Continue
    |
    ├─→ Need to understand pattern?
    │   └─→ YES → CODEBASE_PATTERNS.md (Path 3: Pattern Learning)
    │   └─→ NO  → Continue
    |
    ├─→ Need prompt example?
    │   └─→ YES → AI_PROMPTS.md (Path 4: Effective Prompting)
    │   └─→ NO  → Continue
    |
    └─→ Using Cursor IDE?
        └─→ YES → .cursorrules (Auto-loaded)
        └─→ NO  → Start with QUICK_START_AI.md
```

---

## 📊 File Relationships

```
.cursorrules (Auto-loaded in Cursor)
    ↓ references
AI_CONTEXT.md (Main context)
    ↓ references
CODEBASE_PATTERNS.md (Patterns)
    ↓ examples in
AI_PROMPTS.md (Workflows)
    ↓ summarized in
QUICK_START_AI.md (Quick ref)

All reference:
    ├── docs/guidelines/PACKAGE_GUIDELINES.md
    ├── docs/architecture/ARCHITECTURE.md
    ├── docs/testing/TESTING.md
    └── TEST_COMMANDS_CHEATSHEET.md
```

---

## 🔍 Finding Specific Information

| Looking for... | Check this file | Section |
|---|-----|---|
| Import rules | AI_CONTEXT.md | "Import Policy" |
| Package boundaries | AI_CONTEXT.md | "Package Boundaries" |
| Code style | AI_CONTEXT.md | "Code Style & Conventions" |
| Testing approach | AI_CONTEXT.md | "Testing Philosophy" |
| ECS pattern | CODEBASE_PATTERNS.md | "Component Pattern" |
| Disposal pattern | CODEBASE_PATTERNS.md | "Disposable Pattern" |
| Event handling | CODEBASE_PATTERNS.md | "Event Bus Pattern" |
| Performance tips | CODEBASE_PATTERNS.md | "Performance Patterns" |
| Creating component | AI_PROMPTS.md | "Creating a New Component" |
| Debugging tests | AI_PROMPTS.md | "Debugging Test Failure" |
| Code review | AI_PROMPTS.md | "Self-Review" |
| Critical rules | QUICK_START_AI.md | "Critical Rules" |
| Commands | QUICK_START_AI.md | "Commands" |

---

## 💡 Pro Tips

### For AI Assistants
1. **Always start with AI_CONTEXT.md** on first interaction
2. **Reference CODEBASE_PATTERNS.md** when implementing features
3. **Use AI_PROMPTS.md** as a guide for expected behavior
4. **Consult QUICK_START_AI.md** for quick refreshers

### For Developers
1. **Share AI_CONTEXT.md link** in first AI prompt
2. **Copy prompts from AI_PROMPTS.md** and adapt
3. **Keep QUICK_START_AI.md** open for reference
4. **Update docs** when patterns change

### For Teams
1. **Onboard new devs** with Path 1 (Complete Understanding)
2. **Create custom prompts** inspired by AI_PROMPTS.md
3. **Reference in code reviews** using AI_CONTEXT.md checklist
4. **Keep consistent** by following patterns in CODEBASE_PATTERNS.md

---

## 🔄 Keeping Up to Date

**When to update:**
- Architecture changes → Update AI_CONTEXT.md
- New patterns emerge → Update CODEBASE_PATTERNS.md
- Successful workflows → Update AI_PROMPTS.md
- Rule changes → Update .cursorrules
- Summary needed → Update QUICK_START_AI.md

**Maintenance schedule:**
- Review quarterly
- Update on major changes
- Log changes in AI_DOCUMENTATION_CHANGELOG.md

---

## 📚 Beyond AI Documentation

**Other important docs:**
- [README.md](README.md) - Project overview
- [docs/README.md](docs/README.md) - Documentation index
- [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) - System architecture
- [docs/guidelines/](docs/guidelines/) - Development guidelines
- [TEST_COMMANDS_CHEATSHEET.md](TEST_COMMANDS_CHEATSHEET.md) - Test commands

---

## ❓ FAQ

**Q: Which file should I read first?**  
A: If you have time, [AI_CONTEXT.md](AI_CONTEXT.md). If not, [QUICK_START_AI.md](QUICK_START_AI.md).

**Q: I'm using Cursor IDE. What do I need?**  
A: Nothing! [.cursorrules](.cursorrules) loads automatically. But reading [AI_CONTEXT.md](AI_CONTEXT.md) is still recommended.

**Q: How do I share context with AI?**  
A: Say: "Please read AI_CONTEXT.md for complete project context"

**Q: Are these files only for AI?**  
A: No! Developers benefit too. They're written to be human-readable.

**Q: How often should I re-read these?**  
A: AI_CONTEXT.md: Once. QUICK_START_AI.md: As needed. Others: When relevant to your task.

**Q: Can I contribute?**  
A: Yes! Follow patterns in existing docs and update this index.

---

**Generated:** 2025-11-12  
**Version:** 1.0.0  
**Maintained by:** Tech Team

**For questions or improvements, see [AI_DOCUMENTATION_CHANGELOG.md](AI_DOCUMENTATION_CHANGELOG.md)**


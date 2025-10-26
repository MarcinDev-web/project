# Development Guidelines

Essential guidelines for all contributors.

## Mandatory Reading

### 1. ⭐ Package Guidelines
**[PACKAGE_GUIDELINES.md](./PACKAGE_GUIDELINES.md)** - **MUST READ**
- Decision tree: Where does code belong?
- Package descriptions and examples
- DO/DON'T anti-patterns
- Import policy
- Logger pattern

**Read this before:** Adding any new code

---

### 2. ⭐ Code Review Checklist  
**[CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md)** - **MUST USE**
- Mandatory checklist for all PRs
- Architecture verification
- Red flags and anti-patterns
- Review comment templates

**Use this when:** Reviewing any PR

---

### 3. ⭐ Team Onboarding
**[TEAM_ONBOARDING.md](./TEAM_ONBOARDING.md)** - **NEW DEVS START HERE**
- Quick start guide (10-15 min read)
- Common scenarios with solutions
- Package quick reference
- FAQ

**Read this if:** You're new to the project

---

## Quick Reference

### Where Does Code Go?

**Reusable logic** → `packages/@engine/*`  
**App UI/UX** → `apps/editor/`  
**Always import:** `@engine/package-name`

### Common Questions

**Q: Where do I put a new feature?**  
A: Use decision tree in PACKAGE_GUIDELINES.md

**Q: Can I create a copy of package code?**  
A: NO! Always import from `@engine/*`

**Q: How do I review a PR?**  
A: Use CODE_REVIEW_CHECKLIST.md

---

## Related

- [Architecture](../ARCHITECTURE.md) - System design
- [Refactoring](../refactoring/) - Recent refactoring docs
- [Testing](../TESTING.md) - Test philosophy


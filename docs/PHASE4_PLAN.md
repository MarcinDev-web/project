# Faza 4: Documentation - TODO List

**Do wykonania po merge PR z Fazami 1-3**

## Checklist

### Przygotowanie
- [ ] PR z Fazami 1-3 zmergowany do main
- [ ] Pull latest main: `git checkout main && git pull`
- [ ] Utwórz branch: `git checkout -b docs/package-architecture-guidelines`

### Dokumenty do utworzenia

#### Must Have (Priority 1):
- [ ] `docs/PACKAGE_GUIDELINES.md` (2-3h)
  - Decision tree (gdzie umieścić kod)
  - Examples (DO vs DON'T)
  - Import policy
  - Logger pattern
  - Template gotowy: patrz `docs/PHASE4_PLAN.md`

- [ ] `docs/CODE_REVIEW_CHECKLIST.md` (1h)
  - Review checklist dla PR
  - Red flags to watch for
  - Architecture verification
  - Template gotowy: patrz `docs/PHASE4_PLAN.md`

#### Nice to Have (Priority 2):
- [ ] `docs/MIGRATION_SUCCESS_METRICS.md` (30min)
  - Before/after metrics
  - Proof of value
  - Future reference

- [ ] `docs/TEAM_ONBOARDING.md` (1h)
  - Quick start for new devs
  - Common scenarios
  - Import patterns

#### Updates (Priority 3):
- [ ] Update `docs/ARCHITECTURE.md` (1h)
  - Add @engine/editor-utils
  - Update package descriptions
  - Add package organization section

- [ ] Update `README.md` (30min)
  - Add package organization note
  - Link to guidelines
  - Mention @engine/editor-utils

### Finalizacja
- [ ] Review wszystkich docs
- [ ] Spell check
- [ ] Links działają
- [ ] Examples są poprawne
- [ ] Commit i push
- [ ] Create PR
- [ ] Request review
- [ ] Merge

---

## Templates & Resources

Wszystkie templates gotowe w:
- `docs/PHASE4_PLAN.md` - Szczegółowe plany każdego dokumentu
- `docs/PHASE3_DETAILED_PLAN.md` - Przykład dobrej dokumentacji
- `docs/PACKAGE_GUIDELINES.md` - (będzie utworzone)

---

## Estimated Time

**Minimum (Must Have only):**
- PACKAGE_GUIDELINES.md: 2-3h
- CODE_REVIEW_CHECKLIST.md: 1h
- **Total:** 3-4h

**Complete (All tasks):**
- Must Have: 3-4h
- Nice to Have: 2h
- Updates: 1.5h
- **Total:** 6-8h

**Recommendation:** 
- Day 1: Must Have docs (3-4h)
- Day 2: Nice to Have + Updates (2-3h)
- Or: Spread over a week (1h per day)

---

## Success Criteria

Faza 4 jest ukończona gdy:
- [ ] PACKAGE_GUIDELINES.md exists and is clear
- [ ] CODE_REVIEW_CHECKLIST.md exists and is actionable
- [ ] Team understands where to put code
- [ ] Code review process includes checklist
- [ ] No questions about "where does this go?"

---

**Start when:** PR z Fazami 1-3 zmergowany  
**Owner:** TBD  
**Priority:** High (zapobiega future problems)


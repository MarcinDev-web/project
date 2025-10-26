# Architecture Decision Records (ADR)

**Historia ważnych decyzji architekturalnych**

## Co to jest ADR?

Architecture Decision Record dokumentuje:
- **Co** zdecydowaliśmy
- **Dlaczego** tak zdecydowaliśmy
- **Jakie** były alternatywy
- **Jakie** są konsekwencje

## Format

```markdown
# ADR-XXX: Tytuł Decyzji

**Status:** [Accepted | Deprecated | Superseded by ADR-YYY]
**Data:** YYYY-MM-DD

## Context
Jaka sytuacja wymaga decyzji?

## Decision
Co zdecydowaliśmy?

## Consequences
Co z tego wynika?
- Pozytywne
- Negatywne
- Neutralne
```

## Decyzje

### [001: Modular Engine Architecture](./001-modular-engine-architecture.md)
**2025-10-26** - Migracja z monolitu do modularnego monorepo
- Podział na pakiety @engine/*
- Clean separation of concerns
- Gotowość do publikacji SDK

---

## Kiedy tworzyć ADR?

- ✅ Duża zmiana architekturalna
- ✅ Wybór technologii/biblioteki
- ✅ Wzorce projektowe projektu
- ✅ Performance trade-offs
- ❌ Małe zmiany implementacyjne
- ❌ Bug fixy
- ❌ Refactoring bez zmian architektonicznych

**Zasada:** Jeśli będziemy żałować że tego nie udokumentowaliśmy za 6 miesięcy → zrób ADR.

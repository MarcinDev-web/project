# Architecture Decision Records (ADR)

## Co to są ADRy?

Architecture Decision Records (ADR) to dokumenty opisujące **ważne decyzje architektoniczne** podjęte w projekcie. 

Każdy ADR zawiera:
- **Kontekst** - Dlaczego podjęliśmy tę decyzję?
- **Decyzja** - Co zdecydowaliśmy?
- **Konsekwencje** - Jakie są skutki tej decyzji (pozytywne i negatywne)?
- **Alternatywy** - Jakie inne opcje rozważaliśmy?

## Format

ADRy w tym projekcie są napisane **po polsku**, zgodnie z konwencją komunikacji w zespole.

Kod i dokumentacja techniczna pozostają po angielsku, ale decyzje architektoniczne są po polsku dla lepszej komunikacji w zespole.

## Lista ADRów

### [ADR 001: Modularyzacja Architektury Silnika](./001-modular-engine-architecture.md)

**Status**: Zaakceptowano (2025-10-26)

**Podsumowanie**: Decyzja o przejściu z hybrydowej struktury `src/` na modularną architekturę monorepo z pakietami `@engine/*` i aplikacjami `apps/`.

**Główne punkty**:
- Gradual refactor (8 faz, 2-3 tygodnie)
- Pakiety: core, world, gfx-webgpu, voxel, assets, script, input, camera, net, stdlib
- Aplikacje: editor, playground
- Zasady: silnik = runtime + API, zależności tylko w dół, edytor używa publicznego API

**Konsekwencje**:
- ✅ Czyste granice odpowiedzialności
- ✅ Łatwa wymiana komponentów
- ✅ Headless server dla multiplayer
- ✅ Bezpieczny sandbox dla UGC
- ❌ Początkowy koszt migracji (2-3 tygodnie)
- ❌ Wymaga dyscypliny w przestrzeganiu granic

---

## Proces Tworzenia Nowego ADRu

### 1. Kiedy Tworzyć ADR?

Twórz ADR gdy podejmujesz **znaczącą decyzję architektoniczną**:
- Zmiana struktury projektu
- Wybór technologii / frameworka
- Zmiana wzorca projektowego
- Decyzja wpływająca na całą aplikację

**NIE twórz** ADR dla drobnych zmian (refactor pojedynczego pliku, fix buga).

### 2. Template ADR

```markdown
# ADR XXX: Tytuł Decyzji

## Status

Zaproponowano | Zaakceptowano | Odrzucono | Zastąpiono przez ADR-YYY

## Kontekst

Opisz problem i dlaczego potrzebujemy decyzji.

## Decyzja

Co zdecydowaliśmy?

## Konsekwencje

### Pozytywne
- Lista korzyści

### Negatywne
- Lista kosztów/ryzyk

## Alternatywy

Jakie inne opcje rozważaliśmy i dlaczego je odrzuciliśmy?

## Implementacja (opcjonalnie)

Kroki do wdrożenia decyzji.

## Referencje

Linki do dokumentacji, dyskusji, itp.
```

### 3. Numer ADR

Numery ADR są sekwencyjne: 001, 002, 003, ...

Zachowaj padding (001, nie 1) dla lepszego sortowania.

### 4. Proces Zatwierdzania

1. Utwórz ADR z statusem "Zaproponowano"
2. Code review + dyskusja w zespole
3. Aktualizuj ADR na podstawie feedbacku
4. Po zatwierdzeniu: zmień status na "Zaakceptowano"
5. Merge do main

## Zasady

### 1. ADRy Są Niezmienne

Raz zaakceptowany ADR **nie jest edytowany**. 

Jeśli decyzja się zmienia:
- Utwórz **nowy ADR** zastępujący stary
- Zaktualizuj status starego ADR: "Zastąpiono przez ADR-XXX"

**Dlaczego?**: Historia decyzji jest ważna. Chcemy wiedzieć **dlaczego** podjęliśmy daną decyzję, nawet jeśli już jej nie stosujemy.

### 2. ADRy Są Zwięzłe

Cel: 1-3 strony A4.

Jeśli ADR jest dłuższy, podziel go lub przenieś szczegóły do osobnego dokumentu (np. `docs/architecture/`).

### 3. ADRy Są Po Polsku

Kod, komentarze, commit message - po angielsku.
ADRy, roadmap, docs/adr/ - **po polsku**.

**Dlaczego?**: Lepsza komunikacja w zespole polskojęzycznym.

## Pytania i Odpowiedzi

### Q: Czy mogę edytować zaakceptowany ADR?

**A**: Nie. Jeśli decyzja się zmienia, utwórz nowy ADR zastępujący stary.

Wyjątek: Poprawki literówek, formatowania (nie zmieniają treści decyzji).

### Q: Co jeśli decyzja nie wyszła?

**A**: Utwórz nowy ADR wyjaśniający dlaczego i co zmieniamy. Przykład:

```
ADR 001: Zdecydowaliśmy użyć WebGL
ADR 005: Zmieniamy na WebGPU (zastępuje ADR 001)
```

### Q: Jak długo trzymać odrzucone ADRy?

**A**: Na zawsze. Historia decyzji (nawet złych) jest wartościowa.

## Referencje

- [Architecture Decision Records (Michael Nygard)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub Organization](https://adr.github.io/)
- [Gdy używać ADRów](https://github.com/joelparkerhenderson/architecture-decision-record)

## Historia

| ADR | Tytuł | Status | Data |
|-----|-------|--------|------|
| [001](./001-modular-engine-architecture.md) | Modularyzacja Architektury Silnika | Zaakceptowano | 2025-10-26 |


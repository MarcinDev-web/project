# Dokumentacja - UGC 3D Platform

**Minimalistyczny zestaw dokumentacji - tylko to co niezbędne**

## 📖 Główne Dokumenty

### [ARCHITECTURE.md](./ARCHITECTURE.md) 
**Jedno źródło prawdy o projekcie**
- Struktura pakietów i zależności
- Szczegóły każdego pakietu @engine/*
- Zasady architektoniczne
- Tech stack i workflow

👉 **Zacznij tutaj** - wszystko co musisz wiedzieć o projekcie.

### [PERFORMANCE.md](./PERFORMANCE.md)
**Zasady wydajności**
- Hot paths i alokacje
- Cache locality
- GPU optimization
- Measurement i testing

### [TESTING.md](./TESTING.md)
**Filozofia testowania**
- Co testować, czego nie
- Unit vs Integration vs E2E
- Best practices i anti-patterns

## 🔧 Szczegóły Techniczne

`technical/` - dokumenty techniczne dla głębszego zrozumienia:
- [FRAME_MODEL.md](./technical/FRAME_MODEL.md) - jak działa pętla renderowania
- [PLAY_MODE.md](./technical/PLAY_MODE.md) - state machine play mode w editorze

## 📋 Historia Decyzji

`adr/` - Architecture Decision Records:
- [001-modular-engine-architecture.md](./adr/001-modular-engine-architecture.md) - dlaczego modularny monorepo

## 🎯 Quick Links

**Dla Developera:**
1. Czytam [ARCHITECTURE.md](./ARCHITECTURE.md) - zrozumienie projektu
2. Konfiguruję IDE z path aliases z tsconfig.json
3. Uruchamiam `pnpm install && pnpm build && pnpm dev`

**Dla AI Agenta:**
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - struktura i zasady
2. [PERFORMANCE.md](./PERFORMANCE.md) - przy optymalizacji
3. [TESTING.md](./TESTING.md) - przy pisaniu testów

---

**Zasada:** Dokumentacja musi być aktualna albo nie istnieć. Nieaktualna dokumentacja jest gorsza niż brak dokumentacji.


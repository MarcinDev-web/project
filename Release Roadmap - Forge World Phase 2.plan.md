# Roadmap: Faza 2 & 3 - Stabilizacja i Edukacja 🎓

Kontynuujemy prace nad platformą Forge World, skupiając się teraz na jakości doświadczenia (QoE) i onboardingu nowych twórców.

## Faza 2: Silnik i Stabilizacja (Tygodnie 3-4)

### 2.1. Performance Budgets ⚡
**Cel:** Uświadomić twórcom, że zasoby nie są nieskończone.
- [ ] **Ostrzeżenia w BuildStats**: Rozszerzyć `apps/editor/src/editor/ui/hud/BuildStats.ts`, aby wyświetlał ostrzeżenia (kolory żółty/czerwony) przy przekroczeniu limitów:
    - Triangles: > 500k / 1M
    - Draw Calls: > 500 / 1000
    - Lights: > 50

### 2.2. LogicCubes Polish 🧩
**Cel:** Ułatwić debugowanie logiki gry.
- [ ] **Visual Connection Feedback**: Zmodyfikować `apps/editor/src/editor/panels/gameplay/LogicPanel.ts`:
    - Dodać tryb "Debug Mode".
    - Wizualizować przepływ sygnałów (np. podświetlanie połączeń na liście, gdy sygnał jest aktywny).
- [ ] **UX Improvements**: Dodać ikony do portów wejścia/wyjścia dla lepszej czytelności.

## Faza 3: Edukacja i Start (Miesiąc 2)

### 3.1. Onboarding 🧭
**Cel:** "Time to Hello World" < 5 minut.
- [ ] **Interactive Tutorial System**: Stworzyć manager tutoriali w `apps/editor/src/editor/onboarding/TutorialManager.ts`.
- [ ] **"Your First Game" Scenario**: Zaimplementować pierwszy scenariusz:
    1. Postaw LogicCube (Trigger).
    2. Postaw LogicCube (Action).
    3. Połącz je.
    4. Uruchom grę.

---

**Zrealizowane w poprzedniej fazie:**
- [x] Studio Monetization UI
- [x] Asset Uploader
- [x] Collaboration Invite UI
- [x] Dokumentacja LogicCubes


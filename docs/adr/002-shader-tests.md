---
title: Testowanie shaderów WGSL/WebGPU w przeglądarce (Playwright)
date: 2025-10-26
status: accepted
---

Kontekst
========
- Potrzebujemy deterministycznych, szybkich i przenośnych testów shaderów (WGSL) działających na WebGPU.
- Nasza filozofia testów: testuj zachowanie (nie implementację), mockuj zależności, E2E dla krytycznych ścieżek, unit dla logiki biznesowej, metryki wydajności.

Decyzja
=======
- Używamy Playwright Test (Chromium headless) jako jedynego runnera dla testów shaderów w przeglądarce.
- Włączamy WebGPU przez flagę `--enable-unsafe-webgpu` (konfiguracja w `playwright.config.ts`).
- Piramida testów:
  - Unit/integration (compute): asercje na buforach liczbowych z tolerancjami (abs/rel).
  - Integration (render): minimalne pipeline’y renderujące; weryfikacja pikseli po odczycie z tekstury.
  - Visual regression: w oparciu o `toHaveScreenshot` z tolerancjami. Uruchamiamy selektywnie; goldeny wersjonowane.
  - E2E: tylko krytyczne ścieżki użytkownika.
  - Perf: lekkie budżety; w CI miękkie (wyłączone domyślnie), twarde w nightly.

Uzasadnienie
============
- Chromium zapewnia najstabilniejszą implementację WebGPU w CI i lokalnie.
- Playwright integruje screenshot diff i jest prosty w konfiguracji na CI.
- Oddzielamy testy liczbowe (mała wariancja między GPU) od wizualnych (tolerancje, małe sceny).

Implikacje
==========
- Struktura katalogów:
  - `src/shaders/` – źródła WGSL.
  - `packages/gfx-webgpu/tests/helpers/` – harness WebGPU do testów.
  - `packages/gfx-webgpu/tests/compute/` – testy obliczeń.
  - `packages/gfx-webgpu/tests/render/` – testy renderingu z odczytem pikseli.
  - `packages/gfx-webgpu/tests/visual/` – testy wizualne ze screenshotami i goldenami.
- CI (GitHub Actions) uruchamia tylko Chromium; artefakty: raport Playwright i wyniki testów.

Ryzyka i mitigacje
===================
- Różnice vendorów: preferujemy asercje liczbowe; sceny wizualne minimalne; tolerancje.
- Flakiness headless: pin wersji Chromium (domyślnie w Playwright), pojedynczy OS w CI, retry 1x dla wizualnych.
- Determinizm: stałe seedy, brak zegara czasu rzeczywistego w testach, stałe viewporty.

Konsekwencje
============
- Dodajemy zależność `@playwright/test` i workflow CI.
- W repo utrzymujemy goldeny w folderach `*-snapshots/` obok testów wizualnych.



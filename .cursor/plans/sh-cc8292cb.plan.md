<!-- cc8292cb-6796-438c-932d-7705a9675b3e 3f5bcf83-4920-4ec1-9850-0c98ea1c2273 -->
# Shadows Phase 2: Cascade blending, presets, metrics

### Cel

- Zlikwidować artefakty na granicach kaskad (seams/shimmer) i dać kontrolę jakości + metryki.

### Zmiany

- Cascade blending (fade przy granicach splitów)
- Zmieniamy selekcję kaskady w `packages/gfx-webgpu/src/shaders/pbr.ts`: próbkowanie 2 sąsiednich kaskad w strefie przejścia i miks ich wyników.
- Dodajemy parametr `cascadeOverlap` (np. 0.07 w przestrzeni liniowej) do uniformów (zapis w `packages/gfx-webgpu/src/core/UniformManager.ts`, ustawienie w `.../shadows/ShadowPass.ts`).
- W WGSL: obliczamy liniową głębokość, wykrywamy strefę blendu wokół splitu i liczymy wagę miksu.

- Presety jakości cieni
- W `packages/gfx-webgpu/src/shadows/ShadowPass.ts` dodajemy `setQualityPreset(preset: 'low'|'med'|'high'|'ultra')` mapujące: atlasSize (opcjonalnie), PCSS light radius, max kernel, bias.
- Jeśli atlasSize się zmienia: bezpieczna re‑inicjalizacja zasobów (tekstury, sampler) i aktualizacja uniformów.
- (Opcjonalnie) przełącznik w edytorze: `apps/editor/src/editor/ui/QuickMenu.ts` → Shadows → Preset.

- Metryki per kaskadę
- W `ShadowPass` zliczamy `visibleCount` dla każdej kaskady i udostępniamy `getLastCascadeInstanceCounts()`.
- W `packages/gfx-webgpu/src/core/Renderer.ts` (lub `FrameRenderer`) przekazujemy metryki do `PerformanceMonitor` albo bezpośrednio do HUD.
- W edytorze (`apps/editor/src/editor/ui/EditorUI.ts`) dodać sekcję w status bar: "Shadows: C0/C1/C2/C3".

- Testy
- Jednostkowe: logika blendu (wybór kaskad i wagi) – testy utility w TS (prosty ekwiwalent funkcji z WGSL).
- Integracyjne: regresja liczby instancji na kaskadę przy ruchu kamery (spodziewane spadki/zmiany bez wyjątków).

### Uwagi implementacyjne

- Nie zmieniamy liczby kaskad (4) w tej iteracji – upraszcza kompatybilność i UI.
- `cascadeOverlap` można upchnąć w `filterParams.w`, ale czytelniej dodać osobny vec4 (np. `shadowExtraParams`).
- Dla blendu potrzeba dwóch próbek cienia (bieżąca i sąsiednia kaskada); zachowujemy PCSS dla obu i mieszamy.

### To-dos

- [ ] Blend kaskad w WGSL + `cascadeOverlap` w uniformach
- [ ] Presety jakości w ShadowPass + opcjonalny UI w edytorze
- [ ] Metryki per kaskadę do HUD/PerformanceMonitor
- [ ] Testy blendu i regresji liczby instancji per kaskada
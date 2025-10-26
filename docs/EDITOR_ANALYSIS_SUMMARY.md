# Analiza apps/editor ↔ packages - Szybkie podsumowanie

**Data:** 2025-10-26  
📊 **Status:** 🔴 Krytyczne problemy wykryte

## TL;DR

Editor zawiera **8 głównych duplikatów kodu** z packages (~2000 linii). Kod powinien być importowany z `@engine/*` zamiast duplikowany lokalnie.

## Główne problemy

### 🔴 Duplikaty (100% identyczne)
```
apps/editor/src/editor/camera/
├── CameraDirector.ts      ❌ → użyj @engine/camera
└── FPSCamera.ts           ❌ → użyj @engine/camera

apps/editor/src/editor/assets/
├── AssetImporter.ts       ❌ → użyj @engine/assets
└── GltfOptimizer.ts       ❌ → użyj @engine/assets
```

### ⚠️ Duplikaty (95%+ zgodności)
```
apps/editor/src/editor/assets/
├── AssetRegistry.ts       ⚠️ → zunifikuj z @engine/assets
└── AssetTypes.ts          ⚠️ → zunifikuj z @engine/assets
```

### 📦 Niewykorzystane pakiety
- `@engine/camera` - zadeklarowany, ale editor używa lokalnych kopii
- `@engine/assets` - zadeklarowany, ale editor używa lokalnych kopii

## Przykłady niespójności

### ❌ Obecnie (złe)
```typescript
// apps/editor/src/editor/ui/EditorUI.ts
import { FPSCamera } from '../camera/FPSCamera';
import { assetRegistry } from '../assets/AssetRegistry';
```

### ✅ Powinno być (dobre)
```typescript
// apps/editor/src/editor/ui/EditorUI.ts
import { FPSCamera } from '@engine/camera';
import { assetRegistry } from '@engine/assets';
```

## Wpływ

| Kategoria | Ocena | Opis |
|-----------|-------|------|
| Maintainability | 🔴 | Zmiany trzeba robić w 2 miejscach |
| Testing | 🔴 | Duplikacja testów lub brak testów |
| DX | 🔴 | Niejasne gdzie szukać kodu |
| Bundle size | 🟡 | Potencjalne duplikaty w bundlu |
| Architecture | 🔴 | Naruszenie monorepo patterns |

## Quick Fix (Faza 1) - 1-2 dni

```bash
# 1. Usuń duplikaty
rm apps/editor/src/editor/camera/CameraDirector.ts
rm apps/editor/src/editor/camera/FPSCamera.ts
rm apps/editor/src/editor/assets/AssetImporter.ts
rm apps/editor/src/editor/assets/GltfOptimizer.ts

# 2. Znajdź i zamień importy
# ../camera/CameraDirector → @engine/camera
# ../camera/FPSCamera → @engine/camera
# ./AssetImporter → @engine/assets
# ./GltfOptimizer → @engine/assets

# 3. Uruchom testy
pnpm test
```

**Pliki do zmiany:**
- `apps/editor/src/app.ts`
- `apps/editor/src/editor/managers/EditorModeManager.ts`
- `apps/editor/src/editor/ui/EditorUI.ts`
- `apps/editor/src/editor/states/*.ts` (6 plików)
- `apps/editor/src/editor/assets/AssetBrowser.ts`

**Benefit:** Eliminuje 4 główne duplikaty, poprawia spójność

## Pełny plan

Zobacz szczegóły w: [`docs/EDITOR_PACKAGES_ANALYSIS.md`](./EDITOR_PACKAGES_ANALYSIS.md)

**Fazy:**
1. ✅ Quick wins (1-2 dni) - usuń oczywiste duplikaty
2. ⚙️ Refactor AssetRegistry (2-3 dni)
3. 🔧 Migrate utilities (3-5 dni)
4. 📝 Documentation (1 dzień)

**Total:** 7-11 dni roboczych

## Struktura po refactoringu

```
apps/editor/src/editor/
├── assets/
│   └── AssetBrowser.ts           ✅ Editor-specific UI
├── camera/                        ❌ USUŃ - użyj @engine/camera
├── ui/                            ✅ Editor-specific
├── panels/                        ✅ Editor-specific
├── controllers/                   ✅ Editor-specific
├── managers/                      ✅ Editor-specific
└── states/                        ✅ Editor-specific

packages/
├── camera/
│   ├── CameraDirector.ts         ✅ Shared camera logic
│   └── FPSCamera.ts              ✅ Shared camera logic
├── assets/
│   ├── AssetRegistry.ts          ✅ Shared asset management
│   ├── AssetImporter.ts          ✅ Shared loaders
│   └── GltfOptimizer.ts          ✅ Shared loaders
└── [inne pakiety]                ✅ Shared functionality
```

## Zasady going forward

### ✅ DO: Kod w packages/ gdy
- Jest reużywalny
- Logika biznesowa/core
- Niezależny od editor UI
- Może być używany w innych apps

### ❌ DON'T: Kod w apps/editor/ gdy
- Jest tylko UI/UX edytora
- Editor-specific workflows
- Zarządzanie stanem edytora
- DOM manipulation specyficzne dla edytora

### 📝 Zawsze
- Importuj z `@engine/*`, nigdy relatywne ścieżki do packages
- Jeśli duplikujesz kod - STOP i pomyśl czy należy do pakietu
- Review guidelines przed dodaniem nowego kodu

## Next Actions

1. ☑️ **Review** - Przeczytaj pełną analizę
2. ☑️ **Decide** - Ustal priorytet (all-in czy częściowo)
3. ☑️ **Assign** - Kto weźmie który kawałek
4. ☑️ **Execute** - Zacznij od Fazy 1 (quick wins)
5. ☑️ **Iterate** - Continue z następnymi fazami

---

📄 **Szczegóły:** [`docs/EDITOR_PACKAGES_ANALYSIS.md`](./EDITOR_PACKAGES_ANALYSIS.md)  
📊 **Created:** 2025-10-26


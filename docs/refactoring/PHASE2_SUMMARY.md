# Faza 2: AssetRegistry & AssetTypes Unifikacja - UKOŃCZONE

**Data:** 2025-10-26  
**Status:** ✅ COMPLETE  
**Commit:** `56eff71`  
**Branch:** `refactor/remove-code-duplicates`

## Podsumowanie

Faza 2 zunifikowała `AssetRegistry` i `AssetTypes` między `apps/editor` a `packages/assets`, eliminując **~1050 linii duplikowanego kodu**.

## Wykonane zmiany

### 1. packages/assets/src/core/AssetTypes.ts ✅
**Zmiany:**
- ✅ Eksport `RgbaColor` type (była inline definition)
- ✅ `BlockDefinition` jako `any` placeholder (zapobiega circular dependency)
- ✅ Dodano komentarz wyjaśniający circular dependency prevention

**Dlaczego `BlockDefinition = any`?**
- Pakiet `assets` nie może importować z `gfx-webgpu` (circular dependency)
- Aplikacje mogą importować właściwy typ z `@engine/gfx-webgpu`
- Type safety zachowana na poziomie aplikacji

### 2. packages/assets/src/core/AssetRegistry.ts ✅
**Zmiany:**
- ✅ Dodano `AssetRegistryConfig` interface z optional logger
- ✅ Dodano konstruktor z konfiguracją logger
- ✅ Wszystkie `console.*` zamienione na `this.logger?.*` (24 wystąpienia)
- ✅ Poprawiono error type casting (`error as Error`)
- ✅ `registerBlockAsset` używa clean `BlockDefinition` type

**Logger config:**
```typescript
export interface AssetRegistryConfig {
  logger?: {
    debug: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}
```

### 3. apps/editor/src/editor/assets/AssetRegistry.ts ✅
**COMPLETE REWRITE:**
- ❌ **Przed:** 689 linii pełnej klasy (duplikat)
- ✅ **Po:** 38 linii thin wrapper

**Zawartość:**
```typescript
import { AssetRegistry } from '@engine/assets';
import { Logger } from '../../utils/logger';

// Re-export types for backward compatibility
export type { Asset, AssetFilter, /* ... */ } from '@engine/assets';
export { AssetRegistry } from '@engine/assets';

// Singleton with editor's Logger
export const assetRegistry = new AssetRegistry({
  logger: {
    debug: Logger.debug.bind(Logger),
    warn: Logger.warn.bind(Logger),
    error: Logger.error.bind(Logger),
  },
});
```

**Benefit:**
- ✅ Zero duplikacji logiki
- ✅ Editor używa własnego Logger
- ✅ Backward compatible (re-export types)
- ✅ **-651 linii!**

### 4. apps/editor/src/editor/assets/AssetTypes.ts ❌
**DELETED:** 394 linie

- Wszystkie typy teraz z `@engine/assets`
- Eliminuje całkowitą duplikację type definitions

### 5. Zaktualizowane importy (10 plików) ✅

**Pliki:**
- `AssetBrowser.ts` - types + assetRegistry z `@engine/assets`
- `AssetBrowser.test.ts` - assetRegistry z `@engine/assets`
- `UnifiedBuildPanel.ts` - assetRegistry z `@engine/assets`
- `CatalogPanel.ts` - assetRegistry z `@engine/assets`
- `AssetPalette.ts` - assetRegistry z `@engine/assets`
- `InventoryManager.ts` - Asset type z `@engine/assets`
- `FavoritesManager.ts` - Asset type z `@engine/assets`
- `EditorPanelManager.ts` - wszystkie asset types + RgbaColor z `@engine/assets`
- `PlacementMode.ts` - AssetPreset z `@engine/assets`
- `PlacementMode.test.ts` - AssetPreset z `@engine/assets`

## Statystyki

```
Files changed:     17
Insertions:        +157
Deletions:         -1175
Net change:        -1018 linii ✅
```

**Szczegóły:**
- AssetRegistry.ts (editor): 689 → 38 linii (-651)
- AssetTypes.ts (editor): 394 → 0 linii (-394)
- AssetRegistry.ts (packages): +31 linie (logger config)
- AssetTypes.ts (packages): +5 linie (proper imports)
- Import updates: 10 plików × ~1-3 linie

## Testing

### Unit Tests
- ✅ packages/assets: **47 tests passed**
- ✅ TypeScript compilation: **SUCCESS**
- ✅ pnpm -r build: **SUCCESS**
- ✅ No linter errors

### Build Optimization
**Bundle size improvement:**
- Before: 716.21 kB
- After: 708.50 kB
- **Saved: 7.71 kB** (better tree-shaking)

**New chunks:**
- `AssetRegistry-D-OS7oDi.js`: 0.18 kB (thin wrapper)

## Problemy naprawione

### Problem 1: Circular Dependency
**Issue:** Pakiet `assets` importował z `gfx-webgpu` → circular dependency

**Rozwiązanie:**
```typescript
// packages/assets/src/core/AssetTypes.ts
// BlockDefinition placeholder - prevents circular dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BlockDefinition = any;
```

Applications importują właściwy typ:
```typescript
// apps/editor/src/editor/assets/AssetRegistry.ts
import type { BlockDefinition } from '@engine/gfx-webgpu/blocks/BlockLibrary';
```

### Problem 2: Logger Differences
**Issue:** Editor używał `Logger`, package używał `console`

**Rozwiązanie:** Configurable logger z fallback
```typescript
constructor(config?: AssetRegistryConfig) {
  this.logger = config?.logger ?? {
    debug: console.debug.bind(console),
    warn: console.warn.bind(console),
    error: (msg: string, error?: Error) => console.error(msg, error),
  };
}
```

### Problem 3: Duplikacja type definitions
**Issue:** AssetTypes istniał w dwóch miejscach (394 linie × 2)

**Rozwiązanie:** Usunięto z editora, wszystkie importują z `@engine/assets`

## Backward Compatibility

✅ **Maintained 100%**

Editor code nadal może importować z lokalnego `AssetRegistry.ts`:
```typescript
import { assetRegistry } from '../assets/AssetRegistry';
import type { Asset } from '../assets/AssetRegistry';
```

Wszystko jest re-exportowane z `@engine/assets`, więc nie ma breaking changes.

## Architecture Improvement

### Przed Fazą 2:
```
apps/editor/src/editor/assets/
├── AssetRegistry.ts  (689 linii) ❌ Duplikat
├── AssetTypes.ts     (394 linie) ❌ Duplikat  
└── AssetBrowser.ts   (UI)

packages/assets/src/core/
├── AssetRegistry.ts  (688 linii) ⚠️ Niedostatecznie używany
└── AssetTypes.ts     (398 linii) ⚠️ Niedostatecznie używany
```

### Po Fazie 2:
```
apps/editor/src/editor/assets/
├── AssetRegistry.ts  (38 linii)  ✅ Thin wrapper z Logger config
└── AssetBrowser.ts   (UI only)   ✅ Uses @engine/assets

packages/assets/src/core/
├── AssetRegistry.ts  (719 linii) ✅ Single source of truth + logger config
└── AssetTypes.ts     (403 linie) ✅ Proper exports, no circular deps
```

**Benefit:**
- Zero logic duplication
- Single source of truth
- Proper separation of concerns
- Better maintainability

## Next Steps

### ✅ Fazy ukończone:
- **Faza 1:** Camera/Assets duplicates removal (-805 linii) ✅
- **Faza 2:** AssetRegistry/AssetTypes unification (-1018 linii) ✅
- **Bonus:** WebGPU shader fix ✅

### 🔜 Pozostałe fazy:
- **Faza 3:** Migrate utilities (DisposableGroup, HistoryManager, SnapSystem) - 3-5 dni
- **Faza 4:** Documentation (PACKAGE_GUIDELINES.md) - 1 dzień

### Totals so far:
- **Commits:** 4 (99892a4, db26164, 40dc358, 56eff71)
- **Lines removed:** -1823 (duplicates)
- **Lines added:** +183 (logger configs, wrappers)
- **Net:** **-1640 linii** 🎉

## Manual Testing Needed

Przed merge PR, zweryfikuj w przeglądarce:
- [ ] Editor startuje bez błędów
- [ ] Asset browser działa
- [ ] AssetRegistry singleton używa Logger
- [ ] Console pokazuje [Editor] logi (z Logger)
- [ ] Import assets działa
- [ ] Favorites system działa
- [ ] Inventory system działa

## PR Update

Zaktualizuj `PR_DESCRIPTION.md` aby uwzględnić Fazę 2:
- Add Phase 2 changes to summary
- Update statistics (now -1640 lines total)
- Update commits list

---

**Status:** ✅ **FAZA 2 COMPLETE**  
**Next:** Faza 3 lub finalize PR

**Commits:**
1. `99892a4` - Phase 1: Camera/Assets duplicates
2. `db26164` - Shader fix
3. `40dc358` - Shader documentation
4. `56eff71` - **Phase 2: AssetRegistry/AssetTypes unification** ⭐


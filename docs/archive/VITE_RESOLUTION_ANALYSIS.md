# Analiza problemu z rozwiązywaniem importów w Vite

## Problem

100 testów nie przechodzi z powodu błędów rozwiązywania importów:
- `Failed to resolve entry for package "@engine/core"`
- `Failed to load url @engine/core/event/EventBus`
- `Failed to resolve import "@engine/core/math"`

## Przyczyna

Vite rozwiązuje importy w następującej kolejności:
1. **Najpierw** sprawdza `package.json` exports (które wskazują na `dist/`)
2. **Dopiero potem** wywołuje hook `resolveId` z pluginów (nawet z `enforce: 'pre'`)

To oznacza, że nasz plugin `resolveEngineAliasesPlugin` nie może przechwycić importów przed sprawdzeniem `package.json`.

## Obecne rozwiązanie

### Plugin `resolveEngineAliasesPlugin`
- Ma `enforce: 'pre'` - powinien działać przed innymi resolverami
- Sprawdza wszystkie importy zaczynające się od `@engine/`
- Zwraca absolutne ścieżki do plików źródłowych (`src/`)

### Aliasy w `resolve.alias`
- Zdefiniowane dla wszystkich pakietów `@engine/*`
- Wskazują na katalogi `src/`

### Konfiguracja `optimizeDeps`
- `include` zawiera wszystkie pakiety `@engine/*`
- `server.deps.inline` zawiera `/@engine\/.*/`

### Warunkowe eksporty w `package.json`
- Dodane `test` i `development` conditions dla wszystkich pakietów `@engine/*`
- Wskazują na pliki źródłowe (`src/*.ts`)

### Konfiguracja `resolve.conditions`
- Ustawione na `['development', 'test', 'import', 'module']`
- `development` jest pierwszy, aby Vite preferował pliki źródłowe

### Konfiguracja `resolve.mainFields`
- Ustawione na `[]` aby zapobiec rozwiązywaniu przez `package.json` exports

## Dlaczego to nie działa?

1. **Vite sprawdza `package.json` exports przed pluginami**
   - Nawet z `enforce: 'pre'`, Vite najpierw próbuje rozwiązać przez `package.json`
   - Jeśli znajdzie eksport w `package.json`, używa go zamiast wywoływać plugin
   - Nawet z `mainFields: []`, Vite nadal sprawdza `exports` field

2. **Warunkowe eksporty nie są rozpoznawane**
   - Vite może nie rozpoznawać warunku `development` jako standardowego warunku Node.js
   - Warunek `test` również może nie być rozpoznawany przez Vite

3. **Aliasy nie działają dla subpath exports**
   - `@engine/core/math` jest subpath exportem
   - Vite sprawdza `package.json` exports przed aliasami
   - Aliasy są sprawdzane tylko gdy `package.json` nie ma eksportu

## Możliwe rozwiązania

### Rozwiązanie 1: Zmiana `package.json` exports dla testów ✅
**Status:** Dodane warunki `test` i `development` dla wszystkich pakietów `@engine/*`.
**Problem:** Vite nadal nie używa tych warunków - może nie rozpoznawać ich jako standardowych.

### Rozwiązanie 2: Użycie hooka `shouldExternalize` ✅
**Status:** Dodane, ale nie rozwiązuje problemu - hook jest wywoływany po rozwiązywaniu.

### Rozwiązanie 3: Użycie `resolve.mainFields: []` ✅
**Status:** Dodane, ale nie działa - Vite nadal sprawdza `exports`.

### Rozwiązanie 4: Wykluczenie `dist/` z testów ✅
**Status:** Już zrobione w `exclude: ['**/dist/**']`, ale nie pomaga - problem jest w importach z `src/`.

### Rozwiązanie 5: Użycie `resolve.preserveSymlinks: true`
**Status:** Przetestowane - nie pomaga.

### Rozwiązanie 6: Zmiana kolejności pluginów ✅
**Status:** Plugin jest już pierwszy w liście - nie pomaga.

### Rozwiązanie 7: Użycie hooka `load` do przechwytywania plików z `dist/`
**Status:** Dodane, ale nie działa - Vite nie próbuje ładować plików z `dist/`, tylko rozwiązuje przez `package.json`.

## Rekomendowane rozwiązanie

Najlepszym rozwiązaniem jest **użycie hooka `transform`** do modyfikacji importów w kodzie przed ich rozwiązaniem:

```typescript
transform(code, id) {
  // Jeśli plik importuje z @engine/*, zamień importy na bezpośrednie ścieżki do src/
  if (id.endsWith('.ts') || id.endsWith('.tsx')) {
    code = code.replace(
      /from ['"]@engine\/([^'"]+)['"]/g,
      (match, pkg) => {
        const srcPath = resolve(__dirname, `packages/${pkg}/src/index.ts`);
        if (fs.existsSync(srcPath)) {
          return `from '${srcPath}'`;
        }
        return match;
      }
    );
  }
  return null;
}
```

## Alternatywne rozwiązanie

Jeśli nie chcemy modyfikować importów w kodzie, możemy:
1. Użyć `resolveId` z wyższym priorytetem (ale Vite może nadal sprawdzać `package.json` pierwszy)
2. Użyć `load` hook do przechwytywania załadowanych plików z `dist/` i przekierowywania ich do `src/`
3. Użyć `transform` hook do modyfikacji importów w kodzie

## Status

- ✅ Plugin `resolveEngineAliasesPlugin` działa poprawnie
- ✅ Aliasy są zdefiniowane
- ✅ `optimizeDeps` jest skonfigurowane
- ✅ Warunkowe eksporty `test` i `development` dodane do wszystkich pakietów
- ✅ `resolve.conditions` ustawione na `['development', 'test', 'import', 'module']`
- ✅ `resolve.mainFields` ustawione na `[]`
- ❌ Vite nadal sprawdza `package.json` exports przed pluginami
- ❌ 100 testów nie przechodzi z powodu błędów rozwiązywania

## Następne kroki

1. Przetestować użycie hooka `transform` do modyfikacji importów
2. Jeśli nie zadziała, rozważyć użycie `load` hook do przechwytywania plików z `dist/`
3. Jeśli nadal nie zadziała, rozważyć użycie `resolveId` z wyższym priorytetem lub innym mechanizmem

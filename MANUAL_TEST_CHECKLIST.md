# Manual Testing Checklist - Phase 1 & 2

**Branch:** `refactor/remove-code-duplicates`  
**Before Merge:** Complete this checklist

## 🚀 Uruchomienie

```bash
# Upewnij się że jesteś na właściwym branchu
git checkout refactor/remove-code-duplicates

# Pull latest changes
git pull origin refactor/remove-code-duplicates

# Uruchom editor
pnpm --filter @apps/editor dev
```

**Expected:** Editor powinien wystartować na http://localhost:5173

---

## ✅ Phase 1 Testing: Camera & Loaders

### 1. Editor Startup
- [ ] ✅ Editor startuje bez błędów
- [ ] ✅ Brak czerwonych błędów w console (F12)
- [ ] ✅ Brak WGSL shader compilation errors
- [ ] ✅ WebGPU device initialized successfully
- [ ] ✅ Widoczny komunikat: "Asset Registry initialized successfully"

### 2. Orbit Camera (Edit Mode)
- [ ] ✅ Lewy przycisk myszy (LMB) + drag = obracanie kamery
- [ ] ✅ Prawy przycisk myszy (RMB) + drag = pan kamery
- [ ] ✅ Scroll = zoom in/out
- [ ] ✅ Kamera płynnie się porusza
- [ ] ✅ Brak jittering lub glitchów

### 3. Play Mode Transition
- [ ] ✅ Kliknij przycisk Play (lub Ctrl+P)
- [ ] ✅ Transition do FPS mode
- [ ] ✅ Camera blending jest smooth (nie teleportuje)
- [ ] ✅ Pointer lock aktywuje się

### 4. FPS Camera (Play Mode)
- [ ] ✅ Mouse movement = camera look around
- [ ] ✅ WASD = character movement
- [ ] ✅ Space = jump (jeśli zaimplementowane)
- [ ] ✅ Esc = exit play mode
- [ ] ✅ Powrót do orbit camera w edit mode

### 5. Shadows (Shader Fix)
- [ ] ✅ Cienie renderują się na obiektach
- [ ] ✅ Soft shadows mają smooth transition (penumbra)
- [ ] ✅ Brak artifacts, banding, lub glitchów
- [ ] ✅ Performance OK (FPS podobne jak wcześniej)

### 6. Logger Messages
Sprawdź w console (F12):
- [ ] ✅ Logi z prefiksem `[Editor]` lub `[INFO]`
- [ ] ✅ Camera mode transitions pokazują debug logi
- [ ] ✅ Brak console.debug/warn (powinny być przez Logger)

---

## ✅ Phase 2 Testing: AssetRegistry

### 1. Asset Browser
- [ ] ✅ Otwórz Asset Browser (przycisk lub hotkey)
- [ ] ✅ Assets wyświetlają się w gridzie
- [ ] ✅ Kategorie są widoczne (Building, Nature, Gameplay, etc.)
- [ ] ✅ Kliknięcie kategorii filtruje assets

### 2. Asset Filtering
- [ ] ✅ Search bar działa (wpisz nazwę blocka)
- [ ] ✅ Filter by type (Block, Model, etc.)
- [ ] ✅ Filter by material (Plastic, Wood, Stone, etc.)
- [ ] ✅ Results update instantly

### 3. Asset Selection
- [ ] ✅ Kliknięcie asset wybiera go
- [ ] ✅ Selected asset jest highlighted
- [ ] ✅ Asset info/details pokazują się

### 4. Favorites System
- [ ] ✅ Add asset to favorites (star icon)
- [ ] ✅ Favorites pokazują się w osobnej sekcji
- [ ] ✅ Remove from favorites działa
- [ ] ✅ Favorites persist po refresh (localStorage)

### 5. Recent Assets
- [ ] ✅ Used assets pojawiają się w Recent
- [ ] ✅ Recent limit działa (max 10-20)
- [ ] ✅ Most recent na początku

### 6. Inventory System
- [ ] ✅ Asset dodaje się do inventory
- [ ] ✅ Inventory count updates
- [ ] ✅ Limited/Infinite mode switching działa

### 7. Placement Mode
- [ ] ✅ Wybierz asset z browsera
- [ ] ✅ Preview asset pojawia się na cursor
- [ ] ✅ Placement preview aktualizuje się
- [ ] ✅ Kliknięcie LMB = place asset
- [ ] ✅ Asset properties są poprawne (kolor, material)

### 8. AssetRegistry Logger
Sprawdź w console (F12):
- [ ] ✅ "Asset Registry initialized successfully" z prefiksem [Editor]
- [ ] ✅ "Registered asset: X (id)" przy dodawaniu assets
- [ ] ✅ Brak console.debug (powinny być Logger.debug)
- [ ] ✅ Wszystkie asset operations logują się przez Logger

---

## 🐛 Known Issues to Verify Fixed

### Issue 1: Shader Error (FIXED in db26164)
**Before:** 
```
Error: 'textureSampleCompare' must only be called from uniform control flow
```

**After:**
- [ ] ✅ Brak tego błędu w console
- [ ] ✅ Shadows renderują się poprawnie

### Issue 2: Camera Duplicates (FIXED in 99892a4)
**Before:** Editor używał lokalnych kopii CameraDirector/FPSCamera

**After:**
- [ ] ✅ Importy z @engine/camera działają
- [ ] ✅ Camera functionality bez zmian

### Issue 3: AssetRegistry Duplicates (FIXED in 56eff71)
**Before:** 689 linii duplikatu + 394 linie AssetTypes duplikat

**After:**
- [ ] ✅ Editor używa @engine/assets z custom Logger
- [ ] ✅ Wszystkie asset operations działają
- [ ] ✅ Backward compatibility zachowana

---

## 📸 Screenshots (opcjonalnie)

Jeśli znajdziesz problemy, zrób screenshot i dołącz do PR review:
1. Console errors (F12)
2. Visual glitches
3. UI problems

---

## ✅ Finalna weryfikacja

Przed zatwierdzeniem PR:
- [ ] Wszystkie checklisty Phase 1 completed
- [ ] Wszystkie checklisty Phase 2 completed
- [ ] Brak critical bugs
- [ ] Performance acceptable
- [ ] Logger działa poprawnie

## 🐛 Jeśli znajdziesz problemy

1. **Minor issues (logging, cosmetic):**
   - Dodaj jako comment do PR
   - Możemy naprawić przed merge

2. **Major issues (functionality broken):**
   - Opisz szczegółowo w PR review
   - Request changes
   - Naprawimy i re-test

3. **Critical issues (editor nie działa):**
   - Opisz w PR
   - Może wymagać większych zmian
   - Rozważymy rollback lub fix

---

## 📝 Report Template

Po zakończeniu testowania, dodaj comment do PR:

```markdown
## Manual Testing Results

**Tester:** [Your Name]
**Date:** [Date]
**Browser:** [Chrome/Firefox/Edge] [Version]

### Phase 1: Camera & Loaders
- [x] Editor startup: ✅ OK
- [x] Orbit camera: ✅ OK
- [x] FPS mode: ✅ OK
- [x] Shadows: ✅ OK
- [ ] Issue found: [describe if any]

### Phase 2: AssetRegistry
- [x] Asset browser: ✅ OK
- [x] Filtering: ✅ OK
- [x] Favorites: ✅ OK
- [x] Placement: ✅ OK
- [ ] Issue found: [describe if any]

### Overall
- Performance: ✅ Good / ⚠️ Acceptable / ❌ Poor
- Bugs found: [count]
- Recommendation: ✅ Approve / ⚠️ Request changes / ❌ Reject

### Notes
[Any additional observations]
```

---

**Happy Testing! 🧪**


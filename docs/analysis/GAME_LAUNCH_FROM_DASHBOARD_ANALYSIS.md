# Analiza Uruchamiania Scen z Marketplace w Trybie Gracza

**Data:** 2025-01-26  
**Status:** Analiza brakującej funkcjonalności  
**Priorytet:** Wysoki - krytyczna funkcjonalność platformy UGC

## 📋 Spis Treści

1. [Przegląd](#przegląd)
2. [Obecny Stan](#obecny-stan)
3. [Wymagany Przepływ](#wymagany-przepływ)
4. [Komponenty do Zaimplementowania](#komponenty-do-zaimplementowania)
5. [Problemy i Ryzyka](#problemy-i-ryzyka)
6. [Propozycja Implementacji](#propozycja-implementacji)
7. [Alternatywne Podejścia](#alternatywne-podejścia)

---

## 🔍 Przegląd

### Co Jest w Marketplace

Marketplace przechowuje:
- **Builds** (`type: 'build'`) - sceny 3D z projektami
- **Avatars** (`type: 'avatar'`) - modele awatarów

**UWAGA:** To nie są gotowe gry, ale sceny które można uruchomić w trybie gracza (play mode).

### Co Jest Potrzebne

Użytkownik powinien móc:
1. **Zobaczyć listę scen** (builds) w marketplace/dashboard
2. **Kliknąć "Play Game"** na scenie
3. **Scena się uruchamia** w trybie gracza (podobnie jak play mode w edytorze)
4. **Gracz eksploruje scenę** - kontroluje postać, porusza się po świecie
5. **Może wyjść** z trybu gracza i wrócić do dashboard

### Aktualny Stan

- ✅ Marketplace istnieje z listą scen (builds)
- ✅ Przycisk "Play Game" jest widoczny w UI
- ❌ **Przycisk nie ma handlera** - nie robi nic
- ❌ **Brak player runtime** - nie ma systemu do uruchamiania scen jako gracz
- ❌ **Brak ładowania scen** z marketplace do runtime
- ❌ **Brak routing** między platform a player mode

---

## 📊 Obecny Stan

### MarketplaceItemPage

```typescript:186:186:apps/platform/src/pages/MarketplaceItemPage.tsx
                <Button variant="primary">Play Game</Button>
```

**Problem:** Button nie ma `onClick` handlera - nie jest funkcjonalny.

### EditorPage

```typescript:7:34:apps/platform/src/pages/EditorPage.tsx
export function EditorPage() {
  useEffect(() => {
    // Redirect to editor app (separate app on port 5173)
    // In production, this could be a different domain or subdomain
    window.location.href = 'http://localhost:5173';
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-canvas)',
      color: 'var(--text-1)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1>Redirecting to Editor...</h1>
        <p style={{ color: 'var(--text-2)' }}>
          If you are not redirected automatically,{' '}
          <a href="http://localhost:5173" style={{ color: 'var(--color-accent-400)' }}>
            click here
          </a>
        </p>
      </div>
    </div>
  );
}
```

**Problem:** Editor redirectuje do osobnej aplikacji, ale nie ma podobnego mechanizmu dla player mode.

### Marketplace API

```typescript:113:122:apps/platform/src/api/marketplace.ts
  /**
   * Join a game (track player as online)
   */
  async joinGame(id: string): Promise<{ success: boolean; playersOnline: number }> {
    return apiClient.post(`/marketplace/${id}/join`);
  },

  /**
   * Leave a game (remove player from online count)
   */
  async leaveGame(id: string): Promise<{ success: boolean; playersOnline: number }> {
    return apiClient.post(`/marketplace/${id}/leave`);
  },
```

**Status:** API istnieje dla tracking graczy, ale nie ma integracji z faktycznym uruchamianiem gry.

### Backend - Build Data Endpoint

```typescript
// Z GAME_PUBLISHING_ANALYSIS.md
GET /api/marketplace/:id/build
```

**Status:** Endpoint istnieje, zwraca dane sceny w formacie JSON, gotowy do użycia.

---

## 🔄 Wymagany Przepływ

### Flow Użytkownika

```
1. Użytkownik jest w Dashboard/Marketplace
   ↓
2. Kliknie "Play Game" na wybranej scenie (build)
   ↓
3. Frontend:
   a) Wywołuje joinGame() API (tracking graczy online)
   b) Pobiera dane sceny (GET /api/marketplace/:id/build)
   c) Przekierowuje do player mode
   ↓
4. Player Mode:
   a) Ładuje scenę z danych (sceneJSON z buildData)
   b) Inicjalizuje runtime world (podobnie jak w edytorze)
   c) Spawnuje gracza (w pozycji startowej sceny)
   d) Włącza input handling (WASD, mouse)
   e) Uruchamia game loop (update, render)
   ↓
5. Gracz eksploruje scenę:
   - Porusza się (WASD)
   - Interakcje z obiektami (jeśli zdefiniowane w scenie)
   - Multiplayer (jeśli dostępny i sceny wspiera)
   ↓
6. Wyjście z trybu gracza:
   a) Wywołuje leaveGame() API (stop tracking)
   b) Czyste zamknięcie player mode
   c) Powrót do dashboard/marketplace
```

**Uwaga:** To jest podobny flow jak "Play Mode" w edytorze, ale dla scen z marketplace.

### Sequence Diagram

```
User          MarketplacePage    PlayerMode    Backend API
  │                  │                │              │
  │-- Click "Play" ─>│                │              │
  │                  │                │              │
  │                  │-- joinGame() ──────────────────>│
  │                  │<─── success ──────────────────│
  │                  │                │              │
  │                  │-- getBuild() ───────────────────>│
  │                  │<─── scene JSON ────────────────│
  │                  │                │              │
  │                  │── Navigate ───>│              │
  │                  │                │              │
  │                  │                │── Load Scene │
  │                  │                │── Init World │
  │                  │                │── Spawn Player│
  │                  │                │── Start Loop │
  │                  │                │              │
  │                  │<────── Render ────────────────│
  │                  │                │              │
  │                  │                │              │
  │── Exit ──────────────────────────>│              │
  │                  │                │              │
  │                  │                │── leaveGame()─>│
  │                  │                │<── success ───│
  │                  │                │              │
  │<── Back to Dashboard ────────────│              │
```

---

## 🧩 Komponenty do Zaimplementowania

### 1. Player Mode Runtime

**Lokalizacja:** `apps/player/` (nowa aplikacja) lub `apps/editor/src/player/`

**Wymagania:**
- Osobna aplikacja React/Vite (podobnie jak editor)
- Integracja z engine (@engine/* packages)
- Game loop (update, render)
- Input handling (WASD, mouse)
- Camera controls (FPS/Third-person)

**Podobne do:** `EditorModeManager` ale bez funkcji edycji

### 2. PlayerPage Component

**Lokalizacja:** `apps/platform/src/pages/PlayerPage.tsx`

**Funkcjonalność:**
- Embed player runtime (iframe lub component)
- Pass game ID jako prop/query param
- Handle exit button
- Loading states

**Przykład:**

```typescript
export function PlayerPage() {
  const { buildId } = useParams<{ buildId: string }>();
  const navigate = useNavigate();
  
  const handleExit = async () => {
    if (buildId) {
      await marketplaceApi.leaveGame(buildId);
    }
    navigate('/marketplace');
  };
  
  return (
    <Layout>
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <PlayerRuntime buildId={buildId!} onExit={handleExit} />
      </div>
    </Layout>
  );
}
```

### 3. PlayerRuntime Component

**Lokalizacja:** `apps/player/src/PlayerRuntime.tsx` lub `apps/editor/src/player/PlayerRuntime.tsx`

**Funkcjonalność:**
- Load scene z API (`/api/marketplace/:id/build`) - otrzymuje `buildData` z `sceneJSON`
- Initialize engine (Renderer, Scene, Physics) - podobnie jak w edytorze play mode
- Spawn player w pozycji startowej sceny
- Start game loop (update, render)
- Handle input (WASD, mouse)
- Cleanup on unmount

**Flow:**

```typescript
class PlayerRuntime {
  async initialize(buildId: string) {
    // 1. Load build data (scena z marketplace)
    const buildData = await fetchBuildData(buildId);
    // buildData zawiera: sceneJSON, playerStart (opcjonalne), manifest (opcjonalne)
    
    // 2. Initialize engine (podobnie jak EditorModeManager)
    const scene = new Scene();
    const renderer = await Renderer.create(canvas);
    const physics = new PhysicsWorld();
    
    // 3. Load scene from buildData.sceneJSON
    hydrateScene(scene, buildData.sceneJSON);
    
    // 4. Setup physics
    physics.start();
    
    // 5. Spawn player w pozycji startowej (z manifest lub domyślnej)
    const startPos = buildData.playerStart?.position ?? [0, 2, 0];
    const startRot = buildData.playerStart?.rotation ?? 0;
    const player = await spawnPlayer(scene, startPos, startRot);
    
    // 6. Setup camera (FPS lub Third-person, zależnie od sceny)
    const camera = new FPSCamera(canvas);
    camera.setPlayer(player);
    
    // 7. Start game loop (podobnie jak EditorModeManager.updatePlayMode)
    this.gameLoop();
  }
  
  gameLoop() {
    const update = (deltaTime: number) => {
      // Update physics
      this.physics.update(deltaTime);
      
      // Update character controller
      this.characterSystem.update(deltaTime);
      
      // Update camera
      this.camera.update();
      
      // Render
      this.renderer.render(this.scene);
      
      requestAnimationFrame(update);
    };
    
    update(0);
  }
}
```

### 4. Marketplace Integration

**Zmiany w MarketplaceItemPage:**

```typescript
const handlePlayBuild = async () => {
  if (!item || item.type !== 'build') return; // Tylko builds można uruchamiać
  
  try {
    // Track player joining (dla players online counter)
    await marketplaceApi.joinGame(item.id);
    
    // Navigate to player page z build ID
    navigate(`/player/${item.id}`);
  } catch (error) {
    console.error('Failed to join build:', error);
    // Show error toast
  }
};

// W render:
{item.type === 'build' && (
  <Button variant="primary" onClick={handlePlayBuild}>
    Play Build
  </Button>
)}
```

### 5. Router Update

**Zmiany w router.tsx:**

```typescript
{
  path: '/player/:buildId', // buildId = marketplace item ID (type: 'build')
  element: (
    <ProtectedRoute>
      <PlayerPage />
    </ProtectedRoute>
  ),
},
```

### 6. Scene Loading Utility

**Lokalizacja:** `apps/player/src/utils/loadGameData.ts` lub `apps/editor/src/player/utils/loadGameData.ts`

**Funkcjonalność:**
- Fetch build data z API
- Parse JSON
- Validate data structure
- Return scene data + metadata

```typescript
export async function loadBuildData(buildId: string): Promise<BuildData> {
  const response = await fetch(`/api/marketplace/${buildId}/build`);
  if (!response.ok) {
    throw new Error(`Failed to load build: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Validate structure - buildData powinien zawierać sceneJSON
  if (!data.sceneJSON) {
    throw new Error('Invalid build data: missing sceneJSON');
  }
  
  return {
    sceneJSON: data.sceneJSON, // Dane sceny w formacie JSON (serialized Scene)
    playerStart: data.playerStart ?? { position: [0, 2, 0], rotation: 0 }, // Opcjonalna pozycja startowa
    manifest: data.manifest ?? null, // Opcjonalny manifest play mode
  };
}
```

**Uwaga:** Format `sceneJSON` jest taki sam jak w edytorze (używa `serializeScene` / `hydrateScene` z `@engine/editor-utils`).

---

## ⚠️ Problemy i Ryzyka

### 1. Brak Player Runtime

**Problem:** Obecnie nie ma osobnej aplikacji/runtime dla gracza.

**Rozwiązanie:** 
- Opcja A: Nowa aplikacja `apps/player/`
- Opcja B: Rozszerzyć `apps/editor/` o player mode (dzielenie kodu)

**Rekomendacja:** Opcja B (dzielenie kodu) - edytor już ma większość potrzebnych systemów.

### 2. Code Duplication

**Problem:** Player runtime potrzebuje podobnych systemów jak editor (Scene, Physics, Renderer, Input).

**Rozwiązanie:** Użyj istniejących packages (@engine/*) - już są modularne.

**Uwaga:** Unikaj duplikacji logiki między editor a player.

### 3. Scene Format Compatibility

**Problem:** Scene z marketplace może być w formacie starszym niż obecny engine (serializacja zmieniła się w czasie).

**Rozwiązanie:**
- Versioning w scene format (dodać `version` field do buildData)
- Migration scripts (konwertować stare formaty do nowych)
- Backward compatibility layer w `hydrateScene()`

**Uwaga:** `serializeScene` / `hydrateScene` z `@engine/editor-utils` powinny obsługiwać formaty scen.

### 4. Multiplayer Sync

**Problem:** Jeśli gra wspiera multiplayer, trzeba zsynchronizować stan między graczami.

**Rozwiązanie:** Użyj istniejącego `CollaborationManager` / `MultiplayerGameplayManager` z packages/net.

### 5. Asset Loading

**Problem:** Gra może używać assetów (textures, models), które trzeba załadować.

**Rozwiązanie:**
- Lazy loading assets
- Progress indicator
- Cache assets

### 6. Performance

**Problem:** Duże sceny mogą długo się ładować.

**Rozwiązanie:**
- Progressive loading
- Chunked scene loading (już istnieje w WorldManager.buildRuntimeWorldChunked)
- Loading screen z progress

### 7. Security

**Problem:** Uruchamianie sceny z marketplace może być ryzykowne (scripts w scenie, potencjalnie złośliwe komponenty).

**Rozwiązanie:**
- Sandbox scripts (jeśli sceny mają scripts)
- Validate scene data przed ładowaniem (sprawdź strukture, wymagane pola)
- Rate limiting na API calls
- Content moderation (dla publikowanych scen)

### 8. Exit Handling

**Problem:** Gracz może zamknąć tab podczas gry - trzeba cleanup.

**Rozwiązanie:**
- `beforeunload` handler do wywołania `leaveGame()`
- Cleanup w `useEffect` cleanup function

---

## 💡 Propozycja Implementacji

### Faza 1: Podstawowa Implementacja (MVP)

1. **Stwórz PlayerPage** w platform app
   - Nowy route `/player/:gameId`
   - Basic layout z exit button

2. **Stwórz PlayerRuntime component**
   - Lokalizacja: `apps/editor/src/player/PlayerRuntime.tsx` (dzieli kod z editor)
   - Load scene z API
   - Basic rendering
   - Basic input (WASD movement)

3. **Integruj z Marketplace**
   - Handler dla "Play Game" button
   - Navigate do PlayerPage
   - Track join/leave

**Szacowany czas:** 2-3 dni

### Faza 2: Pełna Funkcjonalność

4. **Dodaj pełny game loop**
   - Physics simulation
   - Character controller
   - Camera controls (FPS/Third-person)
   - Interactions

5. **Loading States**
   - Progress bar
   - Error handling
   - Retry mechanism

6. **Exit & Cleanup**
   - Proper cleanup
   - Return to previous page
   - Leave game tracking

**Szacowany czas:** 3-4 dni

### Faza 3: Multiplayer (Opcjonalne)

7. **Multiplayer Integration**
   - Use CollaborationManager
   - Sync player positions
   - Chat/in-game communication

**Szacowany czas:** 5-7 dni

### Faza 4: Optimization

8. **Performance**
   - Lazy loading
   - Asset optimization
   - Caching

9. **UX Improvements**
   - Settings menu (graphics, controls)
   - Pause menu
   - Screenshot/save state

**Szacowany czas:** 3-5 dni

---

## 🔄 Alternatywne Podejścia

### Opcja A: Osobna Aplikacja Player

**Zalety:**
- Oddzielenie concerns (editor vs player)
- Lżejszy bundle (bez editor UI)
- Możliwość różnych domen (editor.forge.com vs play.forge.com)

**Wady:**
- Więcej maintenance (dwie aplikacje)
- Potencjalna duplikacja kodu
- Więcej build steps

### Opcja B: Iframe Embed

**Zalety:**
- Prostsza implementacja (iframe src="/editor?mode=player&gameId=...")
- Nie wymaga nowej aplikacji

**Wady:**
- Ograniczenia iframe (cors, komunikacja)
- Większy bundle (editor + player)
- Mniej kontrola nad UX

### Opcja C: Modal/Overlay

**Zalety:**
- Nie wymaga routing
- Szybkie przełączanie

**Wady:**
- Ograniczenia UX (mały viewport)
- Problemy z fullscreen
- Mniej "native" feel

### Opcja D: Extension Editor Mode

**Zalety:**
- Dzielenie kodu maksymalne
- Użycie istniejących systemów (EditorModeManager)

**Wady:**
- Editor UI może być widoczny (trzeba ukryć)
- Większy bundle

**Rekomendacja:** Opcja D - rozszerzenie editor o player mode, ale z flagą `mode=player` która ukrywa editor UI.

---

## 📝 Przykładowa Implementacja

### PlayerRuntime.tsx (Szkielet)

```typescript
import { useEffect, useRef } from 'react';
import { Scene } from '@engine/world';
import { Renderer } from '@engine/gfx-webgpu';
import { PhysicsWorld } from '@engine/world';
import { loadBuildData } from './utils/loadBuildData';
import { hydrateScene } from '@engine/editor-utils';

interface PlayerRuntimeProps {
  buildId: string; // Marketplace item ID (type: 'build')
  onExit: () => void;
}

export function PlayerRuntime({ buildId, onExit }: PlayerRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  
  useEffect(() => {
    let mounted = true;
    
    async function initialize() {
      if (!canvasRef.current) return;
      
      try {
        // 1. Load build data (scena z marketplace)
        const buildData = await loadBuildData(gameId);
        
        // 2. Initialize engine
        const canvas = canvasRef.current;
        const renderer = await Renderer.create(canvas);
        const scene = new Scene();
        const physics = new PhysicsWorld();
        
        // 3. Load scene from build data
        hydrateScene(scene, buildData.sceneJSON);
        
        // 4. Setup physics
        physics.start();
        
        // 5. Spawn player (TODO)
        // const player = await spawnPlayer(scene, gameData.playerStart);
        
        // 6. Store refs
        sceneRef.current = scene;
        rendererRef.current = renderer;
        
        // 7. Start game loop
        function gameLoop() {
          if (!mounted || !renderer || !scene) return;
          
          // Update
          physics.update(1/60);
          
          // Render
          renderer.render(scene);
          
          requestAnimationFrame(gameLoop);
        }
        
        gameLoop();
        
      } catch (error) {
        console.error('Failed to initialize player runtime:', error);
        onExit();
      }
    }
    
    void initialize();
    
    return () => {
      mounted = false;
      rendererRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [buildId, onExit]);
  
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <button
        onClick={onExit}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '10px 20px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Exit Game
      </button>
    </div>
  );
}
```

---

## 🔗 Powiązane Pliki

- `apps/platform/src/pages/MarketplaceItemPage.tsx` - UI z buttonem "Play Game"
- `apps/platform/src/pages/EditorPage.tsx` - Przykład redirect
- `apps/platform/src/api/marketplace.ts` - API dla join/leave, getItem
- `apps/editor/src/editor/managers/EditorModeManager.ts` - Przykład play mode (podobna logika)
- `apps/editor/src/editor/core/WorldManager.ts` - Scene loading z buildData
- `apps/editor/src/editor/core/steps/BuildWorldStep.ts` - Loading runtime world
- `@engine/editor-utils` - `serializeScene` / `hydrateScene` functions
- `docs/analysis/GAME_PUBLISHING_ANALYSIS.md` - Build data format i struktura

---

## 📚 Referencje

- [Play Mode Analysis](./PLAY_MODE_LAUNCH_ANALYSIS.md) - Podobny flow w editor
- [Game Publishing Analysis](./GAME_PUBLISHING_ANALYSIS.md) - Format danych gry
- [Marketplace Analysis](./MARKETPLACE_ANALYSIS.md) - API endpoints

---

**Status:** Wymaga implementacji - brakuje całej funkcjonalności player runtime.

**Priorytet:** Wysoki - bez tego marketplace nie jest użyteczny (sceny można tylko oglądać, nie grać).

**Uwaga:** To nie są gotowe "gry", ale sceny 3D (builds) które można uruchomić w trybie gracza - podobnie jak play mode w edytorze.


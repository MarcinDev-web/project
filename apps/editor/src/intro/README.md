# 🎬 Forge World - Epic Intro System

Epicka scena intro dla Forge World z cinematic camera, particle effects i animowanym brandingiem.

## 📋 Spis treści

- [Funkcje](#funkcje)
- [Architektura](#architektura)
- [Użycie](#użycie)
- [Customizacja](#customizacja)
- [API](#api)

## ✨ Funkcje

### Scena 3D (IntroScene)
- ✅ Cinematic camera z orbit animation
- ✅ 200+ particle system z realistic physics
- ✅ Dynamiczne oświetlenie i geometria
- ✅ Orbiting cubes dla visual interest
- ✅ Smooth animations i transitions
- ✅ Auto-cleanup po zakończeniu

### HTML Overlay (IntroOverlay)
- ✅ Animated **FORGE WORLD** logo z SVG
- ✅ Gradient text effects z glow
- ✅ Progress bar z real-time updates
- ✅ Loading status messages
- ✅ Skip button (ESC or click)
- ✅ Fully responsive design

### Transitions
- ✅ Fade in/out effects
- ✅ Flash white transition (AAA game style)
- ✅ Crossfade między canvasami
- ✅ Curtain reveal effect

## 🏗️ Architektura

```
apps/editor/src/intro/
├── IntroScene.ts       # WebGPU 3D scene z camera i particles
├── IntroOverlay.ts     # HTML/CSS overlay z branding
├── transitions.ts      # Transition effects (fade, flash, etc.)
├── index.ts           # Main coordinator (runIntro)
└── README.md          # Ta dokumentacja
```

### Flow

```
bootstrap.ts
    ↓
runIntro(canvas, duration)
    ↓
    ├─→ IntroScene.start()     # 3D rendering
    │   ├─ Create geometry
    │   ├─ Initialize particles
    │   ├─ Animate camera
    │   └─ Update loop
    │
    └─→ IntroOverlay.show()    # HTML UI
        ├─ Display logo
        ├─ Animate elements
        ├─ Update progress
        └─ Handle skip
    ↓
onComplete / onSkip
    ↓
    ├─ Stop scene
    ├─ Hide overlay
    └─ Transition to app (flash + fade)
```

## 🚀 Użycie

### Basic Usage

Intro jest automatycznie wywoływane w `bootstrap.ts`:

```typescript
import { runIntro } from './intro';

// Show 5-second intro
await runIntro(canvas, 5);
```

### Skip Intro

Możesz pominąć intro przez URL parameter:

```
http://localhost:5173/?skipIntro=true
```

Lub programowo:

```typescript
const urlParams = new URLSearchParams(window.location.search);
const skipIntro = urlParams.get('skipIntro') === 'true';

if (!skipIntro) {
  await runIntro(canvas, 5);
}
```

### Custom Duration

```typescript
// Quick 3-second intro
await runIntro(canvas, 3);

// Epic 10-second intro
await runIntro(canvas, 10);
```

## 🎨 Customizacja

### IntroScene - Camera Settings

```typescript
// W IntroScene.ts
private cameraRadius = 15;      // Distance from center
private cameraHeight = 8;       // Starting height
private cameraSpeed = 0.3;      // Rotation speed
```

### IntroScene - Particles

```typescript
// W initializeParticles()
private readonly particleCount = 200;  // Number of particles

// Particle properties
size: Math.random() * 0.3 + 0.1,      // Size range
velocity: [
  (Math.random() - 0.5) * 0.5,        // X velocity
  Math.random() * 0.3 + 0.1,           // Y velocity (upward)
  (Math.random() - 0.5) * 0.5,        // Z velocity
],
```

### IntroOverlay - Branding

Edit HTML w `IntroOverlay.ts`:

```typescript
this.container.innerHTML = `
  <div class="intro-content">
    <div class="intro-logo">
      <!-- Customize SVG icon here -->
      <svg viewBox="0 0 100 100">
        <!-- Your custom logo -->
      </svg>
      
      <h1 class="logo-text">
        <span class="logo-forge">FORGE</span>
        <span class="logo-world">WORLD</span>
      </h1>
    </div>
    
    <div class="intro-tagline">
      <p>Your Custom Tagline</p>
    </div>
  </div>
`;
```

### IntroOverlay - Colors

Edit CSS w `injectStyles()`:

```css
.logo-forge {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  /* Change colors here */
}

.logo-world {
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
  /* Change colors here */
}
```

### Transitions

Możesz użyć różnych transition effects:

```typescript
import { fadeIn, fadeOut, flashTransition, curtainReveal, crossfadeCanvas } from './intro/transitions';

// Flash white (classic game loading)
await flashTransition(400);

// Fade in canvas
await fadeIn(canvas, 600);

// Curtain reveal
await curtainReveal(element, 800);

// Crossfade between canvases
await crossfadeCanvas(oldCanvas, newCanvas, 1000);
```

## 📚 API

### `runIntro(canvas, duration): Promise<void>`

Main function - runs intro sequence.

**Parameters:**
- `canvas: HTMLCanvasElement` - Canvas element for 3D rendering
- `duration?: number` - Duration in seconds (default: 5)

**Returns:** Promise that resolves when intro is complete

### `IntroScene`

WebGPU 3D scene manager.

**Constructor:**
```typescript
new IntroScene({
  canvas: HTMLCanvasElement,
  onComplete: () => void,
  duration?: number
})
```

**Methods:**
- `start(): Promise<void>` - Initialize and start scene
- `stop(): void` - Stop animation and cleanup
- `skip(): void` - Skip intro immediately

### `IntroOverlay`

HTML overlay manager.

**Constructor:**
```typescript
new IntroOverlay({
  onSkip?: () => void,
  duration: number
})
```

**Methods:**
- `show(): void` - Display overlay
- `hide(): void` - Hide and cleanup overlay

### Transition Functions

All return `Promise<void>`:

- `fadeIn(element, duration?)`
- `fadeOut(element, duration?)`
- `flashTransition(duration?)`
- `crossfadeCanvas(from, to, duration?)`
- `curtainReveal(element, duration?)`

## 🎯 Best Practices

1. **Performance:** Intro używa WebGPU - upewnij się że jest dostępne
2. **Duration:** Zalecane 3-7 sekund (5 sekund to sweet spot)
3. **Skip Option:** Zawsze daj możliwość skip (ESC / click / URL param)
4. **Error Handling:** Intro gracefully falls back jeśli coś się wywali
5. **Cleanup:** Scene i overlay automatycznie cleanup po zakończeniu

## 🐛 Troubleshooting

### Intro nie pokazuje się

- Sprawdź czy WebGPU jest dostępne w przeglądarce
- Sprawdź console errors
- Sprawdź czy `?skipIntro=true` nie jest w URL

### Animacje są przerywawe

- Sprawdź FPS - intro wymaga ~60fps dla smooth animations
- Zmniejsz `particleCount` w IntroScene.ts
- Upewnij się że GPU nie jest przeciążony

### Canvas jest czarny

- Sprawdź czy renderer się zainicjalizował
- Sprawdź czy entities mają MeshComponent
- Sprawdź console errors z initRenderer

### Overlay nie znika

- Sprawdź czy `onComplete` jest wywoływane
- Sprawdź czy transitions nie throwują errors
- Sprawdź czy timeout w `hide()` działa

## 🚀 Future Improvements

Potencjalne ulepszenia:

- [ ] Sound effects (whoosh, impact, logo reveal)
- [ ] Advanced particle effects (trails, sparks)
- [ ] Post-processing (bloom, god rays)
- [ ] Interactive elements (mouse tracking)
- [ ] Multiple themes (day/night, seasons)
- [ ] Skip animation (fade to black faster)
- [ ] Preloader for assets
- [ ] WebGL fallback for compatibility

## 📝 License

Part of Forge World Engine - see main LICENSE file.

---

**Created:** 2025-11-06  
**Author:** Forge World Team  
**Version:** 1.0.0


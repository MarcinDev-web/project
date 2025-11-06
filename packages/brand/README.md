# @engine/brand

**Centralized branding and visual identity for Forge World**

This package contains all branding constants, color schemes, typography settings, watermark configurations, and logo assets used across Forge World.

## 🎯 Purpose

- **Single source of truth** for all brand-related constants
- **Consistent visual identity** across UI, overlays, screenshots, and social media
- **Easy updates** - change once, apply everywhere
- **Type-safe** - full TypeScript support

## 📦 Installation

```bash
pnpm add @engine/brand
```

## 🚀 Usage

### Basic Import

```typescript
import { BRAND, COLORS, TYPOGRAPHY } from '@engine/brand';

// Use in UI components
element.style.backgroundColor = COLORS.PRIMARY_BG;
element.style.color = COLORS.TEXT_PRIMARY;
element.style.fontFamily = TYPOGRAPHY.FONT_STACK;

// Display branding
title.textContent = BRAND.PLATFORM_NAME; // "Forge World"
subtitle.textContent = BRAND.TAGLINE; // "Open-source 3D game creation platform..."
badge.textContent = BRAND.ENGINE_TAG; // "POWERED BY FORGE ENGINE"
```

### Watermarks

```typescript
import { WATERMARKS } from '@engine/brand';

// Editor watermark
const watermark = document.createElement('div');
watermark.textContent = WATERMARKS.EDITOR.text; // "FORGE ENGINE · DEV BUILD"
Object.assign(watermark.style, WATERMARKS.EDITOR.style);

// FPS counter with branding
const fpsText = WATERMARKS.FPS_COUNTER.format(60); // "FORGE ENGINE · 60 FPS"

// Community badge (open-source emphasis)
const badge = document.createElement('div');
badge.textContent = WATERMARKS.COMMUNITY.text; // "FORGE · OPEN SOURCE"
Object.assign(badge.style, WATERMARKS.COMMUNITY.style);
```

### UI Utilities

```typescript
import { UI } from '@engine/brand';

button.style.borderRadius = UI.RADIUS.MD;
button.style.padding = UI.SPACING.MD;
button.style.transition = `all ${UI.TRANSITION.BASE}`;
button.style.boxShadow = UI.SHADOW.MD;
```

## 🎨 Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| PRIMARY_BG | `#1B1B1D` | Main background (steel gray) |
| ACCENT_HOT | `#FF6A00` | Forge orange - energy, creation |
| ACCENT_TECH | `#2E6AFF` | Technical blue - Forge Engine |
| TEXT_PRIMARY | `#ffffff` | Main text |
| TEXT_DIM | `#E1E1E3` | Secondary text (light ash) |

**Theme:** Anvil and fire as creation metaphor - steel gray with forge orange accents.

## 📐 Typography

- **Plaza Entertainment (Classic):** Inter, Neue Haas Grotesk, Satoshi
- **Forge World (Geometric):** Orbitron, Rajdhani, Exo 2
- **Monospace:** JetBrains Mono, Fira Code, Consolas
- **Base Size:** 14px
- **Weights:** 300, 400, 500, 600, 700, 800

## 🖼️ Watermark Presets

### EDITOR
Top-left corner for editor/dev builds:
```
FORGE ENGINE · DEV BUILD
```

### LOADING
Center-bottom for loading screens:
```
POWERED BY FORGE ENGINE
```

### FPS_COUNTER
Top-left corner with dynamic FPS:
```
FORGE ENGINE · 142 FPS
```

### SOCIAL
Bottom-right for screenshots/social media:
```
POWERED BY FORGE ENGINE
```

### COMMUNITY
Top-right corner for open-source emphasis:
```
FORGE · OPEN SOURCE
```

## 🎯 Best Practices

1. **Always use constants** - Never hardcode colors, fonts, or brand names
2. **Update once** - Change `@engine/brand`, not individual files
3. **Export everywhere** - Use watermarks on screenshots, videos, demos
4. **Consistency** - Same branding in UI, debug overlays, and social media

## 📝 Marketing Pitch

**One-liner (everywhere):**
```
Forge World — Open-source 3D game creation platform built by the community, for the community. POWERED BY FORGE ENGINE.
```

**README:**
```markdown
# Forge World

Open-source 3D game creation platform built by the community, for the community.

POWERED BY FORGE ENGINE.
```

**Social Media Bio:**
```
Forge World — Open-source 3D game creation platform. Built by the community, for the community. POWERED BY FORGE ENGINE #WebGPU #GameDev #OpenSource #FORGE
```

## 🔄 Updating Branding

To update branding across the entire project:

1. Edit `packages/brand/src/index.ts`
2. Run `pnpm build` (in this package)
3. All consuming packages automatically get new branding

## 📦 Package Structure

```
packages/brand/
├── src/
│   └── index.ts          # All branding constants
├── assets/                # Logo files (SVG)
│   ├── logo.svg          # Full logo (200x200)
│   ├── logo-icon.svg     # Square icon (64x64)
│   └── wordmark.svg      # Text wordmark (400x80)
├── package.json
├── tsconfig.json
└── README.md
```

## 🎓 Examples

### Editor Watermark

```typescript
import { BRAND, WATERMARKS } from '@engine/brand';

class EditorWatermark {
  private element: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.textContent = WATERMARKS.EDITOR.text;
    Object.assign(this.element.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      zIndex: '9999',
      ...WATERMARKS.EDITOR.style,
    });
    container.appendChild(this.element);
  }

  updateFPS(fps: number) {
    this.element.textContent = WATERMARKS.FPS_COUNTER.format(fps);
  }
}
```

### Styled Button

```typescript
import { COLORS, TYPOGRAPHY, UI } from '@engine/brand';

function createButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = text;
  Object.assign(button.style, {
    backgroundColor: COLORS.ACCENT_HOT,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: TYPOGRAPHY.FONT_STACK,
    fontSize: TYPOGRAPHY.SIZE.BASE,
    fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
    padding: `${UI.SPACING.SM} ${UI.SPACING.MD}`,
    borderRadius: UI.RADIUS.MD,
    border: 'none',
    cursor: 'pointer',
    transition: `all ${UI.TRANSITION.BASE}`,
  });
  
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = COLORS.ACCENT_HOT_HOVER;
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = COLORS.ACCENT_HOT;
  });
  
  return button;
}
```

---

**Built with ❤️ by Plaza Entertainment Studio for Forge World**

**POWERED BY FORGE ENGINE**


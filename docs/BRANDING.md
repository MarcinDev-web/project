# FORGE Worlds - Branding Guide

**Official branding documentation for FORGE Worlds**

## 📛 Brand Identity

### Name
- **Platform Name:** FORGE Worlds
- **Engine Name:** FORGE Engine
- **Primary:** FORGE
- **Short Name:** FORGE
- **Technical (Engine):** FORGE ENGINE
- **Tag line:** POWERED BY FORGE ENGINE
- **Tag line (short):** FORGE ENGINE

### Pitch (one sentence)
```
FORGE Worlds — Open-source 3D game creation platform built by the community, for the community. POWERED BY FORGE ENGINE.
```

### Mission Statement
```
Empowering creators worldwide to build, share, and play 3D games without barriers.
```

### Taglines
- **Primary:** Open-source 3D game creation platform built by the community, for the community.
- **Technical:** Create and publish your own 3D games directly in the browser.

## 🎨 Visual Identity

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary Background** | `#0f0f10` | Almost black steel - main background |
| **Secondary Background** | `#1a1a1c` | Slightly lighter - panels, cards |
| **Accent Hot** | `#ff3b00` | Hot metal/sparks - CTAs, highlights |
| **Accent Hot Hover** | `#ff5722` | Brighter - hover states |
| **Text Primary** | `#ffffff` | Pure white - main text |
| **Text Dim** | `#8a8a8a` | Gray - secondary text, hints |
| **Success** | `#00c853` | Green - success states |
| **Warning** | `#ffa726` | Amber - warnings |
| **Error** | `#ff1744` | Red - errors |
| **Border** | `#2a2a2c` | Subtle gray - dividers |
| **Overlay Background** | `rgba(15, 15, 16, 0.85)` | Semi-transparent - modals, overlays |

### Typography

**Primary Font Stack:**
```css
Inter, Roboto, system-ui, -apple-system, sans-serif
```

**Monospace Font Stack:**
```css
"JetBrains Mono", "Fira Code", Consolas, monospace
```

**Font Sizes:**
- XS: 10px
- SM: 12px (debug, watermarks)
- BASE: 14px (body text)
- MD: 16px
- LG: 18px (section headers)
- XL: 24px
- XXL: 32px (page headers)
- XXXL: 48px (hero)

**Font Weights:**
- Light: 300
- Regular: 400 (body)
- Medium: 500
- Semibold: 600 (UI elements)
- Bold: 700 (headings)

## 🖼️ Watermarks & Overlays

### 1. Editor Watermark (Top-Left)
**Text:** `FORGE ENGINE · DEV BUILD`  
**Position:** Top-left corner  
**Style:**
- Font: Monospace, 12px
- Color: `#8a8a8a` (dimmed)
- Background: `rgba(15, 15, 16, 0.85)`
- Padding: 8px 12px
- Border Radius: 0 0 4px 0 (only bottom-right)

**Usage:** Always visible in editor during development

### 2. FPS Counter (Top-Left)
**Text:** `FORGE ENGINE · {fps} FPS` (dynamic)  
**Position:** Top-left corner (replaces dev build watermark)  
**Style:** Same as editor watermark  
**Usage:** Production builds, performance monitoring

### 3. Loading Screen (Center-Bottom)
**Text:** `POWERED BY FORGE ENGINE`  
**Position:** Center-bottom  
**Style:**
- Font: Primary, 18px, Bold
- Color: `#ff3b00` (accent hot)
- Padding: 16px

**Usage:** During scene/world loading

### 4. Social Media Watermark (Bottom-Right)
**Text:** `POWERED BY FORGE ENGINE`  
**Position:** Bottom-right corner  
**Style:**
- Font: Primary, 14px, Semibold
- Color: `#ffffff`
- Background: `#0f0f10`
- Padding: 8px 16px
- Border Radius: 4px 0 0 0 (only top-left)
- Opacity: 0.9

**Usage:** Screenshots, videos, social media posts, trailers

### 5. Community Badge (Top-Right)
**Text:** `FORGE · OPEN SOURCE`  
**Position:** Top-right corner  
**Style:**
- Font: Monospace, 12px
- Color: `#00c853` (success green)
- Background: `rgba(15, 15, 16, 0.85)`
- Padding: 8px 12px
- Border Radius: 0 0 0 4px (only bottom-left)
- Opacity: 0.85

**Usage:** Emphasize open-source nature, community builds

## 💻 Implementation

### Using @engine/brand Package

```typescript
import { BRAND, COLORS, TYPOGRAPHY, WATERMARKS, UI } from '@engine/brand';

// Display brand name
console.log(BRAND.NAME); // "FORGE"
console.log(BRAND.PLATFORM_NAME); // "FORGE Worlds"
console.log(BRAND.ENGINE_NAME); // "FORGE Engine"
console.log(BRAND.ENGINE_TAG); // "POWERED BY FORGE ENGINE"

// Use colors
element.style.backgroundColor = COLORS.PRIMARY_BG;
element.style.color = COLORS.ACCENT_HOT;

// Use typography
element.style.fontFamily = TYPOGRAPHY.FONT_STACK;
element.style.fontSize = TYPOGRAPHY.SIZE.BASE;

// Create watermark
import { BrandWatermark } from '@apps/editor/src/editor/ui/BrandWatermark';

const watermark = new BrandWatermark({
  container: document.body,
  showFPS: true,
  position: 'top-left',
});

// Update FPS in render loop
function renderLoop() {
  watermark.updateFPS();
  // ... rest of render logic
}
```

## 📱 Social Media Usage

### Twitter/X Bio
```
FORGE Worlds — Open-source 3D game creation platform. Built by the community, for the community. POWERED BY FORGE ENGINE #WebGPU #GameDev #OpenSource #FORGE
```

### GitHub Description
```
FORGE Worlds - Open-source WebGPU/TypeScript game platform for browser-based 3D game creation. Built by the community, for the community. POWERED BY FORGE ENGINE.
```

### YouTube Video Description
```
Created with FORGE Worlds

FORGE Worlds — Open-source 3D game creation platform built by the community, for the community.
POWERED BY FORGE ENGINE

🔗 Learn more: https://forge.worlds
💻 GitHub: https://github.com/forge-worlds
```

### Reddit/Forums
```
Made with FORGE Worlds - an open-source, browser-based 3D game platform powered by FORGE Engine and WebGPU. Built by the community, for the community.

Check it out: [link]
```

## 🎬 Video/Screenshot Guidelines

### Always Include Branding
1. **In-Game Watermark:** Bottom-right corner (social watermark)
2. **Video Intro/Outro:** Show FORGE Worlds logo/name
3. **Thumbnail:** Include "FORGE Worlds" or "FORGE" text or logo
4. **Open Source Badge:** Consider adding community badge (top-right) to emphasize open-source nature

### Best Practices
- Keep watermarks visible but non-intrusive (0.7-0.9 opacity)
- Use consistent positioning (bottom-right for social)
- Include branding in every public asset
- Mention "POWERED BY FORGE ENGINE" in descriptions

## 🚀 Brand Voice

### Tone
- **Empowering** - You can do this
- **Professional** - Serious about quality
- **Accessible** - No barriers to entry
- **Bold** - Confident and direct

### Key Messages
1. **Browser-Native** - No downloads, no installations
2. **Production-Ready** - Not a toy, real engine
3. **WebGPU Powered** - Modern, fast, cutting-edge
4. **Solo Developer** - Built with ❤️ by one person

### Do's and Don'ts

✅ **Do:**
- Use "FORGE Worlds" for the platform name
- Use "FORGE Engine" for the engine name
- Use "FORGE" for short/branding
- Emphasize open-source and community nature
- Highlight browser-native nature
- Highlight WebGPU performance
- Mention modular architecture
- Celebrate community contributions

❌ **Don't:**
- Call it "UGC 3D Platform" (old name)
- Call it "Community OS" or "Forge Community OS" (removed branding)
- Downplay capabilities
- Ignore community aspect

## 🎯 Taglines

### Primary
```
Open-source 3D game creation platform built by the community, for the community.
```

### Alternative Taglines
```
Empowering creators worldwide to build, share, and play 3D games without barriers
Browser-native 3D game engine powered by WebGPU
Built by the community, for the community
From prototype to production, all in your browser
No downloads. No barriers. Just create.
Open-source game creation, powered by the community
```

## 📋 Checklist for Public Assets

Before sharing any screenshot, video, or demo:

- [ ] Watermark visible (bottom-right for social media)
- [ ] "POWERED BY FORGE ENGINE" in description
- [ ] Brand colors used in UI (if custom)
- [ ] Link to project/website/GitHub included
- [ ] Consistent branding across all materials
- [ ] Open-source badge visible (optional, for community emphasis)

---

## 🔗 Resources

- **Brand Package:** `@engine/brand`
- **README:** `README.md`
- **Package Name:** `@engine/brand`
- **Website:** https://forge.worlds (placeholder)
- **GitHub:** https://github.com/forge-worlds (placeholder)
- **Discord:** https://discord.gg/forge-worlds (placeholder)
- **Twitter:** https://twitter.com/forgeworlds (placeholder)

*Note: URLs are placeholders and will be updated when actual services are set up.*

---

**Updated:** 2025-01-XX  
**Version:** 3.0.0  
**Status:** ✅ Fully Implemented (FORGE Worlds / FORGE Engine)

**Built with ❤️ by the community**

**POWERED BY FORGE ENGINE**


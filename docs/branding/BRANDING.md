# Forge World - Branding Guide

**Official branding documentation for Forge World**

## 📛 Brand Identity

### Name
- **Company/Studio:** Plaza Entertainment Studio
- **Platform Name:** Forge World
- **Engine Name:** Forge Engine
- **Primary:** FORGE
- **Short Name:** FORGE
- **Technical (Engine):** FORGE ENGINE
- **Tag line:** POWERED BY FORGE ENGINE
- **Tag line (short):** FORGE ENGINE

### Pitch (one sentence)
```
Forge World — Open-source 3D game creation platform built by the community, for the community. POWERED BY FORGE ENGINE.
```

### Mission Statement
```
Empowering creators worldwide to build, share, and play 3D games without barriers.
```

### Taglines
- **Primary:** Open-source 3D game creation platform built by the community, for the community.
- **Technical:** Create and publish your own 3D games directly in the browser.

## 🎨 Visual Identity

### Core Concept

**Anvil and Fire as Creation Metaphor**  
Forge (kuźnia) symbolizes power and creation from raw ideas - transforming concepts into reality through craftsmanship and technology.

### Logo System

1. **Plaza Entertainment Studio**
   - Minimalistic, text-based logo
   - Subtle "P" in the form of a spark
   - Classic sans-serif typography (Inter, Neue Haas Grotesk)
   - Emphasis on elegance and professionalism

2. **Forge World**
   - Dynamic logo with glowing "F" or anvil symbol
   - Futuristic style with geometric fonts (Orbitron, Rajdhani)
   - Forge orange accent (#FF6A00) for energy
   - Represents the platform and creative power

3. **Forge Engine**
   - Technical, monochromatic version
   - "Powered by" tagline variant
   - Subtle blue accent (#2E6AFF) for technical tone
   - Clean, professional appearance for developer-facing contexts

### Color Palette

**Theme:** Anvil and fire as a metaphor for creation - Forge as a symbol of power, creating from raw ideas.

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary Background** | `#1B1B1D` | Steel gray - technology, power |
| **Secondary Background** | `#0E0E10` | Dark graphite - deeper surfaces |
| **Accent Hot** | `#FF6A00` | Forge orange - energy, creation |
| **Accent Hot Hover** | `#FF8A33` | Brighter forge glow - hover states |
| **Accent Tech** | `#2E6AFF` | Subtle blue - Forge Engine technical tone |
| **Light Ash** | `#E1E1E3` | Light accent - highlights, contrast |
| **Text Primary** | `#ffffff` | Pure white - main text |
| **Text Dim** | `#E1E1E3` | Light ash - secondary text |
| **Text Muted** | `#8a8a8a` | Muted gray - tertiary text |
| **Success** | `#00c853` | Green - success states |
| **Warning** | `#ffa726` | Amber - warnings |
| **Error** | `#ff1744` | Red - errors |
| **Border** | `#2a2a2c` | Subtle gray - dividers |
| **Overlay Background** | `rgba(27, 27, 29, 0.85)` | Semi-transparent steel - modals, overlays |

### Typography

**Two-tier font system for brand hierarchy:**

**FORGE WORLD - Geometric, Massive:**
```css
Orbitron, Rajdhani, "Exo 2", "Eurostile", "Michroma", sans-serif
```
Use for: Forge World branding, headers, hero sections, impactful statements

**PLAZA ENTERTAINMENT - Classic, Elegant:**
```css
Inter, "Neue Haas Grotesk", Satoshi, system-ui, -apple-system, sans-serif
```
Use for: Plaza Entertainment Studio branding, body text, UI elements, professional content

**Monospace (Code/Debug):**
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
- Heavy: 800 (Forge World headers)

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
console.log(BRAND.PLATFORM_NAME); // "Forge World"
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
Forge World — Open-source 3D game creation platform. Built by the community, for the community. POWERED BY FORGE ENGINE #WebGPU #GameDev #OpenSource #FORGE
```

### GitHub Description
```
Forge World - Open-source WebGPU/TypeScript game platform for browser-based 3D game creation. Built by the community, for the community. POWERED BY FORGE ENGINE.
```

### YouTube Video Description
```
Created with Forge World

Forge World — Open-source 3D game creation platform built by the community, for the community.
POWERED BY FORGE ENGINE

🔗 Learn more: https://forge.worlds
💻 GitHub: https://github.com/forge-worlds
```

### Reddit/Forums
```
Made with Forge World - an open-source, browser-based 3D game platform powered by Forge Engine and WebGPU. Built by the community, for the community.

Check it out: [link]
```

## 🎬 Video/Screenshot Guidelines

### Always Include Branding
1. **In-Game Watermark:** Bottom-right corner (social watermark)
2. **Video Intro/Outro:** Show Forge World logo/name
3. **Thumbnail:** Include "Forge World" or "FORGE" text or logo
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
- Use "Forge World" for the platform name
- Use "Forge Engine" for the engine name
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
**Status:** ✅ Fully Implemented (Forge World / Forge Engine)

**Built with ❤️ by Plaza Entertainment Studio**

**POWERED BY FORGE ENGINE**


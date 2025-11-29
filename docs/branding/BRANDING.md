# Playverse - Branding Guide

**Official branding documentation for Playverse**

## 📛 Brand Identity

### Name
- **Company/Studio:** Plaza Entertainment Studio
- **Platform Name:** Playverse
- **Engine Name:** Playverse Engine
- **Primary:** PLAYVERSE
- **Short Name:** PLAYVERSE
- **Technical (Engine):** PLAYVERSE ENGINE
- **Tag line:** POWERED BY PLAYVERSE ENGINE
- **Tag line (short):** PLAYVERSE ENGINE

### Pitch (one sentence)
```
Playverse — The friendly 3D game creation platform. Create, play, and share your worlds. POWERED BY PLAYVERSE ENGINE.
```

### Mission Statement
```
Empowering creators worldwide to build, share, and play 3D games without barriers.
```

### Taglines
- **Primary:** Create. Play. Share.
- **Technical:** Create and publish your own 3D games directly in the browser.

## 🎨 Visual Identity

### Core Concept

**Playful Creativity as the Central Theme**  
Playverse represents a friendly, approachable platform where anyone can create, play, and share their imaginative worlds.

### Design Style

**Flat Design with Cartoon/Stylized Aesthetic**
- Clean, minimal interfaces
- Rounded corners and soft edges
- Blue and green color scheme
- Friendly, approachable typography

### Logo System

1. **Plaza Entertainment Studio**
   - Minimalistic, text-based logo
   - Classic sans-serif typography (Inter)
   - Emphasis on elegance and professionalism

2. **Playverse**
   - Friendly, approachable logo
   - Rounded typography (Nunito)
   - Blue accent (#3B82F6) for energy and trust
   - Represents the platform and creative play

3. **Playverse Engine**
   - Technical, clean version
   - "Powered by" tagline variant
   - Cyan accent (#06B6D4) for technical tone
   - Professional appearance for developer-facing contexts

### Color Palette

**Theme:** Friendly flat design with blue/green accents - representing creativity, trust, and growth.

| Color | Hex | Usage |
|-------|-----|-------|
| **Primary Background** | `#0F172A` | Slate 900 - deepest surfaces |
| **Secondary Background** | `#1E293B` | Slate 800 - panels |
| **Elevated Surface** | `#334155` | Slate 700 - cards, elevated UI |
| **Primary Accent** | `#3B82F6` | Blue - main accent, CTAs |
| **Primary Hover** | `#60A5FA` | Blue light - hover states |
| **Primary Dark** | `#2563EB` | Blue dark - active states |
| **Secondary Accent** | `#10B981` | Green - success, secondary actions |
| **Highlight** | `#06B6D4` | Cyan - highlights, links |
| **Text Primary** | `#F1F5F9` | Light - main text |
| **Text Secondary** | `#94A3B8` | Medium gray - secondary text |
| **Text Muted** | `#64748B` | Dimmed - tertiary text |
| **Success** | `#22C55E` | Green - success states |
| **Warning** | `#F59E0B` | Amber - warnings |
| **Error** | `#EF4444` | Red - errors |
| **Border** | `rgba(148, 163, 184, 0.15)` | Subtle - dividers |
| **Overlay Background** | `rgba(15, 23, 42, 0.85)` | Semi-transparent - modals |

### Typography

**Flat/Cartoon Style Font System:**

**PLAYVERSE - Display (Headlines, Branding):**
```css
Nunito, Poppins, system-ui, -apple-system, sans-serif
```
Use for: Playverse branding, headers, hero sections, impactful statements

**PLAZA ENTERTAINMENT - Body (UI, Content):**
```css
Inter, "DM Sans", system-ui, -apple-system, sans-serif
```
Use for: Plaza Entertainment Studio branding, body text, UI elements, professional content

**Monospace (Code/Debug):**
```css
"JetBrains Mono", "Fira Code", Consolas, monospace
```

**Font Sizes:**
- XS: 11px
- SM: 13px (labels, captions)
- BASE: 14px (body text)
- MD: 15px
- LG: 16px (section headers)
- XL: 18px
- XXL: 24px (page headers)
- DISPLAY: 32-40px (hero)

**Font Weights:**
- Light: 300
- Regular: 400 (body)
- Medium: 500
- Semibold: 600 (UI elements)
- Bold: 700 (headings)
- Heavy: 800 (display headers)

### Border Radius

More rounded for the flat/cartoon aesthetic:
- SM: 8px
- MD: 12px
- LG: 16px
- XL: 24px
- Full: 9999px (pills)

## 🖼️ Watermarks & Overlays

### 1. Editor Watermark (Top-Left)
**Text:** `PLAYVERSE ENGINE · DEV BUILD`  
**Position:** Top-left corner  
**Style:**
- Font: Monospace, 13px
- Color: `#94A3B8` (secondary text)
- Background: `rgba(15, 23, 42, 0.85)`
- Padding: 8px 12px
- Border Radius: 0 0 12px 0

### 2. FPS Counter (Top-Left)
**Text:** `PLAYVERSE ENGINE · {fps} FPS` (dynamic)  
**Position:** Top-left corner  
**Style:** Same as editor watermark

### 3. Loading Screen (Center-Bottom)
**Text:** `POWERED BY PLAYVERSE ENGINE`  
**Position:** Center-bottom  
**Style:**
- Font: Nunito, 16px, Bold
- Color: `#3B82F6` (primary blue)
- Padding: 16px

### 4. Social Media Watermark (Bottom-Right)
**Text:** `POWERED BY PLAYVERSE ENGINE`  
**Position:** Bottom-right corner  
**Style:**
- Font: Nunito, 14px, Semibold
- Color: `#F1F5F9`
- Background: `#0F172A`
- Padding: 8px 16px
- Border Radius: 12px 0 0 0
- Opacity: 0.9

### 5. Community Badge (Top-Right)
**Text:** `PLAYVERSE · OPEN SOURCE`  
**Position:** Top-right corner  
**Style:**
- Font: Monospace, 13px
- Color: `#22C55E` (success green)
- Background: `rgba(15, 23, 42, 0.85)`
- Padding: 8px 12px
- Border Radius: 0 0 0 12px
- Opacity: 0.85

## 💻 Implementation

### Using @engine/brand Package

```typescript
import { BRAND, COLORS, TYPOGRAPHY } from '@engine/brand';

// Display brand name
console.log(BRAND.NAME); // "PLAYVERSE"
console.log(BRAND.PLATFORM_NAME); // "Playverse"
console.log(BRAND.ENGINE_NAME); // "Playverse Engine"
console.log(BRAND.ENGINE_TAG); // "POWERED BY PLAYVERSE ENGINE"

// Use colors
element.style.backgroundColor = COLORS.PRIMARY_BG;
element.style.color = COLORS.ACCENT_PRIMARY;

// Use typography
element.style.fontFamily = TYPOGRAPHY.FONT_STACK;
element.style.fontSize = TYPOGRAPHY.SIZE.BASE;
```

## 📱 Social Media Usage

### Twitter/X Bio
```
Playverse — The friendly 3D game creation platform. Create, play, and share your worlds. POWERED BY PLAYVERSE ENGINE #WebGPU #GameDev #OpenSource
```

### GitHub Description
```
Playverse - Open-source WebGPU/TypeScript game platform for browser-based 3D game creation. Create, play, and share. POWERED BY PLAYVERSE ENGINE.
```

### YouTube Video Description
```
Created with Playverse

Playverse — The friendly 3D game creation platform.
Create. Play. Share.
POWERED BY PLAYVERSE ENGINE

🔗 Learn more: https://playverse.gg
💻 GitHub: https://github.com/playverse-gg
```

## 🎬 Video/Screenshot Guidelines

### Always Include Branding
1. **In-Game Watermark:** Bottom-right corner (social watermark)
2. **Video Intro/Outro:** Show Playverse logo/name
3. **Thumbnail:** Include "Playverse" or "PLAYVERSE" text or logo
4. **Open Source Badge:** Consider adding community badge (top-right)

### Best Practices
- Keep watermarks visible but non-intrusive (0.7-0.9 opacity)
- Use consistent positioning (bottom-right for social)
- Include branding in every public asset
- Mention "POWERED BY PLAYVERSE ENGINE" in descriptions

## 🚀 Brand Voice

### Tone
- **Friendly** - Approachable and welcoming
- **Creative** - Inspiring imagination
- **Accessible** - No barriers to entry
- **Playful** - Fun and engaging

### Key Messages
1. **Browser-Native** - No downloads, no installations
2. **Easy to Use** - Anyone can create
3. **WebGPU Powered** - Modern, fast, cutting-edge
4. **Community Driven** - Built together

### Do's and Don'ts

✅ **Do:**
- Use "Playverse" for the platform name
- Use "Playverse Engine" for the engine name
- Use "PLAYVERSE" for short/branding
- Emphasize open-source and community nature
- Highlight browser-native nature
- Use friendly, approachable language
- Celebrate community contributions

❌ **Don't:**
- Use old branding (Forge World, Forge Engine)
- Use harsh or technical jargon unnecessarily
- Downplay capabilities
- Ignore community aspect

## 🎯 Taglines

### Primary
```
Create. Play. Share.
```

### Alternative Taglines
```
The friendly 3D game creation platform
Your imagination, brought to life
Browser-based game creation for everyone
No downloads. No barriers. Just create.
Where creativity comes to play
```

## 📋 Checklist for Public Assets

Before sharing any screenshot, video, or demo:

- [ ] Watermark visible (bottom-right for social media)
- [ ] "POWERED BY PLAYVERSE ENGINE" in description
- [ ] Brand colors used in UI (blue/green, not orange)
- [ ] Link to project/website/GitHub included
- [ ] Consistent branding across all materials
- [ ] Friendly, approachable tone in copy

---

## 🔗 Resources

- **Brand Package:** `@engine/brand`
- **README:** `README.md`
- **Website:** https://playverse.gg (placeholder)
- **GitHub:** https://github.com/playverse-gg (placeholder)
- **Discord:** https://discord.gg/playverse (placeholder)
- **Twitter:** https://twitter.com/playverse_gg (placeholder)

*Note: URLs are placeholders and will be updated when actual services are set up.*

---

**Updated:** 2025-11-XX  
**Version:** 4.0.0  
**Status:** ✅ Fully Implemented (Playverse / Playverse Engine)

**Built with ❤️ by Plaza Entertainment Studio**

**POWERED BY PLAYVERSE ENGINE**

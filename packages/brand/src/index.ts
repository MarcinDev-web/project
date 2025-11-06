/**
 * @engine/brand - Centralized branding and visual identity
 *
 * This package contains all branding constants used across Forge World.
 * Using these constants ensures consistent visual identity in UI, overlays,
 * watermarks, screenshots, and social media content.
 *
 * @example
 * ```typescript
 * import { BRAND, COLORS, TYPOGRAPHY } from '@engine/brand';
 *
 * // In UI components
 * element.style.backgroundColor = COLORS.PRIMARY_BG;
 * element.textContent = BRAND.ENGINE_TAG;
 *
 * // In watermarks
 * overlay.innerHTML = `${BRAND.PLATFORM_NAME} · ${BRAND.VERSION}`;
 * ```
 */

/**
 * Core brand identity - Forge World platform and Forge Engine
 */
export const BRAND = {
  /** Company/Studio name */
  STUDIO_NAME: 'Plaza Entertainment Studio',

  /** Main product name */
  NAME: 'FORGE',

  /** Platform name - Forge World */
  PLATFORM_NAME: 'Forge World',

  /** Engine name - Forge Engine */
  ENGINE_NAME: 'Forge Engine',

  /** Full platform name (display) */
  FULL_NAME: 'Forge World',

  /** Short name / acronym */
  SHORT_NAME: 'FORGE',

  /** Engine name for technical context */
  ENGINE_NAME_UPPER: 'FORGE ENGINE',

  /** Tag line for "powered by" badges */
  ENGINE_TAG: 'POWERED BY FORGE ENGINE',

  /** Alternative shorter tag */
  ENGINE_TAG_SHORT: 'FORGE ENGINE',

  /** Current version (synchronized with root package.json) */
  VERSION: '0.1.0',

  /** Tagline for marketing/pitch */
  TAGLINE: 'Open-source 3D game creation platform built by the community, for the community.',

  /** Alternative tagline (technical) */
  TAGLINE_TECH: 'Create and publish your own 3D games directly in the browser.',

  /** Full pitch (one sentence) */
  PITCH:
    'Forge World — Open-source 3D game creation platform built by the community, for the community. POWERED BY FORGE ENGINE.',

  /** Mission statement */
  MISSION: 'Empowering creators worldwide to build, share, and play 3D games without barriers.',

  /** Website URL (placeholder - update when domain is registered) */
  URL: 'https://forge.worlds',

  /** Community links (placeholders - update with actual URLs when available) */
  GITHUB: 'https://github.com/forge-worlds',
  DISCORD: 'https://discord.gg/forge-worlds',
  TWITTER: 'https://twitter.com/forgeworlds',

  /** Social media handle (placeholder - update with actual handles when available) */
  SOCIAL_HANDLE: '@ForgeWorlds',
} as const;

/**
 * Brand color palette
 *
 * Inspired by forge/metalwork aesthetic:
 * - Steel gray background (anvil and fire metaphor)
 * - Hot orange accent (forge energy)
 * - Technical blue for Forge Engine
 * - Clean contrast with light ash and dark graphite
 */
export const COLORS = {
  /** Primary background - steel gray */
  PRIMARY_BG: '#1B1B1D',

  /** Secondary background - dark graphite */
  SECONDARY_BG: '#0E0E10',

  /** Accent color - forge orange (glowing metal) */
  ACCENT_HOT: '#FF6A00',

  /** Accent hover state - brighter forge glow */
  ACCENT_HOT_HOVER: '#FF8A33',

  /** Technical accent - subtle blue for Forge Engine */
  ACCENT_TECH: '#2E6AFF',

  /** Light accent - ash */
  LIGHT_ASH: '#E1E1E3',

  /** Primary text - pure white */
  TEXT_PRIMARY: '#ffffff',

  /** Secondary text - light ash */
  TEXT_DIM: '#E1E1E3',

  /** Tertiary text - dimmed gray */
  TEXT_MUTED: '#8a8a8a',

  /** Success state - green */
  SUCCESS: '#00c853',

  /** Warning state - amber */
  WARNING: '#ffa726',

  /** Error state - red */
  ERROR: '#ff1744',

  /** Border color - subtle gray */
  BORDER: '#2a2a2c',

  /** Overlay background - semi-transparent steel */
  OVERLAY_BG: 'rgba(27, 27, 29, 0.85)',
} as const;

/**
 * Typography settings
 *
 * Two-tier system:
 * - FORGE WORLD: Geometric, massive fonts (Orbitron, Rajdhani, Exo 2)
 * - PLAZA ENTERTAINMENT: Classic sans-serif (Inter, Satoshi, Neue Haas Grotesk)
 */
export const TYPOGRAPHY = {
  /** Font family stack - Plaza Entertainment (elegant, classic) */
  FONT_STACK: 'Inter, "Neue Haas Grotesk", Satoshi, system-ui, -apple-system, sans-serif',

  /** Font family stack - Forge World (geometric, massive) */
  FONT_FORGE: 'Orbitron, Rajdhani, "Exo 2", "Eurostile", "Michroma", sans-serif',

  /** Monospace font stack (for code/debug) */
  FONT_MONO: '"JetBrains Mono", "Fira Code", Consolas, monospace',

  /** Font sizes */
  SIZE: {
    XS: '10px',
    SM: '12px',
    BASE: '14px',
    MD: '16px',
    LG: '18px',
    XL: '24px',
    XXL: '32px',
    XXXL: '48px',
  },

  /** Font weights */
  WEIGHT: {
    LIGHT: 300,
    REGULAR: 400,
    MEDIUM: 500,
    SEMIBOLD: 600,
    BOLD: 700,
    HEAVY: 800,
  },
} as const;

/**
 * Watermark configurations for different contexts
 */
export const WATERMARKS = {
  /** Top-left corner (editor, debug builds) */
  EDITOR: {
    text: `${BRAND.ENGINE_NAME_UPPER} · DEV BUILD`,
    position: 'top-left' as const,
    style: {
      color: COLORS.TEXT_DIM,
      fontSize: TYPOGRAPHY.SIZE.SM,
      fontFamily: TYPOGRAPHY.FONT_MONO,
      padding: '8px 12px',
      background: COLORS.OVERLAY_BG,
      borderRadius: '0 0 4px 0',
    },
  },

  /** Loading screen */
  LOADING: {
    text: BRAND.ENGINE_TAG,
    position: 'center-bottom' as const,
    style: {
      color: COLORS.ACCENT_HOT,
      fontSize: TYPOGRAPHY.SIZE.LG,
      fontFamily: TYPOGRAPHY.FONT_STACK,
      fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
      padding: '16px',
    },
  },

  /** FPS counter with branding */
  FPS_COUNTER: {
    format: (fps: number) => `${BRAND.ENGINE_NAME_UPPER} · ${fps} FPS`,
    position: 'top-left' as const,
    style: {
      color: COLORS.TEXT_DIM,
      fontSize: TYPOGRAPHY.SIZE.SM,
      fontFamily: TYPOGRAPHY.FONT_MONO,
      padding: '8px 12px',
      background: COLORS.OVERLAY_BG,
      borderRadius: '0 0 4px 0',
    },
  },

  /** Bottom-right corner (screenshots, social media) */
  SOCIAL: {
    text: BRAND.ENGINE_TAG,
    position: 'bottom-right' as const,
    style: {
      color: COLORS.TEXT_PRIMARY,
      fontSize: TYPOGRAPHY.SIZE.BASE,
      fontFamily: TYPOGRAPHY.FONT_STACK,
      fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
      padding: '8px 16px',
      background: COLORS.PRIMARY_BG,
      borderRadius: '4px 0 0 0',
      opacity: '0.9',
    },
  },

  /** Community badge (for open-source emphasis) */
  COMMUNITY: {
    text: `${BRAND.SHORT_NAME} · OPEN SOURCE`,
    position: 'top-right' as const,
    style: {
      color: COLORS.SUCCESS,
      fontSize: TYPOGRAPHY.SIZE.SM,
      fontFamily: TYPOGRAPHY.FONT_MONO,
      padding: '8px 12px',
      background: COLORS.OVERLAY_BG,
      borderRadius: '0 0 0 4px',
      opacity: '0.85',
    },
  },
} as const;

/**
 * UI Component styling utilities
 */
export const UI = {
  /** Border radius values */
  RADIUS: {
    SM: '4px',
    MD: '8px',
    LG: '12px',
    XL: '16px',
    ROUND: '50%',
  },

  /** Spacing scale (8px base) */
  SPACING: {
    XS: '4px',
    SM: '8px',
    MD: '16px',
    LG: '24px',
    XL: '32px',
    XXL: '48px',
  },

  /** Shadow definitions */
  SHADOW: {
    SM: '0 2px 4px rgba(0, 0, 0, 0.1)',
    MD: '0 4px 8px rgba(0, 0, 0, 0.15)',
    LG: '0 8px 16px rgba(0, 0, 0, 0.2)',
    XL: '0 16px 32px rgba(0, 0, 0, 0.3)',
  },

  /** Transition durations */
  TRANSITION: {
    FAST: '150ms',
    BASE: '250ms',
    SLOW: '400ms',
  },
} as const;

/**
 * Export type for type-safe usage
 */
export type BrandColors = typeof COLORS;
export type BrandTypography = typeof TYPOGRAPHY;
export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center-bottom';

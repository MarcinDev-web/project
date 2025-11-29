/**
 * @engine/brand - Centralized branding and visual identity
 *
 * This package contains all branding constants used across Playverse.
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
 * Core brand identity - Playverse platform and Playverse Engine
 */
export const BRAND = {
  /** Company/Studio name */
  STUDIO_NAME: 'Plaza Entertainment Studio',

  /** Main product name */
  NAME: 'PLAYVERSE',

  /** Platform name - Playverse */
  PLATFORM_NAME: 'Playverse',

  /** Engine name - Playverse Engine */
  ENGINE_NAME: 'Playverse Engine',

  /** Full platform name (display) */
  FULL_NAME: 'Playverse',

  /** Short name / acronym */
  SHORT_NAME: 'PLAYVERSE',

  /** Engine name for technical context */
  ENGINE_NAME_UPPER: 'PLAYVERSE ENGINE',

  /** Tag line for "powered by" badges */
  ENGINE_TAG: 'POWERED BY PLAYVERSE ENGINE',

  /** Alternative shorter tag */
  ENGINE_TAG_SHORT: 'PLAYVERSE ENGINE',

  /** Current version (synchronized with root package.json) */
  VERSION: '0.1.0',

  /** Tagline for marketing/pitch */
  TAGLINE: 'Create. Play. Share.',

  /** Alternative tagline (technical) */
  TAGLINE_TECH: 'Create and publish your own 3D games directly in the browser.',

  /** Full pitch (one sentence) */
  PITCH:
    'Playverse — The friendly 3D game creation platform. Create, play, and share your worlds. POWERED BY PLAYVERSE ENGINE.',

  /** Mission statement */
  MISSION: 'Empowering creators worldwide to build, share, and play 3D games without barriers.',

  /** Website URL (placeholder - update when domain is registered) */
  URL: 'https://playverse.gg',

  /** Community links (placeholders - update with actual URLs when available) */
  GITHUB: 'https://github.com/playverse-gg',
  DISCORD: 'https://discord.gg/playverse',
  TWITTER: 'https://twitter.com/playverse_gg',

  /** Social media handle (placeholder - update with actual handles when available) */
  SOCIAL_HANDLE: '@playverse_gg',
} as const;

/**
 * Brand color palette - Playverse Flat Design
 *
 * Modern flat design with blue/green accents:
 * - Slate backgrounds (dark theme)
 * - Blue primary accent (friendly, trustworthy)
 * - Green secondary accent (growth, success)
 * - Cyan highlights (playful, energetic)
 */
export const COLORS = {
  /** Primary background - slate dark */
  PRIMARY_BG: '#0F172A',

  /** Secondary background - slate medium */
  SECONDARY_BG: '#1E293B',

  /** Elevated surface */
  ELEVATED_BG: '#334155',

  /** Accent color - blue (primary) */
  ACCENT_PRIMARY: '#3B82F6',

  /** Accent hover state */
  ACCENT_PRIMARY_HOVER: '#60A5FA',

  /** Accent dark */
  ACCENT_PRIMARY_DARK: '#2563EB',

  /** Secondary accent - green */
  ACCENT_SECONDARY: '#10B981',

  /** Secondary accent hover */
  ACCENT_SECONDARY_HOVER: '#34D399',

  /** Highlight accent - cyan */
  ACCENT_HIGHLIGHT: '#06B6D4',

  /** Primary text - light gray */
  TEXT_PRIMARY: '#F1F5F9',

  /** Secondary text - medium gray */
  TEXT_SECONDARY: '#94A3B8',

  /** Tertiary text - dimmed gray */
  TEXT_MUTED: '#64748B',

  /** Success state - green */
  SUCCESS: '#22C55E',

  /** Warning state - amber */
  WARNING: '#F59E0B',

  /** Error state - red */
  ERROR: '#EF4444',

  /** Info state - blue */
  INFO: '#3B82F6',

  /** Border color - subtle */
  BORDER: 'rgba(148, 163, 184, 0.15)',

  /** Border color - medium */
  BORDER_MEDIUM: 'rgba(148, 163, 184, 0.25)',

  /** Overlay background - semi-transparent */
  OVERLAY_BG: 'rgba(15, 23, 42, 0.85)',

  // Legacy aliases for compatibility
  ACCENT_HOT: '#3B82F6',
  ACCENT_HOT_HOVER: '#60A5FA',
  ACCENT_TECH: '#06B6D4',
  LIGHT_ASH: '#F1F5F9',
  TEXT_DIM: '#94A3B8',
} as const;

/**
 * Typography settings - Playverse Flat Style
 *
 * Friendly, rounded fonts for cartoon/flat aesthetic:
 * - Display: Nunito (headlines, branding)
 * - Body: Inter (content, UI)
 * - Mono: JetBrains Mono (code)
 */
export const TYPOGRAPHY = {
  /** Font family stack - Display (headlines, branding) */
  FONT_DISPLAY: 'Nunito, Poppins, system-ui, -apple-system, sans-serif',

  /** Font family stack - Body (UI, content) */
  FONT_STACK: 'Inter, "DM Sans", system-ui, -apple-system, sans-serif',

  /** Monospace font stack (for code/debug) */
  FONT_MONO: '"JetBrains Mono", "Fira Code", Consolas, monospace',

  // Legacy alias
  FONT_PLAY: 'Nunito, Poppins, system-ui, -apple-system, sans-serif',

  /** Font sizes */
  SIZE: {
    XS: '11px',
    SM: '13px',
    BASE: '14px',
    MD: '15px',
    LG: '16px',
    XL: '18px',
    XXL: '24px',
    XXXL: '32px',
    DISPLAY: '40px',
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
      color: COLORS.TEXT_SECONDARY,
      fontSize: TYPOGRAPHY.SIZE.SM,
      fontFamily: TYPOGRAPHY.FONT_MONO,
      padding: '8px 12px',
      background: COLORS.OVERLAY_BG,
      borderRadius: '0 0 12px 0',
    },
  },

  /** Loading screen */
  LOADING: {
    text: BRAND.ENGINE_TAG,
    position: 'center-bottom' as const,
    style: {
      color: COLORS.ACCENT_PRIMARY,
      fontSize: TYPOGRAPHY.SIZE.LG,
      fontFamily: TYPOGRAPHY.FONT_DISPLAY,
      fontWeight: TYPOGRAPHY.WEIGHT.BOLD,
      padding: '16px',
    },
  },

  /** FPS counter with branding */
  FPS_COUNTER: {
    format: (fps: number) => `${BRAND.ENGINE_NAME_UPPER} · ${fps} FPS`,
    position: 'top-left' as const,
    style: {
      color: COLORS.TEXT_SECONDARY,
      fontSize: TYPOGRAPHY.SIZE.SM,
      fontFamily: TYPOGRAPHY.FONT_MONO,
      padding: '8px 12px',
      background: COLORS.OVERLAY_BG,
      borderRadius: '0 0 12px 0',
    },
  },

  /** Bottom-right corner (screenshots, social media) */
  SOCIAL: {
    text: BRAND.ENGINE_TAG,
    position: 'bottom-right' as const,
    style: {
      color: COLORS.TEXT_PRIMARY,
      fontSize: TYPOGRAPHY.SIZE.BASE,
      fontFamily: TYPOGRAPHY.FONT_DISPLAY,
      fontWeight: TYPOGRAPHY.WEIGHT.SEMIBOLD,
      padding: '8px 16px',
      background: COLORS.PRIMARY_BG,
      borderRadius: '12px 0 0 0',
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
      borderRadius: '0 0 0 12px',
      opacity: '0.85',
    },
  },
} as const;

/**
 * UI Component styling utilities - Flat Design
 */
export const UI = {
  /** Border radius values - More rounded for flat/cartoon style */
  RADIUS: {
    SM: '8px',
    MD: '12px',
    LG: '16px',
    XL: '24px',
    XXL: '32px',
    ROUND: '50%',
    FULL: '9999px',
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

  /** Shadow definitions - Soft, flat style */
  SHADOW: {
    XS: '0 1px 2px rgba(0, 0, 0, 0.1)',
    SM: '0 1px 3px rgba(0, 0, 0, 0.12)',
    MD: '0 4px 6px rgba(0, 0, 0, 0.1)',
    LG: '0 10px 15px rgba(0, 0, 0, 0.12)',
    XL: '0 20px 25px rgba(0, 0, 0, 0.15)',
    GLOW_PRIMARY: '0 0 20px rgba(59, 130, 246, 0.3)',
    GLOW_SECONDARY: '0 0 20px rgba(16, 185, 129, 0.3)',
  },

  /** Transition durations */
  TRANSITION: {
    FASTEST: '100ms',
    FAST: '150ms',
    BASE: '200ms',
    SLOW: '300ms',
    SLOWER: '400ms',
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

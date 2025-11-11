/**
 * Cartoon Texture Palette
 * 
 * Unified color palette for cartoon-style block textures.
 * Provides consistent, bright, saturated colors with controlled brightness variations.
 * 
 * Design principles:
 * - High saturation (0.7-1.0) for vibrant cartoon look
 * - Bright base colors (0.6-1.0 luminance)
 * - Minimal brightness variation between faces (cartoon flat shading)
 * - Consistent hue ranges per material category
 */

import type { RgbaColor } from './BlockLibrary';

/**
 * Cartoon brightness configuration for block faces
 * Cartoon style uses minimal variation for flatter, more stylized look
 */
export interface CartoonBrightness {
  /** Top face brightness (typically brightest) */
  top: number;
  /** Side face brightness (medium) */
  sides: number;
  /** Bottom face brightness (typically darkest) */
  bottom: number;
}

/**
 * Standard cartoon brightness presets
 */
export const CARTOON_BRIGHTNESS: Record<string, CartoonBrightness> = {
  /** Standard blocks - minimal variation for flat cartoon look */
  standard: {
    top: 1.0,
    sides: 0.95,
    bottom: 0.9,
  },
  /** Emissive blocks - brighter overall */
  emissive: {
    top: 1.2,
    sides: 1.15,
    bottom: 1.1,
  },
  /** Natural blocks - slightly more variation for depth */
  natural: {
    top: 1.0,
    sides: 0.92,
    bottom: 0.85,
  },
};

/**
 * Cartoon color palette - bright, saturated colors
 */
export interface CartoonColor {
  /** Base RGBA color (0-1 range) */
  color: RgbaColor;
  /** Recommended pattern for this material */
  pattern: 'solid' | 'grid' | 'noise' | 'bricks' | 'planks' | 'cobble' | 'smooth';
}

/**
 * Cartoon palette colors organized by category
 */
export const CARTOON_PALETTE = {
  /** Basic plastic blocks - bright, saturated primary colors */
  basic: {
    red: {
      color: [0.95, 0.2, 0.2, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    blue: {
      color: [0.2, 0.5, 1.0, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    green: {
      color: [0.2, 0.85, 0.3, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    yellow: {
      color: [1.0, 0.9, 0.2, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    white: {
      color: [0.95, 0.95, 0.95, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
  },

  /** Natural blocks - stylized but recognizable terrain colors */
  natural: {
    grass: {
      color: [0.4, 0.75, 0.3, 1] as RgbaColor,
      pattern: 'noise' as const,
    },
    dirt: {
      color: [0.55, 0.4, 0.3, 1] as RgbaColor,
      pattern: 'noise' as const,
    },
    stone: {
      color: [0.65, 0.65, 0.7, 1] as RgbaColor,
      pattern: 'cobble' as const,
    },
  },

  /** Gameplay blocks - vibrant, eye-catching colors */
  gameplay: {
    light: {
      color: [1.0, 1.0, 1.0, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    glass: {
      color: [0.9, 0.95, 1.0, 0.3] as RgbaColor,
      pattern: 'smooth' as const,
    },
    ice: {
      color: [0.75, 0.9, 1.0, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    slime: {
      color: [0.25, 0.85, 0.35, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    lava: {
      color: [1.0, 0.3, 0.15, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    poison: {
      color: [0.6, 0.35, 0.85, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
    bouncy: {
      color: [1.0, 0.5, 0.75, 1] as RgbaColor,
      pattern: 'smooth' as const,
    },
  },
} as const;

/**
 * Get cartoon color with brightness applied
 */
export function getCartoonFaceTexture(
  paletteColor: CartoonColor,
  brightnessPreset: keyof typeof CARTOON_BRIGHTNESS = 'standard'
): {
  top: { color: RgbaColor; pattern: CartoonColor['pattern']; brightness: number };
  sides: { color: RgbaColor; pattern: CartoonColor['pattern']; brightness: number };
  bottom: { color: RgbaColor; pattern: CartoonColor['pattern']; brightness: number };
} {
  const brightness = CARTOON_BRIGHTNESS[brightnessPreset];
  
  return {
    top: {
      color: paletteColor.color,
      pattern: paletteColor.pattern,
      brightness: brightness.top,
    },
    sides: {
      color: paletteColor.color,
      pattern: paletteColor.pattern,
      brightness: brightness.sides,
    },
    bottom: {
      color: paletteColor.color,
      pattern: paletteColor.pattern,
      brightness: brightness.bottom,
    },
  };
}

/**
 * Color guidelines for maintaining cartoon consistency:
 * 
 * Hue ranges:
 * - Red: 0-15° or 345-360° (warm reds)
 * - Orange/Yellow: 15-60° (warm yellows)
 * - Green: 100-150° (vibrant greens)
 * - Blue: 200-240° (bright blues)
 * - Purple: 270-300° (vibrant purples)
 * 
 * Saturation:
 * - Basic blocks: 0.8-1.0 (high saturation)
 * - Natural blocks: 0.6-0.8 (moderate saturation)
 * - Gameplay blocks: 0.7-1.0 (high saturation)
 * 
 * Lightness:
 * - Base colors: 0.6-0.9 (bright but not washed out)
 * - Dark accents: 0.3-0.5 (for contrast)
 * - Light accents: 0.9-1.0 (for highlights)
 */


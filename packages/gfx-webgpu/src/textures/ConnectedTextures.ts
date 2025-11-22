/**
 * Connected Textures System (CTM)
 *
 * Inspired by Connected Textures Mod
 * Allows blocks to have different textures based on neighboring blocks
 *
 * Features:
 * - Horizontal connection (left-right)
 * - Vertical connection (top-bottom)
 * - Full cross connection (all 4 sides)
 * - Pillar connection (top-bottom with caps)
 * - Random variation
 */

import type { Vec3 } from '@engine/core/math';
import type { CTMConfig, CTMPattern } from '@engine/blocks';

export type { CTMConfig, CTMPattern } from '@engine/blocks';

export type CTMFace = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west';

export interface CTMNeighbors {
  top: boolean;
  bottom: boolean;
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

export interface CTMTextureIndex {
  /** Texture variant index (0-based) */
  index: number;
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Should flip horizontally? */
  flipX: boolean;
  /** Should flip vertically? */
  flipY: boolean;
}

/**
 * Connected Texture Manager
 *
 * Determines which texture variant to use based on neighbors
 */
export class ConnectedTextureSystem {
  /**
   * Get texture index for a block face based on neighbors
   */
  public static getTextureIndex(
    face: CTMFace,
    neighbors: CTMNeighbors,
    config: CTMConfig
  ): CTMTextureIndex {
    switch (config.pattern) {
      case 'none':
        return { index: 0, rotation: 0, flipX: false, flipY: false };

      case 'horizontal':
        return this.getHorizontalIndex(face, neighbors);

      case 'vertical':
        return this.getVerticalIndex(neighbors);

      case 'cross':
        return this.getCrossIndex(face, neighbors);

      case 'pillar':
        return this.getPillarIndex(face, neighbors);

      case 'random':
        return this.getRandomIndex(config.randomVariants || 4);

      default:
        return { index: 0, rotation: 0, flipX: false, flipY: false };
    }
  }

  /**
   * Horizontal connection (3 textures: left, middle, right)
   */
  private static getHorizontalIndex(face: CTMFace, neighbors: CTMNeighbors): CTMTextureIndex {
    // Only apply to vertical faces (not top/bottom)
    if (face === 'top' || face === 'bottom') {
      return { index: 1, rotation: 0, flipX: false, flipY: false }; // Middle
    }

    const hasLeft = this.hasNeighborLeft(face, neighbors);
    const hasRight = this.hasNeighborRight(face, neighbors);

    if (!hasLeft && !hasRight) {
      // Single block
      return { index: 1, rotation: 0, flipX: false, flipY: false }; // Middle
    } else if (hasLeft && hasRight) {
      // Middle of chain
      return { index: 1, rotation: 0, flipX: false, flipY: false }; // Middle
    } else if (hasLeft && !hasRight) {
      // Right end
      return { index: 2, rotation: 0, flipX: false, flipY: false }; // Right
    } else {
      // Left end (!hasLeft && hasRight)
      return { index: 0, rotation: 0, flipX: false, flipY: false }; // Left
    }
  }

  /**
   * Vertical connection (3 textures: bottom, middle, top)
   */
  private static getVerticalIndex(neighbors: CTMNeighbors): CTMTextureIndex {
    const hasTop = neighbors.top;
    const hasBottom = neighbors.bottom;

    if (!hasTop && !hasBottom) {
      // Single block
      return { index: 1, rotation: 0, flipX: false, flipY: false }; // Middle
    } else if (hasTop && hasBottom) {
      // Middle of stack
      return { index: 1, rotation: 0, flipX: false, flipY: false }; // Middle
    } else if (hasTop && !hasBottom) {
      // Bottom of stack
      return { index: 0, rotation: 0, flipX: false, flipY: false }; // Bottom
    } else {
      // Top of stack (!hasTop && hasBottom)
      return { index: 2, rotation: 0, flipX: false, flipY: false }; // Top
    }
  }

  /**
   * Cross connection (16 textures for all combinations)
   * Uses CTM format
   */
  private static getCrossIndex(face: CTMFace, neighbors: CTMNeighbors): CTMTextureIndex {
    // For simplicity, map to 4-way connection (simplified CTM)
    const hasTop = neighbors.top;
    const hasBottom = neighbors.bottom;
    const hasLeft = this.hasNeighborLeft(face, neighbors);
    const hasRight = this.hasNeighborRight(face, neighbors);

    // Calculate index based on binary pattern
    // Bit 0: top, Bit 1: right, Bit 2: bottom, Bit 3: left
    const index = (hasTop ? 1 : 0) | (hasRight ? 2 : 0) | (hasBottom ? 4 : 0) | (hasLeft ? 8 : 0);

    return { index, rotation: 0, flipX: false, flipY: false };
  }

  /**
   * Pillar connection (top cap, middle, bottom cap)
   */
  private static getPillarIndex(face: CTMFace, neighbors: CTMNeighbors): CTMTextureIndex {
    const hasTop = neighbors.top;
    const hasBottom = neighbors.bottom;

    if (face === 'top') {
      // Top face of block
      if (hasTop) {
        return { index: 3, rotation: 0, flipX: false, flipY: false }; // Connected top
      } else {
        return { index: 2, rotation: 0, flipX: false, flipY: false }; // Cap top
      }
    } else if (face === 'bottom') {
      // Bottom face of block
      if (hasBottom) {
        return { index: 3, rotation: 0, flipX: false, flipY: false }; // Connected bottom
      } else {
        return { index: 0, rotation: 0, flipX: false, flipY: false }; // Cap bottom
      }
    } else {
      // Side faces
      if (hasTop && hasBottom) {
        return { index: 1, rotation: 0, flipX: false, flipY: false }; // Middle
      } else if (!hasTop && hasBottom) {
        return { index: 2, rotation: 0, flipX: false, flipY: false }; // Top cap
      } else if (hasTop && !hasBottom) {
        return { index: 0, rotation: 0, flipX: false, flipY: false }; // Bottom cap
      } else {
        return { index: 1, rotation: 0, flipX: false, flipY: false }; // Single
      }
    }
  }

  /**
   * Random variation (for natural blocks like stone, dirt)
   */
  private static getRandomIndex(variants: number): CTMTextureIndex {
    // Use position-based hash for consistent randomness
    // This ensures same position always gets same variant
    const index = Math.floor(Math.random() * variants);
    return { index, rotation: 0, flipX: false, flipY: false };
  }

  /**
   * Get deterministic random index based on position
   */
  public static getRandomIndexByPosition(position: Vec3, variants: number): CTMTextureIndex {
    // Simple hash based on position
    const hash =
      (Math.abs(position[0] * 374761393) +
        Math.abs(position[1] * 668265263) +
        Math.abs(position[2] * 2147483647)) >>>
      0; // Convert to unsigned 32-bit int

    const index = hash % variants;
    return { index, rotation: 0, flipX: false, flipY: false };
  }

  /**
   * Check if there's a neighbor to the left (relative to face direction)
   */
  private static hasNeighborLeft(face: CTMFace, neighbors: CTMNeighbors): boolean {
    switch (face) {
      case 'north':
        return neighbors.west;
      case 'south':
        return neighbors.east;
      case 'east':
        return neighbors.north;
      case 'west':
        return neighbors.south;
      default:
        return false;
    }
  }

  /**
   * Check if there's a neighbor to the right (relative to face direction)
   */
  private static hasNeighborRight(face: CTMFace, neighbors: CTMNeighbors): boolean {
    switch (face) {
      case 'north':
        return neighbors.east;
      case 'south':
        return neighbors.west;
      case 'east':
        return neighbors.south;
      case 'west':
        return neighbors.north;
      default:
        return false;
    }
  }

  /**
   * Get neighbor blocks from scene
   */
  public static getNeighbors(
    position: Vec3,
    scene: { getBlockAt: (pos: Vec3) => { type: string; category?: string } | null }
  ): CTMNeighbors {
    const [x, y, z] = position;

    return {
      top: !!scene.getBlockAt([x, y + 1, z]),
      bottom: !!scene.getBlockAt([x, y - 1, z]),
      north: !!scene.getBlockAt([x, y, z + 1]),
      south: !!scene.getBlockAt([x, y, z - 1]),
      east: !!scene.getBlockAt([x + 1, y, z]),
      west: !!scene.getBlockAt([x - 1, y, z]),
    };
  }

  /**
   * Check if two blocks should connect
   */
  public static shouldConnect(
    blockA: { type: string; category?: string },
    blockB: { type: string; category?: string },
    config: CTMConfig
  ): boolean {
    if (config.matchSameType) {
      return blockA.type === blockB.type;
    }

    if (config.matchCategory && blockA.category && blockB.category) {
      return blockA.category === blockB.category;
    }

    return true; // Connect to everything
  }
}

/**
 * CTM Texture Set
 * Defines multiple texture variants for connected textures
 */
export interface CTMTextureSet {
  /** Pattern type */
  pattern: CTMPattern;
  /** Texture URLs or data for each variant */
  textures: string[];
  /** Configuration */
  config: CTMConfig;
}

/**
 * Example CTM configurations
 */
export const CTM_PRESETS: Record<string, CTMConfig> = {
  // Glass blocks connect to each other
  glass: {
    pattern: 'cross',
    matchSameType: true,
    matchCategory: false,
  },

  // Bricks only connect horizontally
  bricks: {
    pattern: 'horizontal',
    matchSameType: true,
    matchCategory: false,
  },

  // Wood planks connect horizontally
  planks: {
    pattern: 'horizontal',
    matchSameType: false,
    matchCategory: true, // All wood types connect
  },

  // Stone has random variation
  stone: {
    pattern: 'random',
    matchSameType: false,
    matchCategory: false,
    randomVariants: 4,
  },

  // Pillars connect vertically with caps
  pillar: {
    pattern: 'pillar',
    matchSameType: true,
    matchCategory: false,
  },

  // Metal blocks connect in all directions
  metal: {
    pattern: 'cross',
    matchSameType: false,
    matchCategory: true,
  },
};

/**
 * Helper to generate CTM texture coordinates
 */
export class CTMTextureMapper {
  /**
   * Get UV coordinates for a CTM texture index
   * Assumes textures are in a grid (e.g., 4x4 for cross pattern)
   */
  public static getUVs(
    textureIndex: CTMTextureIndex,
    gridWidth: number,
    gridHeight: number
  ): { u: number; v: number; uWidth: number; vHeight: number } {
    const col = textureIndex.index % gridWidth;
    const row = Math.floor(textureIndex.index / gridWidth);

    let uWidth = 1 / gridWidth;
    let vHeight = 1 / gridHeight;

    let u = col * uWidth;
    let v = row * vHeight;

    // Apply rotation (rotate UV coordinates)
    // This is a simplified version - full implementation would need matrix rotation

    // Apply flips
    if (textureIndex.flipX) {
      u += uWidth;
      uWidth *= -1;
    }

    if (textureIndex.flipY) {
      v += vHeight;
      vHeight *= -1;
    }

    return { u, v, uWidth, vHeight };
  }

  /**
   * Get texture atlas index for cross pattern (4x4 grid)
   */
  public static getCrossAtlasIndex(neighbors: CTMNeighbors): number {
    // CTM format mapping
    const hasTop = neighbors.top;
    const hasBottom = neighbors.bottom;
    const hasLeft = neighbors.west; // Assuming west is left
    const hasRight = neighbors.east; // Assuming east is right

    // Map to 16 possible combinations
    return (hasTop ? 1 : 0) | (hasRight ? 2 : 0) | (hasBottom ? 4 : 0) | (hasLeft ? 8 : 0);
  }
}

/**
 * CTM Debug Visualizer
 */
export class CTMDebugger {
  /**
   * Get visual representation of neighbor state
   */
  public static visualizeNeighbors(neighbors: CTMNeighbors): string {
    return `
    ${neighbors.top ? '▲' : '○'}
  ${neighbors.west ? '◄' : '○'} █ ${neighbors.east ? '►' : '○'}
    ${neighbors.bottom ? '▼' : '○'}
  N:${neighbors.north ? '✓' : '✗'} S:${neighbors.south ? '✓' : '✗'}
    `;
  }

  /**
   * Get description of texture index
   */
  public static describeTextureIndex(index: CTMTextureIndex, pattern: CTMPattern): string {
    const parts: string[] = [];

    parts.push(`Index: ${index.index}`);

    if (index.rotation !== 0) {
      parts.push(`Rotation: ${index.rotation}°`);
    }

    if (index.flipX) {
      parts.push('FlipX');
    }

    if (index.flipY) {
      parts.push('FlipY');
    }

    parts.push(`Pattern: ${pattern}`);

    return parts.join(', ');
  }
}

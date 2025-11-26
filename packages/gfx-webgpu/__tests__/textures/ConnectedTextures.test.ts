/**
 * Tests for Connected Textures System
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Mock WebGPU constants that aren't available in test environment
beforeAll(() => {
  (globalThis as any).GPUTextureUsage = {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
  (globalThis as any).GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };
  (globalThis as any).GPUShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
  };
  (globalThis as any).GPUColorWrite = {
    RED: 0x1,
    GREEN: 0x2,
    BLUE: 0x4,
    ALPHA: 0x8,
    ALL: 0xF,
  };
  (globalThis as any).GPUMapMode = {
    READ: 0x0001,
    WRITE: 0x0002,
  };
});

import {
  ConnectedTextureSystem,
  CTMTextureMapper,
  CTMDebugger,
  type CTMNeighbors,
  type CTMConfig,
  CTM_PRESETS,
} from '../../src/textures/ConnectedTextures';

describe('ConnectedTextureSystem', () => {
  describe('Horizontal Pattern', () => {
    const config: CTMConfig = {
      pattern: 'horizontal',
      matchSameType: true,
      matchCategory: false,
    };

    it('should return middle texture for isolated block', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(1); // Middle
    });

    it('should return left texture for left end', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: true,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(0); // Left
    });

    it('should return right texture for right end', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: true,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(2); // Right
    });

    it('should return middle texture for middle of chain', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: true,
        west: true,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(1); // Middle
    });

    it('should use middle texture for top/bottom faces', () => {
      const neighbors: CTMNeighbors = {
        top: true,
        bottom: true,
        north: true,
        south: true,
        east: true,
        west: true,
      };

      const topResult = ConnectedTextureSystem.getTextureIndex('top', neighbors, config);
      expect(topResult.index).toBe(1);

      const bottomResult = ConnectedTextureSystem.getTextureIndex('bottom', neighbors, config);
      expect(bottomResult.index).toBe(1);
    });
  });

  describe('Vertical Pattern', () => {
    const config: CTMConfig = {
      pattern: 'vertical',
      matchSameType: true,
      matchCategory: false,
    };

    it('should return middle texture for isolated block', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(1); // Middle
    });

    it('should return bottom texture for bottom of stack', () => {
      const neighbors: CTMNeighbors = {
        top: true,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(0); // Bottom
    });

    it('should return top texture for top of stack', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: true,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(2); // Top
    });

    it('should return middle texture for middle of stack', () => {
      const neighbors: CTMNeighbors = {
        top: true,
        bottom: true,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(1); // Middle
    });
  });

  describe('Cross Pattern', () => {
    const config: CTMConfig = {
      pattern: 'cross',
      matchSameType: true,
      matchCategory: false,
    };

    it('should return 0 for no neighbors', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(0);
    });

    it('should return correct index for all neighbors', () => {
      const neighbors: CTMNeighbors = {
        top: true,
        bottom: true,
        north: false,
        south: false,
        east: true,
        west: true,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      // Binary: top(1) | right(2) | bottom(4) | left(8) = 1+2+4+8 = 15
      expect(result.index).toBe(15);
    });

    it('should calculate different indices for different neighbor combinations', () => {
      // Top only
      const topOnly: CTMNeighbors = {
        top: true,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };
      const topResult = ConnectedTextureSystem.getTextureIndex('north', topOnly, config);
      expect(topResult.index).toBe(1);

      // Right only (east for north face)
      const rightOnly: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: true,
        west: false,
      };
      const rightResult = ConnectedTextureSystem.getTextureIndex('north', rightOnly, config);
      expect(rightResult.index).toBe(2);

      // Top + Right
      const topRight: CTMNeighbors = {
        top: true,
        bottom: false,
        north: false,
        south: false,
        east: true,
        west: false,
      };
      const topRightResult = ConnectedTextureSystem.getTextureIndex('north', topRight, config);
      expect(topRightResult.index).toBe(3); // 1 + 2
    });
  });

  describe('Pillar Pattern', () => {
    const config: CTMConfig = {
      pattern: 'pillar',
      matchSameType: true,
      matchCategory: false,
    };

    it('should use bottom cap for bottom face without neighbor', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('bottom', neighbors, config);
      expect(result.index).toBe(0); // Bottom cap
    });

    it('should use top cap for top face without neighbor', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('top', neighbors, config);
      expect(result.index).toBe(2); // Top cap
    });

    it('should use connected texture for top face with neighbor above', () => {
      const neighbors: CTMNeighbors = {
        top: true,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('top', neighbors, config);
      expect(result.index).toBe(3); // Connected
    });

    it('should use middle texture for sides in middle of pillar', () => {
      const neighbors: CTMNeighbors = {
        top: true,
        bottom: true,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(1); // Middle
    });
  });

  describe('Random Pattern', () => {
    const config: CTMConfig = {
      pattern: 'random',
      matchSameType: false,
      matchCategory: false,
      randomVariants: 4,
    };

    it('should return random index within range', () => {
      const neighbors: CTMNeighbors = {
        top: false,
        bottom: false,
        north: false,
        south: false,
        east: false,
        west: false,
      };

      // Test multiple times to check range
      for (let i = 0; i < 10; i++) {
        const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
        expect(result.index).toBeGreaterThanOrEqual(0);
        expect(result.index).toBeLessThan(4);
      }
    });

    it('should return consistent random index by position', () => {
      const pos1: [number, number, number] = [5, 10, 15];
      const pos2: [number, number, number] = [5, 10, 15];
      const pos3: [number, number, number] = [6, 10, 15];

      const result1 = ConnectedTextureSystem.getRandomIndexByPosition(pos1, 4);
      const result2 = ConnectedTextureSystem.getRandomIndexByPosition(pos2, 4);
      const result3 = ConnectedTextureSystem.getRandomIndexByPosition(pos3, 4);

      // Same position should return same index
      expect(result1.index).toBe(result2.index);

      // Different positions likely return different indices (not guaranteed but very likely)
      expect(result1.index).toBeGreaterThanOrEqual(0);
      expect(result1.index).toBeLessThan(4);
      expect(result3.index).toBeGreaterThanOrEqual(0);
      expect(result3.index).toBeLessThan(4);
    });
  });

  describe('None Pattern', () => {
    const config: CTMConfig = {
      pattern: 'none',
      matchSameType: true,
      matchCategory: false,
    };

    it('should always return index 0', () => {
      const neighbors: CTMNeighbors = {
        top: true,
        bottom: true,
        north: true,
        south: true,
        east: true,
        west: true,
      };

      const result = ConnectedTextureSystem.getTextureIndex('north', neighbors, config);
      expect(result.index).toBe(0);
      expect(result.rotation).toBe(0);
      expect(result.flipX).toBe(false);
      expect(result.flipY).toBe(false);
    });
  });

  describe('shouldConnect', () => {
    const config: CTMConfig = {
      pattern: 'horizontal',
      matchSameType: true,
      matchCategory: false,
    };

    it('should connect when matchSameType and types match', () => {
      const blockA = { type: 'glass', category: 'glass' };
      const blockB = { type: 'glass', category: 'glass' };

      expect(ConnectedTextureSystem.shouldConnect(blockA, blockB, config)).toBe(true);
    });

    it('should not connect when matchSameType and types differ', () => {
      const blockA = { type: 'glass', category: 'glass' };
      const blockB = { type: 'stone', category: 'natural' };

      expect(ConnectedTextureSystem.shouldConnect(blockA, blockB, config)).toBe(false);
    });

    it('should connect when matchCategory and categories match', () => {
      const config: CTMConfig = {
        pattern: 'horizontal',
        matchSameType: false,
        matchCategory: true,
      };

      const blockA = { type: 'oak_wood', category: 'wood' };
      const blockB = { type: 'birch_wood', category: 'wood' };

      expect(ConnectedTextureSystem.shouldConnect(blockA, blockB, config)).toBe(true);
    });

    it('should connect to everything when no matching rules', () => {
      const config: CTMConfig = {
        pattern: 'horizontal',
        matchSameType: false,
        matchCategory: false,
      };

      const blockA = { type: 'glass', category: 'glass' };
      const blockB = { type: 'stone', category: 'natural' };

      expect(ConnectedTextureSystem.shouldConnect(blockA, blockB, config)).toBe(true);
    });
  });

  describe('CTM Presets', () => {
    it('should have glass preset with cross pattern', () => {
      const glass = CTM_PRESETS.glass!;
      expect(glass).toBeDefined();
      expect(glass.pattern).toBe('cross');
      expect(glass.matchSameType).toBe(true);
    });

    it('should have bricks preset with horizontal pattern', () => {
      const bricks = CTM_PRESETS.bricks!;
      expect(bricks).toBeDefined();
      expect(bricks.pattern).toBe('horizontal');
      expect(bricks.matchSameType).toBe(true);
    });

    it('should have planks preset with category matching', () => {
      const planks = CTM_PRESETS.planks!;
      expect(planks).toBeDefined();
      expect(planks.pattern).toBe('horizontal');
      expect(planks.matchCategory).toBe(true);
    });

    it('should have stone preset with random pattern', () => {
      const stone = CTM_PRESETS.stone!;
      expect(stone).toBeDefined();
      expect(stone.pattern).toBe('random');
      expect(stone.randomVariants).toBe(4);
    });

    it('should have pillar preset', () => {
      const pillar = CTM_PRESETS.pillar!;
      expect(pillar).toBeDefined();
      expect(pillar.pattern).toBe('pillar');
    });

    it('should have metal preset', () => {
      const metal = CTM_PRESETS.metal!;
      expect(metal).toBeDefined();
      expect(metal.pattern).toBe('cross');
      expect(metal.matchCategory).toBe(true);
    });
  });
});

describe('CTMTextureMapper', () => {
  it('should calculate UVs for 4x4 grid', () => {
    const textureIndex = { index: 0, rotation: 0, flipX: false, flipY: false };
    const uvs = CTMTextureMapper.getUVs(textureIndex, 4, 4);

    expect(uvs.u).toBe(0);
    expect(uvs.v).toBe(0);
    expect(uvs.uWidth).toBe(0.25);
    expect(uvs.vHeight).toBe(0.25);
  });

  it('should calculate UVs for different positions in grid', () => {
    // Index 5 in 4x4 grid = column 1, row 1
    const textureIndex = { index: 5, rotation: 0, flipX: false, flipY: false };
    const uvs = CTMTextureMapper.getUVs(textureIndex, 4, 4);

    expect(uvs.u).toBe(0.25);
    expect(uvs.v).toBe(0.25);
    expect(uvs.uWidth).toBe(0.25);
    expect(uvs.vHeight).toBe(0.25);
  });

  it('should handle horizontal flip', () => {
    const textureIndex = { index: 0, rotation: 0, flipX: true, flipY: false };
    const uvs = CTMTextureMapper.getUVs(textureIndex, 4, 4);

    expect(uvs.uWidth).toBe(-0.25); // Negative width for flip
  });

  it('should handle vertical flip', () => {
    const textureIndex = { index: 0, rotation: 0, flipX: false, flipY: true };
    const uvs = CTMTextureMapper.getUVs(textureIndex, 4, 4);

    expect(uvs.vHeight).toBe(-0.25); // Negative height for flip
  });

  it('should get cross atlas index correctly', () => {
    const neighbors: CTMNeighbors = {
      top: true,
      bottom: false,
      north: false,
      south: false,
      east: true,
      west: false,
    };

    const index = CTMTextureMapper.getCrossAtlasIndex(neighbors);
    // Binary: top(1) | right(2) = 3
    expect(index).toBe(3);
  });
});

describe('CTMDebugger', () => {
  it('should visualize neighbors', () => {
    const neighbors: CTMNeighbors = {
      top: true,
      bottom: false,
      north: true,
      south: false,
      east: true,
      west: false,
    };

    const visualization = CTMDebugger.visualizeNeighbors(neighbors);
    expect(visualization).toContain('▲'); // Has top
    expect(visualization).toContain('○'); // Missing bottom
    expect(visualization).toContain('►'); // Has east
    expect(visualization).toContain('○'); // Missing west
    expect(visualization).toContain('N:✓'); // Has north
    expect(visualization).toContain('S:✗'); // Missing south
  });

  it('should describe texture index', () => {
    const textureIndex = { index: 5, rotation: 90, flipX: true, flipY: false };
    const description = CTMDebugger.describeTextureIndex(textureIndex, 'horizontal');

    expect(description).toContain('Index: 5');
    expect(description).toContain('Rotation: 90°');
    expect(description).toContain('FlipX');
    expect(description).toContain('Pattern: horizontal');
  });

  it('should describe simple texture index', () => {
    const textureIndex = { index: 0, rotation: 0, flipX: false, flipY: false };
    const description = CTMDebugger.describeTextureIndex(textureIndex, 'none');

    expect(description).toContain('Index: 0');
    expect(description).toContain('Pattern: none');
    expect(description).not.toContain('Rotation');
    expect(description).not.toContain('Flip');
  });
});

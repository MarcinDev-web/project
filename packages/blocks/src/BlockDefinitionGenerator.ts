/**
 * BlockDefinitionGenerator - Converts micro blocks to BlockDefinition
 * 
 * Analyzes micro block structures and generates BlockDefinition with
 * textures extracted from materials and properties determined from content.
 */

import type { MicroBlockStore } from '@engine/microblocks';
import type { BlockDefinition, BlockTextures, RgbaColor } from './BlockLibrary';
import type { BlockDefinitionConfig } from './ModelBuilderTypes';
import { getBlock, BLOCK_LIBRARY } from './BlockLibrary';
import { getCartoonFaceTexture, CARTOON_BRIGHTNESS } from './palette';

/**
 * Generates BlockDefinition from micro blocks
 */
export class BlockDefinitionGenerator {
  /**
   * Generates BlockDefinition from MicroBlockStore
   */
  generateFromMicroBlocks(
    store: MicroBlockStore,
    config: BlockDefinitionConfig
  ): BlockDefinition {
    const textures = this.generateTextures(store);
    const properties = this.determineProperties(store, config);

    return {
      id: config.id,
      name: config.name,
      category: config.category,
      material: config.material,
      textures,
      properties: {
        solid: properties.solid ?? true,
        transparent: properties.transparent ?? false,
        emissive: properties.emissive ?? 0,
        roughness: properties.roughness ?? 0.3,
        metallic: properties.metallic ?? 0,
      },
      behavior: properties.behavior,
    };
  }

  /**
   * Generates textures by analyzing materials used in micro blocks
   */
  generateTextures(store: MicroBlockStore): BlockTextures {
    const materialColors = this.extractMaterialColors(store);
    
    // Average colors for each face
    const topColor = this.averageColors(materialColors.top);
    const sidesColor = this.averageColors(materialColors.sides);
    const bottomColor = this.averageColors(materialColors.bottom);

    // Determine pattern based on material diversity
    const pattern = this.determinePattern(materialColors);

    // Use standard brightness preset
    const brightness = CARTOON_BRIGHTNESS.standard;

    return {
      top: {
        color: topColor || [0.8, 0.8, 0.8, 1] as RgbaColor,
        pattern,
        brightness: brightness.top,
      },
      sides: {
        color: sidesColor || [0.8, 0.8, 0.8, 1] as RgbaColor,
        pattern,
        brightness: brightness.sides,
      },
      bottom: {
        color: bottomColor || [0.8, 0.8, 0.8, 1] as RgbaColor,
        pattern,
        brightness: brightness.bottom,
      },
    };
  }

  /**
   * Extracts material colors from micro blocks, organized by face direction
   */
  private extractMaterialColors(store: MicroBlockStore): {
    top: RgbaColor[];
    sides: RgbaColor[];
    bottom: RgbaColor[];
  } {
    const topColors: RgbaColor[] = [];
    const sidesColors: RgbaColor[] = [];
    const bottomColors: RgbaColor[] = [];

    const chunks = store.getAllChunks();
    const blockSize = store.blockSize;
    const chunkSize = store.chunkSize;

    for (const chunk of chunks) {
      // Calculate chunk world bounds
      const chunkWorldMinX = chunk.coord[0] * blockSize * chunkSize;
      const chunkWorldMinY = chunk.coord[1] * blockSize * chunkSize;
      const chunkWorldMinZ = chunk.coord[2] * blockSize * chunkSize;

      // Iterate through all positions in chunk
      for (let x = 0; x < chunkSize; x++) {
        for (let y = 0; y < chunkSize; y++) {
          for (let z = 0; z < chunkSize; z++) {
            // Use center of block to avoid floating point precision issues at boundaries
            const halfBlock = blockSize * 0.5;
            const worldPos: [number, number, number] = [
              chunkWorldMinX + x * blockSize + halfBlock,
              chunkWorldMinY + y * blockSize + halfBlock,
              chunkWorldMinZ + z * blockSize + halfBlock,
            ];

            const block = store.getBlock(worldPos);
            if (!block) continue;

            // Get material color from BlockLibrary
            const materialBlock = getBlock(block.materialId);
            if (!materialBlock) continue;

            const color = this.getMaterialColor(materialBlock);

            // Determine which faces are visible (simplified: check neighbors)
            const hasTop = !this.hasBlockAt(store, [worldPos[0], worldPos[1] + blockSize, worldPos[2]]);
            const hasBottom = !this.hasBlockAt(store, [worldPos[0], worldPos[1] - blockSize, worldPos[2]]);
            const hasSide = !this.hasBlockAt(store, [
              worldPos[0] + blockSize,
              worldPos[1],
              worldPos[2],
            ]) || !this.hasBlockAt(store, [worldPos[0] - blockSize, worldPos[1], worldPos[2]]) ||
              !this.hasBlockAt(store, [worldPos[0], worldPos[1], worldPos[2] + blockSize]) ||
              !this.hasBlockAt(store, [worldPos[0], worldPos[1], worldPos[2] - blockSize]);

            if (hasTop) topColors.push(color);
            if (hasBottom) bottomColors.push(color);
            if (hasSide) sidesColors.push(color);
          }
        }
      }
    }

    return {
      top: topColors,
      sides: sidesColors,
      bottom: bottomColors,
    };
  }

  /**
   * Checks if there's a block at world position
   */
  private hasBlockAt(store: MicroBlockStore, worldPos: [number, number, number]): boolean {
    return store.getBlock(worldPos) !== null;
  }

  /**
   * Gets material color from BlockDefinition
   */
  private getMaterialColor(block: BlockDefinition): RgbaColor {
    // Use top face color as representative
    return block.textures.top.color;
  }

  /**
   * Averages an array of colors
   */
  private averageColors(colors: RgbaColor[]): RgbaColor | null {
    if (colors.length === 0) return null;

    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;

    for (const color of colors) {
      r += color[0];
      g += color[1];
      b += color[2];
      a += color[3];
    }

    const count = colors.length;
    return [r / count, g / count, b / count, a / count] as RgbaColor;
  }

  /**
   * Determines texture pattern based on material diversity
   */
  private determinePattern(materialColors: {
    top: RgbaColor[];
    sides: RgbaColor[];
    bottom: RgbaColor[];
  }): 'solid' | 'grid' | 'noise' | 'bricks' | 'planks' | 'cobble' | 'smooth' {
    // Simple heuristic: if many different materials, use noise pattern
    // Otherwise use smooth
    const totalMaterials = materialColors.top.length + materialColors.sides.length + materialColors.bottom.length;
    
    if (totalMaterials > 100) {
      return 'noise';
    }
    
    return 'smooth';
  }

  /**
   * Determines block properties from micro blocks
   */
  determineProperties(
    store: MicroBlockStore,
    config: BlockDefinitionConfig
  ): {
    solid?: boolean;
    transparent?: boolean;
    emissive?: number;
    roughness?: number;
    metallic?: number;
    behavior?: BlockDefinition['behavior'];
  } {
    const chunks = store.getAllChunks();
    if (chunks.length === 0) {
      return {
        solid: true,
        transparent: false,
        emissive: 0,
        roughness: 0.3,
        metallic: 0,
      };
    }

    // Analyze materials used
    const materialIds = new Set<string>();
    const chunksList = store.getAllChunks();
    const blockSize = store.blockSize;
    const chunkSize = store.chunkSize;

    for (const chunk of chunksList) {
      const chunkWorldMinX = chunk.coord[0] * blockSize * chunkSize;
      const chunkWorldMinY = chunk.coord[1] * blockSize * chunkSize;
      const chunkWorldMinZ = chunk.coord[2] * blockSize * chunkSize;

      for (let x = 0; x < chunkSize; x++) {
        for (let y = 0; y < chunkSize; y++) {
          for (let z = 0; z < chunkSize; z++) {
            // Use center of block to avoid floating point precision issues at boundaries
            const halfBlock = blockSize * 0.5;
            const worldPos: [number, number, number] = [
              chunkWorldMinX + x * blockSize + halfBlock,
              chunkWorldMinY + y * blockSize + halfBlock,
              chunkWorldMinZ + z * blockSize + halfBlock,
            ];

            const block = store.getBlock(worldPos);
            if (block) {
              materialIds.add(block.materialId);
            }
          }
        }
      }
    }

    // Determine properties based on materials
    let transparent = false;
    let emissive = 0;
    let roughness = 0.3;
    let metallic = 0;
    let behavior: BlockDefinition['behavior'] | undefined;

    for (const materialId of materialIds) {
      const materialBlock = getBlock(materialId);
      if (materialBlock) {
        if (materialBlock.properties.transparent) {
          transparent = true;
        }
        emissive = Math.max(emissive, materialBlock.properties.emissive);
        roughness = Math.max(roughness, materialBlock.properties.roughness);
        metallic = Math.max(metallic, materialBlock.properties.metallic);
        
        if (materialBlock.behavior && !behavior) {
          behavior = { ...materialBlock.behavior };
        }
      }
    }

    // Override with config if provided
    return {
      solid: config.properties?.solid ?? true,
      transparent: config.properties?.transparent ?? transparent,
      emissive: config.properties?.emissive ?? emissive,
      roughness: config.properties?.roughness ?? roughness,
      metallic: config.properties?.metallic ?? metallic,
      behavior: behavior,
    };
  }
}

/**
 * GPUAtlasMaterialBuilder - Builds atlas materials using GPU compute shaders
 * 
 * Replaces ASCII art patterns with GPU-generated procedural textures:
 * - Higher quality (128x128 instead of 16x16)
 * - Full PBR support (Albedo, Normal, Roughness, Metallic, AO, Emission)
 * - GPU-accelerated generation
 * - Optional WASM backend for even faster generation
 */

import type { MaterialTextureData } from '../textures/TextureAtlas';
import { ProceduralTextureGenerator, type PBRTextureData } from '../textures/ProceduralTextureGenerator';
import type { BlockFaceTexture } from '@engine/blocks';
import { Logger } from '@engine/core/utils';

// Optional WASM texture processor import
let WasmTextureProcessor: typeof import('@engine/wasm-texture-processor').WasmTextureProcessor | null = null;

/**
 * Try to initialize WASM texture processor
 * @returns true if WASM is available
 */
export async function initializeWasmTextureProcessor(): Promise<boolean> {
  try {
    const module = await import('@engine/wasm-texture-processor');
    await module.WasmTextureProcessor.initialize();
    WasmTextureProcessor = module.WasmTextureProcessor;
    Logger.info('[GPUAtlasMaterialBuilder] WASM texture processor initialized');
    return true;
  } catch (error) {
    Logger.warn('[GPUAtlasMaterialBuilder] WASM texture processor not available:', error);
    WasmTextureProcessor = null;
    return false;
  }
}

/**
 * Check if WASM texture processor is available
 */
export function isWasmTextureProcessorAvailable(): boolean {
  return WasmTextureProcessor !== null && WasmTextureProcessor.isAvailable();
}

// ============================================================================
// Types
// ============================================================================

/**
 * GPU material definition for procedural generation
 */
export interface GPUMaterialDefinition {
  /** Material name/identifier (must match atlas index order) */
  name: string;
  /** Procedural pattern type */
  pattern: 'solid' | 'smooth' | 'noise' | 'cobble' | 'bricks' | 'planks' | 'grid';
  /** Base color RGBA (0-1 range) */
  color: [number, number, number, number];
  /** Brightness multiplier */
  brightness: number;
  /** PBR metallic value (0-1) */
  metallic: number;
  /** PBR roughness value (0-1) */
  roughness: number;
  /** Saturation multiplier for the texture */
  saturation: number;
  /** Optional top face pattern (different from side) */
  topPattern?: 'solid' | 'smooth' | 'noise' | 'cobble' | 'bricks' | 'planks' | 'grid';
  /** Optional top face color */
  topColor?: [number, number, number, number];
  /** Emission color RGB (0-1 range, undefined = no emission) */
  emission?: [number, number, number];
  /** Emission intensity multiplier */
  emissionIntensity?: number;
}

/**
 * Built atlas material with texture data
 */
export interface BuiltAtlasMaterial {
  material: MaterialTextureData;
  params: {
    saturation: number;
    metallic: number;
    roughness: number;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ImageData to Uint8Array
 */
function imageDataToUint8Array(imageData: ImageData): Uint8Array {
  return new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
}

/**
 * Create BlockFaceTexture from GPUMaterialDefinition
 */
function createFaceTexture(
  def: GPUMaterialDefinition,
  useTop: boolean = false
): BlockFaceTexture {
  const color = useTop && def.topColor ? def.topColor : def.color;
  const pattern = useTop && def.topPattern ? def.topPattern : def.pattern;
  
  return {
    color,
    pattern,
    brightness: def.brightness,
    emissionColor: def.emission,
    emissionIntensity: def.emissionIntensity,
  };
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build atlas materials using GPU compute shaders
 * 
 * @param generator - ProceduralTextureGenerator with GPU initialized
 * @param definitions - Array of material definitions
 * @param textureSize - Target texture size (default: 128)
 * @returns Promise resolving to built materials array
 * 
 * @example
 * ```typescript
 * const generator = new ProceduralTextureGenerator(128);
 * generator.initializeGPU(device);
 * 
 * const materials = await buildGPUAtlasMaterials(generator, GPU_MATERIAL_DEFINITIONS);
 * ```
 */
export async function buildGPUAtlasMaterials(
  generator: ProceduralTextureGenerator,
  definitions: GPUMaterialDefinition[],
  textureSize: number = 128
): Promise<BuiltAtlasMaterial[]> {
  const results: BuiltAtlasMaterial[] = [];
  
  for (const def of definitions) {
    // Generate side face textures
    const sideFace = createFaceTexture(def, false);
    const sidePBR = await generator.generatePBRTextureAsync(sideFace);
    
    // Generate top face textures (may be same as side)
    const hasTopVariant = def.topPattern !== undefined || def.topColor !== undefined;
    let topPBR: PBRTextureData;
    
    if (hasTopVariant) {
      const topFace = createFaceTexture(def, true);
      topPBR = await generator.generatePBRTextureAsync(topFace);
    } else {
      topPBR = sidePBR; // Same as side
    }
    
    // Build material texture data
    const material: MaterialTextureData = {
      name: def.name,
      sideData: imageDataToUint8Array(sidePBR.albedo),
      topData: imageDataToUint8Array(topPBR.albedo),
      size: textureSize,
    };
    
    // Add normal maps if available
    if (sidePBR.normal) {
      material.sideNormalData = imageDataToUint8Array(sidePBR.normal);
    }
    if (topPBR.normal) {
      material.topNormalData = imageDataToUint8Array(topPBR.normal);
    }
    
    // Add roughness maps
    if (sidePBR.roughness) {
      material.sideRoughnessData = imageDataToUint8Array(sidePBR.roughness);
    }
    if (topPBR.roughness) {
      material.topRoughnessData = imageDataToUint8Array(topPBR.roughness);
    }
    
    // Add metallic maps
    if (sidePBR.metallic) {
      material.sideMetallicData = imageDataToUint8Array(sidePBR.metallic);
    }
    if (topPBR.metallic) {
      material.topMetallicData = imageDataToUint8Array(topPBR.metallic);
    }
    
    // Add AO maps
    if (sidePBR.ao) {
      material.sideAOData = imageDataToUint8Array(sidePBR.ao);
    }
    if (topPBR.ao) {
      material.topAOData = imageDataToUint8Array(topPBR.ao);
    }
    
    // Add emission maps
    if (sidePBR.emission) {
      material.sideEmissionData = imageDataToUint8Array(sidePBR.emission);
    }
    if (topPBR.emission) {
      material.topEmissionData = imageDataToUint8Array(topPBR.emission);
    }
    
    results.push({
      material,
      params: {
        saturation: def.saturation,
        metallic: def.metallic,
        roughness: def.roughness,
      },
    });
  }
  
  return results;
}

/**
 * Build atlas materials using WASM texture processor
 * 
 * @param definitions - Array of material definitions
 * @param textureSize - Target texture size (default: 128)
 * @returns Built materials array or null if WASM unavailable
 */
export function buildWasmAtlasMaterials(
  definitions: GPUMaterialDefinition[],
  textureSize: number = 128
): BuiltAtlasMaterial[] | null {
  if (!WasmTextureProcessor || !WasmTextureProcessor.isAvailable()) {
    return null;
  }

  const results: BuiltAtlasMaterial[] = [];
  
  for (const def of definitions) {
    // Generate PBR textures using WASM
    const sidePBR = WasmTextureProcessor.generatePBRTexture(textureSize, textureSize, {
      pattern: def.pattern,
      color: def.color,
      roughness: def.roughness,
      metallic: def.metallic,
      emissionColor: def.emission,
      emissionIntensity: def.emissionIntensity,
      seed: def.name.charCodeAt(0) * 1000 + (def.name.charCodeAt(1) || 0),
    });
    
    // Generate top face if different
    const hasTopVariant = def.topPattern !== undefined || def.topColor !== undefined;
    let topPBR: typeof sidePBR;
    
    if (hasTopVariant) {
      topPBR = WasmTextureProcessor.generatePBRTexture(textureSize, textureSize, {
        pattern: def.topPattern || def.pattern,
        color: def.topColor || def.color,
        roughness: def.roughness,
        metallic: def.metallic,
        emissionColor: def.emission,
        emissionIntensity: def.emissionIntensity,
        seed: def.name.charCodeAt(0) * 1000 + (def.name.charCodeAt(1) || 0) + 500,
      });
    } else {
      topPBR = sidePBR;
    }
    
    // Build material texture data
    const material: MaterialTextureData = {
      name: def.name,
      sideData: sidePBR.albedo,
      topData: topPBR.albedo,
      sideNormalData: sidePBR.normal,
      topNormalData: topPBR.normal,
      sideRoughnessData: sidePBR.roughness,
      topRoughnessData: topPBR.roughness,
      sideMetallicData: sidePBR.metallic,
      topMetallicData: topPBR.metallic,
      sideAOData: sidePBR.ao,
      topAOData: topPBR.ao,
      size: textureSize,
    };
    
    // Add emission if defined
    if (def.emission && def.emissionIntensity && def.emissionIntensity > 0) {
      material.sideEmissionData = sidePBR.emission;
      material.topEmissionData = topPBR.emission;
    }
    
    results.push({
      material,
      params: {
        saturation: def.saturation,
        metallic: def.metallic,
        roughness: def.roughness,
      },
    });
  }
  
  Logger.info(`[GPUAtlasMaterialBuilder] Built ${results.length} materials using WASM`);
  return results;
}

/**
 * Build atlas materials synchronously using CPU fallback
 * 
 * @param generator - ProceduralTextureGenerator
 * @param definitions - Array of material definitions
 * @param textureSize - Target texture size (default: 128)
 * @returns Built materials array
 */
export function buildGPUAtlasMaterialsSync(
  generator: ProceduralTextureGenerator,
  definitions: GPUMaterialDefinition[],
  textureSize: number = 128
): BuiltAtlasMaterial[] {
  const results: BuiltAtlasMaterial[] = [];
  
  for (const def of definitions) {
    // Generate side face textures
    const sideFace = createFaceTexture(def, false);
    const sideAlbedo = generator.generateTexture(sideFace);
    const sideHeightMap = (generator as any).generateHeightMap(sideFace);
    const sideNormal = generator.generateNormalMap(sideHeightMap, 2.0);
    
    // Generate top face textures
    const hasTopVariant = def.topPattern !== undefined || def.topColor !== undefined;
    let topAlbedo: ImageData;
    let topNormal: ImageData;
    
    if (hasTopVariant) {
      const topFace = createFaceTexture(def, true);
      topAlbedo = generator.generateTexture(topFace);
      const topHeightMap = (generator as any).generateHeightMap(topFace);
      topNormal = generator.generateNormalMap(topHeightMap, 2.0);
    } else {
      topAlbedo = sideAlbedo;
      topNormal = sideNormal;
    }
    
    // Build material texture data
    const material: MaterialTextureData = {
      name: def.name,
      sideData: imageDataToUint8Array(sideAlbedo),
      topData: imageDataToUint8Array(topAlbedo),
      sideNormalData: imageDataToUint8Array(sideNormal),
      topNormalData: imageDataToUint8Array(topNormal),
      size: textureSize,
    };
    
    // Add emission if defined
    if (def.emission && def.emissionIntensity && def.emissionIntensity > 0) {
      const sideEmission = generator.generateEmissionMap(
        def.emission,
        def.emissionIntensity,
        def.pattern
      );
      material.sideEmissionData = imageDataToUint8Array(sideEmission);
      
      if (hasTopVariant) {
        const topEmission = generator.generateEmissionMap(
          def.emission,
          def.emissionIntensity,
          def.topPattern || def.pattern
        );
        material.topEmissionData = imageDataToUint8Array(topEmission);
      } else {
        material.topEmissionData = material.sideEmissionData;
      }
    }
    
    results.push({
      material,
      params: {
        saturation: def.saturation,
        metallic: def.metallic,
        roughness: def.roughness,
      },
    });
  }
  
  return results;
}


import { Material } from './Material';

export type MaterialPresetName =
  | 'metal_polished'
  | 'metal_brushed'
  | 'plastic_matte'
  | 'plastic_glossy'
  | 'wood_oak'
  | 'stone_granite'
  | 'glass_clear'
  | 'emissive_neon'
  | 'water_default';

export interface MaterialPreset {
  metallic: number;
  roughness: number;
  color: [number, number, number, number];
  opacity?: number;
  alphaMode?: 'OPAQUE' | 'BLEND' | 'MASK';
  doubleSided?: boolean;
  emissive?: [number, number, number];
  emissiveIntensity?: number;
}

export function createPreset(name: MaterialPresetName): Material {
  const m = new Material();
  switch (name) {
    case 'metal_polished':
      m.metallic = 1;
      m.roughness = 0.1;
      m.color = [0.75, 0.75, 0.78, 1];
      break;
    case 'metal_brushed':
      m.metallic = 1;
      m.roughness = 0.4;
      m.color = [0.65, 0.65, 0.68, 1];
      break;
    case 'plastic_matte':
      m.metallic = 0;
      m.roughness = 0.8;
      m.color = [0.8, 0.1, 0.1, 1];
      break;
    case 'plastic_glossy':
      m.metallic = 0;
      m.roughness = 0.2;
      m.color = [0.1, 0.3, 0.9, 1];
      break;
    case 'wood_oak':
      m.metallic = 0;
      m.roughness = 0.7;
      m.color = [0.6, 0.45, 0.25, 1];
      break;
    case 'stone_granite':
      m.metallic = 0;
      m.roughness = 0.9;
      m.color = [0.5, 0.5, 0.5, 1];
      break;
    case 'glass_clear':
      m.metallic = 0;
      m.roughness = 0.02;
      m.opacity = 0.1;
      m.color = [0.9, 0.95, 1.0, 1];
      m.alphaMode = 'BLEND';
      m.doubleSided = true;
      break;
    case 'emissive_neon':
      m.metallic = 0;
      m.roughness = 0.4;
      m.emissive = [0.1, 0.6, 1.0];
      m.emissiveIntensity = 3.0;
      m.color = [0.1, 0.2, 0.3, 1];
      break;
    case 'water_default':
      m.metallic = 0;
      m.roughness = 0.05;
      m.color = [0.2, 0.5, 0.8, 0.7];
      m.alphaMode = 'BLEND';
      m.doubleSided = true;
      m.opacity = 0.7;
      break;
  }
  return m;
}

/**
 * MaterialPresets namespace providing preset creation utilities
 */
export const MaterialPresets = {
  create: createPreset,
  names: [
    'metal_polished',
    'metal_brushed',
    'plastic_matte',
    'plastic_glossy',
    'wood_oak',
    'stone_granite',
    'glass_clear',
    'emissive_neon',
    'water_default',
  ] as const satisfies readonly MaterialPresetName[],
};

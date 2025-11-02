/**
 * Micro Block System - Shape Presets
 */

import type { MicroBlock, MicroBlockType } from './types';

/**
 * Default presets for common micro block shapes
 */
export interface MicroBlockPreset {
  id: string;
  name: string;
  shape: MicroBlockType;
  defaultMaterial: string;
}

/**
 * Built-in presets
 */
export const MICRO_BLOCK_PRESETS: Record<string, MicroBlockPreset> = {
  cube_red: {
    id: 'cube_red',
    name: 'Red Cube',
    shape: 'cube',
    defaultMaterial: 'plastic_red',
  },
  cube_blue: {
    id: 'cube_blue',
    name: 'Blue Cube',
    shape: 'cube',
    defaultMaterial: 'plastic_blue',
  },
  cube_green: {
    id: 'cube_green',
    name: 'Green Cube',
    shape: 'cube',
    defaultMaterial: 'plastic_green',
  },
  slab_red: {
    id: 'slab_red',
    name: 'Red Slab',
    shape: 'slab',
    defaultMaterial: 'plastic_red',
  },
  stairs_red: {
    id: 'stairs_red',
    name: 'Red Stairs',
    shape: 'stairs',
    defaultMaterial: 'plastic_red',
  },
};

/**
 * Creates a micro block from a preset
 */
export function createMicroBlockFromPreset(presetId: string): MicroBlock | null {
  const preset = MICRO_BLOCK_PRESETS[presetId];
  if (!preset) return null;

  return {
    type: preset.shape,
    materialId: preset.defaultMaterial,
    rotation: 0,
  };
}


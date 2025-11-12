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
export declare const MICRO_BLOCK_PRESETS: Record<string, MicroBlockPreset>;
/**
 * Creates a micro block from a preset
 */
export declare function createMicroBlockFromPreset(presetId: string): MicroBlock | null;
//# sourceMappingURL=presets.d.ts.map
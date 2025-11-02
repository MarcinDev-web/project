/**
 * Block types and definitions
 */
export type BlockCategory = 'basic' | 'natural' | 'gameplay';
export type BlockMaterialType = 'solid' | 'glass' | 'metal' | 'wood' | 'stone' | 'plastic' | 'emissive';
/**
 * Connected Textures Mod (CTM) configuration
 * Allows blocks to have different textures based on neighboring blocks
 */
export type CTMPattern = 'none' | 'horizontal' | 'vertical' | 'cross' | 'pillar' | 'random';
export interface CTMConfig {
    /** Pattern type */
    pattern: CTMPattern;
    /** Should connect to same block type only? */
    matchSameType: boolean;
    /** Should connect to same category? */
    matchCategory: boolean;
    /** Number of random variants (for random pattern) */
    randomVariants?: number;
}
//# sourceMappingURL=types.d.ts.map
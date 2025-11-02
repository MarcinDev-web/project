import { WaterComponent } from '../components/WaterComponent';
import type { Vec2, Vec4 } from '@engine/core/math';
/**
 * Water preset types for common water scenarios
 */
export type WaterPresetType = 'calm_lake' | 'ocean' | 'pool' | 'river' | 'pond' | 'stormy_ocean';
/**
 * Create a water component from a preset
 * @param preset - Water preset type
 * @param size - Optional custom size [width, height]. Defaults based on preset
 * @returns New WaterComponent instance
 */
export declare function createWater(preset: WaterPresetType, size?: Vec2): WaterComponent;
/**
 * Create a custom water component with manual parameters
 * @param config - Custom water configuration
 * @returns New WaterComponent instance
 */
export declare function createCustomWater(config: {
    size?: Vec2;
    waveSpeed?: number;
    waveHeight?: number;
    waveFrequency?: number;
    waveDirection?: Vec2;
    waterColor?: Vec4;
    foamColor?: Vec4;
    foamThreshold?: number;
    transparency?: number;
    refractionStrength?: number;
    reflectionStrength?: number;
    causticsEnabled?: boolean;
}): WaterComponent;
/**
 * Helper to add water to an entity in a scene
 * @param entity - Entity to add water to
 * @param preset - Water preset type
 * @param size - Optional custom size
 * @returns The created WaterComponent
 */
export declare function addWaterToEntity(entity: import('../core/Entity').Entity, preset: WaterPresetType, size?: Vec2): WaterComponent;
//# sourceMappingURL=WaterFactory.d.ts.map
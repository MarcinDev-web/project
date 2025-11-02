import { Component } from './Component';
import type { Vec2, Vec4 } from '@engine/core/math';
export interface WaterComponentJSON {
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
    enabled?: boolean;
}
/**
 * WaterComponent defines water rendering properties for a water body entity.
 * Each entity with a WaterComponent represents a single water plane.
 */
export declare class WaterComponent extends Component {
    static readonly type = "Water";
    /** Water plane dimensions (width, height) in world units */
    size: Vec2;
    /** Wave animation speed (phase speed multiplier) */
    waveSpeed: number;
    /** Wave amplitude (height) in world units */
    waveHeight: number;
    /** Wave frequency (how many waves per unit) */
    waveFrequency: number;
    /** Primary wave direction (normalized 2D vector) */
    waveDirection: Vec2;
    /** Base water color (RGBA) */
    waterColor: Vec4;
    /** Foam color at edges and wave peaks (RGBA) */
    foamColor: Vec4;
    /** Foam generation threshold (0-1, higher = more foam) */
    foamThreshold: number;
    /** Water transparency (0 = opaque, 1 = fully transparent) */
    transparency: number;
    /** Refraction distortion strength */
    refractionStrength: number;
    /** Reflection intensity (0-1) */
    reflectionStrength: number;
    /** Enable caustics effect (light patterns underwater) */
    causticsEnabled: boolean;
    /** Whether water rendering is enabled */
    enabled: boolean;
    getType(): string;
    /**
     * Normalizes the wave direction vector to ensure it's unit length
     */
    normalizeWaveDirection(): void;
    clone(): WaterComponent;
    toJSON(): WaterComponentJSON;
    fromJSON(data: WaterComponentJSON): void;
}
//# sourceMappingURL=WaterComponent.d.ts.map
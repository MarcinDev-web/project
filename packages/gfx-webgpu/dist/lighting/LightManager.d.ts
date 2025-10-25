/**
 * LightManager - Manages lights in the scene and prepares lighting data for shaders
 */
import type { Scene } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
/**
 * Maximum number of lights supported by the shader (directional + point + spot)
 */
export declare const MAX_LIGHTS = 8;
export declare const MAX_DIRECTIONAL_LIGHTS = 2;
export declare const MAX_POINT_LIGHTS = 4;
export declare const MAX_SPOT_LIGHTS = 4;
/**
 * Packed light data for shader uniforms
 * Layout matches the shader's Light struct
 */
export interface PackedLight {
    /** Type: 0=directional, 1=point, 2=spot, 3=ambient */
    type: number;
    /** Position (for point/spot) or direction (for directional) */
    position: Vec3;
    /** Light color * intensity */
    color: Vec3;
    /** Range (for point/spot) */
    range: number;
    /** Direction (for directional/spot) */
    direction: Vec3;
    /** Spot light inner cone cosine */
    spotInnerCos: number;
    /** Spot light outer cone cosine */
    spotOuterCos: number;
}
/**
 * Lighting data ready for upload to GPU
 */
export interface LightingData {
    /** Number of active lights */
    lightCount: number;
    /** Packed light array */
    lights: PackedLight[];
    /** Ambient light color */
    ambientColor: Vec3;
    /** Ambient light intensity */
    ambientIntensity: number;
}
/**
 * Manages scene lighting and prepares data for rendering
 */
export declare class LightManager {
    private readonly scene;
    private cachedLightingData;
    private lastUpdateFrame;
    constructor(scene: Scene);
    /**
     * Gathers all light entities from the scene
     */
    private gatherLights;
    /**
     * Converts LightComponent to PackedLight format
     */
    private packLight;
    /**
     * Gets lighting data for the current frame
     * Results are cached per frame to avoid redundant computation
     */
    getLightingData(frameId: number): LightingData;
    /**
     * Creates default lighting setup for a scene
     * Call this when initializing a new scene
     */
    static createDefaultLights(scene: Scene): void;
    /**
     * Invalidates the cache (call when lights are added/removed/modified)
     */
    invalidateCache(): void;
}
//# sourceMappingURL=LightManager.d.ts.map
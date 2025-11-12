import { Component } from './Component.js';
import type { Vec3 } from '@engine/core/math';
declare global {
    interface GPUTexture {
    }
}
/**
 * Types of skybox rendering supported
 */
export type SkyboxType = 'solid' | 'gradient' | 'procedural-sky' | 'cubemap';
/**
 * Fog modes for distance-based atmosphere
 */
export type FogMode = 'none' | 'linear' | 'exponential' | 'exponential-squared';
/**
 * Visual presets for environment rendering
 */
export type VisualPreset = 'stylized-balanced' | 'cinematic' | 'low';
export interface EnvironmentComponentJSON {
    skyboxType?: SkyboxType;
    skyColor?: Vec3;
    horizonColor?: Vec3;
    groundColor?: Vec3;
    sunDirection?: Vec3;
    sunColor?: Vec3;
    sunIntensity?: number;
    fogMode?: FogMode;
    fogColor?: Vec3;
    fogNear?: number;
    fogFar?: number;
    fogDensity?: number;
    ambientIntensity?: number;
    exposure?: number;
    enabled?: boolean;
    cloudsEnabled?: boolean;
    cloudDensity?: number;
    cloudSpeed?: number;
    visualPreset?: VisualPreset;
}
/**
 * EnvironmentComponent defines the skybox and atmospheric settings for a scene.
 * Only one environment component should be active per scene.
 */
export declare class EnvironmentComponent extends Component {
    static readonly type = "Environment";
    /** Type of skybox rendering */
    skyboxType: SkyboxType;
    /** Sky color (top) for gradient and procedural sky */
    skyColor: Vec3;
    /** Horizon color for gradient and procedural sky */
    horizonColor: Vec3;
    /** Ground color (bottom) for gradient mode */
    groundColor: Vec3;
    /** Sun direction (normalized) for procedural sky */
    private _sunDirection;
    /** Sun color for procedural sky */
    sunColor: Vec3;
    /** Sun intensity multiplier */
    private _sunIntensity;
    /** Fog rendering mode */
    fogMode: FogMode;
    /** Fog color */
    fogColor: Vec3;
    /** Fog start distance (for linear fog) */
    fogNear: number;
    /** Fog end distance (for linear fog) */
    fogFar: number;
    /** Fog density (for exponential fog) */
    fogDensity: number;
    /** Ambient light intensity from environment */
    private _ambientIntensity;
    /** Exposure adjustment for HDR environments */
    private _exposure;
    /** Whether environment rendering is enabled */
    enabled: boolean;
    /** Whether clouds are enabled in procedural sky */
    cloudsEnabled: boolean;
    /** Cloud density (0.0 - 1.0) */
    cloudDensity: number;
    /** Cloud animation speed */
    cloudSpeed: number;
    /** Visual preset for rendering quality/features */
    private _visualPreset;
    get visualPreset(): VisualPreset | undefined;
    set visualPreset(value: VisualPreset | undefined);
    /** Cubemap texture resource (set by renderer, not serialized) */
    cubemapTexture?: GPUTexture;
    /** Path to cubemap file (for serialization/loading) */
    cubemapPath?: string;
    getType(): string;
    /**
     * Gets the sun direction (always normalized)
     */
    get sunDirection(): Vec3;
    /**
     * Sets the sun direction and auto-normalizes it
     */
    set sunDirection(value: Vec3);
    /**
     * Gets the sun intensity (always >= 0)
     */
    get sunIntensity(): number;
    /**
     * Sets the sun intensity with clamping (>= 0, allows HDR > 1.0)
     */
    set sunIntensity(value: number);
    /**
     * Gets the ambient intensity (always >= 0)
     */
    get ambientIntensity(): number;
    /**
     * Sets the ambient intensity with clamping (>= 0, <= 10)
     */
    set ambientIntensity(value: number);
    /**
     * Gets the exposure value (always > 0)
     */
    get exposure(): number;
    /**
     * Sets the exposure with clamping (> 0, <= 10)
     */
    set exposure(value: number);
    /**
     * Sets the cubemap texture and path
     * @param texture The GPU texture (will be managed by renderer lifecycle)
     * @param path Optional path/identifier for the cubemap
     */
    setCubemap(texture: GPUTexture | undefined, path?: string): void;
    /**
     * Clears the cubemap and resets to procedural sky
     */
    clearCubemap(): void;
    /**
     * Normalizes the sun direction vector
     */
    normalizeSunDirection(): void;
    private upgradeLegacyDefaults;
    /**
     * Sets time of day (0-24 hours) and updates sun position accordingly
     */
    setTimeOfDay(hours: number): void;
    clone(): EnvironmentComponent;
    toJSON(): EnvironmentComponentJSON;
    fromJSON(data: EnvironmentComponentJSON): void;
}
//# sourceMappingURL=EnvironmentComponent.d.ts.map
import { Component } from './Component';
import type { Vec3 } from '@engine/core/math';
/**
 * Types of skybox rendering supported
 */
export type SkyboxType = 'solid' | 'gradient' | 'procedural-sky' | 'cubemap';
/**
 * Fog modes for distance-based atmosphere
 */
export type FogMode = 'none' | 'linear' | 'exponential' | 'exponential-squared';
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
    sunDirection: Vec3;
    /** Sun color for procedural sky */
    sunColor: Vec3;
    /** Sun intensity multiplier */
    sunIntensity: number;
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
    ambientIntensity: number;
    /** Exposure adjustment for HDR environments */
    exposure: number;
    /** Whether environment rendering is enabled */
    enabled: boolean;
    getType(): string;
    /**
     * Normalizes the sun direction vector
     */
    normalizeSunDirection(): void;
    /**
     * Sets time of day (0-24 hours) and updates sun position accordingly
     */
    setTimeOfDay(hours: number): void;
    clone(): EnvironmentComponent;
    toJSON(): EnvironmentComponentJSON;
    fromJSON(data: EnvironmentComponentJSON): void;
}
//# sourceMappingURL=EnvironmentComponent.d.ts.map
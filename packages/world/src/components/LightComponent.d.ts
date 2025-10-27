import { Component } from './Component';
import type { Vec3 } from '@engine/core/math';
/**
 * Types of lights supported by the lighting system
 */
export type LightType = 'directional' | 'point' | 'spot' | 'ambient';
/**
 * Light component for entities that emit light
 */
export declare class LightComponent extends Component {
    static readonly type = "Light";
    /** Type of light source */
    lightType: LightType;
    /** Light color (RGB, 0-1 range) */
    color: Vec3;
    /** Light intensity multiplier */
    intensity: number;
    /** Range for point/spot lights (world units) */
    range: number;
    /** Direction for directional/spot lights (normalized) */
    direction: Vec3;
    /** Inner cone angle for spot lights (radians) */
    innerConeAngle: number;
    /** Outer cone angle for spot lights (radians) */
    outerConeAngle: number;
    /** Whether this light is enabled */
    enabled: boolean;
    getType(): string;
    clone(): LightComponent;
    toJSON(): Record<string, unknown>;
    fromJSON(data: Record<string, unknown>): void;
}
//# sourceMappingURL=LightComponent.d.ts.map
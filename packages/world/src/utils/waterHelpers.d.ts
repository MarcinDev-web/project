import type { Entity } from '../core/Entity';
import { WaterComponent } from '../components/WaterComponent';
import type { Vec2, Vec3 } from '@engine/core/math';
/**
 * Helper functions for working with water in games
 */
/**
 * Check if an entity has water component
 */
export declare function hasWater(entity: Entity): boolean;
/**
 * Get water component from entity (if exists)
 */
export declare function getWater(entity: Entity): WaterComponent | null;
/**
 * Set water size
 */
export declare function setWaterSize(entity: Entity, size: Vec2): boolean;
/**
 * Set water position (via entity transform)
 */
export declare function setWaterPosition(entity: Entity, position: Vec3): boolean;
/**
 * Enable or disable water rendering
 */
export declare function setWaterEnabled(entity: Entity, enabled: boolean): boolean;
/**
 * Set water animation speed
 */
export declare function setWaterSpeed(entity: Entity, speed: number): boolean;
/**
 * Set water color tint
 */
export declare function setWaterColor(entity: Entity, r: number, g: number, b: number, a?: number): boolean;
/**
 * Set water transparency (0 = opaque, 1 = fully transparent)
 */
export declare function setWaterTransparency(entity: Entity, transparency: number): boolean;
//# sourceMappingURL=waterHelpers.d.ts.map
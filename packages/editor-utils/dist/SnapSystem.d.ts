/**
 * Snap-to-grid system for the editor.
 * Provides intelligent snapping of position, rotation, and scale to grid increments.
 */
import type { Vec3, Quat } from '@engine/core/math';
import type { SnapConfig } from './SnapConfig';
/**
 * SnapSystem handles snapping entities to grid increments.
 * Supports per-axis configuration and can snap position, rotation, and scale.
 */
export declare class SnapSystem {
    private config;
    constructor(config?: Partial<SnapConfig>);
    /**
     * Snaps a position to the nearest grid point.
     * @param position - Original position [x, y, z]
     * @param config - Optional configuration override for this call
     * @returns Snapped position
     */
    snapPosition(position: Vec3, config?: Partial<SnapConfig>): Vec3;
    /**
     * Snaps a rotation quaternion to the nearest rotation increment.
     * @param rotation - Original rotation quaternion [x, y, z, w]
     * @returns Snapped rotation quaternion
     */
    snapRotation(rotation: Quat): Quat;
    /**
     * Snaps a scale vector to the nearest scale increment.
     * @param scale - Original scale [x, y, z]
     * @returns Snapped scale
     */
    snapScale(scale: Vec3): Vec3;
    /**
     * Returns the nearest grid point for a given position.
     * This always snaps regardless of the enabled state.
     * @param position - Position to check
     * @returns Nearest grid point
     */
    getNearestGridPoint(position: Vec3): Vec3;
    /**
     * Checks if two positions are on the same grid point.
     * @param pos1 - First position
     * @param pos2 - Second position
     * @returns true if both positions snap to the same grid point
     */
    areOnSameGridPoint(pos1: Vec3, pos2: Vec3): boolean;
    /**
     * Updates the snap configuration.
     * @param config - Partial configuration to merge with current
     */
    setConfig(config: Partial<SnapConfig>): void;
    /**
     * Gets the current snap configuration.
     * @returns Current configuration (copy)
     */
    getConfig(): SnapConfig;
    /**
     * Toggles snap on/off.
     */
    toggle(): void;
    /**
     * Enables snapping.
     */
    enable(): void;
    /**
     * Disables snapping.
     */
    disable(): void;
    /**
     * Checks if snapping is currently enabled.
     */
    isEnabled(): boolean;
    /**
     * Helper function to snap a single value to the nearest increment.
     * @param value - Value to snap
     * @param increment - Snap increment
     * @returns Snapped value
     */
    private snapValue;
    /**
     * Synchronizes snap increment with grid cell size.
     * @param cellSize - Size of a grid cell in world units
     */
    syncSnapToGrid(cellSize: number): void;
}
//# sourceMappingURL=SnapSystem.d.ts.map
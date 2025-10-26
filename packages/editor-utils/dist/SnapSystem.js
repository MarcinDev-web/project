/**
 * Snap-to-grid system for the editor.
 * Provides intelligent snapping of position, rotation, and scale to grid increments.
 */
import { quatToEuler, quatFromEuler, quatNormalize } from '@engine/core/math';
import { DEFAULT_SNAP_CONFIG, validateSnapConfig } from './SnapConfig';
/**
 * SnapSystem handles snapping entities to grid increments.
 * Supports per-axis configuration and can snap position, rotation, and scale.
 */
export class SnapSystem {
    config;
    constructor(config) {
        const merged = {
            ...DEFAULT_SNAP_CONFIG,
            ...config,
            axes: { ...DEFAULT_SNAP_CONFIG.axes, ...(config?.axes ?? {}) },
        };
        const errors = validateSnapConfig(merged);
        if (errors.length) {
            throw new Error(`Invalid snap config: ${errors.join(', ')}`);
        }
        this.config = merged;
    }
    /**
     * Snaps a position to the nearest grid point.
     * @param position - Original position [x, y, z]
     * @param config - Optional configuration override for this call
     * @returns Snapped position
     */
    snapPosition(position, config) {
        const cfg = config
            ? {
                ...this.config,
                ...config,
                axes: { ...this.config.axes, ...(config.axes ?? {}) },
            }
            : this.config;
        if (!cfg.enabled) {
            return [...position];
        }
        const result = [...position];
        const increment = cfg.increment;
        // Snap each axis independently based on configuration
        if (cfg.axes.x) {
            result[0] = this.snapValue(position[0], increment);
        }
        if (cfg.axes.y) {
            result[1] = this.snapValue(position[1], increment);
        }
        if (cfg.axes.z) {
            result[2] = this.snapValue(position[2], increment);
        }
        return result;
    }
    /**
     * Snaps a rotation quaternion to the nearest rotation increment.
     * @param rotation - Original rotation quaternion [x, y, z, w]
     * @returns Snapped rotation quaternion
     */
    snapRotation(rotation) {
        if (!this.config.enabled) {
            return [...rotation];
        }
        // Convert quaternion to Euler angles
        const euler = quatToEuler(rotation);
        // Snap each Euler angle
        const increment = this.config.rotationIncrement;
        const snappedEuler = [
            this.snapValue(euler[0], increment),
            this.snapValue(euler[1], increment),
            this.snapValue(euler[2], increment),
        ];
        // Convert back to quaternion
        return quatNormalize(quatFromEuler(snappedEuler));
    }
    /**
     * Snaps a scale vector to the nearest scale increment.
     * @param scale - Original scale [x, y, z]
     * @returns Snapped scale
     */
    snapScale(scale) {
        if (!this.config.enabled) {
            return [...scale];
        }
        const increment = this.config.scaleIncrement;
        const minScale = this.config.minScale;
        return [
            Math.max(minScale, this.snapValue(scale[0], increment)),
            Math.max(minScale, this.snapValue(scale[1], increment)),
            Math.max(minScale, this.snapValue(scale[2], increment)),
        ];
    }
    /**
     * Returns the nearest grid point for a given position.
     * This always snaps regardless of the enabled state.
     * @param position - Position to check
     * @returns Nearest grid point
     */
    getNearestGridPoint(position) {
        const increment = this.config.increment;
        return [
            this.snapValue(position[0], increment),
            this.snapValue(position[1], increment),
            this.snapValue(position[2], increment),
        ];
    }
    /**
     * Checks if two positions are on the same grid point.
     * @param pos1 - First position
     * @param pos2 - Second position
     * @returns true if both positions snap to the same grid point
     */
    areOnSameGridPoint(pos1, pos2) {
        const grid1 = this.getNearestGridPoint(pos1);
        const grid2 = this.getNearestGridPoint(pos2);
        const epsilon = 0.0001;
        return (Math.abs(grid1[0] - grid2[0]) < epsilon &&
            Math.abs(grid1[1] - grid2[1]) < epsilon &&
            Math.abs(grid1[2] - grid2[2]) < epsilon);
    }
    /**
     * Updates the snap configuration.
     * @param config - Partial configuration to merge with current
     */
    setConfig(config) {
        const next = {
            ...this.config,
            ...config,
            axes: { ...this.config.axes, ...(config.axes ?? {}) },
        };
        const errors = validateSnapConfig(next);
        if (errors.length) {
            throw new Error(`Invalid snap config: ${errors.join(', ')}`);
        }
        this.config = next;
    }
    /**
     * Gets the current snap configuration.
     * @returns Current configuration (copy)
     */
    getConfig() {
        return { ...this.config, axes: { ...this.config.axes } };
    }
    /**
     * Toggles snap on/off.
     */
    toggle() {
        this.config.enabled = !this.config.enabled;
    }
    /**
     * Enables snapping.
     */
    enable() {
        this.config.enabled = true;
    }
    /**
     * Disables snapping.
     */
    disable() {
        this.config.enabled = false;
    }
    /**
     * Checks if snapping is currently enabled.
     */
    isEnabled() {
        return this.config.enabled;
    }
    /**
     * Helper function to snap a single value to the nearest increment.
     * @param value - Value to snap
     * @param increment - Snap increment
     * @returns Snapped value
     */
    snapValue(value, increment) {
        if (increment <= 0) {
            return value;
        }
        const snapped = Math.round(value / increment) * increment;
        return Object.is(snapped, -0) ? 0 : snapped;
    }
    /**
     * Synchronizes snap increment with grid cell size.
     * @param cellSize - Size of a grid cell in world units
     */
    syncSnapToGrid(cellSize) {
        if (!(typeof cellSize === 'number' && Number.isFinite(cellSize) && cellSize > 0)) {
            throw new Error('cellSize must be a positive number');
        }
        this.setConfig({ increment: cellSize });
    }
}
//# sourceMappingURL=SnapSystem.js.map
/**
 * Configuration for snap-to-grid system.
 * Inspired by Minecraft's block placement system.
 */
/**
 * Default snap configuration
 */
export const DEFAULT_SNAP_CONFIG = {
    enabled: true,
    increment: 0.5,
    axes: {
        x: true,
        y: true,
        z: true,
    },
    rotationIncrement: 0.5, // ~28.65 degrees
    scaleIncrement: 0.5,
    minScale: 0.001,
};
/**
 * Common snap presets
 */
export const SNAP_PRESETS = {
    /** Fine snap (0.25 units) */
    FINE: {
        increment: 0.25,
        rotationIncrement: Math.PI / 8, // 22.5 degrees
        scaleIncrement: 0.1,
    },
    /** Normal snap (1.0 units) */
    NORMAL: {
        increment: 1.0,
        rotationIncrement: Math.PI / 4, // 45 degrees
        scaleIncrement: 0.5,
    },
    /** Coarse snap (2.0 units) */
    COARSE: {
        increment: 2.0,
        rotationIncrement: Math.PI / 2, // 90 degrees
        scaleIncrement: 1.0,
    },
};
/**
 * Validates snap configuration
 */
export function validateSnapConfig(config) {
    const errors = [];
    if (config.increment !== undefined && config.increment <= 0) {
        errors.push('increment must be greater than 0');
    }
    if (config.rotationIncrement !== undefined && config.rotationIncrement <= 0) {
        errors.push('rotationIncrement must be greater than 0');
    }
    if (config.scaleIncrement !== undefined && config.scaleIncrement <= 0) {
        errors.push('scaleIncrement must be greater than 0');
    }
    if (config.minScale !== undefined && config.minScale <= 0) {
        errors.push('minScale must be greater than 0');
    }
    return errors;
}
//# sourceMappingURL=SnapConfig.js.map
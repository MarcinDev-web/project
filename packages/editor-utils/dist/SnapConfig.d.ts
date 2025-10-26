/**
 * Configuration for snap-to-grid system.
 * Inspired by Minecraft's block placement system.
 */
/**
 * Snap configuration interface
 */
export interface SnapConfig {
    /** Whether snapping is enabled */
    enabled: boolean;
    /** Snap increment for position (in world units) */
    increment: number;
    /** Per-axis snap configuration */
    axes: {
        /** Snap on X axis */
        x: boolean;
        /** Snap on Y axis */
        y: boolean;
        /** Snap on Z axis */
        z: boolean;
    };
    /** Snap increment for rotation (in radians) */
    rotationIncrement: number;
    /** Snap increment for scale */
    scaleIncrement: number;
    /** Minimum allowed scale value to avoid degeneracy */
    minScale: number;
}
/**
 * Default snap configuration
 */
export declare const DEFAULT_SNAP_CONFIG: SnapConfig;
/**
 * Common snap presets
 */
export declare const SNAP_PRESETS: {
    /** Fine snap (0.25 units) */
    readonly FINE: {
        readonly increment: 0.25;
        readonly rotationIncrement: number;
        readonly scaleIncrement: 0.1;
    };
    /** Normal snap (1.0 units) */
    readonly NORMAL: {
        readonly increment: 1;
        readonly rotationIncrement: number;
        readonly scaleIncrement: 0.5;
    };
    /** Coarse snap (2.0 units) */
    readonly COARSE: {
        readonly increment: 2;
        readonly rotationIncrement: number;
        readonly scaleIncrement: 1;
    };
};
/**
 * Validates snap configuration
 */
export declare function validateSnapConfig(config: Partial<SnapConfig>): string[];
//# sourceMappingURL=SnapConfig.d.ts.map
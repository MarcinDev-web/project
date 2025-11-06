/**
 * LOD Component
 *
 * Component for entities that support Level of Detail (LOD).
 * Tracks screen-space size and current LOD level.
 */
import { Component } from './Component.js';
export type LODLevel = 0 | 1 | 2 | 3;
/**
 * LOD Component for screen-space LOD selection.
 */
export declare class LODComponent extends Component {
    static readonly type = "LOD";
    /** Current LOD level */
    currentLOD: LODLevel;
    /** Target LOD level (may differ from current during transitions) */
    targetLOD: LODLevel;
    /** Screen-space size (pixels) */
    screenSize: number;
    /** Transition progress (0-1) for smooth LOD switching */
    transitionProgress: number;
    /** Whether LOD is enabled for this entity */
    enabled: boolean;
    getType(): string;
    /**
     * Gets the current LOD level.
     */
    getCurrentLOD(): LODLevel;
    /**
     * Sets the target LOD level (with transition).
     */
    setTargetLOD(level: LODLevel): void;
    /**
     * Updates transition progress.
     */
    updateTransition(delta: number): void;
    /**
     * Gets the effective LOD level (accounting for transition).
     */
    getEffectiveLOD(): LODLevel;
    clone(): LODComponent;
    toJSON(): {
        currentLOD: LODLevel;
        targetLOD: LODLevel;
        screenSize: number;
        transitionProgress: number;
        enabled: boolean;
    };
    fromJSON(data: {
        currentLOD?: LODLevel;
        targetLOD?: LODLevel;
        screenSize?: number;
        transitionProgress?: number;
        enabled?: boolean;
    }): void;
}
//# sourceMappingURL=LODComponent.d.ts.map
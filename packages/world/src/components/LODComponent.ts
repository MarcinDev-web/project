/**
 * LOD Component
 * 
 * Component for entities that support Level of Detail (LOD).
 * Tracks screen-space size and current LOD level.
 */

import { Component } from './Component.js';
import { registerComponent } from './registry.js';

export type LODLevel = 0 | 1 | 2 | 3; // 0 = highest detail, 3 = lowest

/**
 * LOD Component for screen-space LOD selection.
 */
export class LODComponent extends Component {
  static readonly type = 'LOD';

  /** Current LOD level */
  currentLOD: LODLevel = 0;
  
  /** Target LOD level (may differ from current during transitions) */
  targetLOD: LODLevel = 0;
  
  /** Screen-space size (pixels) */
  screenSize: number = 0;
  
  /** Transition progress (0-1) for smooth LOD switching */
  transitionProgress: number = 1.0;
  
  /** Whether LOD is enabled for this entity */
  enabled: boolean = true;

  getType(): string {
    return LODComponent.type;
  }

  /**
   * Gets the current LOD level.
   */
  getCurrentLOD(): LODLevel {
    return this.currentLOD;
  }

  /**
   * Sets the target LOD level (with transition).
   */
  setTargetLOD(level: LODLevel): void {
    if (this.targetLOD !== level) {
      this.targetLOD = level;
      this.transitionProgress = 0.0;
    }
  }

  /**
   * Updates transition progress.
   */
  updateTransition(delta: number): void {
    if (this.currentLOD !== this.targetLOD) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + delta);
      if (this.transitionProgress >= 1.0) {
        this.currentLOD = this.targetLOD;
      }
    }
  }

  /**
   * Gets the effective LOD level (accounting for transition).
   */
  getEffectiveLOD(): LODLevel {
    if (this.transitionProgress >= 1.0) {
      return this.currentLOD;
    }
    // During transition, use the higher detail level (smooth transition)
    return this.currentLOD < this.targetLOD ? this.currentLOD : this.targetLOD;
  }

  clone(): LODComponent {
    const copy = new LODComponent();
    copy.currentLOD = this.currentLOD;
    copy.targetLOD = this.targetLOD;
    copy.screenSize = this.screenSize;
    copy.transitionProgress = this.transitionProgress;
    copy.enabled = this.enabled;
    return copy;
  }

  toJSON() {
    return {
      currentLOD: this.currentLOD,
      targetLOD: this.targetLOD,
      screenSize: this.screenSize,
      transitionProgress: this.transitionProgress,
      enabled: this.enabled,
    };
  }

  fromJSON(data: {
    currentLOD?: LODLevel;
    targetLOD?: LODLevel;
    screenSize?: number;
    transitionProgress?: number;
    enabled?: boolean;
  }): void {
    if (typeof data.currentLOD === 'number') this.currentLOD = data.currentLOD;
    if (typeof data.targetLOD === 'number') this.targetLOD = data.targetLOD;
    if (typeof data.screenSize === 'number') this.screenSize = data.screenSize;
    if (typeof data.transitionProgress === 'number') this.transitionProgress = data.transitionProgress;
    if (typeof data.enabled === 'boolean') this.enabled = data.enabled;
  }
}

registerComponent(LODComponent.type, LODComponent);


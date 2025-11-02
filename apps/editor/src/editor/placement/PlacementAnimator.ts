/**
 * PlacementAnimator - Handles smooth animations for placement preview.
 * Provides animations for spawn (scale + fade), position interpolation, and rotation interpolation.
 */

import type { Entity } from '@engine/world';
import type { Vec3, Quat } from '@engine/core/math';
import { lerpVec3Out, quatSlerpOut } from '@engine/core/math';

/**
 * Configuration for placement animations
 */
export interface PlacementAnimatorConfig {
  /** Enable animations (default: true) */
  enabled: boolean;
  /** Animation durations in seconds */
  duration: {
    spawn: number;
    position: number;
    rotation: number;
  };
}

/**
 * Default animation configuration
 */
const DEFAULT_CONFIG: PlacementAnimatorConfig = {
  enabled: true,
  duration: {
    spawn: 0.2, // 200ms
    position: 0.1, // 100ms
    rotation: 0.15, // 150ms
  },
};

/**
 * Easing function: ease-out
 */
function easeOut(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * (2 - clamped);
}

/**
 * State of an active spawn animation
 */
interface SpawnAnimation {
  entity: Entity;
  startScale: Vec3;
  targetScale: Vec3;
  startOpacity: number;
  targetOpacity: number;
  elapsed: number;
  duration: number;
}

/**
 * State of an active position animation
 */
interface PositionAnimation {
  entity: Entity;
  startPos: Vec3;
  targetPos: Vec3;
  elapsed: number;
  duration: number;
}

/**
 * State of an active rotation animation
 */
interface RotationAnimation {
  entity: Entity;
  startRot: Quat;
  targetRot: Quat;
  elapsed: number;
  duration: number;
}

/**
 * Animator for placement preview animations
 */
export class PlacementAnimator {
  private config: PlacementAnimatorConfig;
  private spawnAnim: SpawnAnimation | null = null;
  private positionAnim: PositionAnimation | null = null;
  private rotationAnim: RotationAnimation | null = null;
  private tempVec3: Vec3 = [0, 0, 0];
  private tempQuat: Quat = [0, 0, 0, 1];
  private rafId: number | null = null;
  private lastFrameTime: number | null = null;

  constructor(config?: Partial<PlacementAnimatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts a spawn animation (scale from 0 and fade in)
   */
  animateSpawn(entity: Entity, targetScale: Vec3, targetOpacity: number): void {
    if (!this.config.enabled) {
      // Apply directly if disabled
      entity.transform.scale = [...targetScale];
      const color = entity.color ?? [1, 1, 1, 1];
      color[3] = targetOpacity;
      entity.color = color;
      return;
    }

    // Cancel any existing spawn animation for this entity
    if (this.spawnAnim?.entity === entity) {
      this.spawnAnim = null;
    }

    const startScale: Vec3 = [0, 0, 0];
    const startOpacity = 0;

    // Initialize to start state
    entity.transform.scale = startScale;
    const color = entity.color ?? [1, 1, 1, 1];
    color[3] = startOpacity;
    entity.color = color;

    this.spawnAnim = {
      entity,
      startScale,
      targetScale: [...targetScale],
      startOpacity,
      targetOpacity,
      elapsed: 0,
      duration: this.config.duration.spawn,
    };

    // Start animation loop if not already running
    this.startAnimationLoop();
  }

  /**
   * Starts a position interpolation animation
   */
  animatePosition(entity: Entity, targetPosition: Vec3): void {
    if (!this.config.enabled) {
      // Apply directly if disabled
      entity.transform.position = [...targetPosition];
      return;
    }

    // Cancel any existing position animation for this entity
    if (this.positionAnim?.entity === entity) {
      this.positionAnim = null;
    }

    const currentPos = entity.transform.position;
    const startPos: Vec3 = [currentPos[0], currentPos[1], currentPos[2]];

    // If start and target are the same, no animation needed
    const dx = targetPosition[0] - startPos[0];
    const dy = targetPosition[1] - startPos[1];
    const dz = targetPosition[2] - startPos[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < 0.0001) {
      entity.transform.position = [...targetPosition];
      return;
    }

    this.positionAnim = {
      entity,
      startPos,
      targetPos: [...targetPosition],
      elapsed: 0,
      duration: this.config.duration.position,
    };

    // Start animation loop if not already running
    this.startAnimationLoop();
  }

  /**
   * Starts a rotation interpolation animation
   */
  animateRotation(entity: Entity, targetRotation: Quat): void {
    if (!this.config.enabled) {
      // Apply directly if disabled
      entity.transform.rotation = [...targetRotation];
      return;
    }

    // Cancel any existing rotation animation for this entity
    if (this.rotationAnim?.entity === entity) {
      this.rotationAnim = null;
    }

    const currentRot = entity.transform.rotation;
    const startRot: Quat = [currentRot[0], currentRot[1], currentRot[2], currentRot[3]];

    this.rotationAnim = {
      entity,
      startRot,
      targetRot: [...targetRotation],
      elapsed: 0,
      duration: this.config.duration.rotation,
    };

    // Start animation loop if not already running
    this.startAnimationLoop();
  }

  /**
   * Starts the animation loop using requestAnimationFrame
   */
  private startAnimationLoop(): void {
    if (this.rafId !== null) {
      return; // Already running
    }

    this.lastFrameTime = performance.now();
    const animate = (currentTime: number) => {
      if (!this.isAnimating()) {
        this.rafId = null;
        this.lastFrameTime = null;
        return;
      }

      const deltaTime = this.lastFrameTime !== null 
        ? (currentTime - this.lastFrameTime) / 1000 
        : 0.016; // Default to ~60fps if no previous frame
      this.lastFrameTime = currentTime;

      this.update(deltaTime);

      if (this.isAnimating()) {
        this.rafId = requestAnimationFrame(animate);
      } else {
        this.rafId = null;
        this.lastFrameTime = null;
      }
    };

    this.rafId = requestAnimationFrame(animate);
  }

  /**
   * Stops the animation loop
   */
  private stopAnimationLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.lastFrameTime = null;
    }
  }

  /**
   * Updates all active animations with the given delta time
   */
  private update(deltaTime: number): void {
    if (!this.config.enabled) {
      return;
    }

    // Update spawn animation
    if (this.spawnAnim) {
      this.spawnAnim.elapsed += deltaTime;
      const progress = Math.min(1, this.spawnAnim.elapsed / this.spawnAnim.duration);
      const eased = easeOut(progress);

      // Interpolate scale
      lerpVec3Out(
        this.tempVec3,
        this.spawnAnim.startScale,
        this.spawnAnim.targetScale,
        eased
      );
      this.spawnAnim.entity.transform.scale = [
        this.tempVec3[0],
        this.tempVec3[1],
        this.tempVec3[2],
      ];

      // Interpolate opacity
      const opacity = this.spawnAnim.startOpacity + 
        (this.spawnAnim.targetOpacity - this.spawnAnim.startOpacity) * eased;
      const color = this.spawnAnim.entity.color ?? [1, 1, 1, 1];
      color[3] = Math.max(0, Math.min(1, opacity));
      this.spawnAnim.entity.color = color;

      if (progress >= 1) {
        // Ensure final values
        this.spawnAnim.entity.transform.scale = [...this.spawnAnim.targetScale];
        const finalColor = this.spawnAnim.entity.color ?? [1, 1, 1, 1];
        finalColor[3] = this.spawnAnim.targetOpacity;
        this.spawnAnim.entity.color = finalColor;
        this.spawnAnim = null;
      }
    }

    // Update position animation
    if (this.positionAnim) {
      this.positionAnim.elapsed += deltaTime;
      const progress = Math.min(1, this.positionAnim.elapsed / this.positionAnim.duration);

      lerpVec3Out(
        this.tempVec3,
        this.positionAnim.startPos,
        this.positionAnim.targetPos,
        progress
      );
      this.positionAnim.entity.transform.position = [
        this.tempVec3[0],
        this.tempVec3[1],
        this.tempVec3[2],
      ];

      if (progress >= 1) {
        // Ensure final position
        this.positionAnim.entity.transform.position = [...this.positionAnim.targetPos];
        this.positionAnim = null;
      }
    }

    // Update rotation animation
    if (this.rotationAnim) {
      this.rotationAnim.elapsed += deltaTime;
      const progress = Math.min(1, this.rotationAnim.elapsed / this.rotationAnim.duration);

      quatSlerpOut(
        this.tempQuat,
        this.rotationAnim.startRot,
        this.rotationAnim.targetRot,
        progress
      );
      this.rotationAnim.entity.transform.rotation = [
        this.tempQuat[0],
        this.tempQuat[1],
        this.tempQuat[2],
        this.tempQuat[3],
      ];

      if (progress >= 1) {
        // Ensure final rotation
        this.rotationAnim.entity.transform.rotation = [...this.rotationAnim.targetRot];
        this.rotationAnim = null;
      }
    }
  }

  /**
   * Cancels all active animations
   */
  cancel(): void {
    // Jump to final values if animations are active
    if (this.spawnAnim) {
      this.spawnAnim.entity.transform.scale = [...this.spawnAnim.targetScale];
      const color = this.spawnAnim.entity.color ?? [1, 1, 1, 1];
      color[3] = this.spawnAnim.targetOpacity;
      this.spawnAnim.entity.color = color;
      this.spawnAnim = null;
    }

    if (this.positionAnim) {
      this.positionAnim.entity.transform.position = [...this.positionAnim.targetPos];
      this.positionAnim = null;
    }

    if (this.rotationAnim) {
      this.rotationAnim.entity.transform.rotation = [...this.rotationAnim.targetRot];
      this.rotationAnim = null;
    }

    this.stopAnimationLoop();
  }

  /**
   * Updates the configuration
   */
  setConfig(config: Partial<PlacementAnimatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets the current configuration
   */
  getConfig(): PlacementAnimatorConfig {
    return { ...this.config };
  }

  /**
   * Checks if any animation is currently active
   */
  isAnimating(): boolean {
    return this.spawnAnim !== null || this.positionAnim !== null || this.rotationAnim !== null;
  }

  /**
   * Disposes the animator (cancels all animations and stops loop)
   */
  dispose(): void {
    this.cancel();
    this.stopAnimationLoop();
  }
}


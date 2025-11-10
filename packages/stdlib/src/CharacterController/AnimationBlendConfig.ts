import { AnimationStateName } from './AnimationStateName';
import type { AnimationEasing } from '../Animation/types';

/**
 * Configuration for animation blend times and easing functions.
 * 
 * Provides intelligent defaults for different types of animation transitions:
 * - Fast transitions for similar states (idle ↔ walk)
 * - Medium transitions for common changes (walk ↔ run)
 * - Slower transitions for important state changes (fall → land)
 */
export class AnimationBlendConfig {
  private readonly blendTimes = new Map<string, number>();
  private readonly blendEasings = new Map<string, AnimationEasing>();
  private readonly defaultBlendTime: number;
  private readonly defaultEasing: AnimationEasing;

  constructor(options?: {
    defaultBlendTime?: number;
    defaultEasing?: AnimationEasing;
    customBlendTimes?: Record<string, number>;
    customEasings?: Record<string, AnimationEasing>;
  }) {
    this.defaultBlendTime = options?.defaultBlendTime ?? 0.12;
    this.defaultEasing = options?.defaultEasing ?? 'ease-in-out';

    // Set up default blend times for common transitions
    this.setupDefaultBlendTimes();

    // Override with custom values if provided
    if (options?.customBlendTimes) {
      for (const [key, value] of Object.entries(options.customBlendTimes)) {
        this.blendTimes.set(key, value);
      }
    }

    if (options?.customEasings) {
      for (const [key, value] of Object.entries(options.customEasings)) {
        this.blendEasings.set(key, value);
      }
    }
  }

  /**
   * Get blend time for a transition between two animation states.
   * 
   * @param from - Source animation state name
   * @param to - Target animation state name
   * @returns Blend time in seconds
   */
  getBlendTime(from: AnimationStateName | string | null, to: AnimationStateName | string): number {
    if (!from) {
      return this.defaultBlendTime;
    }
    const key = this.getTransitionKey(from, to);
    return this.blendTimes.get(key) ?? this.defaultBlendTime;
  }

  /**
   * Get blend easing function for a transition between two animation states.
   * 
   * @param from - Source animation state name
   * @param to - Target animation state name
   * @returns Easing function name
   */
  getBlendEasing(from: AnimationStateName | string | null, to: AnimationStateName | string): AnimationEasing {
    if (!from) {
      return this.defaultEasing;
    }
    const key = this.getTransitionKey(from, to);
    return this.blendEasings.get(key) ?? this.defaultEasing;
  }

  /**
   * Set custom blend time for a specific transition.
   * 
   * @param from - Source animation state name
   * @param to - Target animation state name
   * @param time - Blend time in seconds
   */
  setBlendTime(from: AnimationStateName | string, to: AnimationStateName | string, time: number): void {
    const key = this.getTransitionKey(from, to);
    this.blendTimes.set(key, Math.max(0, time));
  }

  /**
   * Set custom blend easing for a specific transition.
   * 
   * @param from - Source animation state name
   * @param to - Target animation state name
   * @param easing - Easing function name
   */
  setBlendEasing(from: AnimationStateName | string, to: AnimationStateName | string, easing: AnimationEasing): void {
    const key = this.getTransitionKey(from, to);
    this.blendEasings.set(key, easing);
  }

  private getTransitionKey(from: AnimationStateName | string, to: AnimationStateName | string): string {
    return `${from}->${to}`;
  }

  private setupDefaultBlendTimes(): void {
    // Fast transitions for similar states (idle ↔ walk)
    this.blendTimes.set('idle->walk', 0.08);
    this.blendTimes.set('walk->idle', 0.08);

    // Fast transitions for similar states (walk ↔ run)
    this.blendTimes.set('walk->run', 0.10);
    this.blendTimes.set('run->walk', 0.10);

    // Medium transitions for common changes (idle/run → jump)
    this.blendTimes.set('idle->jump', 0.15);
    this.blendTimes.set('run->jump', 0.15);

    // Medium transitions (jump → fall)
    this.blendTimes.set('jump->fall', 0.12);

    // Slower transitions for important state changes (fall → land)
    this.blendTimes.set('fall->land', 0.20);

    // Medium transitions (land → idle)
    this.blendTimes.set('land->idle', 0.15);

    // Additional transitions for completeness
    this.blendTimes.set('idle->run', 0.10);
    this.blendTimes.set('run->idle', 0.10);
    this.blendTimes.set('jump->land', 0.18);
    this.blendTimes.set('land->walk', 0.12);
    this.blendTimes.set('land->run', 0.12);
  }
}


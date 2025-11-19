import type { AnimationSample } from './types';

export interface AnimationNode {
  update(deltaTime: number): void;
  sample(): AnimationSample[];
  play(): void;
  pause(): void;
  stop(): void;
  
  /**
   * Get the duration of the animation source in seconds.
   * For blend trees, this might be a weighted average or the duration of the dominant child.
   */
  getDuration(): number;
  
  /**
   * Get current normalized time (0-1).
   */
  getNormalizedTime(): number;
  
  /**
   * Set current normalized time (0-1).
   * Used for synchronizing animations in a blend tree.
   */
  setNormalizedTime(time: number): void;

  /**
   * Get the global weight of this animation node (0-1).
   * Used by AnimationSystem to blend this node's output with others.
   */
  getWeight(): number;
}

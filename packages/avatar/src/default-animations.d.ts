import type { AvatarAnimation } from './animation';
/**
 * Default idle animation - character stands still with subtle breathing.
 * Enhanced with more frames for smoother animation and natural micro-movements.
 */
export declare const IDLE_ANIMATION: AvatarAnimation;
/**
 * Default run animation - character runs with arm and leg movement.
 * Enhanced with more frames (8 frames) for smoother running cycle.
 *
 * Run cycle phases:
 * - Contact: foot touches ground
 * - Lift: foot lifts off
 * - Peak: leg at highest point
 * - Land: foot prepares for contact
 *
 * Rotation angles in radians:
 * - Leg forward/back: ~0.3-0.35 rad (~17-20 degrees)
 * - Leg lower bend: ~0.4-0.5 rad (~23-29 degrees)
 * - Arm swing: ~0.3-0.35 rad opposite to leg
 * - Arm lower bend: ~0.2-0.25 rad
 */
export declare const RUN_ANIMATION: AvatarAnimation;
/**
 * Default walk animation - character walks at normal pace.
 * Slower and more controlled than run, with smaller movement amplitudes.
 *
 * Walk cycle phases (slower than run):
 * - Heel strike: foot contacts ground
 * - Mid-stance: weight over foot
 * - Toe-off: foot pushes off
 * - Swing: leg swings forward
 *
 * Rotation angles in radians (smaller than run):
 * - Leg forward/back: ~0.2-0.25 rad (~11-14 degrees)
 * - Leg lower bend: ~0.25-0.3 rad (~14-17 degrees)
 * - Arm swing: ~0.2-0.25 rad opposite to leg
 * - Arm lower bend: ~0.15 rad
 */
export declare const WALK_ANIMATION: AvatarAnimation;
/**
 * Default jump animation - character jumps with crouch, upward motion, and landing.
 * Not looped - emits 'finished' event when complete.
 *
 * Jump phases:
 * - Crouch (0.0-0.2s): Preparing for jump, legs bend
 * - Upward (0.2-0.5s): Legs extend, arms swing up
 * - Peak (0.5-0.7s): At highest point, legs tucked
 * - Landing (0.7-1.0s): Legs prepare for impact, arms down
 */
export declare const JUMP_ANIMATION: AvatarAnimation;
//# sourceMappingURL=default-animations.d.ts.map
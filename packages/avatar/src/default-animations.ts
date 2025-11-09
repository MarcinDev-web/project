import type { AvatarAnimation } from './animation';
import { quatFromEuler, type Quat, type Vec3 } from '@engine/core/math';

/**
 * Default idle animation - character stands still with subtle breathing.
 * Enhanced with more frames for smoother animation and natural micro-movements.
 */
export const IDLE_ANIMATION: AvatarAnimation = {
  name: 'idle',
  length: 3.0,
  loop: true,
  frames: [
    {
      time: 0,
      joints: {
        Chest: {
          rotation: quatFromEuler([0, 0, 0] as Vec3),
        },
        Head: {
          rotation: quatFromEuler([0, 0, 0] as Vec3),
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([0, 0, 0.05] as Vec3), // Slight forward
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0, 0, -0.05] as Vec3), // Slight forward
        },
        'Leg.L.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Leg.R.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
      },
    },
    {
      time: 0.75,
      joints: {
        Chest: {
          rotation: quatFromEuler([0.02, 0, 0] as Vec3), // Slight forward (breathing in)
        },
        Head: {
          rotation: quatFromEuler([0.01, 0, 0] as Vec3), // Slight nod
        },
      },
    },
    {
      time: 1.5,
      joints: {
        Chest: {
          rotation: quatFromEuler([-0.02, 0, 0] as Vec3), // Slight back (breathing out)
        },
        Head: {
          rotation: quatFromEuler([-0.01, 0, 0] as Vec3), // Slight back
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([0, 0, -0.05] as Vec3), // Slight back
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0, 0, 0.05] as Vec3), // Slight back
        },
      },
    },
    {
      time: 2.25,
      joints: {
        Chest: {
          rotation: quatFromEuler([0.02, 0, 0] as Vec3), // Breathing in again
        },
        Head: {
          rotation: quatFromEuler([0.01, 0, 0] as Vec3),
        },
      },
    },
    {
      time: 3.0,
      joints: {
        Chest: {
          rotation: quatFromEuler([0, 0, 0] as Vec3), // Back to neutral
        },
        Head: {
          rotation: quatFromEuler([0, 0, 0] as Vec3),
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([0, 0, 0.05] as Vec3), // Back to start
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0, 0, -0.05] as Vec3), // Back to start
        },
      },
    },
  ],
};

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
export const RUN_ANIMATION: AvatarAnimation = {
  name: 'run',
  length: 0.8,
  loop: true,
  frames: [
    {
      time: 0,
      joints: {
        // Contact phase: Left leg forward, right leg back
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.35, 0, 0] as Vec3), // Forward
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.35, 0, 0] as Vec3), // Back
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.5, 0, 0] as Vec3), // Bent forward (contact)
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.45, 0, 0] as Vec3), // Bent back
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([-0.35, 0, 0] as Vec3), // Back (opposite to leg)
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0.35, 0, 0] as Vec3), // Forward
        },
        'Arm.L.Lower': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Slight bend
        },
        'Arm.R.Lower': {
          rotation: quatFromEuler([-0.25, 0, 0] as Vec3), // Slight bend
        },
        Chest: {
          rotation: quatFromEuler([0.05, 0, 0] as Vec3), // Slight forward lean
        },
      },
    },
    {
      time: 0.1,
      joints: {
        // Lift phase: Left leg lifting, right leg pushing
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Less forward
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Less bent (lifting)
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.5, 0, 0] as Vec3), // More bent (pushing)
        },
      },
    },
    {
      time: 0.2,
      joints: {
        // Peak phase: Left leg at highest, right leg mid-swing
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Almost vertical
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Less bent
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Mid-swing
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.3, 0, 0] as Vec3), // Less bent
        },
      },
    },
    {
      time: 0.3,
      joints: {
        // Mid-swing: Left leg swinging back, right leg preparing contact
        'Leg.L.Upper': {
          rotation: quatFromEuler([-0.1, 0, 0] as Vec3), // Starting back swing
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Preparing forward
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Preparing contact
        },
      },
    },
    {
      time: 0.4,
      joints: {
        // Contact phase: Right leg forward, left leg back (opposite phase)
        'Leg.L.Upper': {
          rotation: quatFromEuler([-0.35, 0, 0] as Vec3), // Back
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.35, 0, 0] as Vec3), // Forward
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([0.45, 0, 0] as Vec3), // Bent back
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.5, 0, 0] as Vec3), // Bent forward (contact)
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([0.35, 0, 0] as Vec3), // Forward
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([-0.35, 0, 0] as Vec3), // Back
        },
        'Arm.L.Lower': {
          rotation: quatFromEuler([-0.25, 0, 0] as Vec3), // Slight bend
        },
        'Arm.R.Lower': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Slight bend
        },
      },
    },
    {
      time: 0.5,
      joints: {
        // Lift phase: Right leg lifting, left leg pushing
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Less forward
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Less bent (lifting)
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([0.5, 0, 0] as Vec3), // More bent (pushing)
        },
      },
    },
    {
      time: 0.6,
      joints: {
        // Peak phase: Right leg at highest, left leg mid-swing
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Almost vertical
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Less bent
        },
        'Leg.L.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Mid-swing
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([0.3, 0, 0] as Vec3), // Less bent
        },
      },
    },
    {
      time: 0.7,
      joints: {
        // Mid-swing: Right leg swinging back, left leg preparing contact
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.1, 0, 0] as Vec3), // Starting back swing
        },
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Preparing forward
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Preparing contact
        },
      },
    },
    {
      time: 0.8,
      joints: {
        // Back to start position (for seamless loop)
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.35, 0, 0] as Vec3), // Forward
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.35, 0, 0] as Vec3), // Back
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.5, 0, 0] as Vec3), // Bent forward
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.45, 0, 0] as Vec3), // Bent back
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([-0.35, 0, 0] as Vec3), // Back
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0.35, 0, 0] as Vec3), // Forward
        },
        'Arm.L.Lower': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Slight bend
        },
        'Arm.R.Lower': {
          rotation: quatFromEuler([-0.25, 0, 0] as Vec3), // Slight bend
        },
        Chest: {
          rotation: quatFromEuler([0.05, 0, 0] as Vec3), // Slight forward lean
        },
      },
    },
  ],
};

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
export const WALK_ANIMATION: AvatarAnimation = {
  name: 'walk',
  length: 1.2,
  loop: true,
  frames: [
    {
      time: 0,
      joints: {
        // Heel strike: Left foot contacts ground, right foot lifting
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Forward
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Bent forward (contact)
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Bent back
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back (opposite to leg)
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Forward
        },
        'Arm.L.Lower': {
          rotation: quatFromEuler([0.15, 0, 0] as Vec3), // Slight bend
        },
        'Arm.R.Lower': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Slight bend
        },
        Chest: {
          rotation: quatFromEuler([0.02, 0, 0] as Vec3), // Very slight forward lean
        },
      },
    },
    {
      time: 0.15,
      joints: {
        // Mid-stance: Left leg supporting weight
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.15, 0, 0] as Vec3), // More vertical
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Less bent
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Swinging forward
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Less bent
        },
      },
    },
    {
      time: 0.3,
      joints: {
        // Toe-off: Left leg pushing off, right leg swinging
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.05, 0, 0] as Vec3), // Almost vertical
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Less bent
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([0, 0, 0] as Vec3), // Mid-swing
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.15, 0, 0] as Vec3), // Less bent
        },
      },
    },
    {
      time: 0.45,
      joints: {
        // Swing phase: Left leg swinging back, right leg preparing contact
        'Leg.L.Upper': {
          rotation: quatFromEuler([-0.1, 0, 0] as Vec3), // Swinging back
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Preparing forward
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Preparing contact
        },
      },
    },
    {
      time: 0.6,
      joints: {
        // Heel strike: Right foot contacts ground, left foot lifting
        'Leg.L.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Forward
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Bent back
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Bent forward (contact)
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Forward
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back
        },
        'Arm.L.Lower': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Slight bend
        },
        'Arm.R.Lower': {
          rotation: quatFromEuler([0.15, 0, 0] as Vec3), // Slight bend
        },
      },
    },
    {
      time: 0.75,
      joints: {
        // Mid-stance: Right leg supporting weight
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.15, 0, 0] as Vec3), // More vertical
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Less bent
        },
        'Leg.L.Upper': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Swinging forward
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Less bent
        },
      },
    },
    {
      time: 0.9,
      joints: {
        // Toe-off: Right leg pushing off, left leg swinging
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.05, 0, 0] as Vec3), // Almost vertical
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Less bent
        },
        'Leg.L.Upper': {
          rotation: quatFromEuler([0, 0, 0] as Vec3), // Mid-swing
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([0.15, 0, 0] as Vec3), // Less bent
        },
      },
    },
    {
      time: 1.05,
      joints: {
        // Swing phase: Right leg swinging back, left leg preparing contact
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.1, 0, 0] as Vec3), // Swinging back
        },
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Preparing forward
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Preparing contact
        },
      },
    },
    {
      time: 1.2,
      joints: {
        // Back to start position (for seamless loop)
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Forward
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Bent forward
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.25, 0, 0] as Vec3), // Bent back
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Forward
        },
        'Arm.L.Lower': {
          rotation: quatFromEuler([0.15, 0, 0] as Vec3), // Slight bend
        },
        'Arm.R.Lower': {
          rotation: quatFromEuler([-0.15, 0, 0] as Vec3), // Slight bend
        },
        Chest: {
          rotation: quatFromEuler([0.02, 0, 0] as Vec3), // Very slight forward lean
        },
      },
    },
  ],
};

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
export const JUMP_ANIMATION: AvatarAnimation = {
  name: 'jump',
  length: 1.0,
  loop: false,
  frames: [
    {
      time: 0,
      joints: {
        // Starting position (neutral)
        'Leg.L.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Leg.R.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Leg.L.Lower': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Leg.R.Lower': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Arm.L.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Arm.R.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        Chest: {
          rotation: [0, 0, 0, 1] as Quat,
        },
      },
    },
    {
      time: 0.2,
      joints: {
        // Crouch phase: Legs bend, arms swing back
        'Leg.L.Upper': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Back
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Back
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([0.5, 0, 0] as Vec3), // Bent (crouch)
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.5, 0, 0] as Vec3), // Bent (crouch)
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back
        },
        Chest: {
          rotation: quatFromEuler([-0.05, 0, 0] as Vec3), // Slight forward lean
        },
      },
    },
    {
      time: 0.35,
      joints: {
        // Upward phase: Legs extend, arms swing up
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Forward (extending)
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Forward (extending)
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Less bent (extending)
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Less bent (extending)
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([0.4, 0, 0] as Vec3), // Up
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0.4, 0, 0] as Vec3), // Up
        },
        Chest: {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Back (upward motion)
        },
      },
    },
    {
      time: 0.5,
      joints: {
        // Peak phase: At highest point, legs tucked up
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.4, 0, 0] as Vec3), // Up (tucked)
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.4, 0, 0] as Vec3), // Up (tucked)
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.5, 0, 0] as Vec3), // Bent up
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.5, 0, 0] as Vec3), // Bent up
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([0.5, 0, 0] as Vec3), // Up
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0.5, 0, 0] as Vec3), // Up
        },
        Chest: {
          rotation: quatFromEuler([0.15, 0, 0] as Vec3), // Back
        },
      },
    },
    {
      time: 0.7,
      joints: {
        // Landing preparation: Legs extend down, arms start down
        'Leg.L.Upper': {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Less up
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([0.1, 0, 0] as Vec3), // Less up
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Extending down
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([-0.3, 0, 0] as Vec3), // Extending down
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Coming down
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([0.2, 0, 0] as Vec3), // Coming down
        },
        Chest: {
          rotation: quatFromEuler([0.05, 0, 0] as Vec3), // Less back
        },
      },
    },
    {
      time: 0.85,
      joints: {
        // Landing impact: Legs absorb impact
        'Leg.L.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back (absorbing)
        },
        'Leg.R.Upper': {
          rotation: quatFromEuler([-0.2, 0, 0] as Vec3), // Back (absorbing)
        },
        'Leg.L.Lower': {
          rotation: quatFromEuler([0.4, 0, 0] as Vec3), // Bent (absorbing impact)
        },
        'Leg.R.Lower': {
          rotation: quatFromEuler([0.4, 0, 0] as Vec3), // Bent (absorbing impact)
        },
        'Arm.L.Upper': {
          rotation: quatFromEuler([-0.1, 0, 0] as Vec3), // Down
        },
        'Arm.R.Upper': {
          rotation: quatFromEuler([-0.1, 0, 0] as Vec3), // Down
        },
        Chest: {
          rotation: quatFromEuler([-0.02, 0, 0] as Vec3), // Forward (impact)
        },
      },
    },
    {
      time: 1.0,
      joints: {
        // Recovery: Back to neutral
        'Leg.L.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Leg.R.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Leg.L.Lower': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Leg.R.Lower': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Arm.L.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        'Arm.R.Upper': {
          rotation: [0, 0, 0, 1] as Quat,
        },
        Chest: {
          rotation: [0, 0, 0, 1] as Quat,
        },
      },
    },
  ],
};


import type { Vec2 } from '../math';

export type IntentVector = Vec2 | [number, number];

export interface GameplayIntent {
  /** Planar movement input: x = strafe (left -1 → right +1), y = forward (back -1 → forward +1) */
  move: IntentVector;
  /** Look delta in radians (yaw, pitch) since previous frame */
  look: IntentVector;
  /** Jump request (pressed this tick) */
  jump: boolean;
  /** Sprint modifier */
  sprint: boolean;
  /** Interaction / use key */
  use: boolean;
  /** Secondary interaction (e.g., contextual interact) */
  interact: boolean;
  /** Optional ability trigger identifier */
  ability: string | null;
}

export const EMPTY_INTENT: GameplayIntent = Object.freeze({
  move: [0, 0] as IntentVector,
  look: [0, 0] as IntentVector,
  jump: false,
  sprint: false,
  use: false,
  interact: false,
  ability: null,
});

export function cloneIntent(intent: GameplayIntent): GameplayIntent {
  return {
    move: [intent.move[0], intent.move[1]],
    look: [intent.look[0], intent.look[1]],
    jump: intent.jump,
    sprint: intent.sprint,
    use: intent.use,
    interact: intent.interact,
    ability: intent.ability,
  };
}

export function resetIntent(intent: GameplayIntent): void {
  intent.move[0] = 0;
  intent.move[1] = 0;
  intent.look[0] = 0;
  intent.look[1] = 0;
  intent.jump = false;
  intent.sprint = false;
  intent.use = false;
  intent.interact = false;
  intent.ability = null;
}



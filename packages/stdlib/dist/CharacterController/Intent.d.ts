import type { Vec2 } from '@engine/core/math';
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
export declare const EMPTY_INTENT: GameplayIntent;
export declare function cloneIntent(intent: GameplayIntent): GameplayIntent;
export declare function resetIntent(intent: GameplayIntent): void;
//# sourceMappingURL=Intent.d.ts.map
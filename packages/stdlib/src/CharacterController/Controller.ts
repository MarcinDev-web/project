import type { GameplayIntent } from './Intent';
import type { Entity } from '@engine/world';

export type ControllerId = string;

export interface ControllerPreferences {
  fov: number;
  invertY: boolean;
  sensitivity: number;
  hudLayout: string;
}

export interface ControllerContext {
  /** Currently possessed pawn entity */
  pawn: Entity | null;
  /** Latest evaluated intent */
  intent: GameplayIntent;
}

export interface PlayerController {
  readonly id: ControllerId;
  readonly preferences: ControllerPreferences;

  possess(pawn: Entity): void;
  unpossess(): void;
  update(deltaTime: number): void;
  getContext(): ControllerContext;
}

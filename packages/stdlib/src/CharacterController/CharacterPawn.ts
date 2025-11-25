import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

export interface CameraTargetConfig {
  offset: Vec3;
  lag: number;
  collisionRadius: number;
}

export interface PawnMotor {
  readonly entity: Entity;
  applyMovement(move: Vec3, deltaTime: number): void;
  applyLook(yaw: number, pitch: number): void;
  applyJump(): void;
}

export interface CharacterPawn {
  readonly motor: PawnMotor;
  readonly cameraTarget: CameraTargetConfig;
  readonly entity: Entity;
}

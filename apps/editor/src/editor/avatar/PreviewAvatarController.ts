import type { Vec3 } from '@engine/core/math';
import type { CharacterInputHandler } from '@engine/input';
import type { CameraMode } from '@engine/camera';
import { PreviewAvatar } from './PreviewAvatar';

interface UpdateParams {
  deltaTime: number;
  cameraYaw: number;
  cameraPitch: number;
  cameraForward: Vec3;
  cameraRight: Vec3;
  mode: CameraMode;
}

interface UpdateResult {
  yaw?: number;
}

const WALK_SPEED = 3.5;
const SPRINT_MULTIPLIER = 1.8;

/**
 * Handles lightweight movement simulation for the editor preview avatar.
 */
export class PreviewAvatarController {
  private readonly avatar: PreviewAvatar;
  private readonly input: CharacterInputHandler | null;

  constructor(avatar: PreviewAvatar, input: CharacterInputHandler | null) {
    this.avatar = avatar;
    this.input = input ?? null;
  }

  update(params: UpdateParams): UpdateResult {
    if (!this.input) {
      return {};
    }

    if (params.mode !== 'third-person' && params.mode !== 'fps') {
      return {};
    }

    this.input.setCameraDirections(params.cameraForward, params.cameraRight);
    const inputState = this.input.getInput();
    const move = inputState.moveDirection;
    const hasMovement = Math.abs(move[0]) > 1e-3 || Math.abs(move[2]) > 1e-3;

    if (!hasMovement) {
      if (params.mode === 'fps') {
        return { yaw: params.cameraYaw };
      }
      return {};
    }

    const speed = (inputState.sprint ? WALK_SPEED * SPRINT_MULTIPLIER : WALK_SPEED);
    const dtSpeed = speed * params.deltaTime;

    const forward = this.horizontalForward(params.cameraYaw);
    const right = this.horizontalRight(params.cameraYaw);

    const worldX = forward[0] * move[2] + right[0] * move[0];
    const worldZ = forward[2] * move[2] + right[2] * move[0];
    const length = Math.hypot(worldX, worldZ);

    if (length < 1e-4) {
      return {};
    }

    const normX = worldX / length;
    const normZ = worldZ / length;
    const displacement: Vec3 = [normX * dtSpeed, 0, normZ * dtSpeed];

    const pose = this.avatar.getPose();
    const nextPosition: Vec3 = [
      pose.position[0] + displacement[0],
      pose.position[1],
      pose.position[2] + displacement[2],
    ];
    this.avatar.setPosition(nextPosition);

    const yaw = Math.atan2(normX, -normZ);
    return { yaw };
  }

  private horizontalForward(yaw: number): Vec3 {
    return [Math.sin(yaw), 0, -Math.cos(yaw)] as Vec3;
  }

  private horizontalRight(yaw: number): Vec3 {
    return [Math.cos(yaw), 0, Math.sin(yaw)] as Vec3;
  }
}


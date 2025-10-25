import { Logger } from '../app/utils/logger';
import type { PlayerController, ControllerPreferences, ControllerContext } from './Controller';
import type { CharacterInputHandler } from '../input/CharacterInput';
import type { CameraDirector } from '../editor/camera/CameraDirector';
import type { FPSCamera } from '../editor/camera/FPSCamera';
import type { CharacterControllerSystem } from '../scene/CharacterControllerSystem';
import { CharacterController } from '@engine/world';
import type { CharacterInput } from '@engine/world';
import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { EMPTY_INTENT, cloneIntent, type GameplayIntent } from './Intent';

export interface LocalPlayerControllerOptions {
  id: string;
  preferences: ControllerPreferences;
  inputHandler: CharacterInputHandler;
  cameraDirector: CameraDirector;
  fpsCamera: FPSCamera | null;
  characterSystem: CharacterControllerSystem | null;
}

export class LocalPlayerController implements PlayerController {
  readonly id: string;
  readonly preferences: ControllerPreferences;

  private readonly inputHandler: CharacterInputHandler;
  private readonly cameraDirector: CameraDirector;
  private readonly fpsCamera: FPSCamera | null;
  private readonly characterSystem: CharacterControllerSystem | null;

  private pawnController: CharacterController | null = null;
  private context: ControllerContext;
  private lastYaw = 0;
  private lastPitch = 0;

  constructor(options: LocalPlayerControllerOptions) {
    this.id = options.id;
    this.preferences = options.preferences;
    this.inputHandler = options.inputHandler;
    this.cameraDirector = options.cameraDirector;
    this.fpsCamera = options.fpsCamera ?? null;
    this.characterSystem = options.characterSystem ?? null;

    const intent = cloneIntent(EMPTY_INTENT);
    this.context = {
      pawn: null,
      intent,
    };
  }

  possess(pawn: Entity): void {
    const controller = pawn.getComponent(CharacterController);
    if (!controller) {
      Logger.warn('LocalPlayerController: pawn missing CharacterController component');
      this.context.pawn = pawn;
      this.pawnController = null;
      return;
    }

    this.context.pawn = pawn;
    this.pawnController = controller;

    if (this.fpsCamera) {
      const { yaw, pitch } = this.fpsCamera.getYawPitch();
      this.lastYaw = yaw;
      this.lastPitch = pitch;
    }
  }

  unpossess(): void {
    this.context.pawn = null;
    this.pawnController = null;
  }

  update(deltaTime: number): void {
    if (!this.context.pawn || !this.pawnController) {
      return;
    }

    const input = this.inputHandler.getInput();

    // Update intent state
    const intent = this.context.intent;
    intent.move[0] = input.moveDirection[0];
    intent.move[1] = input.moveDirection[2];
    intent.jump = input.jump;
    intent.sprint = input.sprint;
    intent.use = false;
    intent.interact = false;
    intent.ability = null;

    if (this.fpsCamera) {
      const { yaw, pitch } = this.fpsCamera.getYawPitch();
      intent.look[0] = yaw - this.lastYaw;
      intent.look[1] = pitch - this.lastPitch;
      this.lastYaw = yaw;
      this.lastPitch = pitch;
    } else {
      intent.look[0] = 0;
      intent.look[1] = 0;
    }

    // Apply to character controller
    const forwardVec: Vec3 = this.fpsCamera?.getForwardDirection() ?? [0, 0, -1];
    const rightVec: Vec3 = this.fpsCamera?.getRightDirection() ?? [1, 0, 0];

    if (this.characterSystem) {
      this.characterSystem.applyIntent(
        this.pawnController,
        {
          move: [intent.move[0], intent.move[1]],
          jump: intent.jump,
          sprint: intent.sprint,
        },
        forwardVec,
        rightVec
      );
    } else {
      const directInput: CharacterInput = {
        moveDirection: [intent.move[0], 0, intent.move[1]],
        sprint: intent.sprint,
        jump: intent.jump,
        cameraForward: forwardVec,
        cameraRight: rightVec,
      };
      this.pawnController.setInput(directInput);
    }
  }

  getContext(): ControllerContext {
    return this.context;
  }
}



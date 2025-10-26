import { CharacterController } from '@engine/world';
import { EMPTY_INTENT, cloneIntent } from './Intent';
export class LocalPlayerController {
    id;
    preferences;
    inputHandler;
    // @ts-expect-error - Kept for future use
    _cameraDirector;
    fpsCamera;
    characterSystem;
    pawnController = null;
    context;
    lastYaw = 0;
    lastPitch = 0;
    constructor(options) {
        this.id = options.id;
        this.preferences = options.preferences;
        this.inputHandler = options.inputHandler;
        this._cameraDirector = options.cameraDirector;
        this.fpsCamera = options.fpsCamera ?? null;
        this.characterSystem = options.characterSystem ?? null;
        const intent = cloneIntent(EMPTY_INTENT);
        this.context = {
            pawn: null,
            intent,
        };
    }
    possess(pawn) {
        const controller = pawn.getComponent(CharacterController);
        if (!controller) {
            console.warn('LocalPlayerController: pawn missing CharacterController component');
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
    unpossess() {
        this.context.pawn = null;
        this.pawnController = null;
    }
    update(_deltaTime) {
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
        }
        else {
            intent.look[0] = 0;
            intent.look[1] = 0;
        }
        // Apply to character controller
        const forwardVec = this.fpsCamera?.getForwardDirection() ?? [0, 0, -1];
        const rightVec = this.fpsCamera?.getRightDirection() ?? [1, 0, 0];
        if (this.characterSystem) {
            this.characterSystem.applyIntent(this.pawnController, {
                move: [intent.move[0], intent.move[1]],
                jump: intent.jump,
                sprint: intent.sprint,
            }, forwardVec, rightVec);
        }
        else {
            const directInput = {
                moveDirection: [intent.move[0], 0, intent.move[1]],
                sprint: intent.sprint,
                jump: intent.jump,
                cameraForward: forwardVec,
                cameraRight: rightVec,
            };
            this.pawnController.setInput(directInput);
        }
    }
    getContext() {
        return this.context;
    }
}
//# sourceMappingURL=LocalPlayerController.js.map
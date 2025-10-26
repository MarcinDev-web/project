import type { PlayerController, ControllerPreferences, ControllerContext } from './Controller';
import { CharacterController } from '@engine/world';
import type { CharacterInput } from '@engine/world';
import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
export interface CharacterInputHandler {
    getInput(): CharacterInput;
}
export interface CameraDirector {
}
export interface FPSCamera {
    getYawPitch(): {
        yaw: number;
        pitch: number;
    };
    getForwardDirection(): Vec3;
    getRightDirection(): Vec3;
}
export interface CharacterControllerSystem {
    applyIntent(controller: CharacterController, intent: {
        move: [number, number];
        jump: boolean;
        sprint: boolean;
    }, cameraForward: Vec3, cameraRight: Vec3): void;
}
export interface LocalPlayerControllerOptions {
    id: string;
    preferences: ControllerPreferences;
    inputHandler: CharacterInputHandler;
    cameraDirector: CameraDirector;
    fpsCamera: FPSCamera | null;
    characterSystem: CharacterControllerSystem | null;
}
export declare class LocalPlayerController implements PlayerController {
    readonly id: string;
    readonly preferences: ControllerPreferences;
    private readonly inputHandler;
    private readonly _cameraDirector;
    private readonly fpsCamera;
    private readonly characterSystem;
    private pawnController;
    private context;
    private lastYaw;
    private lastPitch;
    constructor(options: LocalPlayerControllerOptions);
    possess(pawn: Entity): void;
    unpossess(): void;
    update(_deltaTime: number): void;
    getContext(): ControllerContext;
}
//# sourceMappingURL=LocalPlayerController.d.ts.map
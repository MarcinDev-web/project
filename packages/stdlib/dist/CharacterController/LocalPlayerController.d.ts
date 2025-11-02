import type { PlayerController, ControllerPreferences, ControllerContext } from './Controller';
import { CharacterController } from '@engine/world';
import type { CharacterInput } from '@engine/world';
import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { ProfileSwitcher } from '../MovementProfiles/ProfileSwitcher';
export interface CharacterInputHandler {
    getInput(): CharacterInput;
}
/**
 * Optional interface for checking special keys (F1-F4, Tab, etc.)
 * If not provided, profile switching will be disabled
 */
export interface KeyInputProvider {
    isKeyPressed(key: string): boolean;
    wasKeyJustPressed?(key: string): boolean;
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
    keyInputProvider?: KeyInputProvider;
    enableProfileSwitching?: boolean;
}
export declare class LocalPlayerController implements PlayerController {
    readonly id: string;
    readonly preferences: ControllerPreferences;
    private readonly inputHandler;
    private readonly _cameraDirector;
    private readonly fpsCamera;
    private readonly characterSystem;
    private readonly keyInputProvider;
    private readonly enableProfileSwitching;
    private pawnController;
    private context;
    private lastYaw;
    private lastPitch;
    private profileSwitcher;
    private lastProfileSwitchKeys;
    constructor(options: LocalPlayerControllerOptions);
    possess(pawn: Entity): void;
    unpossess(): void;
    update(_deltaTime: number): void;
    /**
     * Handle profile switching based on key input
     */
    private handleProfileSwitching;
    /**
     * Set custom profile switcher
     */
    setProfileSwitcher(switcher: ProfileSwitcher): void;
    /**
     * Get current profile switcher
     */
    getProfileSwitcher(): ProfileSwitcher | null;
    getContext(): ControllerContext;
}
//# sourceMappingURL=LocalPlayerController.d.ts.map
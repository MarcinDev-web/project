import { CharacterController } from '@engine/world';
import { EMPTY_INTENT, cloneIntent } from './Intent';
import { ProfileSwitcher } from '../MovementProfiles/ProfileSwitcher';
import { PRESET_PROFILES } from '../MovementProfiles/presets';
export class LocalPlayerController {
    id;
    preferences;
    inputHandler;
    // @ts-expect-error - Kept for future use
    _cameraDirector;
    fpsCamera;
    characterSystem;
    keyInputProvider;
    enableProfileSwitching;
    pawnController = null;
    context;
    lastYaw = 0;
    lastPitch = 0;
    profileSwitcher = null;
    lastProfileSwitchKeys = new Set();
    constructor(options) {
        this.id = options.id;
        this.preferences = options.preferences;
        this.inputHandler = options.inputHandler;
        this._cameraDirector = options.cameraDirector;
        this.fpsCamera = options.fpsCamera ?? null;
        this.characterSystem = options.characterSystem ?? null;
        this.keyInputProvider = options.keyInputProvider ?? null;
        this.enableProfileSwitching = options.enableProfileSwitching ?? (options.keyInputProvider !== undefined);
        // Initialize profile switcher with default profiles
        if (this.enableProfileSwitching && this.keyInputProvider) {
            this.profileSwitcher = new ProfileSwitcher([
                PRESET_PROFILES.HUMAN,
                PRESET_PROFILES.FAST_HUMAN,
                PRESET_PROFILES.FLYING_HUMAN,
                PRESET_PROFILES.SPEED_BOOST_HUMAN,
            ]);
        }
        const intent = cloneIntent(EMPTY_INTENT);
        this.context = {
            pawn: null,
            intent,
        };
    }
    possess(pawn) {
        // Use MovementController interface - works with CharacterController now,
        // and will work with future movement types (VehicleController, FlyingController, etc.)
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
        // Handle profile switching
        if (this.enableProfileSwitching && this.keyInputProvider && this.profileSwitcher && this.pawnController instanceof CharacterController) {
            this.handleProfileSwitching();
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
        // Create CharacterInput for multiplayer replication
        const characterInput = {
            moveDirection: [intent.move[0], 0, intent.move[1]],
            sprint: intent.sprint,
            jump: intent.jump,
            cameraForward: forwardVec,
            cameraRight: rightVec,
        };
        // Process multiplayer input replication (if callback is set)
        if (this.onMultiplayerInput) {
            this.onMultiplayerInput(characterInput);
        }
        if (this.characterSystem) {
            // Use system applyIntent for multiplayer replication
            // System expects CharacterController specifically for camera-relative movement
            if (this.pawnController instanceof CharacterController) {
                this.characterSystem.applyIntent(this.pawnController, {
                    move: [intent.move[0], intent.move[1]],
                    jump: intent.jump,
                    sprint: intent.sprint,
                }, forwardVec, rightVec);
            }
        }
        else {
            // Direct input - can use MovementInput or CharacterInput
            // CharacterInput needed for camera-relative movement in multiplayer
            this.pawnController.setInput(characterInput);
        }
    }
    /**
     * Handle profile switching based on key input
     */
    handleProfileSwitching() {
        if (!this.keyInputProvider || !this.profileSwitcher || !(this.pawnController instanceof CharacterController)) {
            return;
        }
        const keys = new Set();
        const checkKey = (key) => {
            const pressed = this.keyInputProvider.isKeyPressed(key);
            const wasPressed = this.lastProfileSwitchKeys.has(key);
            if (pressed) {
                keys.add(key);
            }
            // Detect key press (was not pressed, now is pressed)
            return pressed && !wasPressed;
        };
        // F1 - Normal (HUMAN)
        if (checkKey('F1')) {
            const profile = this.profileSwitcher.switchTo('human');
            if (profile) {
                this.pawnController.applyProfile(profile);
            }
        }
        // F2 - Fast (FAST_HUMAN)
        else if (checkKey('F2')) {
            const profile = this.profileSwitcher.switchTo('fast-human');
            if (profile) {
                this.pawnController.applyProfile(profile);
            }
        }
        // F3 - Flying (FLYING_HUMAN)
        else if (checkKey('F3')) {
            const profile = this.profileSwitcher.switchTo('flying-human');
            if (profile) {
                this.pawnController.applyProfile(profile);
            }
        }
        // F4 - Speed Boost (SPEED_BOOST_HUMAN)
        else if (checkKey('F4')) {
            const profile = this.profileSwitcher.switchTo('speed-boost-human');
            if (profile) {
                this.pawnController.applyProfile(profile);
            }
        }
        // Tab - Switch to next profile (cycle)
        else if (checkKey('Tab')) {
            const profile = this.profileSwitcher.switchToNext();
            this.pawnController.applyProfile(profile);
        }
        // Update last keys state
        this.lastProfileSwitchKeys = keys;
    }
    /**
     * Set custom profile switcher
     */
    setProfileSwitcher(switcher) {
        this.profileSwitcher = switcher;
    }
    /**
     * Get current profile switcher
     */
    getProfileSwitcher() {
        return this.profileSwitcher;
    }
    getContext() {
        return this.context;
    }
}
//# sourceMappingURL=LocalPlayerController.js.map
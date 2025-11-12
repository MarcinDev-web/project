import type { PlayerController, ControllerPreferences, ControllerContext } from './Controller';
import { CharacterController } from '@engine/world';
import type { CharacterInput, MovementController } from '@engine/world';
import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { EMPTY_INTENT, cloneIntent } from './Intent';
import { ProfileSwitcher } from '../MovementProfiles/ProfileSwitcher';
import { PRESET_PROFILES } from '../MovementProfiles/presets';

// Note: This file has dependencies on editor components that need to be resolved
// These types are imported but will need to be adapted for the stdlib package

export interface CharacterInputHandler {
  getInput(): CharacterInput;
}

/**
 * Optional interface for checking special keys (F1-F4, Tab, etc.)
 * If not provided, profile switching will be disabled
 */
export interface KeyInputProvider {
  isKeyPressed(key: string): boolean;
  wasKeyJustPressed?(key: string): boolean; // Optional: for one-time key press detection
}

export interface CameraDirector {
  // minimal interface stub - will be defined properly when camera system is migrated
}

export interface FPSCamera {
  getYawPitch(): { yaw: number; pitch: number };
  getForwardDirection(): Readonly<Vec3>;
  getRightDirection(): Readonly<Vec3>;
}

export interface CharacterControllerSystem {
  applyIntent(
    controller: CharacterController,
    intent: { move: [number, number]; jump: boolean; sprint: boolean },
    cameraForward: Vec3,
    cameraRight: Vec3
  ): void;
}

export interface LocalPlayerControllerOptions {
  id: string;
  preferences: ControllerPreferences;
  inputHandler: CharacterInputHandler;
  cameraDirector: CameraDirector;
  fpsCamera: FPSCamera | null;
  characterSystem: CharacterControllerSystem | null;
  keyInputProvider?: KeyInputProvider; // Optional: for profile switching
  enableProfileSwitching?: boolean; // Enable profile switching (default: true if keyInputProvider provided)
}

export class LocalPlayerController implements PlayerController {
  readonly id: string;
  readonly preferences: ControllerPreferences;

  private readonly inputHandler: CharacterInputHandler;
  private readonly fpsCamera: FPSCamera | null;
  private readonly characterSystem: CharacterControllerSystem | null;
  private readonly keyInputProvider: KeyInputProvider | null;
  private readonly enableProfileSwitching: boolean;

  private pawnController: MovementController | null = null;
  private context: ControllerContext;
  private lastYaw = 0;
  private lastPitch = 0;
  private profileSwitcher: ProfileSwitcher | null = null;
  private lastProfileSwitchKeys: Set<string> = new Set();

  constructor(options: LocalPlayerControllerOptions) {
    this.id = options.id;
    this.preferences = options.preferences;
    this.inputHandler = options.inputHandler;
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

  possess(pawn: Entity): void {
    // Use MovementController interface - works with CharacterController now,
    // and will work with future movement types (VehicleController, FlyingController, etc.)
    const controller = pawn.getComponent(CharacterController) as MovementController;
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

  unpossess(): void {
    this.context.pawn = null;
    this.pawnController = null;
  }

  update(_deltaTime: number): void {
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
    } else {
      intent.look[0] = 0;
      intent.look[1] = 0;
    }

    // Apply to character controller
    const forwardReadonly = this.fpsCamera?.getForwardDirection() ?? [0, 0, -1];
    const rightReadonly = this.fpsCamera?.getRightDirection() ?? [1, 0, 0];
    const forwardVec: Vec3 = [forwardReadonly[0], forwardReadonly[1], forwardReadonly[2]];
    const rightVec: Vec3 = [rightReadonly[0], rightReadonly[1], rightReadonly[2]];

    // Create CharacterInput for multiplayer replication
    const characterInput: CharacterInput = {
      moveDirection: [intent.move[0], 0, intent.move[1]],
      sprint: intent.sprint,
      jump: intent.jump,
      cameraForward: forwardVec,
      cameraRight: rightVec,
    };

    // Process multiplayer input replication (if callback is set)
    if ((this as any).onMultiplayerInput) {
      (this as any).onMultiplayerInput(characterInput);
    }

    if (this.characterSystem) {
      // Use system applyIntent for multiplayer replication
      // System expects CharacterController specifically for camera-relative movement
      if (this.pawnController instanceof CharacterController) {
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
      }
    } else {
      // Direct input - can use MovementInput or CharacterInput
      // CharacterInput needed for camera-relative movement in multiplayer
      this.pawnController.setInput(characterInput);
    }
  }

  /**
   * Handle profile switching based on key input
   */
  private handleProfileSwitching(): void {
    if (!this.keyInputProvider || !this.profileSwitcher || !(this.pawnController instanceof CharacterController)) {
      return;
    }

    const keys = new Set<string>();
    const checkKey = (key: string): boolean => {
      const pressed = this.keyInputProvider!.isKeyPressed(key);
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
  setProfileSwitcher(switcher: ProfileSwitcher): void {
    this.profileSwitcher = switcher;
  }

  /**
   * Get current profile switcher
   */
  getProfileSwitcher(): ProfileSwitcher | null {
    return this.profileSwitcher;
  }

  getContext(): ControllerContext {
    return this.context;
  }
}


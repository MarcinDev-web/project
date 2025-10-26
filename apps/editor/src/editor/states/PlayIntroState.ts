import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { Logger } from '../../utils/logger';
import type { CameraDirector } from '../camera/CameraDirector';
import type { InputContextManager } from '@engine/input';
import { GameplayInputContext } from '@engine/input';
import type { Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import type { PlayManifest } from '../core/PlayManifest';

/**
 * Dependencies for PLAY_INTRO state
 */
export interface PlayIntroStateDeps {
  /** Camera director for blending */
  cameraDirector: CameraDirector;
  /** Input context manager */
  inputContext: InputContextManager;
  /** Track whether gameplay context has been pushed */
  markGameplayContextActive: (active: boolean) => void;
  /** Check if gameplay context is active */
  isGameplayContextActive: () => boolean;
  /** Spawn player entity */
  spawnPlayer: (position: Vec3, rotation: number) => Entity;
  /** Configure controller bindings */
  configureController: (manifest: PlayManifest) => void;
  /** Enable character input */
  enableCharacterInput: () => void;
  /** Disable orbit controls during play intro */
  disableOrbitControls: () => void;
  /** Freeze history recording */
  freezeHistory: () => void;
  /** Whether FPS camera mode is available */
  hasFpsCamera?: () => boolean;
  /** Called when play intro fails to transition */
  onFailure?: () => void;
  /** Optional blend duration override */
  blendDuration?: number;
}

/**
 * PLAY_INTRO State - Handoff to gameplay
 * 
 * Responsibilities:
 * - Switch InputContext: Editor → Gameplay
 * - Request pointer lock
 * - Blend camera: Orbit → FPS
 * - Spawn player at PlayerStart
 * - Auto-transition to PLAYING after handoff
 */
export class PlayIntroState implements IPlayModeState {
  readonly type = StateType.PLAY_INTRO;
  
  private deps: PlayIntroStateDeps;
  private handoffComplete = false;
  private readonly blendDuration: number;
  private elapsed = 0;
  private pendingInputContextPush = false;

  constructor(deps: PlayIntroStateDeps) {
    this.deps = deps;
    this.blendDuration = deps.blendDuration ?? 0;
  }

  onEnter(context: PlayModeContext): void {
    Logger.debug('Entering PLAY_INTRO state');
    
    this.handoffComplete = false;
    this.elapsed = 0;
    this.pendingInputContextPush = false;
    
    let transitionFailed = false;

    try {
      this.deps.disableOrbitControls();
      this.deps.freezeHistory();

      // Step 1: Push gameplay input context
      Logger.debug('Switching to gameplay input context');
      this.deps.inputContext.push({
        ...GameplayInputContext,
        onAction: (action) => {
          if (action === 'pause') {
            // Handle pause in PLAYING state
          }
        },
      });
      this.pendingInputContextPush = true;
      this.deps.markGameplayContextActive(true);
      
      const manifest = context.manifest as PlayManifest | undefined;
      if (manifest) {
        this.deps.configureController(manifest);
      }

      // Step 2: Spawn player
      const playerPos = manifest?.playerStart?.position ?? [0, 2, 0];
      const playerRot = manifest?.playerStart?.rotation ?? 0;

      Logger.debug('Spawning player at', playerPos);
      const player = this.deps.spawnPlayer(playerPos as Vec3, playerRot);
      context.data.set('playerEntity', player);
      this.deps.cameraDirector.setPlayerPosition(player.transform.position);
      
      // Step 3: Start camera blend from orbit to FPS
      const hasFpsCamera = this.deps.hasFpsCamera?.() ?? true;
      if (hasFpsCamera) {
        Logger.debug('Starting camera blend: orbit → fps');
        const blendDuration = this.blendDuration > 0 ? this.blendDuration : 0.33;
        this.deps.cameraDirector.startBlend('fps', blendDuration);
      } else {
        Logger.warn('FPS camera unavailable, skipping blend');
        this.deps.cameraDirector.setMode('orbit');
      }
      
      // Step 4: Enable character input
      this.deps.enableCharacterInput();
      
      Logger.info('Play intro started');

      if (this.blendDuration <= 0) {
        this.handoffComplete = true;
      }
    } catch (error) {
      Logger.error('Failed to start play intro:', error as Error);
      context.errors.push(`Play intro failed: ${error instanceof Error ? error.message : String(error)}`);
      transitionFailed = true;
      this.handoffComplete = true; // Force exit
    }

    if (transitionFailed && this.pendingInputContextPush) {
      this.deps.inputContext.pop();
      this.deps.markGameplayContextActive(false);
      this.pendingInputContextPush = false;
      this.deps.onFailure?.();
    }
  }

  onExit(): void {
    Logger.debug('Exiting PLAY_INTRO state');
    if (this.pendingInputContextPush) {
      this.deps.inputContext.pop();
      this.deps.markGameplayContextActive(false);
      this.pendingInputContextPush = false;
    }
  }

  onUpdate(deltaTime: number, context: PlayModeContext): PlayModeStateType | null {
    if (!this.handoffComplete && this.blendDuration > 0) {
      this.elapsed += deltaTime;
      if (this.elapsed >= this.blendDuration) {
        this.handoffComplete = true;
      }
    }
    
    // Update player position for camera
    const player = context.data.get('playerEntity') as Entity | undefined;
    if (player) {
      this.deps.cameraDirector.setPlayerPosition(player.transform.position);
    }
    
    // Wait for blend to complete
    if (this.elapsed >= this.blendDuration) {
      this.handoffComplete = true;
    }
    
    if (this.handoffComplete) {
      if (context.errors.length > 0) {
        if (this.pendingInputContextPush || this.deps.isGameplayContextActive()) {
          this.deps.inputContext.pop();
          this.deps.markGameplayContextActive(false);
          this.pendingInputContextPush = false;
        }
        return StateType.RETURN; // Failed, return to edit
      }
      this.pendingInputContextPush = false;
      return StateType.PLAYING; // Success, start playing
    }
    
    return null; // Still transitioning
  }

  canTransitionTo(target: PlayModeStateType): boolean {
    // Can transition to PLAYING (success) or RETURN (failure)
    return target === StateType.PLAYING || target === StateType.RETURN;
  }
}


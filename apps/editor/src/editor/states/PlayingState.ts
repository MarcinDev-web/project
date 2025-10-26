import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { Logger } from '../../utils/logger';
import type { Entity } from '@engine/world';
import type { CameraDirector } from '../camera/CameraDirector';

/**
 * Dependencies for PLAYING state
 */
export interface PlayingStateDeps {
  /** Update FPS camera */
  updateFPSCamera: () => void;
  /** Camera director */
  cameraDirector: CameraDirector;
  /** Re-enable orbit controls */
  enableOrbitControls: () => void;
  /** Restore orbit state */
  restoreOrbitState: () => void;
  /** Update character input with camera directions */
  updateCharacterInput: (forward: [number, number, number], right: [number, number, number]) => void;
  /** Get FPS camera forward direction */
  getCameraForward: () => [number, number, number];
  /** Get FPS camera right direction */
  getCameraRight: () => [number, number, number];
  /** Resume history recording */
  resumeHistory: () => void;
  /** Update scripts */
  updateScripts?: (deltaTime: number) => void;
  /** Update audio */
  updateAudio?: (deltaTime: number) => void;
}

/**
 * PLAYING State - Active gameplay
 * 
 * Responsibilities:
 * - Tick physics, AI, scripts, audio
 * - Update FPS camera
 * - Update character controllers
 * - Handle pause (Esc → PAUSED)
 * - Handle stop (Stop button → RETURN)
 */
export class PlayingState implements IPlayModeState {
  readonly type = StateType.PLAYING;
  
  private deps: PlayingStateDeps;
  private requestPause = false;
  private requestStop = false;

  constructor(deps: PlayingStateDeps) {
    this.deps = deps;
  }

  onEnter(_context: PlayModeContext): void {
    Logger.debug('Entering PLAYING state');
    this.requestPause = false;
    this.requestStop = false;
    Logger.info('Play mode active - use Esc to pause');
  }

  onExit(_context: PlayModeContext): void {
    Logger.debug('Exiting PLAYING state');
    this.deps.enableOrbitControls();
    this.deps.restoreOrbitState();
    this.deps.resumeHistory();
  }

  onUpdate(deltaTime: number, context: PlayModeContext): PlayModeStateType | null {
    try {
      // Update player position for camera
      const player = context.data.get('playerEntity') as Entity | undefined;
      if (player) {
        this.deps.cameraDirector.setPlayerPosition(player.transform.position);
      }
      
      // Update FPS camera
      this.deps.updateFPSCamera();
      
      // Update character input with camera directions
      const forward = this.deps.getCameraForward();
      const right = this.deps.getCameraRight();
      this.deps.updateCharacterInput(forward, right);
      
      // Update scripts (if available)
      this.deps.updateScripts?.(deltaTime);
      
      // Update audio (if available)
      this.deps.updateAudio?.(deltaTime);
      
      // Check for pause request
      if (this.requestPause) {
        this.requestPause = false;
        return StateType.PAUSED;
      }
      
      // Check for stop request
      if (this.requestStop) {
        this.requestStop = false;
        return StateType.RETURN;
      }
    } catch (error) {
      Logger.error('Error during play mode update:', error as Error);
      context.errors.push(`Runtime error: ${error instanceof Error ? error.message : String(error)}`);
      // Don't crash, just log the error and continue
    }
    
    return null; // Stay in PLAYING
  }

  canTransitionTo(target: PlayModeStateType): boolean {
    // Can transition to PAUSED or RETURN
    return target === StateType.PAUSED || target === StateType.RETURN;
  }

  /**
   * Request pause (called by external systems, e.g., Esc key)
   */
  pause(): void {
    this.requestPause = true;
  }

  /**
   * Request stop (called by external systems, e.g., Stop button)
   */
  stop(): void {
    this.requestStop = true;
  }
}


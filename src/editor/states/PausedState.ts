import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { Logger } from '../../app/utils/logger';

/**
 * Dependencies for PAUSED state
 */
export interface PausedStateDeps {
  /** Set time scale (0 = frozen) */
  setTimeScale: (scale: number) => void;
  /** Show/hide pause menu */
  setPauseMenuVisible: (visible: boolean) => void;
}

/**
 * PAUSED State - Game paused
 * 
 * Responsibilities:
 * - Freeze time (timescale = 0)
 * - Show pause menu
 * - Handle: Resume → PLAYING, Restart → LOADING, Stop → RETURN
 */
export class PausedState implements IPlayModeState {
  readonly type = StateType.PAUSED;
  
  private readonly deps: PausedStateDeps;
  private requestResume = false;
  private requestStop = false;
  private requestRestart = false;

  constructor(deps: PausedStateDeps) {
    this.deps = deps;
  }

  onEnter(_context: PlayModeContext): void {
    Logger.debug('Entering PAUSED state');
    
    // Freeze time
    this.deps.setTimeScale(0);
    
    // Show pause menu
    this.deps.setPauseMenuVisible(true);
    
    this.requestResume = false;
    this.requestStop = false;
    this.requestRestart = false;
    
    Logger.info('Game paused');
  }

  onExit(): void {
    Logger.debug('Exiting PAUSED state');
    
    // Restore normal time
    this.deps.setTimeScale(1);
    
    // Hide pause menu
    this.deps.setPauseMenuVisible(false);
  }

  onUpdate(_deltaTime: number, _context: PlayModeContext): PlayModeStateType | null {
    // Check for resume
    if (this.requestResume) {
      this.resetRequests();
      return StateType.PLAYING;
    }

    if (this.requestRestart) {
      this.resetRequests();
      return StateType.LOADING;
    }

    if (this.requestStop) {
      this.resetRequests();
      return StateType.RETURN;
    }

    return null; // Stay paused
  }

  canTransitionTo(target: PlayModeStateType): boolean {
    // Can transition to PLAYING (resume), LOADING (restart), or RETURN (stop)
    return target === StateType.PLAYING || target === StateType.LOADING || target === StateType.RETURN;
  }

  /**
   * Resume game
   */
  resume(): void {
    this.requestResume = true;
  }

  /**
   * Stop and return to edit
   */
  stop(): void {
    this.requestStop = true;
  }

  /**
   * Restart play mode (return to loading)
   */
  restart(): void {
    this.requestRestart = true;
  }

  private resetRequests(): void {
    this.requestResume = false;
    this.requestStop = false;
    this.requestRestart = false;
  }
}


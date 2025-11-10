import type { IPlayerState, PlayerContext, PlayerStateType } from '../PlayerStateMachine.js';
import { PlayerStateType as StateType } from '../PlayerStateMachine.js';
import { Logger } from '../../utils/logger';

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
 * - Handle: Resume → PLAYING, Exit → (exit game)
 */
export class PausedState implements IPlayerState {
  readonly type = StateType.PAUSED;
  
  private readonly deps: PausedStateDeps;
  private requestResume = false;
  private requestExit = false;

  constructor(deps: PausedStateDeps) {
    this.deps = deps;
  }

  onEnter(_context: PlayerContext): void {
    Logger.debug('Entering PAUSED state');
    
    // Freeze time
    this.deps.setTimeScale(0);
    
    // Show pause menu
    this.deps.setPauseMenuVisible(true);
    
    this.requestResume = false;
    this.requestExit = false;
    
    Logger.info('Game paused');
  }

  onExit(): void {
    Logger.debug('Exiting PAUSED state');
    
    // Restore normal time
    this.deps.setTimeScale(1);
    
    // Hide pause menu
    this.deps.setPauseMenuVisible(false);
  }

  onUpdate(_deltaTime: number, _context: PlayerContext): PlayerStateType | null {
    // Check for resume
    if (this.requestResume) {
      this.resetRequests();
      return StateType.PLAYING;
    }

    if (this.requestExit) {
      this.resetRequests();
      // Exit will be handled by PlayerModeManager
      return null; // Stay paused until exit is handled
    }

    return null; // Stay paused
  }

  canTransitionTo(target: PlayerStateType): boolean {
    // Can transition to PLAYING (resume)
    return target === StateType.PLAYING;
  }

  /**
   * Resume game
   */
  resume(): void {
    this.requestResume = true;
  }

  /**
   * Request exit (will be handled by PlayerModeManager)
   */
  exit(): void {
    this.requestExit = true;
  }

  /**
   * Check if exit was requested
   */
  isExitRequested(): boolean {
    return this.requestExit;
  }

  private resetRequests(): void {
    this.requestResume = false;
    this.requestExit = false;
  }
}


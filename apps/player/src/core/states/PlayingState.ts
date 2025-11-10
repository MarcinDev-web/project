import type { IPlayerState, PlayerContext, PlayerStateType } from '../PlayerStateMachine.js';
import { PlayerStateType as StateType } from '../PlayerStateMachine.js';
import { Logger } from '../../utils/logger';

/**
 * Dependencies for PLAYING state
 */
export interface PlayingStateDeps {
  /** Update game systems */
  updateGame: (deltaTime: number) => void;
  /** Request pause (called externally, e.g., Esc key) */
  requestPause?: () => void;
}

/**
 * PLAYING State - Active gameplay
 * 
 * Responsibilities:
 * - Update game loop (physics, scripts, multiplayer, etc.)
 * - Handle pause request (Esc → PAUSED)
 * - Handle disconnection (→ DISCONNECTED)
 */
export class PlayingState implements IPlayerState {
  readonly type = StateType.PLAYING;
  
  private deps: PlayingStateDeps;
  private requestPause = false;
  private isDisconnected = false;

  constructor(deps: PlayingStateDeps) {
    this.deps = deps;
  }

  onEnter(_context: PlayerContext): void {
    Logger.debug('Entering PLAYING state');
    this.requestPause = false;
    this.isDisconnected = false;
    Logger.info('Game started - use Esc to pause');
  }

  onExit(_context: PlayerContext): void {
    Logger.debug('Exiting PLAYING state');
  }

  onUpdate(deltaTime: number, context: PlayerContext): PlayerStateType | null {
    try {
      // Update game systems
      this.deps.updateGame(deltaTime);
      
      // Check for pause request
      if (this.requestPause) {
        this.requestPause = false;
        return StateType.PAUSED;
      }
      
      // Check for disconnection
      if (this.isDisconnected) {
        this.isDisconnected = false;
        return StateType.DISCONNECTED;
      }
    } catch (error) {
      Logger.error('Error during gameplay update:', error as unknown as Error);
      context.errors.push(`Runtime error: ${error instanceof Error ? error.message : String(error)}`);
      // Don't crash, just log the error and continue
    }
    
    return null; // Stay in PLAYING
  }

  canTransitionTo(target: PlayerStateType): boolean {
    // Can transition to PAUSED or DISCONNECTED
    return target === StateType.PAUSED || target === StateType.DISCONNECTED;
  }

  /**
   * Request pause (called by external systems, e.g., Esc key)
   */
  pause(): void {
    this.requestPause = true;
  }

  /**
   * Mark as disconnected
   */
  disconnect(): void {
    this.isDisconnected = true;
  }
}


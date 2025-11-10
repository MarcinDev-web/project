import type { IPlayerState, PlayerContext, PlayerStateType } from '../PlayerStateMachine.js';
import { PlayerStateType as StateType } from '../PlayerStateMachine.js';
import { Logger } from '../../utils/logger';

/**
 * Dependencies for DISCONNECTED state
 */
export interface DisconnectedStateDeps {
  /** Show/hide disconnect UI */
  setDisconnectUIVisible: (visible: boolean) => void;
  /** Attempt to reconnect */
  reconnect?: () => Promise<void>;
}

/**
 * DISCONNECTED State - Lost connection to server
 * 
 * Responsibilities:
 * - Show disconnect UI
 * - Allow reconnection attempt
 * - Handle exit
 */
export class DisconnectedState implements IPlayerState {
  readonly type = StateType.DISCONNECTED;
  
  private readonly deps: DisconnectedStateDeps;
  private requestReconnect = false;
  private requestExit = false;

  constructor(deps: DisconnectedStateDeps) {
    this.deps = deps;
  }

  onEnter(_context: PlayerContext): void {
    Logger.debug('Entering DISCONNECTED state');
    
    // Show disconnect UI
    this.deps.setDisconnectUIVisible(true);
    
    this.requestReconnect = false;
    this.requestExit = false;
    
    Logger.warn('Disconnected from server');
  }

  onExit(): void {
    Logger.debug('Exiting DISCONNECTED state');
    
    // Hide disconnect UI
    this.deps.setDisconnectUIVisible(false);
  }

  onUpdate(_deltaTime: number, context: PlayerContext): PlayerStateType | null {
    // Check for reconnect
    if (this.requestReconnect && this.deps.reconnect) {
      this.requestReconnect = false;
      void this.attemptReconnect(context);
      return null; // Stay disconnected until reconnect succeeds
    }

    if (this.requestExit) {
      this.resetRequests();
      // Exit will be handled by PlayerModeManager
      return null;
    }

    return null; // Stay disconnected
  }

  canTransitionTo(target: PlayerStateType): boolean {
    // Can transition to CONNECTING (reconnect) or stay disconnected
    return target === StateType.CONNECTING;
  }

  /**
   * Request reconnect
   */
  reconnect(): void {
    if (this.deps.reconnect) {
      this.requestReconnect = true;
    }
  }

  /**
   * Request exit
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

  private async attemptReconnect(context: PlayerContext): Promise<void> {
    if (!this.deps.reconnect) {
      return;
    }

    try {
      await this.deps.reconnect();
      // Reconnect successful - transition will be handled by state machine
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Reconnection failed:', error as unknown as Error);
      context.errors.push(`Reconnection failed: ${errorMsg}`);
    }
  }

  private resetRequests(): void {
    this.requestReconnect = false;
    this.requestExit = false;
  }
}


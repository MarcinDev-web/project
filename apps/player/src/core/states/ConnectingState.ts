import type { IPlayerState, PlayerContext, PlayerStateType } from '../PlayerStateMachine.js';
import { PlayerStateType as StateType } from '../PlayerStateMachine.js';
import { Logger } from '../../utils/logger';

/**
 * Dependencies for CONNECTING state
 */
export interface ConnectingStateDeps {
  /** Connect to multiplayer server */
  connect: (buildId: string) => Promise<void>;
  /** Called when connection starts */
  onStarted?: () => void;
  /** Progress callback */
  onProgress?: (message: string) => void;
  /** Called when connection completes */
  onCompleted?: (success: boolean) => void;
}

/**
 * CONNECTING State - Connect to multiplayer server
 * 
 * Responsibilities:
 * - Establish WebSocket/WebRTC connection
 * - Authenticate with server
 * - Join game session
 * - Auto-transition to PLAYING when connected
 */
export class ConnectingState implements IPlayerState {
  readonly type = StateType.CONNECTING;
  
  private deps: ConnectingStateDeps;
  private connectingComplete = false;
  private connectingSuccess = false;
  private started = false;

  constructor(deps: ConnectingStateDeps) {
    this.deps = deps;
  }

  onEnter(_context: PlayerContext): void {
    Logger.debug('Entering CONNECTING state');
    this.connectingComplete = false;
    this.connectingSuccess = false;
    this.started = false;
    try { this.deps.onStarted?.(); } catch { /* ignore */ }
  }

  onExit(_context: PlayerContext): void {
    Logger.debug('Exiting CONNECTING state');
  }

  onUpdate(_deltaTime: number, context: PlayerContext): PlayerStateType | null {
    if (!this.started) {
      this.started = true;
      void this.startAsyncConnecting(context);
    }

    if (!this.connectingComplete) {
      return null; // Still connecting
    }

    if (this.connectingSuccess) {
      return StateType.PLAYING; // Connected, start playing
    }
    
    // Connection failed - transition to DISCONNECTED
    return StateType.DISCONNECTED;
  }

  canTransitionTo(target: PlayerStateType): boolean {
    // Can transition to PLAYING (success) or DISCONNECTED (failure)
    return target === StateType.PLAYING || target === StateType.DISCONNECTED;
  }

  private async startAsyncConnecting(context: PlayerContext): Promise<void> {
    const buildId = context.buildId;
    if (!buildId) {
      context.errors.push('Connection failed: No buildId available');
      this.finish(false, context);
      return;
    }

    try {
      this.reportProgress('Connecting to server...');
      
      await this.deps.connect(buildId);
      
      this.reportProgress('Connected!');
      
      this.finish(true, context);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Connection failed:', error as unknown as Error);
      context.errors.push(`Connection failed: ${errorMsg}`);
      this.finish(false, context);
    }
  }

  private reportProgress(message: string): void {
    try {
      this.deps.onProgress?.(message);
    } catch { /* ignore */ }
  }

  private finish(success: boolean, context: PlayerContext): void {
    this.connectingSuccess = success;
    this.connectingComplete = true;
    try { this.deps.onCompleted?.(success); } catch { /* ignore */ }
    if (success) {
      Logger.info('Connected to multiplayer server');
    } else {
      if (context.errors.length === 0) {
        context.errors.push('Connection failed');
      }
    }
  }
}


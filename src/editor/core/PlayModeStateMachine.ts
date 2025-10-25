import { Logger } from '../../app/utils/logger';

/**
 * Possible play mode states
 */
export enum PlayModeStateType {
  EDIT = 'EDIT',
  PREFLIGHT = 'PREFLIGHT',
  LOADING = 'LOADING',
  PLAY_INTRO = 'PLAY_INTRO',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  RETURN = 'RETURN',
}

/**
 * Shared context passed between states
 */
export interface PlayModeContext {
  /** Authoring world snapshot (JSON) for restoration */
  authoringSnapshot: string | null;
  /** Selection path for restoration */
  selectionPath: number[] | null;
  /** Built manifest for runtime */
  manifest: any | null;
  /** Error messages from validation */
  errors: string[];
  /** Warnings from validation */
  warnings: string[];
  /** Arbitrary state data */
  data: Map<string, any>;
}

/**
 * State interface that all play mode states must implement
 */
export interface IPlayModeState {
  readonly type: PlayModeStateType;

  /**
   * Called when entering this state
   */
  onEnter(context: PlayModeContext): void;

  /**
   * Called when exiting this state
   */
  onExit(context: PlayModeContext): void;

  /**
   * Called each frame while in this state
   * @returns Next state to transition to, or null to stay in current state
   */
  onUpdate(deltaTime: number, context: PlayModeContext): PlayModeStateType | null;

  /**
   * Check if transition to target state is allowed
   */
  canTransitionTo(target: PlayModeStateType): boolean;
}

/**
 * State machine for play mode transitions
 */
export class PlayModeStateMachine {
  private currentState: IPlayModeState | null = null;
  private states = new Map<PlayModeStateType, IPlayModeState>();
  private context: PlayModeContext;
  private transitioning = false;
  private transitionCount = 0;
  private initialized = false;

  constructor() {
    this.context = this.createInitialContext();
  }

  /**
   * Register a state with the machine
   */
  registerState(state: IPlayModeState): void {
    if (this.states.has(state.type)) {
      Logger.warn(`State ${state.type} already registered, replacing`);
    }
    this.states.set(state.type, state);
  }

  /**
   * Initialize machine to a starting state
   */
  initialize(initialState: PlayModeStateType): void {
    if (this.initialized) {
      Logger.warn('PlayModeStateMachine is already initialized; ignoring initialize call');
      return;
    }
    const state = this.states.get(initialState);
    if (!state) {
      throw new Error(`Initial state ${initialState} not registered`);
    }
    Logger.debug(`Initializing state machine to ${initialState}`);
    try {
      state.onEnter(this.context);
      this.currentState = state;
      Logger.debug(`State machine initialized to ${initialState}`);
      this.initialized = true;
    } catch (error) {
      Logger.error(`Failed to enter initial state ${initialState}:`, error as Error);
      this.currentState = null;
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Transition to a new state
   */
  transitionTo(targetType: PlayModeStateType): boolean {
    if (!this.initialized) {
      Logger.warn('State machine not initialized; ignoring transition request');
      return false;
    }
    if (this.transitioning) {
      Logger.warn('State transition already in progress');
      return false;
    }

    const targetState = this.states.get(targetType);
    if (!targetState) {
      Logger.error(`Target state ${targetType} not registered`);
      return false;
    }

    if (!this.currentState) {
      Logger.error('No current state, cannot transition');
      return false;
    }

    if (!this.currentState.canTransitionTo(targetType)) {
      Logger.warn(`Transition from ${this.currentState.type} to ${targetType} not allowed`);
      return false;
    }

    this.transitioning = true;
    this.transitionCount += 1;
    const previousState = this.currentState;
    let exitCompleted = false;

    try {
      Logger.debug(`Transitioning ${previousState.type} → ${targetType}`);

      // Exit current state
      previousState.onExit(this.context);
      exitCompleted = true;

      // Enter new state
      targetState.onEnter(this.context);
      this.currentState = targetState;

      Logger.debug(`State transition complete: ${targetType}`);
      return true;
    } catch (error) {
      const phase = exitCompleted ? 'enter' : 'exit';
      Logger.error(`State transition failed during ${phase} ${previousState.type} → ${targetType}:`, error as Error);

      if (exitCompleted) {
        try {
          previousState.onEnter(this.context);
        } catch (restoreError) {
          Logger.error(`Failed to restore state ${previousState.type} after transition error:`, restoreError as Error);
          this.context.errors.push(
            `Transition recovery failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
          );
        }
      }

      this.currentState = previousState;
      this.context.errors.push(
        `Transition failed during ${phase}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    } finally {
      this.transitioning = false;
    }
  }

  /**
   * Update the current state
   * @returns true if a transition occurred
   */
  update(deltaTime: number): boolean {
    if (!this.currentState || this.transitioning || !this.initialized) {
      return false;
    }

    try {
      const nextState = this.currentState.onUpdate(deltaTime, this.context);
      
      if (nextState !== null && nextState !== this.currentState.type) {
        return this.transitionTo(nextState);
      }
      
      return false;
    } catch (error) {
      Logger.error(`State update failed in ${this.currentState.type}:`, error as Error);
      this.context.errors.push(`Update failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Get current state type
   */
  getCurrentStateType(): PlayModeStateType | null {
    return this.currentState?.type ?? null;
  }

  /**
   * Get current state
   */
  getCurrentState(): IPlayModeState | null {
    return this.currentState;
  }

  /**
   * Get shared context
   */
  getContext(): Readonly<PlayModeContext> {
    return this.context;
  }

  /**
   * Get mutable context for configuration prior to transitions
   */
  getMutableContext(): PlayModeContext {
    return this.context;
  }

  /**
   * Check if machine is currently transitioning
   */
  isTransitioning(): boolean {
    return this.transitioning;
  }

  /**
   * Reset context to initial state
   */
  resetContext(): void {
    this.context = this.createInitialContext();
  }

  /**
   * Dispose of the state machine
   */
  dispose(): void {
    if (this.currentState) {
      try {
        this.currentState.onExit(this.context);
      } catch (error) {
        Logger.warn('Error exiting state during dispose:', error as Error);
      }
    }
    
    this.currentState = null;
    this.states.clear();
    this.resetContext();
    this.transitionCount = 0;
    this.initialized = false;
  }

  private createInitialContext(): PlayModeContext {
    return {
      authoringSnapshot: null,
      selectionPath: null,
      manifest: null,
      errors: [],
      warnings: [],
      data: new Map<string, any>(),
    };
  }
}


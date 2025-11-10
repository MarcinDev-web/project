import type { IPlayerState, PlayerContext, PlayerStateType } from '../PlayerStateMachine.js';
import { PlayerStateType as StateType } from '../PlayerStateMachine.js';
import { Logger } from '../../utils/logger';

/**
 * Dependencies for LOADING state
 */
export interface LoadingStateDeps {
  /** Load build data from API */
  loadBuildData: (buildId: string) => Promise<any>;
  /** Called when loading starts (for UI) */
  onStarted?: () => void;
  /** Progress callback for UI */
  onProgress?: (step: string, percentage: number, message?: string) => void;
  /** Called when loading completes */
  onCompleted?: (success: boolean) => void;
}

/**
 * LOADING State - Load build data and initialize
 * 
 * Responsibilities:
 * - Load build data from API
 * - Parse manifest
 * - Prepare scene data
 * - Auto-transition to CONNECTING (multiplayer) or PLAYING (singleplayer)
 */
export class LoadingState implements IPlayerState {
  readonly type = StateType.LOADING;
  
  private deps: LoadingStateDeps;
  private loadingComplete = false;
  private loadingSuccess = false;
  private started = false;

  constructor(deps: LoadingStateDeps) {
    this.deps = deps;
  }

  onEnter(_context: PlayerContext): void {
    Logger.debug('Entering LOADING state');
    this.loadingComplete = false;
    this.loadingSuccess = false;
    this.started = false;
    try { this.deps.onStarted?.(); } catch { /* ignore */ }
  }

  onExit(_context: PlayerContext): void {
    Logger.debug('Exiting LOADING state');
  }

  onUpdate(_deltaTime: number, context: PlayerContext): PlayerStateType | null {
    if (!this.started) {
      this.started = true;
      void this.startAsyncLoading(context);
    }

    if (!this.loadingComplete) {
      return null; // Still loading
    }

    if (this.loadingSuccess) {
      // Check if multiplayer is enabled
      const manifest = context.manifest;
      const isMultiplayer = manifest?.simulation?.enableMultiplayer ?? false;
      
      if (isMultiplayer) {
        return StateType.CONNECTING; // Connect to server first
      }
      return StateType.PLAYING; // Singleplayer, go straight to playing
    }
    
    // Loading failed - stay in loading (will show error UI)
    return null;
  }

  canTransitionTo(target: PlayerStateType): boolean {
    // Can transition to CONNECTING (multiplayer) or PLAYING (singleplayer)
    return target === StateType.CONNECTING || target === StateType.PLAYING;
  }

  private async startAsyncLoading(context: PlayerContext): Promise<void> {
    const buildId = context.buildId;
    if (!buildId) {
      context.errors.push('Loading failed: No buildId available');
      this.finish(false, context);
      return;
    }

    try {
      this.reportProgress('Loading build data...', 10);
      
      // Load build data
      const buildData = await this.deps.loadBuildData(buildId);
      context.buildData = buildData;
      
      this.reportProgress('Parsing manifest...', 30);
      
      // Extract manifest or use defaults
      const manifest = buildData.manifest ?? this.createDefaultManifest();
      context.manifest = manifest;
      
      this.reportProgress('Preparing scene...', 60);
      
      // Store scene JSON
      if (buildData.sceneJSON) {
        context.data.set('sceneJSON', buildData.sceneJSON);
      }
      
      // Store player start position
      if (buildData.playerStart) {
        context.data.set('playerStart', buildData.playerStart);
      }
      
      this.reportProgress('Ready!', 100);
      
      this.finish(true, context);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Loading failed:', error as unknown as Error);
      context.errors.push(`Loading failed: ${errorMsg}`);
      this.finish(false, context);
    }
  }

  private reportProgress(step: string, percentage: number, message = ''): void {
    try {
      this.deps.onProgress?.(step, percentage, message);
    } catch { /* ignore */ }
  }

  private finish(success: boolean, context: PlayerContext): void {
    this.loadingSuccess = success;
    this.loadingComplete = true;
    try { this.deps.onCompleted?.(success); } catch { /* ignore */ }
    if (success) {
      Logger.info('Build data loaded successfully');
    } else {
      if (context.errors.length === 0) {
        context.errors.push('Loading failed');
      }
    }
  }

  private createDefaultManifest(): any {
    return {
      version: 1,
      timestamp: Date.now(),
      playerStart: {
        position: [0, 2, 0],
        rotation: 0,
        controllerMode: 'fps',
        enableCollisions: true,
        pawnArchetype: 'character',
      },
      simulation: {
        fixedDeltaTime: 1 / 60,
        gravity: [0, -9.81, 0],
        rngSeed: Math.floor(Math.random() * 1000000),
        maxSubsteps: 5,
        enablePhysics: true,
        enableAI: true,
        enableScripts: true,
        enableMultiplayer: false,
      },
      controller: {
        preferences: {
          fov: 90,
          invertY: false,
          sensitivity: 0.0025,
          hudLayout: 'default',
        },
        input: {
          movement: {
            forward: ['KeyW', 'ArrowUp'],
            backward: ['KeyS', 'ArrowDown'],
            left: ['KeyA', 'ArrowLeft'],
            right: ['KeyD', 'ArrowRight'],
          },
          actions: {
            jump: ['Space'],
            sprint: ['ShiftLeft', 'ShiftRight'],
            interact: ['KeyE'],
            crouch: ['KeyC', 'ControlLeft'],
          },
        },
      },
      pawn: {
        type: 'character',
        cameraTarget: {
          offset: [0, 1.6, 0],
          lag: 0.1,
          collisionRadius: 0.3,
        },
        physics: {
          rigidbody: {
            type: 'kinematic',
            mass: 75,
            useGravity: true,
          },
          collider: {
            shape: 'capsule',
            radius: 0.35,
            height: 1.7,
            center: [0, 0.85, 0],
          },
          material: {
            friction: 0.7,
            restitution: 0,
          },
        },
        kcc: {
          moveSpeed: 5.0,
          sprintMultiplier: 1.5,
          jumpForce: 8.0,
          gravityMultiplier: 1.0,
          maxSlopeAngle: 45,
          stepHeight: 0.3,
          groundCheckDistance: 0.1,
          airControlMultiplier: 0.3,
          rotationSpeed: 10,
          autoRotate: true,
        },
      },
    };
  }
}


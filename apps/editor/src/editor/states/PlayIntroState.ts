import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { Logger } from '../../utils/logger';
import type { CameraDirector } from '@engine/camera';
import type { InputContextManager } from '@engine/input';
import { GameplayInputContext } from '@engine/input';
import type { Entity, Scene, PhysicsWorld } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import type { PlayManifest } from '../core/PlayManifest';
import { SpawnPointSystem } from '../systems/SpawnPointSystem';

/**
 * Dependencies for PLAY_INTRO state
 */
export interface PlayIntroStateDeps {
  /** Camera director for blending */
  cameraDirector: CameraDirector;
  /** Input context manager */
  inputContext: InputContextManager;
  /** Scene for spawn point detection */
  getScene: () => Scene;
  /** Physics world for raycast fallback */
  getPhysicsWorld?: () => PhysicsWorld | null;
  /** Track whether gameplay context has been pushed */
  markGameplayContextActive: (active: boolean) => void;
  /** Check if gameplay context is active */
  isGameplayContextActive: () => boolean;
  /** Spawn player entity */
  spawnPlayer: (position: Vec3, rotation: number) => Promise<Entity>;
  /** Configure controller bindings */
  configureController: (manifest: PlayManifest) => void;
  /** Enable character input */
  enableCharacterInput: () => void;
  /** Disable orbit controls during play intro */
  disableOrbitControls: () => void;
  /** Freeze history recording */
  freezeHistory: () => void;
  /** Initialize checkpoint system with runtime world */
  initializeCheckpoints?: (scene: Scene) => void;
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

  async onEnter(context: PlayModeContext): Promise<void> {
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

      // Step 2: Find spawn point and initialize checkpoints with runtime world
      const scene = this.deps.getScene();
      const physicsWorld = this.deps.getPhysicsWorld?.() ?? null;
      
      // Initialize checkpoint system with runtime scene
      this.deps.initializeCheckpoints?.(scene);
      
      // Use camera position as fallback reference for raycast
      const cameraPosition = this.deps.cameraDirector.getViewMatrix ? 
        this.extractCameraPosition(this.deps.cameraDirector.getViewMatrix()) :
        [0, 10, 0] as Vec3;
      
      const spawnResult = SpawnPointSystem.findSpawnPoint(
        scene,
        physicsWorld,
        cameraPosition
      );

      Logger.debug('Spawn point found:', spawnResult.source, 'at', spawnResult.position);

      // Step 3: Spawn player
      const player = await this.deps.spawnPlayer(spawnResult.position, spawnResult.rotation);
      context.data.set('playerEntity', player);
      this.deps.cameraDirector.setPlayerPose(player.transform.position, player.transform.getForward());
      
      // Step 3: Start camera blend from orbit to FPS
      const hasFpsCamera = this.deps.hasFpsCamera?.() ?? true;
      if (hasFpsCamera) {
        Logger.debug('Starting camera blend: free-fly -> fps');
        const blendDuration = this.blendDuration > 0 ? this.blendDuration : 0.33;
        this.deps.cameraDirector.startBlend('fps', blendDuration);
      } else {
        Logger.warn('FPS camera unavailable, skipping blend');
        this.deps.cameraDirector.setMode('free-fly');
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
      this.deps.cameraDirector.setPlayerPose(player.transform.position, player.transform.getForward());
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

  /**
   * Extract camera position from view matrix
   * View matrix is the inverse of the camera's world transform
   */
  private extractCameraPosition(viewMatrix: Float32Array): Vec3 {
    // Invert view matrix to get camera world transform
    // For a simple extraction, we can use the fact that:
    // viewMatrix = inverse(cameraWorldMatrix)
    // The camera position is at the translation component of the inverted view
    
    // Simplified extraction (assumes orthonormal matrix):
    // View matrix is always 4x4 (16 elements), so indices 0-15 are guaranteed to exist
    const m = viewMatrix;
    const x = -(m[0]! * m[12]! + m[1]! * m[13]! + m[2]! * m[14]!);
    const y = -(m[4]! * m[12]! + m[5]! * m[13]! + m[6]! * m[14]!);
    const z = -(m[8]! * m[12]! + m[9]! * m[13]! + m[10]! * m[14]!);
    
    return [x, y, z];
  }
}


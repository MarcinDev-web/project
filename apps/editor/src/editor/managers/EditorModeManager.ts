/**
 * EditorModeManager - Manages play mode state machine.
 * 
 * Now uses a proper state machine architecture with states:
 * EDIT → PREFLIGHT → LOADING → PLAY_INTRO → PLAYING ↔ PAUSED → RETURN → EDIT
 * 
 * Responsibilities:
 * - Coordinate state machine transitions
 * - Provide high-level API for mode switching
 * - Integrate with editor systems (UI, camera, input, physics)
 * - Maintain backward compatibility with existing code
 */

import type { Scene } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { CharacterInput } from '@engine/world';
import type { EditorState } from '../core/state';
import { Logger } from '../../utils/logger';
import { Entity } from '@engine/world';
import type { Vec3, Mat4 } from '@engine/core/math';
import { mat4Invert, mat4GetTranslationOut, mat4GetRotationOut, transformVec3ByQuatOut } from '@engine/core/math';
import type { PhysicsWorld } from '@engine/world';
import { CharacterController, CharacterState } from '@engine/world/components/CharacterController';
import { PhysicsComponent, RigidbodyType } from '@engine/world/components/PhysicsComponent';
import { HealthComponent } from '@engine/world/components/HealthComponent';
import { CameraComponent } from '@engine/world/components/CameraComponent';
import { CameraDirector } from '@engine/camera';
import type { OrbitControls, EditorCameraController } from '@engine/camera';
import type { FPSCamera } from '@engine/camera';
// Note: FPSCamera and ThirdPersonCamera are not used in editor, only in play mode
import type { CharacterControllerSystem, GroundDetectionSystem } from '@engine/stdlib/CharacterController';
import type { CharacterInputHandler } from '@engine/input';
import { PlayModeAvatarManager } from './PlayModeAvatarManager';
import { PlayModeStateMachine, PlayModeStateType } from '../core/PlayModeStateMachine';
import { WorldManager } from '../core/WorldManager';
import { InputContextManager, EditorInputContext } from '@engine/input';
import { EditState, type EditorCameraState } from '../states/EditState';
import { PreflightState } from '../states/PreflightState';
import { LoadingState } from '../states/LoadingState';
import { PlayIntroState } from '../states/PlayIntroState';
import { PlayingState } from '../states/PlayingState';
import { PausedState } from '../states/PausedState';
import { ReturnState } from '../states/ReturnState';
import { computeEntityPath, resolveEntityByPath } from '@engine/editor-utils';
import { DefaultControllerFactory, PlayerSession, LocalPlayerController } from '@engine/stdlib/CharacterController';
import type { PlayManifest } from '../core/PlayManifest';
import { LoadingOverlay } from '../ui/hud/LoadingOverlay';
import { CancellationToken } from '../core/cancellation/CancellationToken';
import type { LoadingStepsRegistry } from '../core/LoadingStepsRegistry';
import { CheckpointSystem, RespawnManager } from '@engine/world';
import type { BlockBehaviorSystem } from '@engine/world/systems';

export interface EditorModeManagerConfig {
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  updateSceneBuffers: () => void;
  onModeChanged?: (mode: 'edit' | 'play') => void;
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  physicsWorld?: PhysicsWorld | null;
  characterSystem?: CharacterControllerSystem | null;
  groundDetectionSystem?: GroundDetectionSystem | null;
  blockBehaviorSystem?: BlockBehaviorSystem | null;
  characterInput?: CharacterInputHandler | null;
  fpsCamera?: FPSCamera | null;
  editorCamera?: EditorCameraController | null;
  thirdPersonCamera?: any | null; // ThirdPersonCamera - not used in editor, only in play mode
  getRendererReady?: () => boolean;
  /** Optional registry to extend play mode loading steps */
  loadingStepsRegistry?: LoadingStepsRegistry;
  /** Collaboration manager for multiplayer gameplay */
  collaborationManager?: any; // CollaborationManager type
}

export class EditorModeManager {
  // State machine and managers
  private stateMachine: PlayModeStateMachine;
  private worldManager: WorldManager;
  private cameraDirector: CameraDirector;
  private inputContext: InputContextManager;
  
  // State instances
  private editState: EditState;
  private playingState: PlayingState;
  private pausedState: PausedState;
  
  // Legacy player entity (for compatibility)
  private playerEntity: Entity | null = null;
  private playerScene: Scene | null = null;
  private playerSession: PlayerSession | null = null;
  private avatarManager: PlayModeAvatarManager;
  
  // Temporary camera entity for edit mode (bridges CameraDirector to renderer)
  private editorCameraEntity: Entity | null = null;
  
  // Systems
  private readonly physicsWorld: PhysicsWorld | null;
  private readonly characterSystem: CharacterControllerSystem | null;
  private readonly groundDetectionSystem: GroundDetectionSystem | null;
  private readonly blockBehaviorSystem: BlockBehaviorSystem | null;
  private readonly characterInput: CharacterInputHandler | null;
  private readonly editorCamera: EditorCameraController | null;
  private readonly controls: OrbitControls;
  private readonly checkpointSystem: CheckpointSystem;
  private editorCameraSnapshot: EditorCameraState | null = null;
  private selectionSnapshotPath: number[] | null = null;
  private loadingOverlay: LoadingOverlay | null = null;
  private loadingCancelToken: CancellationToken | null = null;
 
  // Time scaling
  private timeScale = 1.0;
  private playAccumulator = 0;
  
  // Track if we're returning from play mode to avoid duplicate cleanup
  private returningFromPlay = false;

  // Scratch buffers to avoid allocations in camera sync
  private readonly _cameraWorldScratch: Mat4 = new Float32Array(16) as Mat4;
  private readonly _cameraPosScratch: Vec3 = [0, 0, 0] as Vec3;
  private readonly _cameraRotScratch: [number, number, number, number] = [0, 0, 0, 1];
  private readonly _forwardScratch: Vec3 = [0, 0, 0] as Vec3;
  private readonly _rightScratch: Vec3 = [0, 0, 0] as Vec3;
  private readonly _rotateScratch: Vec3 = [0, 0, 0] as Vec3;

  // Follow camera (collaboration): userId being followed (remote cursor)
  private followingUserId: string | null = null;

  constructor(private readonly config: EditorModeManagerConfig) {
    this.physicsWorld = config.physicsWorld ?? null;
    this.characterSystem = config.characterSystem ?? null;
    this.groundDetectionSystem = config.groundDetectionSystem ?? null;
    this.blockBehaviorSystem = config.blockBehaviorSystem ?? null;
    this.characterInput = config.characterInput ?? null;
    this.editorCamera = config.editorCamera ?? null;
    this.controls = config.controls;
    
    // Initialize managers
    this.worldManager = new WorldManager(config.scene);
    this.cameraDirector = new CameraDirector({
      orbitControls: config.controls,
      fpsCamera: config.fpsCamera ?? null,
      editorCamera: config.editorCamera ?? null,
      thirdPersonCamera: null,
      canvas: config.canvas,
      scene: config.scene,
      physicsWorld: this.physicsWorld,
      logger: {
        debug: (...args: unknown[]) => Logger.debug(args[0] as string, ...args.slice(1)),
        warn: (...args: unknown[]) => Logger.warn(args[0] as string, ...args.slice(1)),
      },
    });
    this.inputContext = new InputContextManager(config.canvas);
    this.checkpointSystem = new CheckpointSystem();
    this.checkpointSystem.initialize(config.scene);
    
    this.avatarManager = new PlayModeAvatarManager();
    
    // Initialize state machine
    this.stateMachine = new PlayModeStateMachine();
    
    // Create temporary camera entity for edit mode
    this.setupEditorCamera();
    // Avatar is not used in editor
    // Note: In play mode we attach a runtime avatar for visuals
    
    // Create state instances
    this.editState = new EditState({
      setEditorUIVisible: (visible) => {
        // Will be handled by UI integration
        if (!visible) {
          config.state.disableHistory();
        }
      },
      enableEditorCamera: () => {
        this.cameraDirector.setMode('free-fly');
      },
      disableEditorCamera: () => {
        this.editorCamera?.disable();
        this.controls.setEnabled(false);
      },
      getEditorCameraState: () => {
        if (this.editorCamera) {
          const position = this.editorCamera.getPosition();
          const { yaw, pitch } = this.editorCamera.getOrientation();
          return {
            position: [...position] as Vec3,
            yaw,
            pitch,
          };
        }
        return {
          position: [0, 2, 5] as Vec3,
          yaw: 0,
          pitch: 0,
        };
      },
      saveEditorCameraState: (state) => {
        this.editorCameraSnapshot = {
          position: [...state.position] as Vec3,
          yaw: state.yaw,
          pitch: state.pitch,
        };
      },
      restoreEditorCameraState: (state) => {
        if (!this.editorCamera || !state) {
          return;
        }
        this.editorCamera.setPosition(state.position);
        this.editorCamera.setOrientation(state.yaw, state.pitch);
      },
      stopPhysics: () => this.physicsWorld?.stop(),
      disableScripts: () => this.setScriptSystemEnabled(false),
      enableHistory: () => config.state.enableHistory(),
      disableHistory: () => config.state.disableHistory(),
      isReturningFromPlay: () => this.returningFromPlay,
      disableCharacterInput: () => this.characterInput?.disable(),
      disableFPSCamera: () => this.getFPSCamera()?.disable(),
    });
    
    const preflightState = new PreflightState({
      getScene: () => config.scene,
      isRendererReady: () => config.getRendererReady?.() ?? true,
    });
    
    const loadingState = new LoadingState({
      worldManager: this.worldManager,
      setupPhysics: () => {
        // Physics will be setup when player spawns
      },
      updateSceneBuffers: config.updateSceneBuffers,
      onStarted: () => {
        const token = this.ensureLoadingCancelToken();
        this.getLoadingOverlay().show('Preparing play mode...', () => token.cancel());
      },
      onProgress: (progress) => {
        this.getLoadingOverlay().updateProgress(progress);
      },
      onStepError: (error, stepName) => {
        this.getLoadingOverlay().showError(`${stepName}: ${error}`, true);
      },
      onCompleted: () => {
        this.getLoadingOverlay().hide();
        this.loadingCancelToken = null;
      },
      getCancellationToken: () => this.ensureLoadingCancelToken(),
      ...(config.loadingStepsRegistry ? { stepsRegistry: config.loadingStepsRegistry } : {}),
    });
    
    const playIntroState = new PlayIntroState({
      cameraDirector: this.cameraDirector,
      inputContext: this.inputContext,
      getScene: () => config.scene,
      getPhysicsWorld: () => this.physicsWorld,
      markGameplayContextActive: (active) => {
        this.stateMachine.getMutableContext().data.set('gameplayContextActive', active);
      },
      isGameplayContextActive: () => {
        return this.stateMachine.getContext().data.get('gameplayContextActive') === true;
      },
      spawnPlayer: this.spawnPlayer.bind(this),
      configureController: this.configureController.bind(this),
      enableCharacterInput: () => {
        Logger.info('[EditorModeManager] enableCharacterInput called, characterInput:', this.characterInput ? 'exists' : 'null');
        if (this.characterInput) {
          Logger.info('[EditorModeManager] Calling characterInput.enable()');
          this.characterInput.enable();
          Logger.info('[EditorModeManager] Character input enabled, isEnabled:', this.characterInput.isEnabled());
        } else {
          Logger.warn('[EditorModeManager] characterInput is null, cannot enable');
        }
      },
      disableOrbitControls: () => this.controls.setEnabled(false),
      freezeHistory: () => this.config.state.disableHistory(),
      hasFpsCamera: () => this.getFPSCamera() !== null,
      initializeCheckpoints: (scene) => {
        this.checkpointSystem.initialize(scene);
      },
      enableScripts: () => this.setScriptSystemEnabled(true),
      onFailure: () => {
        this.controls.setEnabled(false);
        if (this.editorCameraSnapshot && this.editorCamera) {
          this.editorCamera.setPosition(this.editorCameraSnapshot.position);
          this.editorCamera.setOrientation(this.editorCameraSnapshot.yaw, this.editorCameraSnapshot.pitch);
        }
        this.cameraDirector.setMode('free-fly');
        this.config.state.enableHistory();
        this.getFPSCamera()?.disable();
        this.characterInput?.disable();
        this.config.onModeChanged?.('edit');
        this.config.state.editorMode.value = 'edit';
        this.restoreSelectionSnapshot();
        this.cleanupPlayer();
      },
    });
    
    this.playingState = new PlayingState({
      updateFPSCamera: () => this.getFPSCamera()?.update(),
      cameraDirector: this.cameraDirector,
      enableEditorCamera: () => {
        this.cameraDirector.setMode('free-fly');
        this.getFPSCamera()?.disable();
        this.controls.setEnabled(false);
      },
      restoreEditorCameraState: () => {
        if (this.editorCameraSnapshot && this.editorCamera) {
          this.editorCamera.setPosition(this.editorCameraSnapshot.position);
          this.editorCamera.setOrientation(this.editorCameraSnapshot.yaw, this.editorCameraSnapshot.pitch);
        }
      },
      updateCharacterInput: (forward, right) => this.characterInput?.setCameraDirections(forward, right),
      getCameraForward: () => this.getMutableCameraForward(),
      getCameraRight: () => this.getMutableCameraRight(),
      updateCheckpoints: (playerPosition) => this.checkpointSystem.update(playerPosition),
      resumeHistory: () => this.config.state.enableHistory(),
      updateMultiplayer: (deltaTime) => {
        // Update multiplayer gameplay systems
        this.config.collaborationManager?.updateMultiplayerGameplay(deltaTime);
      },
      processMultiplayerInput: (input) => {
        // Process input for multiplayer replication
        this.config.collaborationManager?.processMultiplayerInput(input);
      },
    });
    
    this.pausedState = new PausedState({
      setTimeScale: (scale) => {
        this.timeScale = scale;
      },
      setPauseMenuVisible: (visible) => {
        this.config.state.editorUI?.setPauseMenuVisible?.(visible);
      },
    });
    
    const returnState = new ReturnState({
      worldManager: this.worldManager,
      inputContext: this.inputContext,
      cameraDirector: this.cameraDirector,
      shouldPopGameplayContext: () => {
        return this.stateMachine.getContext().data.get('gameplayContextActive') === true;
      },
      markGameplayContextInactive: () => {
        this.stateMachine.getMutableContext().data.delete('gameplayContextActive');
      },
      stopPhysics: () => this.physicsWorld?.stop(),
      disableScripts: () => this.setScriptSystemEnabled(false),
      disableCharacterInput: () => this.characterInput?.disable(),
      disableFPSCamera: () => this.getFPSCamera()?.disable(),
      unbindPlayerController: () => this.playerSession?.unbindController(),
      cleanupPlayer: () => {
        this.cleanupPlayer();
        // Set flag to avoid duplicate cleanup in EditState
        this.returningFromPlay = true;
      },
      updateSceneBuffers: config.updateSceneBuffers,
      showEditorUI: () => {
        this.config.state.editorMode.value = 'edit';
      },
      restoreEditorCamera: () => {
        this.cameraDirector.setMode('free-fly');
        this.getFPSCamera()?.disable();
        this.controls.setEnabled(false);
      },
      clearCheckpoints: () => {
        this.checkpointSystem.clear();
        // Reinitialize with authoring scene when returning to edit
        this.checkpointSystem.initialize(this.config.scene);
        if (this.editorCameraSnapshot && this.editorCamera) {
          this.editorCamera.setPosition(this.editorCameraSnapshot.position);
          this.editorCamera.setOrientation(this.editorCameraSnapshot.yaw, this.editorCameraSnapshot.pitch);
        }
      },
    });
    
    // Register states
    this.stateMachine.registerState(this.editState);
    this.stateMachine.registerState(preflightState);
    this.stateMachine.registerState(loadingState);
    this.stateMachine.registerState(playIntroState);
    this.stateMachine.registerState(this.playingState);
    this.stateMachine.registerState(this.pausedState);
    this.stateMachine.registerState(returnState);
  }

  private settleStateMachine(deltaTime = 0): void {
    const maxIterations = 32;
    let iterations = 0;
    while (iterations < maxIterations && this.stateMachine.update(deltaTime)) {
      iterations += 1;
    }
    if (iterations === maxIterations) {
      Logger.warn('State machine did not settle after maximum iterations');
    }
  }

  private restoreSelectionSnapshot(): void {
    if (!this.selectionSnapshotPath) {
      return;
    }
    const restored = resolveEntityByPath(this.config.scene, this.selectionSnapshotPath);
    if (restored) {
      this.config.selection.select(restored);
    } else {
      this.config.selection.clearSelection();
    }
    this.selectionSnapshotPath = null;
  }

  initialize(): () => void {
    // Initialize to EDIT state
    this.stateMachine.initialize(PlayModeStateType.EDIT);
    
    // Push editor input context
    this.inputContext.push({
      ...EditorInputContext,
      onAction: (action) => {
        if (action === 'deselect') {
          this.config.selection.clearSelection();
        }
      },
    });
    
    return () => {
      this.stateMachine.dispose();
      this.worldManager.dispose();
      this.cameraDirector.dispose();
      this.inputContext.dispose();
    };
  }

  isPlayMode(): boolean {
    const state = this.stateMachine.getCurrentStateType();
    return state !== PlayModeStateType.EDIT && state !== null;
  }

  enterPlayMode(): void {
    const currentState = this.stateMachine.getCurrentStateType();
    if (currentState !== PlayModeStateType.EDIT) {
      Logger.warn('Can only enter play mode from EDIT state');
      return;
    }

    // If collaboration is active, request Play Mode from other users
    if (this.config.collaborationManager?.isCollaborating()) {
      const requestId = this.config.collaborationManager.requestPlayMode();
      if (requestId) {
        Logger.debug('Play Mode request sent, waiting for responses...');
        // The actual Play Mode entry will be triggered by onPlayModeStarted callback
        return;
      }
    }

    // No collaboration or request failed, enter Play Mode directly
    this.enterPlayModeSync();
  }

  /**
   * Enter Play Mode synchronously (without collaboration request).
   * Called by CollaborationManager when all users accepted the request,
   * or when collaboration is not active.
   */
  enterPlayModeSync(): void {
    const currentState = this.stateMachine.getCurrentStateType();
    if (currentState !== PlayModeStateType.EDIT) {
      Logger.warn('Can only enter play mode from EDIT state');
      return;
    }

    this.selectionSnapshotPath = computeEntityPath(
      this.config.scene,
      this.config.selection.primarySelection
    );

    this.returningFromPlay = false; // Clear flag when entering play mode
    this.editState.requestPlayMode();
    this.settleStateMachine();

    if (this.isPlayMode()) {
      this.config.onModeChanged?.('play');
      this.config.state.editorMode.value = 'play';
    }
  }

  exitPlayMode(): void {
    const currentState = this.stateMachine.getCurrentStateType();

    if (currentState === PlayModeStateType.PLAYING) {
      this.playingState.stop();
    } else if (currentState === PlayModeStateType.PAUSED) {
      this.pausedState.stop();
    } else if (currentState === PlayModeStateType.EDIT) {
      Logger.debug('Already in edit mode');
      return;
    } else {
      if (!this.stateMachine.transitionTo(PlayModeStateType.RETURN)) {
        Logger.warn('Unable to transition to RETURN state from current state');
      }
    }

    this.settleStateMachine();

    if (!this.isPlayMode()) {
      // Send Play Mode end notification if collaboration is active
      if (this.config.collaborationManager?.isCollaborating()) {
        this.config.collaborationManager.sendPlayModeEnd();
      }

      this.restoreSelectionSnapshot();
      this.returningFromPlay = false; // Clear flag after returning to edit mode
      this.config.onModeChanged?.('edit');
      this.config.state.editorMode.value = 'edit';
      this.config.state.enableHistory();
      // Restore avatar visibility based on current camera type (free-fly hides avatar)
      const cameraType = this.config.state.cameraType.value;
      this.setEditCameraInputMode(cameraType);
    }
  }

  toggleMode(): void {
    if (this.isPlayMode()) {
      this.exitPlayMode();
    } else {
      this.enterPlayMode();
    }
  }

  pausePlayMode(): void {
    const currentState = this.stateMachine.getCurrentStateType();
    if (currentState === PlayModeStateType.PLAYING) {
      this.playingState.pause();
      this.settleStateMachine();
    }
  }

  resumePlayMode(): void {
    const currentState = this.stateMachine.getCurrentStateType();
    if (currentState === PlayModeStateType.PAUSED) {
      this.pausedState.resume();
      this.settleStateMachine();
    }
  }

  forceExitPlayMode(): void {
    if (this.stateMachine.transitionTo(PlayModeStateType.RETURN)) {
      this.settleStateMachine();
      if (!this.isPlayMode()) {
        this.restoreSelectionSnapshot();
        this.returningFromPlay = false;
        this.config.onModeChanged?.('edit');
        this.config.state.editorMode.value = 'edit';
        this.config.state.enableHistory();
      }
    }
  }

  hasSnapshot(): boolean {
    return this.worldManager.getAuthoringSnapshot() !== null;
  }

  getCurrentMode(): 'edit' | 'play' {
    return this.isPlayMode() ? 'play' : 'edit';
  }

  getCurrentState(): PlayModeStateType | null {
    return this.stateMachine.getCurrentStateType();
  }

  getPlayerPosition(): Vec3 | null {
    return this.playerEntity?.transform.position ?? null;
  }

  getPlayerSession(): PlayerSession | null {
    return this.playerSession;
  }


  getCameraDirector(): CameraDirector {
    return this.cameraDirector;
  }

  /**
   * Get FPS camera instance (available in play mode)
   * Returns null if FPS camera is not configured (editor-only mode)
   */
  getFPSCamera(): FPSCamera | null {
    return this.config.fpsCamera ?? null;
  }
  
  /**
   * Setup temporary camera entity for edit mode
   * This bridges CameraDirector to the renderer's CameraSystem
   */
  private setupEditorCamera(): void {
    // Create a temporary camera entity
    this.editorCameraEntity = new Entity('EditorCamera');
    const cameraComponent = new CameraComponent();
    this.editorCameraEntity.addComponent(cameraComponent);
    
    // Attach to scene so the camera is registered and selectable as primary
    this.config.scene.addEntity(this.editorCameraEntity);
    
    // Override getViewMatrix to use CameraDirector
    cameraComponent.getViewMatrix = (_entity: Entity, outMatrix: Mat4) => {
      const view = this.cameraDirector.getViewMatrix();
      outMatrix.set(view);

      // Sync editor camera entity transform so world-space eyePosition/forward/up are correct
      // world = inverse(view)
      mat4Invert(this._cameraWorldScratch, view);
      mat4GetTranslationOut(this._cameraPosScratch, this._cameraWorldScratch);
      mat4GetRotationOut(this._cameraRotScratch, this._cameraWorldScratch);
      if (this.editorCameraEntity) {
        this.editorCameraEntity.transform.position = this._cameraPosScratch;
        this.editorCameraEntity.transform.rotation = this._cameraRotScratch;
      }

      return outMatrix;
    };
    
    // Override getProjectionMatrix to use CameraDirector
    cameraComponent.getProjectionMatrix = (outMatrix: Mat4, _aspect: number) => {
      const proj = this.cameraDirector.getProjectionMatrix();
      outMatrix.set(proj);
      return outMatrix;
    };
    
    // Set as primary camera in edit mode
    this.config.scene.setPrimaryCamera(this.editorCameraEntity);
    
    Logger.debug('[EditorModeManager] Setup editor camera entity');
  }

  setEditCameraInputMode(cameraType: 'free-fly' | 'fps' | 'third-person'): void {
    // In editor, only free-fly camera is allowed
    // FPS and third-person are for play mode only
    if (cameraType !== 'free-fly') {
      return;
    }
    
    // Character input is disabled in editor (only used in play mode)
    this.characterInput?.disable();
    this.characterInput?.clear();
  }

  private getMutableCameraForward(): Vec3 {
    const forward = this.getFPSCamera()?.getForwardDirection();
    if (forward) {
      this._forwardScratch[0] = forward[0];
      this._forwardScratch[1] = forward[1];
      this._forwardScratch[2] = forward[2];
      return this._forwardScratch;
    }
    return [0, 0, -1];
  }

  private getMutableCameraRight(): Vec3 {
    const right = this.getFPSCamera()?.getRightDirection();
    if (right) {
      this._rightScratch[0] = right[0];
      this._rightScratch[1] = right[1];
      this._rightScratch[2] = right[2];
      return this._rightScratch;
    }
    return [1, 0, 0];
  }

  private setScriptSystemEnabled(enabled: boolean): void {
    const runtime = this.config.scene.scriptRuntime as { scriptSystem?: unknown } | null;
    if (!runtime) {
      return;
    }
    const scriptSystem = runtime.scriptSystem;
    if (this.isToggleableScriptSystem(scriptSystem)) {
      scriptSystem.setEnabled(enabled);
    }
  }

  private isToggleableScriptSystem(
    value: unknown,
  ): value is { setEnabled: (enabled: boolean) => void } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as { setEnabled?: unknown };
    return typeof candidate.setEnabled === 'function';
  }

  getWorldManager(): WorldManager {
    return this.worldManager;
  }

  getActiveScene(): Scene {
    return this.worldManager.getRuntimeWorld() ?? this.config.scene;
  }

  /**
   * Determine which scene is currently simulated by physics/character systems.
   * Falls back to runtime world (if available) or the editor scene.
   */
  private getSimulationScene(): Scene {
    if (this.physicsWorld) {
      return this.physicsWorld.getScene();
    }
    if (this.characterSystem) {
      return this.characterSystem.getScene();
    }
    return this.worldManager.getRuntimeWorld() ?? this.config.scene;
  }

  private getLoadingOverlay(): LoadingOverlay {
    if (!this.loadingOverlay) {
      this.loadingOverlay = new LoadingOverlay(this.config.canvas.ownerDocument ?? document);
    }
    return this.loadingOverlay;
  }

  private ensureLoadingCancelToken(): CancellationToken {
    if (!this.loadingCancelToken) {
      this.loadingCancelToken = new CancellationToken();
    }
    return this.loadingCancelToken;
  }

  updateEditPreview(_deltaTime: number): void {
    if (this.isPlayMode()) {
      return;
    }

    // Follow remote user's camera if requested
    if (this.followingUserId && this.editorCamera && this.config.collaborationManager) {
      try {
        const cursors: Map<string, any> = this.config.collaborationManager.getRemoteCursors?.() ?? new Map();
        const cursor = cursors.get(this.followingUserId);
        if (cursor && cursor.position) {
          // Snap editor camera to remote camera pose
          this.editorCamera.setPosition(cursor.position as Vec3);
          if (cursor.rotation) {
            const forward = this.rotateVectorByQuat([0, 0, -1], cursor.rotation);
            const yaw = Math.atan2(forward[0] ?? 0, -(forward[2] ?? 0));
            const fy = Math.max(-1, Math.min(1, forward[1] ?? 0));
            const pitch = Math.asin(fy);
            this.editorCamera.setOrientation(yaw, pitch);
          }
        }
      } catch {
        // ignore follow errors
      }
    }
  }


  async updatePlayMode(deltaTime: number): Promise<void> {
    if (!this.isPlayMode()) {
      return;
    }

    // Update camera director
    this.cameraDirector.update(deltaTime);
    
    const manifest = this.stateMachine.getContext().manifest as PlayManifest | null;
    const fixedDeltaTime = manifest?.simulation.fixedDeltaTime ?? (1 / 60);
    const maxSubsteps = manifest?.simulation.maxSubsteps ?? 4;

    this.playAccumulator += deltaTime * this.timeScale;

    let steps = 0;
    while (this.playAccumulator >= fixedDeltaTime && steps < maxSubsteps) {
      this.physicsWorld?.update(fixedDeltaTime);
      // Ground detection must be updated before character controllers
      this.groundDetectionSystem?.update(fixedDeltaTime);
      
      // CRITICAL: playerSession.update() must be called BEFORE characterSystem.update()
      // because playerSession writes to intentBuffer, and characterSystem reads from it
      if (this.playerSession) {
        this.playerSession.update(fixedDeltaTime);
      } else {
        // Debug: log only first frame to avoid spam
        if (steps === 0) {
          Logger.warn('[EditorModeManager] playerSession is null, cannot update');
        }
      }
      
      // Now apply intents that were written to buffer by playerSession
      this.characterSystem?.update(fixedDeltaTime);
      this.blockBehaviorSystem?.update(fixedDeltaTime);
      this.stateMachine.update(fixedDeltaTime);
      this.playAccumulator -= fixedDeltaTime;
      steps += 1;
    }

    if (steps === maxSubsteps && this.playAccumulator >= fixedDeltaTime) {
      Logger.warn('Fixed update did not settle after maximum substeps');
      this.playAccumulator = fixedDeltaTime * 0.99;
    }

    // Update avatar visuals and animation
    if (this.playerEntity) {
      this.avatarManager.update(deltaTime, this.playerEntity);
    }
  }

  dispose(): void {
    // Ensure play mode resources are torn down even if dispose is called directly
    this.cleanupPlayer();

    // Cleanup temporary editor camera entity and primary camera assignment
    if (this.editorCameraEntity) {
      try {
        if (this.config.scene.primaryCamera === this.editorCameraEntity) {
          this.config.scene.setPrimaryCamera(null);
        }
        this.config.scene.removeEntity(this.editorCameraEntity);
      } catch (error) {
        Logger.warn('Error removing editor camera entity:', error as Error);
      }
      this.editorCameraEntity = null;
    }

    this.stateMachine.dispose();
    this.worldManager.dispose();
    this.cameraDirector.dispose();
    this.inputContext.dispose();
    this.checkpointSystem.dispose();
  }

  // ========== Collaboration Follow API ==========
  followUser(userId: string): void {
    this.followingUserId = userId;
    // Ensure editor camera mode is active
    this.cameraDirector.setMode('free-fly');
  }

  stopFollowingUser(): void {
    this.followingUserId = null;
  }

  getFollowingUserId(): string | null {
    return this.followingUserId;
  }

  private rotateVectorByQuat(v: [number, number, number], q: [number, number, number, number]): [number, number, number] {
    return transformVec3ByQuatOut(this._rotateScratch, v as Vec3, q as any);
  }

  private configureController(manifest: PlayManifest): void {
    const pawnConfig = manifest.pawn;
    const controllerConfig = manifest.controller;

    const fovRadians = (controllerConfig.preferences.fov * Math.PI) / 180;
    this.cameraDirector.setFov(fovRadians);
    this.cameraDirector.setCameraOffset(pawnConfig.cameraTarget.offset);
    this.cameraDirector.setCollisionRadius(pawnConfig.cameraTarget.collisionRadius);

    const fpsCamera = this.getFPSCamera();
    if (fpsCamera) {
      fpsCamera.setEyeHeight(pawnConfig.cameraTarget.offset[1]);
      fpsCamera.setSensitivity(controllerConfig.preferences.sensitivity);
      fpsCamera.setInvertY(controllerConfig.preferences.invertY);
    }

    Logger.info('[EditorModeManager] configureController called, characterInput:', this.characterInput ? 'exists' : 'null');
    if (this.characterInput) {
      Logger.info('[EditorModeManager] Setting bindings:', controllerConfig.input);
      this.characterInput.setBindings(controllerConfig.input);
      Logger.info('[EditorModeManager] Bindings set successfully');
    } else {
      Logger.warn('[EditorModeManager] characterInput is null, cannot configure bindings');
    }
    Logger.info('[EditorModeManager] Controller configured from manifest');
  }

  /**
   * Respawn player at the last activated checkpoint or default spawn point.
   * Can be called during gameplay to respawn the player.
   * 
   * @public
   */
  async respawnPlayer(): Promise<void> {
    const player = this.playerEntity;
    if (!player) {
      Logger.warn('[EditorModeManager] Cannot respawn: no player entity');
      return;
    }

    const contextManifest = this.stateMachine.getMutableContext().manifest as PlayManifest | null;
    const defaultSpawn = {
      position: (contextManifest?.playerStart.position ?? [0, 2, 0]) as Vec3,
      rotation: contextManifest?.playerStart.rotation ?? 0,
    };

    const respawnManager = new RespawnManager({
      defaultSpawn,
      checkpointSystem: this.checkpointSystem,
    });

    const result = respawnManager.respawn(player);

    // Update camera to player position
    const forward = player.transform.getForward();
    this.cameraDirector.setPlayerPose(result.position, forward);

    // Reset FPS camera yaw/pitch
    const fpsCamera = this.getFPSCamera();
    if (fpsCamera) {
      fpsCamera.setYawPitch(result.rotation, 0);
    }

    Logger.debug('[EditorModeManager] Player respawned at checkpoint/default spawn:', result.position);
  }

  private async spawnPlayer(position: Vec3, rotation: number): Promise<Entity> {
    const player = new Entity('__playmode_player');
    
    player.transform.position = [...position] as Vec3;
    player.transform.setEulerAngles(0, rotation, 0);
    
    player.userData.isPlayModePlayer = true;
    player.userData.isHidden = true;

    const contextManifest = this.stateMachine.getMutableContext().manifest as PlayManifest | null;

    // Add physics component
    const physics = new PhysicsComponent();
    const manifest = contextManifest ?? null;
    const physicsConfig = manifest?.pawn.physics;
    physics.colliders = [];
    if (physicsConfig) {
      physics.rigidbodyType = physicsConfig.rigidbody.type === 'kinematic'
        ? RigidbodyType.Kinematic
        : RigidbodyType.Dynamic;
      physics.mass = physicsConfig.rigidbody.mass;
      physics.useGravity = physicsConfig.rigidbody.useGravity;
      physics.material.friction = physicsConfig.material.friction;
      physics.material.restitution = physicsConfig.material.restitution;
      physics.addCapsuleCollider(
        physicsConfig.collider.radius,
        physicsConfig.collider.height,
        physicsConfig.collider.center,
      );
    } else {
      physics.rigidbodyType = RigidbodyType.Kinematic;
      physics.mass = 75;
      physics.useGravity = true;
      physics.material.friction = 0.7;
      physics.material.restitution = 0;
      physics.addCapsuleCollider(0.35, 1.7, [0, 0.85, 0]);
    }
    player.addComponent(physics);

    // Add character controller
    const controllerConfig = manifest?.pawn.kcc;
    const controller = new CharacterController(controllerConfig ?? {});
    player.addComponent(controller);

    // Add health component for gameplay blocks (lava, poison)
    const health = new HealthComponent();
    health.maxHealth = 100;
    health.currentHealth = 100;
    player.addComponent(health);

    if (manifest && this.characterInput) {
      const factory = new DefaultControllerFactory();
      const localController = factory.createLocalController({
        id: 'localPlayer',
        bindings: manifest.controller,
        inputHandler: this.characterInput,
        cameraDirector: this.cameraDirector,
        fpsCamera: this.getFPSCamera(),
        characterSystem: this.characterSystem,
      });

      // Set multiplayer input callback if collaboration is active
      if (this.config.collaborationManager?.isCollaborating()) {
        if (localController instanceof LocalPlayerController) {
          localController.onMultiplayerInput = (input: CharacterInput) => {
          this.config.collaborationManager?.processMultiplayerInput(input);
        };
        }
      }

      const session = new PlayerSession({
        id: 'player1',
        displayName: 'Player 1',
      });
      session.bindController(localController);
      localController.possess(player);
      this.playerSession = session;
    }

    // Add to the scene that is currently simulated by physics/character systems.
    const simulationScene = this.getSimulationScene();
    simulationScene.addEntity(player);
    this.playerScene = simulationScene;

    this.playerEntity = player;

    // Attach visual avatar under the player for play mode
    this.avatarManager.attachAvatarToPlayer(player, contextManifest);
    // Load and apply user's saved avatar (best-effort, async)
    void this.avatarManager.loadAndApplyUserAvatar();

    // Start multiplayer gameplay if collaboration is active
    if (this.config.collaborationManager?.isCollaborating()) {
      try {
        await this.config.collaborationManager.startMultiplayerGameplay(player);
      } catch (error) {
        Logger.warn('Failed to start multiplayer gameplay:', error as Error);
      }
    }

    // Start physics
    if (this.physicsWorld) {
      this.physicsWorld.start();
    }

    // Initialize FPS camera orientation from orbit
    const fpsCamera = this.getFPSCamera();
    if (fpsCamera) {
      const orbitState = this.controls.getState();
      fpsCamera.setYawPitch(rotation, orbitState.pitch);
      fpsCamera.enable();
    }

    Logger.debug('Player spawned at position:', player.transform.position);
    return player;
  }

  private cleanupPlayer(): void {
    // Stop multiplayer gameplay if active
    if (this.config.collaborationManager?.isCollaborating()) {
      try {
        void this.config.collaborationManager.stopMultiplayerGameplay();
      } catch (error) {
        Logger.warn('Failed to stop multiplayer gameplay:', error as Error);
      }
    }

    // Stop simulation subsystems to avoid leaving them running in editor mode
    this.physicsWorld?.stop();
    this.getFPSCamera()?.disable();
    this.characterInput?.disable();
    this.characterInput?.clear();

    if (this.playerSession) {
      try {
        this.playerSession.dispose();
      } catch (error) {
        Logger.warn('Failed to dispose player session:', error as Error);
      }
    }

    // Cleanup avatar visuals
    this.avatarManager.dispose();

    if (this.playerEntity) {
      const scenes = new Set<Scene>();
      if (this.playerScene) {
        scenes.add(this.playerScene);
      }
      const runtimeWorld = this.worldManager.getRuntimeWorld();
      if (runtimeWorld) {
        scenes.add(runtimeWorld);
      }
      scenes.add(this.config.scene);

      let removed = false;
      for (const scene of scenes) {
        try {
          scene.removeEntity(this.playerEntity);
          removed = true;
          break;
        } catch {
          // Try next scene
        }
      }

      if (!removed) {
        Logger.warn('Failed to remove player entity from any scene');
      }

      this.playerEntity = null;
      this.playerScene = null;
    }
    this.playerSession = null;
  }

}


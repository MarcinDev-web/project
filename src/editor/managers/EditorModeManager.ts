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

import type { Scene } from '../../engine/scene';
import type { SelectionManager } from '../../scene/Selection';
import type { EditorState } from '../core/state';
import { Logger } from '../../app/utils/logger';
import { Entity } from '../../scene/Entity';
import type { Vec3 } from '@engine/core/math';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import { CharacterController } from '../../scene/components/CharacterController';
import { PhysicsComponent, RigidbodyType } from '../../scene/components/PhysicsComponent';
import type { OrbitControls } from '@engine/camera';
import type { CharacterControllerSystem } from '../../scene/CharacterControllerSystem';
import type { CharacterInputHandler } from '@engine/input';
import type { FPSCamera } from '../camera/FPSCamera';
import { PlayModeStateMachine, PlayModeStateType } from '../core/PlayModeStateMachine';
import { WorldManager } from '../core/WorldManager';
import { CameraDirector } from '../camera/CameraDirector';
import { InputContextManager, EditorInputContext } from '@engine/input';
import { EditState } from '../states/EditState';
import { PreflightState } from '../states/PreflightState';
import { LoadingState } from '../states/LoadingState';
import { PlayIntroState } from '../states/PlayIntroState';
import { PlayingState } from '../states/PlayingState';
import { PausedState } from '../states/PausedState';
import { ReturnState } from '../states/ReturnState';
import { computeEntityPath, resolveEntityByPath } from '../history/HistoryHelpers';
import { DefaultControllerFactory } from '../../gameplay/PlayerControllerFactory';
import { PlayerSession } from '../../gameplay/PlayerSession';
import type { PlayManifest } from '../core/PlayManifest';

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
  characterInput?: CharacterInputHandler | null;
  fpsCamera?: FPSCamera | null;
  getRendererReady?: () => boolean;
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
  private playerSession: PlayerSession | null = null;
  
  // Systems
  private readonly physicsWorld: PhysicsWorld | null;
  private readonly characterSystem: CharacterControllerSystem | null;
  private readonly characterInput: CharacterInputHandler | null;
  private readonly fpsCamera: FPSCamera | null;
  private readonly controls: OrbitControls;
  private orbitSnapshot: { yaw: number; pitch: number; distance: number } | null = null;
  private selectionSnapshotPath: number[] | null = null;
 
  // Time scaling
  private timeScale = 1.0;
  private playAccumulator = 0;
  
  // Track if we're returning from play mode to avoid duplicate cleanup
  private returningFromPlay = false;

  constructor(private readonly config: EditorModeManagerConfig) {
    this.physicsWorld = config.physicsWorld ?? null;
    this.characterSystem = config.characterSystem ?? null;
    this.characterInput = config.characterInput ?? null;
    this.fpsCamera = config.fpsCamera ?? null;
    this.controls = config.controls;
    
    // Initialize managers
    this.worldManager = new WorldManager(config.scene);
    this.cameraDirector = new CameraDirector({
      orbitControls: config.controls,
      fpsCamera: config.fpsCamera ?? null,
      canvas: config.canvas,
      scene: config.scene,
      physicsWorld: this.physicsWorld,
    });
    this.inputContext = new InputContextManager(config.canvas);
    
    // Initialize state machine
    this.stateMachine = new PlayModeStateMachine();
    
    // Create state instances
    this.editState = new EditState({
      setEditorUIVisible: (visible) => {
        // Will be handled by UI integration
        if (!visible) {
          config.state.disableHistory();
        }
      },
      setOrbitEnabled: (enabled) => this.controls.setEnabled(enabled),
      getOrbitState: () => this.controls.getState(),
      saveOrbitState: (state) => {
        this.orbitSnapshot = { ...state };
      },
      restoreOrbitState: (state) => {
        if (state) {
          this.controls.setState(state);
        }
      },
      stopPhysics: () => this.physicsWorld?.stop(),
      disableScripts: () => {
        // TODO: Disable scripts when script system is ready
      },
      enableHistory: () => config.state.enableHistory(),
      disableHistory: () => config.state.disableHistory(),
      isReturningFromPlay: () => this.returningFromPlay,
      disableCharacterInput: () => this.characterInput?.disable(),
      disableFPSCamera: () => this.fpsCamera?.disable(),
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
    });
    
    const playIntroState = new PlayIntroState({
      cameraDirector: this.cameraDirector,
      inputContext: this.inputContext,
      markGameplayContextActive: (active) => {
        this.stateMachine.getMutableContext().data.set('gameplayContextActive', active);
      },
      isGameplayContextActive: () => {
        return this.stateMachine.getContext().data.get('gameplayContextActive') === true;
      },
      spawnPlayer: this.spawnPlayer.bind(this),
      configureController: this.configureController.bind(this),
      enableCharacterInput: () => this.characterInput?.enable(),
      disableOrbitControls: () => this.controls.setEnabled(false),
      freezeHistory: () => this.config.state.disableHistory(),
      hasFpsCamera: () => this.fpsCamera !== null,
      onFailure: () => {
        this.controls.setEnabled(true);
        if (this.orbitSnapshot) {
          this.controls.setState(this.orbitSnapshot);
        }
        this.config.state.enableHistory();
        this.restoreSelectionSnapshot();
        this.cleanupPlayer();
      },
    });
    
    this.playingState = new PlayingState({
      updateFPSCamera: () => this.fpsCamera?.update(),
      cameraDirector: this.cameraDirector,
      enableOrbitControls: () => this.controls.setEnabled(true),
      restoreOrbitState: () => {
        if (this.orbitSnapshot) {
          this.controls.setState(this.orbitSnapshot);
        }
      },
      updateCharacterInput: (forward, right) => this.characterInput?.setCameraDirections(forward, right),
      getCameraForward: () => this.fpsCamera?.getForwardDirection() ?? [0, 0, -1],
      getCameraRight: () => this.fpsCamera?.getRightDirection() ?? [1, 0, 0],
      resumeHistory: () => this.config.state.enableHistory(),
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
      disableScripts: () => {
        // TODO: Disable scripts when script system is ready
      },
      disableCharacterInput: () => this.characterInput?.disable(),
      disableFPSCamera: () => this.fpsCamera?.disable(),
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
      enableOrbitControls: () => this.controls.setEnabled(true),
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
      Logger.warn('Already in edit mode');
      return;
    } else {
      if (!this.stateMachine.transitionTo(PlayModeStateType.RETURN)) {
        Logger.warn('Unable to transition to RETURN state from current state');
      }
    }

    this.settleStateMachine();

    if (!this.isPlayMode()) {
      this.restoreSelectionSnapshot();
      this.returningFromPlay = false; // Clear flag after returning to edit mode
      this.config.onModeChanged?.('edit');
      this.config.state.editorMode.value = 'edit';
      this.config.state.enableHistory();
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

  getFPSCamera(): FPSCamera | null {
    return this.fpsCamera ?? null;
  }

  getCameraDirector(): CameraDirector {
    return this.cameraDirector;
  }

  getWorldManager(): WorldManager {
    return this.worldManager;
  }

  getActiveScene(): Scene {
    return this.worldManager.getRuntimeWorld() ?? this.config.scene;
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
      this.characterSystem?.update(fixedDeltaTime);
      this.playerSession?.update(fixedDeltaTime);
      this.stateMachine.update(fixedDeltaTime);
      this.playAccumulator -= fixedDeltaTime;
      steps += 1;
    }

    if (steps === maxSubsteps && this.playAccumulator >= fixedDeltaTime) {
      Logger.warn('Fixed update did not settle after maximum substeps');
      this.playAccumulator = fixedDeltaTime * 0.99;
    }
  }

  dispose(): void {
    this.stateMachine.dispose();
    this.worldManager.dispose();
    this.cameraDirector.dispose();
    this.inputContext.dispose();
    this.playerEntity = null;
  }

  private configureController(manifest: PlayManifest): void {
    const pawnConfig = manifest.pawn;
    const controllerConfig = manifest.controller;

    const fovRadians = (controllerConfig.preferences.fov * Math.PI) / 180;
    this.cameraDirector.setFov(fovRadians);
    this.cameraDirector.setCameraOffset(pawnConfig.cameraTarget.offset);
    this.cameraDirector.setCollisionRadius(pawnConfig.cameraTarget.collisionRadius);

    if (this.fpsCamera) {
      this.fpsCamera.setEyeHeight(pawnConfig.cameraTarget.offset[1]);
      this.fpsCamera.setSensitivity(controllerConfig.preferences.sensitivity);
      this.fpsCamera.setInvertY(controllerConfig.preferences.invertY);
    }

    if (this.characterInput) {
      this.characterInput.setBindings(controllerConfig.input);
    }
    Logger.debug('Controller configured from manifest');
  }

  private spawnPlayer(position: Vec3, rotation: number): Entity {
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

    if (manifest && this.characterInput) {
      const factory = new DefaultControllerFactory();
      const localController = factory.createLocalController({
        id: 'localPlayer',
        bindings: manifest.controller,
        inputHandler: this.characterInput,
        cameraDirector: this.cameraDirector,
        fpsCamera: this.fpsCamera,
        characterSystem: this.characterSystem,
      });

      const session = new PlayerSession({
        id: 'player1',
        displayName: 'Player 1',
      });
      session.bindController(localController);
      localController.possess(player);
      this.playerSession = session;
    }

    // Add to runtime world if it exists, otherwise authoring world
    const runtimeWorld = this.worldManager.getRuntimeWorld();
    if (runtimeWorld) {
      runtimeWorld.addEntity(player);
    } else {
      this.config.scene.addEntity(player);
    }
    
    this.playerEntity = player;

    // Start physics
    if (this.physicsWorld) {
      this.physicsWorld.start();
    }

    // Initialize FPS camera orientation from orbit
    if (this.fpsCamera) {
      const orbitState = this.controls.getState();
      this.fpsCamera.setYawPitch(rotation, orbitState.pitch);
      this.fpsCamera.enable();
    }

    Logger.debug('Player spawned at position:', player.transform.position);
    return player;
  }

  private cleanupPlayer(): void {
    if (this.playerEntity) {
      try {
        const runtimeWorld = this.worldManager.getRuntimeWorld();
        if (runtimeWorld) {
          runtimeWorld.removeEntity(this.playerEntity);
        } else {
          this.config.scene.removeEntity(this.playerEntity);
        }
      } catch (error) {
        Logger.warn('Error removing player entity:', error as Error);
      }
      this.playerEntity = null;
    }
    this.playerSession = null;
  }
}


/**
 * PlayerModeManager - Manages player runtime for published builds
 * 
 * Advanced version with state machine architecture for better organization
 * and support for multiplayer, visual scripting, and advanced features.
 */

import { Scene, Entity } from '@engine/world';
import type { Renderer } from '@engine/gfx-webgpu';
import type { PhysicsWorld } from '@engine/world';
import type { CharacterControllerSystem, GroundDetectionSystem } from '@engine/stdlib/CharacterController';
import type { CharacterInputHandler } from '@engine/input';
import type { FPSCamera } from '@engine/camera';
import { CameraDirector } from '@engine/camera';
import { InputContextManager, GameplayInputContext } from '@engine/input';
import { CharacterController, CharacterState } from '@engine/world/components/CharacterController';
import { PhysicsComponent, RigidbodyType } from '@engine/world/components/PhysicsComponent';
import { HealthComponent } from '@engine/world/components/HealthComponent';
import { DefaultControllerFactory, PlayerSession } from '@engine/stdlib/CharacterController';
import { hydrateScene } from '@engine/editor-utils';
import type { Vec3 } from '@engine/core/math';
import { quatToEuler } from '@engine/core/math';
import { Logger } from '../utils/logger';
import { loadBuildData } from '../utils/loadBuildData';
import {
  AvatarInstance,
  DEFAULT_AVATAR_LOADOUT,
  type AvatarLoadout,
  IDLE_ANIMATION,
  WALK_ANIMATION,
  RUN_ANIMATION,
  JUMP_ANIMATION,
} from '@engine/avatar';
import { PlayerStateMachine, PlayerStateType } from '../core/PlayerStateMachine.js';
import { LoadingState } from '../core/states/LoadingState.js';
import { ConnectingState } from '../core/states/ConnectingState.js';
import { PlayingState } from '../core/states/PlayingState.js';
import { PausedState } from '../core/states/PausedState.js';
import { DisconnectedState } from '../core/states/DisconnectedState.js';
import { ReplicationClient, MultiplayerGameplayManager, ReplicationState } from '@engine/net';
import { MultiplayerAPI } from '../utils/multiplayerApi.js';

// PlayManifest interface
interface PlayManifest {
  version: number;
  timestamp: number;
  playerStart: {
    position: Vec3;
    rotation: number;
    controllerMode: 'fps' | 'thirdPerson';
    enableCollisions: boolean;
    pawnArchetype: 'character';
  };
  simulation: {
    fixedDeltaTime: number;
    gravity: Vec3;
    rngSeed: number;
    maxSubsteps: number;
    enablePhysics: boolean;
    enableAI: boolean;
    enableScripts: boolean;
    enableMultiplayer?: boolean;
  };
  controller: {
    preferences: {
      fov: number;
      invertY: boolean;
      sensitivity: number;
      hudLayout: string;
    };
    input: {
      movement: {
        forward: string[];
        backward: string[];
        left: string[];
        right: string[];
      };
      actions: {
        jump: string[];
        sprint: string[];
        interact: string[];
        crouch: string[];
      };
    };
  };
  pawn: {
    type: 'character';
    cameraTarget: {
      offset: Vec3;
      lag: number;
      collisionRadius: number;
    };
    physics: {
      rigidbody: {
        type: 'kinematic' | 'dynamic';
        mass: number;
        useGravity: boolean;
      };
      collider: {
        shape: 'capsule';
        radius: number;
        height: number;
        center: Vec3;
      };
      material: {
        friction: number;
        restitution: number;
      };
    };
    kcc: {
      moveSpeed: number;
      sprintMultiplier: number;
      jumpForce: number;
      gravityMultiplier: number;
      maxSlopeAngle: number;
      stepHeight: number;
      groundCheckDistance: number;
      airControlMultiplier: number;
      rotationSpeed: number;
      autoRotate: boolean;
    };
  };
}

function createDefaultManifest(): PlayManifest {
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

export interface PlayerModeManagerConfig {
  canvas: HTMLCanvasElement;
  scene: Scene;
  renderer: Renderer;
  physicsWorld: PhysicsWorld;
  characterSystem: CharacterControllerSystem;
  groundDetectionSystem: GroundDetectionSystem;
  characterInput: CharacterInputHandler;
  fpsCamera: FPSCamera;
  /** Callback for loading progress updates */
  onLoadingProgress?: (step: string, percentage: number, message?: string) => void;
  /** Callback for pause menu visibility */
  onPauseMenuVisibilityChange?: (visible: boolean) => void;
  /** Callback for disconnect UI visibility */
  onDisconnectUIVisibilityChange?: (visible: boolean) => void;
}

export class PlayerModeManager {
  private scene: Scene;
  private renderer: Renderer;
  private physicsWorld: PhysicsWorld;
  private characterSystem: CharacterControllerSystem;
  private groundDetectionSystem: GroundDetectionSystem;
  private characterInput: CharacterInputHandler;
  private fpsCamera: FPSCamera;
  private canvas: HTMLCanvasElement;
  
  private cameraDirector: CameraDirector;
  private inputContext: InputContextManager;
  private stateMachine: PlayerStateMachine;
  
  private playerEntity: Entity | null = null;
  private playerSession: PlayerSession | null = null;
  private avatarInstance: AvatarInstance | null = null;
  private avatarVisualRoot: Entity | null = null;
  private lastPlayedAnim: 'idle' | 'walk' | 'run' | 'jump' | null = null;
  
  private manifest: PlayManifest | null = null;
  private buildId: string | null = null;
  
  private isInitialized = false;
  private accumulator = 0;
  private timeScale = 1.0;
  
  // State references for external control
  private playingState: PlayingState | null = null;
  private pausedState: PausedState | null = null;
  private disconnectedState: DisconnectedState | null = null;
  
  // Multiplayer systems
  private replicationClient: ReplicationClient | null = null;
  private multiplayerGameplayManager: MultiplayerGameplayManager | null = null;
  
  constructor(config: PlayerModeManagerConfig) {
    this.canvas = config.canvas;
    this.scene = config.scene;
    this.renderer = config.renderer;
    this.physicsWorld = config.physicsWorld;
    this.characterSystem = config.characterSystem;
    this.groundDetectionSystem = config.groundDetectionSystem;
    this.characterInput = config.characterInput;
    this.fpsCamera = config.fpsCamera;
    
    // Initialize managers
    const mockOrbitControls = {
      getState: () => ({
        position: [0, 0, 5] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
        pitch: 0,
        yaw: 0,
        distance: 5,
        zoom: 1,
      }),
      setEnabled: () => {},
      setState: () => {},
      cleanup: () => {},
    } as any;

    this.cameraDirector = new CameraDirector({
      orbitControls: mockOrbitControls,
      fpsCamera: this.fpsCamera,
      editorCamera: null,
      thirdPersonCamera: null,
      canvas: this.canvas,
      scene: this.scene,
      physicsWorld: this.physicsWorld,
      logger: {
        debug: (...args: unknown[]) => Logger.debug(args[0] as string, ...args.slice(1)),
        warn: (...args: unknown[]) => Logger.warn(args[0] as string, ...args.slice(1)),
      },
    });
    
    this.cameraDirector.setMode('fps');
    
    this.inputContext = new InputContextManager(this.canvas);
    
    // Initialize state machine
    this.stateMachine = new PlayerStateMachine();
    this.setupStates(config);
  }
  
  /**
   * Setup state machine with all states
   */
  private setupStates(config: PlayerModeManagerConfig): void {
    // Loading state
    const loadingState = new LoadingState({
      loadBuildData: async (buildId: string) => {
        return await loadBuildData(buildId);
      },
      onStarted: () => {
        Logger.info('Loading build data...');
      },
      onProgress: (step: string, percentage: number, message?: string) => {
        config.onLoadingProgress?.(step, percentage, message);
      },
      onCompleted: (success: boolean) => {
        if (success) {
          Logger.info('Build data loaded');
        } else {
          Logger.error('Failed to load build data');
        }
      },
    });
    
    // Connecting state - connect to multiplayer server using @engine/net
    const connectingState = new ConnectingState({
      connect: async (buildId: string) => {
        // Check if multiplayer is enabled in manifest
        const context = this.stateMachine.getContext();
        const manifest = context.manifest as PlayManifest | null;
        const isMultiplayer = manifest?.simulation?.enableMultiplayer ?? false;
        
        if (!isMultiplayer) {
          // Skip connection if multiplayer is disabled
          return;
        }
        
        // Get JWT token for authentication
        const jwtToken = await this.getJWTToken();
        if (!jwtToken) {
          throw new Error('Failed to get authentication token');
        }
        
        // Get WebSocket URL
        const wsUrl = await MultiplayerAPI.getWebSocketUrl(buildId);
        
        // Initialize ReplicationClient if not already created
        if (!this.replicationClient) {
          this.replicationClient = new ReplicationClient(wsUrl, jwtToken, {
            enableTransportNegotiation: true,
          });
          
          // Subscribe to state changes
          this.replicationClient.onStateChange((state) => {
            // Handle state changes (e.g., transition to DISCONNECTED on error)
            if (state === ReplicationState.Disconnected || state === ReplicationState.Error) {
              const currentState = this.stateMachine.getCurrentStateType();
              if (currentState === PlayerStateType.PLAYING) {
                // Transition to DISCONNECTED state
                this.stateMachine.transitionTo(PlayerStateType.DISCONNECTED);
              }
            }
          });
          
          // Subscribe to errors
          this.replicationClient.onError((error, code) => {
            Logger.error('[PlayerModeManager] ReplicationClient error:', error);
            const context = this.stateMachine.getMutableContext();
            context.errors.push(`Multiplayer error: ${error}${code ? ` (${code})` : ''}`);
          });
          
          // Initialize MultiplayerGameplayManager
          this.multiplayerGameplayManager = new MultiplayerGameplayManager(
            this.replicationClient,
            this.scene,
            this.physicsWorld
          );
          
          // Subscribe to MultiplayerGameplayManager errors
          this.multiplayerGameplayManager.onError((error) => {
            Logger.error('[PlayerModeManager] MultiplayerGameplayManager error:', error);
            const context = this.stateMachine.getMutableContext();
            context.errors.push(`Multiplayer error: ${error.message}`);
          });
        }
        
        // Connect to server and start session
        // Use buildId as sessionId for game sessions
        await this.replicationClient.connect(buildId);
        
        // Start multiplayer session after player is spawned (will be called in spawnPlayer)
        // For now, we just ensure connection is established
      },
      onStarted: () => {
        Logger.info('Connecting to server...');
      },
      onProgress: (message: string) => {
        Logger.debug(message);
      },
      onCompleted: (success: boolean) => {
        if (success) {
          Logger.info('Connected to server');
        } else {
          Logger.error('Failed to connect to server');
        }
      },
    });
    
    // Playing state
    this.playingState = new PlayingState({
      updateGame: (deltaTime: number) => {
        this.updateGameLoop(deltaTime);
      },
    });
    
    // Paused state
    this.pausedState = new PausedState({
      setTimeScale: (scale: number) => {
        this.timeScale = scale;
      },
      setPauseMenuVisible: (visible: boolean) => {
        config.onPauseMenuVisibilityChange?.(visible);
      },
    });
    
    // Disconnected state
    this.disconnectedState = new DisconnectedState({
      setDisconnectUIVisible: (visible: boolean) => {
        config.onDisconnectUIVisibilityChange?.(visible);
      },
      reconnect: async () => {
        if (!this.multiplayerGameplayManager || !this.buildId) {
          Logger.warn('[PlayerModeManager] Cannot reconnect: multiplayer system not initialized');
          return;
        }
        
        // Attempt reconnection
        try {
          await this.multiplayerGameplayManager.reconnect();
          // Transition back to CONNECTING state after successful reconnect
          const currentState = this.stateMachine.getCurrentStateType();
          if (currentState === PlayerStateType.DISCONNECTED) {
            this.stateMachine.transitionTo(PlayerStateType.CONNECTING);
          }
        } catch (error) {
          Logger.error('[PlayerModeManager] Reconnection failed:', error as unknown as Error);
          throw error;
        }
      },
    });
    
    // Register all states
    this.stateMachine.registerState(loadingState);
    this.stateMachine.registerState(connectingState);
    this.stateMachine.registerState(this.playingState);
    this.stateMachine.registerState(this.pausedState);
    this.stateMachine.registerState(this.disconnectedState);
  }
  
  /**
   * Initialize player mode with build ID
   */
  async initialize(buildId: string): Promise<void> {
    if (this.isInitialized) {
      Logger.warn('PlayerModeManager already initialized');
      return;
    }
    
    this.buildId = buildId;
    const context = this.stateMachine.getMutableContext();
    context.buildId = buildId;
    
    // Initialize state machine to LOADING
    this.stateMachine.initialize(PlayerStateType.LOADING);
    
    // Setup input context for pause
    this.inputContext.push({
      ...GameplayInputContext,
      onAction: (action) => {
        if (action === 'pause') {
          this.requestPause();
        }
      },
    });
    
    this.isInitialized = true;
    Logger.info('PlayerModeManager initialized');
  }
  
  /**
   * Update - call each frame
   */
  update(deltaTime: number): void {
    if (!this.isInitialized) {
      return;
    }
    
    // Update state machine
    this.stateMachine.update(deltaTime * this.timeScale);
    
    // Handle state-specific logic
    const currentState = this.stateMachine.getCurrentStateType();
    if (currentState === PlayerStateType.PLAYING) {
      // Game loop is handled by PlayingState.updateGame
      // But we still need to check for exit requests from paused state
      this.checkForExitRequest();
    } else if (currentState === PlayerStateType.PAUSED) {
      this.checkForExitRequest();
    } else if (currentState === PlayerStateType.LOADING) {
      // Loading is async, handled by LoadingState
      this.handleLoadingComplete();
    } else if (currentState === PlayerStateType.CONNECTING) {
      // Connecting is async, handled by ConnectingState
      this.handleConnectingComplete();
    }
  }
  
  /**
   * Handle loading completion - initialize game systems
   */
  private handleLoadingComplete(): void {
    const context = this.stateMachine.getContext();
    if (context.buildData && context.manifest && !this.playerEntity) {
      // Loading completed, initialize game
      void this.initializeGame();
    }
  }
  
  /**
   * Handle connecting completion
   */
  private handleConnectingComplete(): void {
    // Connection completed, game will start automatically via state transition
  }
  
  /**
   * Initialize game systems after loading
   */
  private async initializeGame(): Promise<void> {
    const context = this.stateMachine.getContext();
    if (!context.buildData || !context.manifest) {
      return;
    }
    
    try {
      const buildData = context.buildData;
      const manifest = context.manifest as PlayManifest;
      this.manifest = manifest;
      
      // Load scene
      Logger.info('Loading scene...');
      if (typeof buildData.sceneJSON === 'string') {
        hydrateScene(this.scene, buildData.sceneJSON);
        this.renderer.updateScene();
      }
      
      // Setup physics
      Logger.info('Setting up physics...');
      this.physicsWorld.start();
      
      // Spawn player
      Logger.info('Spawning player...');
      const playerStart = buildData.playerStart ?? null;
      const startPos = playerStart?.position ?? manifest.playerStart.position;
      const startRot = playerStart?.rotation ?? manifest.playerStart.rotation;
      await this.spawnPlayer(startPos, startRot);
      
      // Start multiplayer session if multiplayer is enabled and manager exists
      if (manifest.simulation.enableMultiplayer && this.multiplayerGameplayManager && this.playerEntity) {
        // Use buildId as sessionId for game sessions
        const sessionId = this.buildId ?? 'default-session';
        await this.multiplayerGameplayManager.startSession(sessionId, this.playerEntity);
      }
      
      // Fetch and apply user avatar loadout
      try {
        const userLoadout = await this.fetchUserAvatarLoadout();
        if (userLoadout && this.avatarInstance) {
          this.avatarInstance.applyLoadout(userLoadout);
        }
      } catch {
        // Ignore errors - default loadout already applied
      }
      
      // Configure controller
      this.configureController(manifest);
      
      // Enable input
      this.characterInput.enable();
      this.fpsCamera.enable();
      this.cameraDirector.setMode('fps');
      
      Logger.info('Game initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize game:', error as unknown as Error);
      const context = this.stateMachine.getMutableContext();
      context.errors.push(`Game initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Update game loop (called by PlayingState)
   */
  private updateGameLoop(deltaTime: number): void {
    // Update camera director
    this.cameraDirector.update(deltaTime);
    
    // Fixed timestep physics update
    const fixedDeltaTime = this.manifest?.simulation.fixedDeltaTime ?? (1 / 60);
    const maxSubsteps = this.manifest?.simulation.maxSubsteps ?? 4;
    
    this.accumulator += deltaTime;
    
    let steps = 0;
    while (this.accumulator >= fixedDeltaTime && steps < maxSubsteps) {
      // Update physics
      if (this.manifest?.simulation.enablePhysics) {
        this.physicsWorld.update(fixedDeltaTime);
      }
      
      // Ground detection must be updated before character controllers
      this.groundDetectionSystem.update(fixedDeltaTime);
      
      // Update character controller
      this.characterSystem.update(fixedDeltaTime);
      
      // Update player session
      this.playerSession?.update(fixedDeltaTime);
      
      this.accumulator -= fixedDeltaTime;
      steps += 1;
    }
    
    if (steps === maxSubsteps && this.accumulator >= fixedDeltaTime) {
      Logger.warn('Fixed update did not settle after maximum substeps');
      this.accumulator = fixedDeltaTime * 0.99;
    }
    
    // Update FPS camera
    this.fpsCamera.update();
    
    // Update avatar visuals and animation
    this.updateAvatar(deltaTime);
    
    // Update multiplayer systems if enabled
    if (this.multiplayerGameplayManager) {
      this.multiplayerGameplayManager.update(deltaTime);
    }
    
    // Process character input for multiplayer if enabled
    if (this.multiplayerGameplayManager && this.characterInput) {
      const input = this.characterInput.getInput();
      if (input) {
        this.multiplayerGameplayManager.processInput(input);
      }
    }
    
    // Update scene buffers
    this.renderer.updateScene();
  }
  
  /**
   * Request pause
   */
  requestPause(): void {
    const currentState = this.stateMachine.getCurrentStateType();
    if (currentState === PlayerStateType.PLAYING && this.playingState) {
      this.playingState.pause();
    }
  }
  
  /**
   * Request resume
   */
  requestResume(): void {
    const currentState = this.stateMachine.getCurrentStateType();
    if (currentState === PlayerStateType.PAUSED && this.pausedState) {
      this.pausedState.resume();
    }
  }
  
  /**
   * Request reconnect (from disconnected state)
   */
  requestReconnect(): void {
    const currentState = this.stateMachine.getCurrentStateType();
    if (currentState === PlayerStateType.DISCONNECTED && this.disconnectedState) {
      this.disconnectedState.reconnect();
    }
  }
  
  /**
   * Check for exit request from paused state
   */
  private checkForExitRequest(): void {
    if (this.pausedState?.isExitRequested()) {
      void this.exit();
    }
  }
  
  /**
   * Exit player mode - cleanup and return to platform
   */
  async exit(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    Logger.info('Exiting player mode...');
    
    // Call leaveGame API if buildId exists
    if (this.buildId) {
      try {
        await fetch(`/api/marketplace/${this.buildId}/leave`, {
          method: 'POST',
        });
      } catch (error) {
        Logger.warn('Failed to call leaveGame API:', error as unknown as Error);
      }
    }
    
    // Cleanup
    this.cleanup();
    
    // Redirect back to platform
    window.location.href = '/marketplace';
  }
  
  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.cleanup();
    this.stateMachine.dispose();
    this.cameraDirector.dispose();
    this.inputContext.dispose();
  }
  
  /**
   * Get current player entity
   */
  getPlayerEntity(): Entity | null {
    return this.playerEntity;
  }
  
  /**
   * Get current player position
   */
  getPlayerPosition(): Vec3 | null {
    return this.playerEntity?.transform.position ?? null;
  }
  
  /**
   * Get current state
   */
  getCurrentState(): PlayerStateType | null {
    return this.stateMachine.getCurrentStateType();
  }
  
  private async spawnPlayer(position: Vec3, rotation: number): Promise<void> {
    const player = new Entity('__playmode_player');
    
    player.transform.position = [...position] as Vec3;
    player.transform.setEulerAngles(0, rotation, 0);
    
    player.userData.isPlayModePlayer = true;
    player.userData.isHidden = true;
    
    const manifest = this.manifest ?? createDefaultManifest();
    
    // Add physics component
    const physics = new PhysicsComponent();
    const physicsConfig = manifest.pawn.physics;
    physics.colliders = [];
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
    player.addComponent(physics);
    
    // Add character controller
    const controllerConfig = manifest.pawn.kcc;
    const controller = new CharacterController(controllerConfig);
    player.addComponent(controller);
    
    // Add health component
    const health = new HealthComponent();
    health.maxHealth = 100;
    health.currentHealth = 100;
    player.addComponent(health);
    
    // Create player session and controller
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
    
    // Add to scene
    this.scene.addEntity(player);
    this.playerEntity = player;
    
    // Store in context
    const context = this.stateMachine.getMutableContext();
    context.data.set('playerEntity', player);
    
    // Attach visual avatar
    this.attachAvatarToPlayer();
    
    // Initialize FPS camera
    this.fpsCamera.setYawPitch(rotation, 0);
    
    Logger.info(`Player spawned at position: ${position[0]}, ${position[1]}, ${position[2]}`);
  }
  
  private attachAvatarToPlayer(): void {
    if (!this.playerEntity) return;
    
    // Cleanup previous visuals if any
    if (this.avatarInstance) {
      try {
        this.avatarInstance.dispose();
      } catch {
        // ignore
      }
      this.avatarInstance = null;
    }
    if (this.avatarVisualRoot && this.avatarVisualRoot.parent) {
      try {
        this.avatarVisualRoot.parent.removeChild(this.avatarVisualRoot);
      } catch {
        // ignore
      }
    }
    this.avatarVisualRoot = null;
    
    const visualRoot = new Entity('PlayerAvatarVisual');
    visualRoot.userData.isPlayerAvatarVisual = true;
    
    const centerY = this.manifest?.pawn.physics.collider.center[1] ?? 0.85;
    visualRoot.transform.position = [0, -centerY, 0];
    visualRoot.transform.scale = [1, 1, 1];
    
    this.playerEntity.addChild(visualRoot);
    this.avatarVisualRoot = visualRoot;
    
    const avatar = new AvatarInstance(visualRoot, {
      name: 'PlayerAvatar',
      loadout: DEFAULT_AVATAR_LOADOUT,
      strictMode: true,
    });
    
    // Hide head-related slots for FPS
    try {
      avatar.setSlotVisible('HeadSlot', false);
      avatar.setSlotVisible('HairSlot', false);
      avatar.setSlotVisible('FaceOverlaySlot', false);
    } catch {
      // non-fatal
    }
    
    this.avatarInstance = avatar;
    this.lastPlayedAnim = null;
  }
  
  private updateAvatar(deltaTime: number): void {
    if (!this.avatarInstance || !this.playerEntity) return;
    
    this.avatarInstance.update(deltaTime);
    
    const controller = this.playerEntity.getComponent(CharacterController);
    if (!controller) return;
    
    let desired: 'idle' | 'walk' | 'run' | 'jump' = 'idle';
    switch (controller.state) {
      case CharacterState.Running:
        desired = 'run';
        break;
      case CharacterState.Walking:
        desired = 'walk';
        break;
      case CharacterState.Jumping:
      case CharacterState.Falling:
        desired = 'jump';
        break;
      case CharacterState.Idle:
      case CharacterState.Landing:
      default:
        desired = 'idle';
        break;
    }
    
    if (desired !== this.lastPlayedAnim) {
      switch (desired) {
        case 'run':
          this.avatarInstance.playAnimation(RUN_ANIMATION);
          break;
        case 'walk':
          this.avatarInstance.playAnimation(WALK_ANIMATION);
          break;
        case 'jump':
          this.avatarInstance.playAnimation(JUMP_ANIMATION);
          break;
        case 'idle':
        default:
          this.avatarInstance.playAnimation(IDLE_ANIMATION);
          break;
      }
      this.lastPlayedAnim = desired;
    }
  }
  
  /**
   * Get JWT token for authentication.
   * Tries to get from cookies or API.
   */
  private async getJWTToken(): Promise<string | null> {
    // Try to get token from cookies (if set by auth system)
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'authToken' || name === 'jwt' || name === 'token') {
        return decodeURIComponent(value);
      }
    }
    
    // Try to get from API
    try {
      const response = await fetch('/api/auth/token', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = (await response.json()) as { token?: string };
        if (data.token) {
          return data.token;
        }
      }
    } catch (error) {
      Logger.warn('[PlayerModeManager] Failed to get token from API:', error as unknown as Error);
    }
    
    // Try to get from /api/auth/me response headers or body
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        // Check if token is in Authorization header or response body
        const authHeader = response.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          return authHeader.substring(7);
        }
        
        const data = (await response.json()) as { token?: string };
        if (data.token) {
          return data.token;
        }
      }
    } catch (error) {
      Logger.warn('[PlayerModeManager] Failed to get token from /api/auth/me:', error as unknown as Error);
    }
    
    Logger.warn('[PlayerModeManager] No JWT token found - multiplayer may not work');
    return null;
  }
  
  private async fetchUserAvatarLoadout(): Promise<AvatarLoadout | null> {
    interface AvatarLoadoutData {
      version: number;
      parts: Record<
        string,
        {
          mesh: string;
          mat?: string;
          material?: string;
          colors?: Record<string, [number, number, number, number]>;
        }
      >;
    }
    
    let userId: string | null = null;
    try {
      const meResp = await fetch('/api/auth/me', { credentials: 'include' });
      if (!meResp.ok) return null;
      const me = (await meResp.json()) as { id?: string };
      userId = me?.id ?? null;
      if (!userId) return null;
    } catch {
      return null;
    }
    
    try {
      const resp = await fetch(`/api/users/${encodeURIComponent(userId)}/avatar-loadout`, {
        credentials: 'include',
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as AvatarLoadoutData;
      return this.convertAvatarLoadoutData(data);
    } catch {
      return null;
    }
  }
  
  private convertAvatarLoadoutData(data: {
    version: number;
    parts: Record<
      string,
      { mesh: string; mat?: string; material?: string; colors?: Record<string, [number, number, number, number]> }
    >;
  }): AvatarLoadout {
    const parts: AvatarLoadout['parts'] = {};
    for (const [slot, part] of Object.entries(data.parts || {})) {
      if (!part) continue;
      (parts as any)[slot] = {
        mesh: part.mesh,
        ...(part.mat && { mat: part.mat }),
        ...(part.material && { material: part.material }),
        ...(part.colors && { colors: part.colors }),
      };
    }
    return { version: data.version, parts };
  }
  
  private configureController(manifest: PlayManifest): void {
    const pawnConfig = manifest.pawn;
    const controllerConfig = manifest.controller;
    
    const fovRadians = (controllerConfig.preferences.fov * Math.PI) / 180;
    this.cameraDirector.setFov(fovRadians);
    this.cameraDirector.setCameraOffset(pawnConfig.cameraTarget.offset);
    this.cameraDirector.setCollisionRadius(pawnConfig.cameraTarget.collisionRadius);
    
    this.fpsCamera.setEyeHeight(pawnConfig.cameraTarget.offset[1]);
    this.fpsCamera.setSensitivity(controllerConfig.preferences.sensitivity);
    this.fpsCamera.setInvertY(controllerConfig.preferences.invertY);
    
    this.characterInput.setBindings(controllerConfig.input);
    
    Logger.debug('Controller configured from manifest');
  }
  
  private cleanup(): void {
    this.physicsWorld.stop();
    
    this.characterInput.disable();
    this.fpsCamera.disable();
    
    if (this.playerEntity) {
      try {
        this.scene.removeEntity(this.playerEntity);
      } catch (error) {
        Logger.warn('Error removing player entity:', error as unknown as Error);
      }
      this.playerEntity = null;
    }
    
    if (this.avatarInstance) {
      try {
        this.avatarInstance.dispose();
      } catch {
        // ignore
      }
      this.avatarInstance = null;
    }
    this.avatarVisualRoot = null;
    this.lastPlayedAnim = null;
    
    this.playerSession = null;
    
    // Cleanup multiplayer systems
    if (this.multiplayerGameplayManager) {
      this.multiplayerGameplayManager.dispose();
      this.multiplayerGameplayManager = null;
    }
    
    if (this.replicationClient) {
      // ReplicationClient doesn't have dispose method, but connection will be closed on page unload
      this.replicationClient = null;
    }
    
    this.isInitialized = false;
    
    Logger.debug('Player mode cleaned up');
  }
}


/**
 * PlayerModeManager - Manages player runtime for published builds
 * 
 * Simplified version of EditorModeManager - no edit state, history, or UI panels.
 * Only handles: Loading scene -> Playing -> Exit
 */

import { Scene, Entity } from '@engine/world';
import type { Renderer } from '@engine/gfx-webgpu';
import type { PhysicsWorld } from '@engine/world';
import type { CharacterControllerSystem } from '@engine/stdlib/CharacterController';
import type { CharacterInputHandler } from '@engine/input';
import type { FPSCamera } from '@engine/camera';
import { CameraDirector } from '@engine/camera';
import { InputContextManager, GameplayInputContext } from '@engine/input';
import { CharacterController } from '@engine/world/components/CharacterController';
import { PhysicsComponent, RigidbodyType } from '@engine/world/components/PhysicsComponent';
import { HealthComponent } from '@engine/world/components/HealthComponent';
import { DefaultControllerFactory, PlayerSession } from '@engine/stdlib/CharacterController';
import { hydrateScene } from '@engine/editor-utils';
import type { Vec3 } from '@engine/core/math';
import { Logger } from './utils/logger';
import { loadBuildData } from './utils/loadBuildData';

// PlayManifest is not exported from @engine/world, we'll define a simple interface
// or use the one from editor (but we don't want to depend on editor)
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
  characterInput: CharacterInputHandler;
  fpsCamera: FPSCamera;
}

export class PlayerModeManager {
  private scene: Scene;
  private renderer: Renderer;
  private physicsWorld: PhysicsWorld;
  private characterSystem: CharacterControllerSystem;
  private characterInput: CharacterInputHandler;
  private fpsCamera: FPSCamera;
  private canvas: HTMLCanvasElement;
  
  private cameraDirector: CameraDirector;
  private inputContext: InputContextManager;
  
  private playerEntity: Entity | null = null;
  private playerSession: PlayerSession | null = null;
  
  private manifest: PlayManifest | null = null;
  private buildId: string | null = null;
  
  private isInitialized = false;
  private isPlaying = false;
  private accumulator = 0;
  
  constructor(config: PlayerModeManagerConfig) {
    this.canvas = config.canvas;
    this.scene = config.scene;
    this.renderer = config.renderer;
    this.physicsWorld = config.physicsWorld;
    this.characterSystem = config.characterSystem;
    this.characterInput = config.characterInput;
    this.fpsCamera = config.fpsCamera;
    
    // Initialize managers
    // Create a minimal mock orbitControls for CameraDirector (required but not used in fps mode)
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
      editorCamera: null, // Not used in player mode
      thirdPersonCamera: null, // Not used in player mode (yet)
      canvas: this.canvas,
      scene: this.scene,
      physicsWorld: this.physicsWorld,
      logger: {
        debug: (...args: unknown[]) => Logger.debug(args[0] as string, ...args.slice(1)),
        warn: (...args: unknown[]) => Logger.warn(args[0] as string, ...args.slice(1)),
      },
    });
    
    // Set fps mode immediately (before any update calls)
    this.cameraDirector.setMode('fps');
    
    this.inputContext = new InputContextManager(this.canvas);
  }
  
  /**
   * Initialize player mode with build data
   */
  async initialize(buildId: string): Promise<void> {
    if (this.isInitialized) {
      Logger.warn('PlayerModeManager already initialized');
      return;
    }
    
    this.buildId = buildId;
    
    try {
      // Load build data from API
      Logger.info(`Loading build: ${buildId}`);
      const buildData = await loadBuildData(buildId);
      
      // Use manifest from build data or default, ensure all required fields are present
      const defaultManifest = createDefaultManifest();
      if (buildData.manifest) {
        // Merge with defaults to ensure all required fields exist
        this.manifest = {
          ...defaultManifest,
          ...buildData.manifest,
          timestamp: (buildData.manifest as { timestamp?: number }).timestamp ?? Date.now(),
        } as PlayManifest;
      } else {
        this.manifest = defaultManifest;
      }
      
      // Load scene from buildData
      Logger.info('Loading scene...');
      if (typeof buildData.sceneJSON !== 'string') {
        throw new Error('Invalid build data: sceneJSON must be a string');
      }
      hydrateScene(this.scene, buildData.sceneJSON);
      
      // Update scene buffers
      this.renderer.updateScene();
      
      // Setup physics
      Logger.info('Setting up physics...');
      this.physicsWorld.start();
      
      // Spawn player
      Logger.info('Spawning player...');
      const playerStart = buildData.playerStart ?? null;
      const startPos = playerStart?.position ?? this.manifest.playerStart.position;
      const startRot = playerStart?.rotation ?? this.manifest.playerStart.rotation;
      await this.spawnPlayer(startPos, startRot);
      
      // Configure controller - manifest is guaranteed to be non-null here
      if (!this.manifest) {
        throw new Error('Manifest is null after initialization');
      }
      this.configureController(this.manifest);
      
      // Enable input
      this.characterInput.enable();
      this.fpsCamera.enable();
      
      // Set camera mode
      this.cameraDirector.setMode('fps');
      
      // Push player input context
      this.inputContext.push({
        ...GameplayInputContext,
        onAction: (action) => {
          if (action === 'pause') {
            void this.exit();
          }
        },
      });
      
      this.isInitialized = true;
      this.isPlaying = true;
      
      Logger.info('Player mode initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize player mode:', error as Error);
      throw error;
    }
  }
  
  /**
   * Update game loop - call each frame
   */
  update(deltaTime: number): void {
    if (!this.isPlaying || !this.isInitialized) {
      return;
    }
    
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
    
    // Update scene buffers (renderer handles rendering automatically)
    this.renderer.updateScene();
  }
  
  /**
   * Exit player mode - cleanup and return to platform
   */
  async exit(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    Logger.info('Exiting player mode...');
    
    this.isPlaying = false;
    
    // Call leaveGame API if buildId exists
    if (this.buildId) {
      try {
        await fetch(`/api/marketplace/${this.buildId}/leave`, {
          method: 'POST',
        });
      } catch (error) {
        Logger.warn('Failed to call leaveGame API:', error as Error);
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
    
    // Initialize FPS camera
    this.fpsCamera.setYawPitch(rotation, 0);
    
    Logger.info(`Player spawned at position: ${position[0]}, ${position[1]}, ${position[2]}`);
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
    // Stop physics
    this.physicsWorld.stop();
    
    // Disable input
    this.characterInput.disable();
    this.fpsCamera.disable();
    
    // Cleanup player
    if (this.playerEntity) {
      try {
        this.scene.removeEntity(this.playerEntity);
      } catch (error) {
        Logger.warn('Error removing player entity:', error as Error);
      }
      this.playerEntity = null;
    }
    
    this.playerSession = null;
    this.isInitialized = false;
    this.isPlaying = false;
    
    Logger.debug('Player mode cleaned up');
  }
}


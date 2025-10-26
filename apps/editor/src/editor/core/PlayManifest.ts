import type { Vec3 } from '@engine/core/math';

/**
 * Player start configuration
 */
export interface PlayerStartConfig {
  /** World position to spawn player */
  position: Vec3;
  /** Initial rotation (yaw in radians) */
  rotation: number;
  /** Controller mode */
  controllerMode: 'fps' | 'thirdPerson';
  /** Enable collisions */
  enableCollisions: boolean;
  /** Pawn archetype identifier */
  pawnArchetype: 'character';
}

/**
 * Simulation settings for runtime
 */
export interface SimulationSettings {
  /** Fixed timestep in seconds (e.g., 1/60 for 60Hz) */
  fixedDeltaTime: number;
  /** Gravity vector */
  gravity: Vec3;
  /** Random number generator seed for determinism */
  rngSeed: number;
  /** Maximum substeps per frame */
  maxSubsteps: number;
  /** Enable physics simulation */
  enablePhysics: boolean;
  /** Enable AI/character controllers */
  enableAI: boolean;
  /** Enable script execution */
  enableScripts: boolean;
}

/**
 * Rendering configuration
 */
export interface RenderingConfig {
  /** Shadow map resolution */
  shadowMapSize: number;
  /** Enable shadows */
  enableShadows: boolean;
  /** Material LOD distance thresholds */
  lodDistances: number[];
  /** Enable post-processing */
  enablePostProcessing: boolean;
}

/**
 * Input binding configuration
 */
export interface InputBindings {
  /** Movement keys */
  movement: {
    forward: string[];
    backward: string[];
    left: string[];
    right: string[];
  };
  /** Action keys */
  actions: {
    jump: string[];
    sprint: string[];
    interact: string[];
    crouch: string[];
  };
}

export interface ControllerPreferences {
  fov: number;
  invertY: boolean;
  sensitivity: number;
  hudLayout: string;
}

export interface ControllerBindings {
  /** Preferences for local controller */
  preferences: ControllerPreferences;
  /** Action mapping overrides */
  input: InputBindings;
}

export interface PawnPhysicsConfig {
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
}

export interface PawnKccConfig {
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
}

export interface PawnConfig {
  type: 'character';
  cameraTarget: {
    offset: Vec3;
    lag: number;
    collisionRadius: number;
  };
  physics: PawnPhysicsConfig;
  kcc: PawnKccConfig;
}

/**
 * UGC script permissions
 */
export interface UGCPermissions {
  /** Allowed API methods (whitelist) */
  allowedAPIs: string[];
  /** Max execution time per frame (ms) */
  maxExecutionTime: number;
  /** Max memory usage (bytes) */
  maxMemoryUsage: number;
  /** Enable network access */
  allowNetworkAccess: boolean;
  /** Enable file system access */
  allowFileSystemAccess: boolean;
}

/**
 * Streaming configuration for large worlds
 */
export interface StreamingConfig {
  /** Enable chunk streaming */
  enabled: boolean;
  /** Load radius around player (in chunks) */
  loadRadius: number;
  /** Unload radius (should be > loadRadius) */
  unloadRadius: number;
  /** Preload buffer (chunks to load ahead) */
  preloadBuffer: number;
}

/**
 * Complete manifest describing how to build and run the play mode
 * 
 * This is the "single source of truth" created during PREFLIGHT
 * and consumed during LOADING/PLAYING states.
 */
export interface PlayManifest {
  /** Manifest version for compatibility */
  version: number;
  /** Timestamp when manifest was created */
  timestamp: number;
  
  /** Player start configuration */
  playerStart: PlayerStartConfig;
  
  /** Simulation settings */
  simulation: SimulationSettings;
  
  /** Rendering configuration */
  rendering: RenderingConfig;
  
  /** Controller bindings/preferences */
  controller: ControllerBindings;

  /** Pawn configuration */
  pawn: PawnConfig;
  
  /** UGC permissions and limits */
  permissions: UGCPermissions;
  
  /** Streaming configuration */
  streaming: StreamingConfig;
  
  /** Component type filter (types to include in runtime) */
  runtimeComponentTypes: string[];
  
  /** Entity IDs to exclude from runtime (editor-only entities) */
  excludedEntityIds: string[];
  
  /** Custom metadata */
  metadata: Record<string, any>;
}

// Internal validators (type guards) used by validateManifest
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value as number) && (value as number) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value as number) && (value as number) >= 0;
}

function isVec3Like(v: unknown): v is Vec3 {
  if (!v || typeof (v as any)[0] === 'undefined') return false;
  const arr = v as { 0: unknown; 1: unknown; 2: unknown; length?: number };
  const hasLength = typeof arr.length === 'number' ? (arr.length as number) >= 3 : true;
  return (
    hasLength &&
    isFiniteNumber(arr[0]) &&
    isFiniteNumber(arr[1]) &&
    isFiniteNumber(arr[2])
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => isFiniteNumber(v));
}

/**
 * Default manifest settings
 */
export function createDefaultManifest(): PlayManifest {
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
    
    rendering: {
      shadowMapSize: 2048,
      enableShadows: true,
      lodDistances: [20, 50, 100],
      enablePostProcessing: true,
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
    
    permissions: {
      allowedAPIs: [
        'entity.transform',
        'entity.getComponent',
        'scene.findEntity',
        'physics.raycast',
        'audio.play',
      ],
      maxExecutionTime: 16, // ~1 frame at 60fps
      maxMemoryUsage: 10 * 1024 * 1024, // 10MB
      allowNetworkAccess: false,
      allowFileSystemAccess: false,
    },
    
    streaming: {
      enabled: false,
      loadRadius: 3,
      unloadRadius: 5,
      preloadBuffer: 1,
    },
    
    runtimeComponentTypes: [
      'PhysicsComponent',
      'MeshComponent',
      'LightComponent',
      'CameraComponent',
      'ScriptComponent',
      'AnimationComponent',
      'AudioComponent',
      'CharacterController',
      'EnvironmentComponent',
      'JointComponent',
    ],
    
    excludedEntityIds: [],
    
    metadata: {},
  };
}

/**
 * Validate a manifest for completeness and correctness
 */
export function validateManifest(manifest: PlayManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Version check
  if (manifest.version !== 1) {
    errors.push(`Unsupported manifest version: ${manifest.version}`);
  }
  if (!isNonNegativeNumber(manifest.timestamp)) {
    errors.push('Invalid timestamp');
  }
  
  // Player start validation
  if (!manifest.playerStart) {
    errors.push('Missing playerStart configuration');
  } else {
    if (!isVec3Like(manifest.playerStart.position)) {
      errors.push('Invalid playerStart.position');
    }
    if (!isFiniteNumber(manifest.playerStart.rotation)) {
      errors.push('Invalid playerStart.rotation');
    }
    if (manifest.playerStart.controllerMode !== 'fps' && manifest.playerStart.controllerMode !== 'thirdPerson') {
      errors.push('Invalid playerStart.controllerMode');
    }
    if (typeof manifest.playerStart.enableCollisions !== 'boolean') {
      errors.push('Invalid playerStart.enableCollisions');
    }
    if (manifest.playerStart.pawnArchetype !== 'character') {
      errors.push('Invalid playerStart.pawnArchetype');
    }
  }
  
  // Simulation validation
  if (!manifest.simulation) {
    errors.push('Missing simulation configuration');
  } else {
    if (!isPositiveNumber(manifest.simulation.fixedDeltaTime)) {
      errors.push('simulation.fixedDeltaTime must be positive');
    }
    if (!isVec3Like(manifest.simulation.gravity)) {
      errors.push('Invalid simulation.gravity');
    }
    if (!Number.isInteger(manifest.simulation.rngSeed)) {
      errors.push('simulation.rngSeed must be an integer');
    }
    if (!isPositiveInteger(manifest.simulation.maxSubsteps)) {
      errors.push('simulation.maxSubsteps must be >= 1');
    }
    if (typeof manifest.simulation.enablePhysics !== 'boolean') {
      errors.push('Invalid simulation.enablePhysics');
    }
    if (typeof manifest.simulation.enableAI !== 'boolean') {
      errors.push('Invalid simulation.enableAI');
    }
    if (typeof manifest.simulation.enableScripts !== 'boolean') {
      errors.push('Invalid simulation.enableScripts');
    }
  }
  
  // Rendering validation
  if (!manifest.rendering) {
    errors.push('Missing rendering configuration');
  } else {
    if (!isPositiveInteger(manifest.rendering.shadowMapSize) || manifest.rendering.shadowMapSize < 256 || manifest.rendering.shadowMapSize > 8192) {
      errors.push('rendering.shadowMapSize must be between 256 and 8192');
    }
    if (typeof manifest.rendering.enableShadows !== 'boolean') {
      errors.push('Invalid rendering.enableShadows');
    }
    if (!isNumberArray(manifest.rendering.lodDistances)) {
      errors.push('Invalid rendering.lodDistances');
    } else {
      const lod = manifest.rendering.lodDistances;
      for (let i = 0; i < lod.length; i++) {
        if (!isNonNegativeNumber(lod[i])) {
          errors.push(`rendering.lodDistances[${i}] must be non-negative`);
          break;
        }
      }
      for (let i = 1; i < lod.length; i++) {
        const curr = lod[i];
        const prev = lod[i - 1];
        if (!isNonNegativeNumber(curr) || !isNonNegativeNumber(prev) || !(curr > prev)) {
          errors.push('rendering.lodDistances must be strictly increasing');
          break;
        }
      }
    }
    if (typeof manifest.rendering.enablePostProcessing !== 'boolean') {
      errors.push('Invalid rendering.enablePostProcessing');
    }
  }
  
  // Input validation
  if (!manifest.controller) {
    errors.push('Missing controller configuration');
  } else {
    if (!manifest.controller.preferences) {
      errors.push('Missing controller.preferences configuration');
    }
    if (!manifest.controller.input) {
      errors.push('Missing controller.input configuration');
    }
    if (manifest.controller.preferences) {
      const p = manifest.controller.preferences;
      if (!isPositiveNumber(p.fov)) {
        errors.push('Invalid controller.preferences.fov');
      }
      if (typeof p.invertY !== 'boolean') {
        errors.push('Invalid controller.preferences.invertY');
      }
      if (!isPositiveNumber(p.sensitivity)) {
        errors.push('Invalid controller.preferences.sensitivity');
      }
      if (typeof p.hudLayout !== 'string') {
        errors.push('Invalid controller.preferences.hudLayout');
      }
    }
    if (manifest.controller.input) {
      const i = manifest.controller.input;
      const m = i.movement;
      const a = i.actions;
      if (!m || !isStringArray(m.forward) || !isStringArray(m.backward) || !isStringArray(m.left) || !isStringArray(m.right)) {
        errors.push('Invalid controller.input.movement');
      }
      if (!a || !isStringArray(a.jump) || !isStringArray(a.sprint) || !isStringArray(a.interact) || !isStringArray(a.crouch)) {
        errors.push('Invalid controller.input.actions');
      }
    }
  }

  // Pawn validation
  if (!manifest.pawn) {
    errors.push('Missing pawn configuration');
  } else {
    if (!manifest.pawn.cameraTarget) {
      errors.push('Missing pawn.cameraTarget configuration');
    }
    if (!manifest.pawn.physics) {
      errors.push('Missing pawn.physics configuration');
    }
    if (!manifest.pawn.kcc) {
      errors.push('Missing pawn.kcc configuration');
    }
    if (manifest.pawn.cameraTarget) {
      const c = manifest.pawn.cameraTarget;
      if (!isVec3Like(c.offset)) {
        errors.push('Invalid pawn.cameraTarget.offset');
      }
      if (!isNonNegativeNumber(c.lag)) {
        errors.push('Invalid pawn.cameraTarget.lag');
      }
      if (!isPositiveNumber(c.collisionRadius)) {
        errors.push('Invalid pawn.cameraTarget.collisionRadius');
      }
    }
    if (manifest.pawn.physics) {
      const ph = manifest.pawn.physics;
      if (!ph.rigidbody || (ph.rigidbody.type !== 'kinematic' && ph.rigidbody.type !== 'dynamic')) {
        errors.push('Invalid pawn.physics.rigidbody.type');
      }
      if (!isPositiveNumber(ph.rigidbody?.mass)) {
        errors.push('Invalid pawn.physics.rigidbody.mass');
      }
      if (typeof ph.rigidbody?.useGravity !== 'boolean') {
        errors.push('Invalid pawn.physics.rigidbody.useGravity');
      }
      if (!ph.collider || ph.collider.shape !== 'capsule') {
        errors.push('Invalid pawn.physics.collider.shape');
      }
      if (!isPositiveNumber(ph.collider?.radius)) {
        errors.push('Invalid pawn.physics.collider.radius');
      }
      if (!isPositiveNumber(ph.collider?.height)) {
        errors.push('Invalid pawn.physics.collider.height');
      }
      if (!isVec3Like(ph.collider?.center)) {
        errors.push('Invalid pawn.physics.collider.center');
      }
      if (!ph.material) {
        errors.push('Missing pawn.physics.material');
      } else {
        if (!isNonNegativeNumber(ph.material.friction)) {
          errors.push('Invalid pawn.physics.material.friction');
        }
        if (!isNonNegativeNumber(ph.material.restitution) || ph.material.restitution > 1) {
          errors.push('Invalid pawn.physics.material.restitution');
        }
      }
    }
    if (manifest.pawn.kcc) {
      const k = manifest.pawn.kcc;
      if (!isPositiveNumber(k.moveSpeed)) errors.push('Invalid pawn.kcc.moveSpeed');
      if (!isPositiveNumber(k.sprintMultiplier)) errors.push('Invalid pawn.kcc.sprintMultiplier');
      if (!isNonNegativeNumber(k.jumpForce)) errors.push('Invalid pawn.kcc.jumpForce');
      if (!isPositiveNumber(k.gravityMultiplier)) errors.push('Invalid pawn.kcc.gravityMultiplier');
      if (!isNonNegativeNumber(k.maxSlopeAngle) || k.maxSlopeAngle > 89) errors.push('Invalid pawn.kcc.maxSlopeAngle');
      if (!isNonNegativeNumber(k.stepHeight)) errors.push('Invalid pawn.kcc.stepHeight');
      if (!isNonNegativeNumber(k.groundCheckDistance)) errors.push('Invalid pawn.kcc.groundCheckDistance');
      if (!isNonNegativeNumber(k.airControlMultiplier)) errors.push('Invalid pawn.kcc.airControlMultiplier');
      if (!isNonNegativeNumber(k.rotationSpeed)) errors.push('Invalid pawn.kcc.rotationSpeed');
      if (typeof k.autoRotate !== 'boolean') errors.push('Invalid pawn.kcc.autoRotate');
    }
  }

  // Permissions validation
  if (!manifest.permissions) {
    errors.push('Missing permissions configuration');
  } else {
    const p = manifest.permissions;
    if (!isStringArray(p.allowedAPIs)) errors.push('Invalid permissions.allowedAPIs');
    if (!isPositiveNumber(p.maxExecutionTime)) errors.push('Invalid permissions.maxExecutionTime');
    if (!isPositiveNumber(p.maxMemoryUsage)) errors.push('Invalid permissions.maxMemoryUsage');
    if (typeof p.allowNetworkAccess !== 'boolean') errors.push('Invalid permissions.allowNetworkAccess');
    if (typeof p.allowFileSystemAccess !== 'boolean') errors.push('Invalid permissions.allowFileSystemAccess');
  }

  // Streaming validation
  if (!manifest.streaming) {
    errors.push('Missing streaming configuration');
  } else {
    const s = manifest.streaming;
    if (typeof s.enabled !== 'boolean') errors.push('Invalid streaming.enabled');
    if (!isNonNegativeInteger(s.loadRadius)) errors.push('Invalid streaming.loadRadius');
    if (!isNonNegativeInteger(s.unloadRadius)) errors.push('Invalid streaming.unloadRadius');
    if (!isNonNegativeInteger(s.preloadBuffer)) errors.push('Invalid streaming.preloadBuffer');
    if (isNonNegativeInteger(s.loadRadius) && isNonNegativeInteger(s.unloadRadius)) {
      if (!(s.unloadRadius > s.loadRadius)) errors.push('streaming.unloadRadius must be > loadRadius');
    }
  }

  // Runtime and metadata validation
  if (!isStringArray(manifest.runtimeComponentTypes)) {
    errors.push('Invalid runtimeComponentTypes');
  }
  if (!Array.isArray(manifest.excludedEntityIds) || !manifest.excludedEntityIds.every((v) => typeof v === 'string')) {
    errors.push('Invalid excludedEntityIds');
  }
  if (manifest.metadata === null || typeof manifest.metadata !== 'object' || Array.isArray(manifest.metadata)) {
    errors.push('Invalid metadata');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}


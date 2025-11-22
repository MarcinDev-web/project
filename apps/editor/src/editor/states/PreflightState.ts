import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { createDefaultManifest, validateManifest, type PlayManifest } from '../core/PlayManifest';
import { Logger } from '../../utils/logger';
import { quatToEuler } from '@engine/core/math';
import type { Scene } from '@engine/world';
import { ScriptComponent } from '@engine/script';
import { BehaviorRegistry } from '@engine/script';
import {
  LightComponent,
  PhysicsComponent,
  MeshComponent,
  MaterialComponent,
  HealthComponent,
  type RigidbodyType,
  type ColliderShape,
} from '@engine/world';

/**
 * Validation result
 */
interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Dependencies for PREFLIGHT state
 */
export interface PreflightStateDeps {
  /** Get the authoring scene */
  getScene: () => Scene;
  /** Check if renderer is ready */
  isRendererReady: () => boolean;
  /** Get renderer capabilities */
  getRendererCapabilities?: () => any;
}

/**
 * PREFLIGHT State - Validation before play
 * 
 * Responsibilities:
 * - Validate scene for runtime compatibility
 * - Check for missing assets (materials, meshes)
 * - Verify shaders are compiled
 * - Check for script errors
 * - Find PlayerStart entity
 * - Build Play Manifest
 * - Success → LOADING, Failure → EDIT
 */
export class PreflightState implements IPlayModeState {
  readonly type = StateType.PREFLIGHT;
  
  private deps: PreflightStateDeps;
  private validationComplete = false;
  private validationPassed = false;

  constructor(deps: PreflightStateDeps) {
    this.deps = deps;
  }

  onEnter(context: PlayModeContext): void {
    Logger.debug('Entering PREFLIGHT state');
    
    this.validationComplete = false;
    this.validationPassed = false;
    
    // Clear previous errors/warnings
    context.errors = [];
    context.warnings = [];
    
    // Run validation checks
    const result = this.runValidation(context);
    
    this.validationPassed = result.passed;
    context.errors = result.errors;
    context.warnings = result.warnings;
    
    if (result.passed) {
      // Build manifest
      try {
        const manifest = this.buildManifest(context);
        context.manifest = manifest;
        Logger.info('Preflight checks passed, manifest built');
      } catch (error) {
        Logger.error('Failed to build manifest:', error as Error);
        context.errors.push(`Manifest build failed: ${error instanceof Error ? error.message : String(error)}`);
        this.validationPassed = false;
      }
    } else {
      Logger.warn('Preflight checks failed', result.errors);
    }
    
    this.validationComplete = true;
  }

  onExit(_context: PlayModeContext): void {
    Logger.debug('Exiting PREFLIGHT state');
  }

  onUpdate(_deltaTime: number, _context: PlayModeContext): PlayModeStateType | null {
    if (!this.validationComplete) {
      return null; // Still validating
    }
    
    if (this.validationPassed) {
      return StateType.LOADING; // Proceed to loading
    } else {
      return StateType.EDIT; // Return to edit with error report
    }
  }

  canTransitionTo(target: PlayModeStateType): boolean {
    // Can transition to LOADING (success) or EDIT (failure)
    return target === StateType.LOADING || target === StateType.EDIT;
  }

  /**
   * Run all validation checks
   */
  private runValidation(context: PlayModeContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check 1: Renderer ready
      if (!this.deps.isRendererReady()) {
        errors.push('Renderer is not ready');
      }
      
      // Check 2: Scene has entities
      const scene = this.deps.getScene();
      if (scene.entityCount === 0) {
        warnings.push('Scene is empty');
      }
      
      // Check 3: Find PlayerStart
      const playerStart = this.findPlayerStart(scene);
      if (!playerStart) {
        // Create default player start
        warnings.push('No PlayerStart entity found, using default position');
        context.data.set('playerStartPosition', [0, 5, 0]);
        context.data.set('playerStartRotation', 0);
      } else {
        context.data.set('playerStartPosition', playerStart.position);
        context.data.set('playerStartRotation', playerStart.rotation);
      }
      
      // Check 4: Validate components
      this.validateComponents(scene, errors, warnings);
      
      // Check 5: Validate scripts
      this.validateScripts(scene, errors, warnings);
      
      Logger.debug(`Validation complete: ${errors.length} errors, ${warnings.length} warnings`);
    } catch (error) {
      Logger.error('Validation failed with exception:', error as Error);
      errors.push(`Validation exception: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Build the play manifest
   */
  private buildManifest(context: PlayModeContext): PlayManifest {
    const manifest = createDefaultManifest();
    
    // Configure player start from validation
    const playerStartPos = context.data.get('playerStartPosition');
    const playerStartRot = context.data.get('playerStartRotation');
    if (playerStartPos) {
      manifest.playerStart.position = playerStartPos;
    }
    if (playerStartRot !== undefined) {
      manifest.playerStart.rotation = playerStartRot;
    }
    
    // Validate manifest
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
    }
    
    return manifest;
  }

  /**
   * Find PlayerStart entity in scene
   */
  private findPlayerStart(scene: Scene): { position: [number, number, number]; rotation: number } | null {
    // Look for entity named "PlayerStart" or with userData.playerStart
    const entities = scene.getAllEntities();
    
    for (const entity of entities) {
      if (entity.name === 'PlayerStart' || entity.userData.playerStart === true) {
        // Extract yaw around Y axis from quaternion
        const euler = quatToEuler(entity.transform.rotation as any);
        const yawY = euler[1] ?? 0;
        return {
          position: [...entity.transform.position] as [number, number, number],
          rotation: yawY,
        };
      }
    }
    
    return null;
  }

  /**
   * Validate components across the scene.
   * Checks for invalid values, missing required data, and component-specific issues.
   */
  private validateComponents(scene: Scene, errors: string[], warnings: string[]): void {
    try {
      const entities = scene.getAllEntities();
      if (entities.length === 0) return;

      for (const entity of entities) {
        const label = `${entity.name ?? 'Entity'}#${entity.id}`;

        // Validate LightComponent
        const light = entity.getComponent(LightComponent);
        if (light) {
          this.validateLightComponent(light, label, errors, warnings);
        }

        // Validate PhysicsComponent
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
          this.validatePhysicsComponent(physics, label, errors, warnings);
        }

        // Validate MeshComponent
        const mesh = entity.getComponent(MeshComponent);
        if (mesh) {
          this.validateMeshComponent(mesh, label, errors, warnings);
        }

        // Validate MaterialComponent
        const material = entity.getComponent(MaterialComponent);
        if (material) {
          this.validateMaterialComponent(material, label, errors, warnings);
        }

        // Validate HealthComponent
        const health = entity.getComponent(HealthComponent);
        if (health) {
          this.validateHealthComponent(health, label, errors, warnings);
        }
      }
    } catch (e) {
      errors.push(`Component validation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Validate LightComponent properties
   */
  private validateLightComponent(
    light: LightComponent,
    label: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate intensity
    if (!Number.isFinite(light.intensity) || light.intensity < 0) {
      errors.push(`LightComponent on ${label} has invalid intensity: ${light.intensity}`);
    } else if (light.intensity === 0) {
      warnings.push(`LightComponent on ${label} has zero intensity (light will be invisible)`);
    }

    // Validate range (for point/spot lights)
    if (light.lightType === 'point' || light.lightType === 'spot') {
      if (!Number.isFinite(light.range) || light.range <= 0) {
        errors.push(`LightComponent on ${label} (${light.lightType}) has invalid range: ${light.range}`);
      }
    }

    // Validate spot light angles
    if (light.lightType === 'spot') {
      if (!Number.isFinite(light.innerConeAngle) || light.innerConeAngle < 0 || light.innerConeAngle > Math.PI) {
        errors.push(`LightComponent on ${label} (spot) has invalid innerConeAngle: ${light.innerConeAngle}`);
      }
      if (!Number.isFinite(light.outerConeAngle) || light.outerConeAngle < 0 || light.outerConeAngle > Math.PI) {
        errors.push(`LightComponent on ${label} (spot) has invalid outerConeAngle: ${light.outerConeAngle}`);
      }
      if (
        Number.isFinite(light.innerConeAngle) &&
        Number.isFinite(light.outerConeAngle) &&
        light.innerConeAngle > light.outerConeAngle
      ) {
        errors.push(
          `LightComponent on ${label} (spot) has innerConeAngle (${light.innerConeAngle}) > outerConeAngle (${light.outerConeAngle})`
        );
      }
    }

    // Validate color values (should be 0-1 range)
    if (light.color) {
      for (let i = 0; i < 3; i++) {
        const val = light.color[i];
        if (!Number.isFinite(val) || val < 0 || val > 1) {
          warnings.push(`LightComponent on ${label} has color[${i}] out of [0,1] range: ${val}`);
        }
      }
    }

    // Validate direction (should be normalized for directional/spot)
    if (light.lightType === 'directional' || light.lightType === 'spot') {
      if (light.direction) {
        const len = Math.sqrt(
          light.direction[0] ** 2 + light.direction[1] ** 2 + light.direction[2] ** 2
        );
        if (len < 0.001) {
          errors.push(`LightComponent on ${label} (${light.lightType}) has zero-length direction vector`);
        } else if (Math.abs(len - 1.0) > 0.1) {
          warnings.push(`LightComponent on ${label} (${light.lightType}) has non-normalized direction (length: ${len.toFixed(2)})`);
        }
      }
    }
  }

  /**
   * Validate PhysicsComponent properties
   */
  private validatePhysicsComponent(
    physics: PhysicsComponent,
    label: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate rigidbody type
    const validTypes: RigidbodyType[] = ['static', 'dynamic', 'kinematic'];
    if (!validTypes.includes(physics.rigidbodyType)) {
      errors.push(`PhysicsComponent on ${label} has invalid rigidbodyType: ${physics.rigidbodyType}`);
    }

    // Validate mass (should be positive for dynamic bodies)
    if (physics.rigidbodyType === 'dynamic') {
      if (!Number.isFinite(physics.mass) || physics.mass <= 0) {
        errors.push(`PhysicsComponent on ${label} (dynamic) has invalid mass: ${physics.mass}`);
      } else if (physics.mass < 0.001) {
        warnings.push(`PhysicsComponent on ${label} (dynamic) has very small mass: ${physics.mass}`);
      } else if (physics.mass > 10000) {
        warnings.push(`PhysicsComponent on ${label} (dynamic) has very large mass: ${physics.mass}`);
      }
    }

    // Validate colliders
    if (physics.colliders && physics.colliders.length > 0) {
      for (let i = 0; i < physics.colliders.length; i++) {
        const collider = physics.colliders[i];
        const colliderLabel = `${label}[collider ${i}]`;

        // Validate shape
        const validShapes: ColliderShape[] = ['box', 'sphere', 'capsule'];
        if (!validShapes.includes(collider.shape)) {
          errors.push(`PhysicsComponent ${colliderLabel} has invalid shape: ${collider.shape}`);
          continue;
        }

        // Validate center
        if (collider.center) {
          for (let j = 0; j < 3; j++) {
            if (!Number.isFinite(collider.center[j])) {
              errors.push(`PhysicsComponent ${colliderLabel} has invalid center[${j}]: ${collider.center[j]}`);
            }
          }
        }

        // Validate friction and restitution
        if (!Number.isFinite(collider.friction) || collider.friction < 0 || collider.friction > 1) {
          warnings.push(`PhysicsComponent ${colliderLabel} has friction out of [0,1] range: ${collider.friction}`);
        }
        if (!Number.isFinite(collider.restitution) || collider.restitution < 0 || collider.restitution > 1) {
          warnings.push(`PhysicsComponent ${colliderLabel} has restitution out of [0,1] range: ${collider.restitution}`);
        }

        // Validate shape-specific properties
        if (collider.shape === 'box') {
          const box = collider as any;
          if (box.size) {
            for (let j = 0; j < 3; j++) {
              if (!Number.isFinite(box.size[j]) || box.size[j] <= 0) {
                errors.push(`PhysicsComponent ${colliderLabel} (box) has invalid size[${j}]: ${box.size[j]}`);
              }
            }
          } else {
            errors.push(`PhysicsComponent ${colliderLabel} (box) is missing size property`);
          }
        } else if (collider.shape === 'sphere') {
          const sphere = collider as any;
          if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) {
            errors.push(`PhysicsComponent ${colliderLabel} (sphere) has invalid radius: ${sphere.radius}`);
          }
        } else if (collider.shape === 'capsule') {
          const capsule = collider as any;
          if (!Number.isFinite(capsule.radius) || capsule.radius <= 0) {
            errors.push(`PhysicsComponent ${colliderLabel} (capsule) has invalid radius: ${capsule.radius}`);
          }
          if (!Number.isFinite(capsule.height) || capsule.height <= 0) {
            errors.push(`PhysicsComponent ${colliderLabel} (capsule) has invalid height: ${capsule.height}`);
          }
          if (
            Number.isFinite(capsule.radius) &&
            Number.isFinite(capsule.height) &&
            capsule.height < capsule.radius * 2
          ) {
            warnings.push(
              `PhysicsComponent ${colliderLabel} (capsule) has height (${capsule.height}) < 2*radius (${capsule.radius * 2})`
            );
          }
        }
      }
    } else {
      warnings.push(`PhysicsComponent on ${label} has no colliders (will not participate in physics)`);
    }

    // Validate material properties
    if (physics.material) {
      if (!Number.isFinite(physics.material.density) || physics.material.density <= 0) {
        warnings.push(`PhysicsComponent on ${label} has invalid material density: ${physics.material.density}`);
      }
      if (!Number.isFinite(physics.material.friction) || physics.material.friction < 0 || physics.material.friction > 1) {
        warnings.push(`PhysicsComponent on ${label} has material friction out of [0,1] range: ${physics.material.friction}`);
      }
      if (
        !Number.isFinite(physics.material.restitution) ||
        physics.material.restitution < 0 ||
        physics.material.restitution > 1
      ) {
        warnings.push(
          `PhysicsComponent on ${label} has material restitution out of [0,1] range: ${physics.material.restitution}`
        );
      }
    }
  }

  /**
   * Validate MeshComponent properties
   */
  private validateMeshComponent(
    mesh: MeshComponent,
    label: string,
    errors: string[],
    warnings: string[]
  ): void {
    const validTypes: string[] = [
      'cube',
      'sphere',
      'cylinder',
      'plane',
      'capsule',
      'custom',
      'avatar_torso',
      'terrain',
      'capsule_y',
    ];
    if (!validTypes.includes(mesh.meshType)) {
      errors.push(`MeshComponent on ${label} has invalid meshType: ${mesh.meshType}`);
    }

    // Validate custom mesh data if present
    if (mesh.meshType === 'custom' && mesh.meshData) {
      if (!mesh.meshData.vertices || mesh.meshData.vertices.length === 0) {
        errors.push(`MeshComponent on ${label} (custom) has no vertices`);
      }
      if (mesh.meshData.indices && mesh.meshData.indices.length === 0) {
        warnings.push(`MeshComponent on ${label} (custom) has empty indices array`);
      }
    } else if (mesh.meshType === 'custom' && !mesh.meshData) {
      errors.push(`MeshComponent on ${label} (custom) is missing meshData`);
    }
  }

  /**
   * Validate MaterialComponent properties
   */
  private validateMaterialComponent(
    material: MaterialComponent,
    label: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate material ID
    if (!Number.isFinite(material.materialId) || material.materialId < 0 || material.materialId > MaterialComponent.MAX_MATERIAL_ID) {
      errors.push(
        `MaterialComponent on ${label} has materialId out of [0, ${MaterialComponent.MAX_MATERIAL_ID}] range: ${material.materialId}`
      );
    }

    // Validate color values (should be 0-1 range)
    const colorProps = ['primaryColor', 'secondaryColor', 'accentColor', 'emissiveColor'] as const;
    for (const prop of colorProps) {
      const color = material[prop];
      if (color) {
        for (let i = 0; i < 4; i++) {
          const val = color[i];
          if (!Number.isFinite(val) || val < 0 || val > 1) {
            warnings.push(`MaterialComponent on ${label} has ${prop}[${i}] out of [0,1] range: ${val}`);
          }
        }
      }
    }

    // Validate opacity
    if (!Number.isFinite(material.opacity) || material.opacity < 0 || material.opacity > 1) {
      errors.push(`MaterialComponent on ${label} has opacity out of [0,1] range: ${material.opacity}`);
    }

    // Validate metallic and roughness
    if (!Number.isFinite(material.metallic) || material.metallic < 0 || material.metallic > 1) {
      warnings.push(`MaterialComponent on ${label} has metallic out of [0,1] range: ${material.metallic}`);
    }
    if (!Number.isFinite(material.roughness) || material.roughness < 0 || material.roughness > 1) {
      warnings.push(`MaterialComponent on ${label} has roughness out of [0,1] range: ${material.roughness}`);
    }

    // Validate emissive intensity
    if (!Number.isFinite(material.emissiveIntensity) || material.emissiveIntensity < 0) {
      warnings.push(`MaterialComponent on ${label} has negative emissiveIntensity: ${material.emissiveIntensity}`);
    }

    // Validate alpha mode
    const validAlphaModes: string[] = ['opaque', 'mask', 'blend'];
    if (!validAlphaModes.includes(material.alphaMode)) {
      errors.push(`MaterialComponent on ${label} has invalid alphaMode: ${material.alphaMode}`);
    }
  }

  /**
   * Validate HealthComponent properties
   */
  private validateHealthComponent(
    health: HealthComponent,
    label: string,
    errors: string[],
    warnings: string[]
  ): void {
    // Validate max health
    if (!Number.isFinite(health.maxHealth) || health.maxHealth <= 0) {
      errors.push(`HealthComponent on ${label} has invalid maxHealth: ${health.maxHealth}`);
    } else if (health.maxHealth < 1) {
      warnings.push(`HealthComponent on ${label} has very small maxHealth: ${health.maxHealth}`);
    } else if (health.maxHealth > 1000000) {
      warnings.push(`HealthComponent on ${label} has very large maxHealth: ${health.maxHealth}`);
    }

    // Validate current health (should be in [0, maxHealth] range)
    const currentHealth = health.currentHealth;
    if (!Number.isFinite(currentHealth) || currentHealth < 0) {
      errors.push(`HealthComponent on ${label} has invalid currentHealth: ${currentHealth}`);
    } else if (currentHealth > health.maxHealth) {
      warnings.push(
        `HealthComponent on ${label} has currentHealth (${currentHealth}) > maxHealth (${health.maxHealth})`
      );
    }
  }

  /**
   * Validate ScriptComponent definitions across the scene.
   * Ensures each script references a registered behavior and flags basic issues.
   */
  private validateScripts(scene: Scene, errors: string[], warnings: string[]): void {
    try {
      const scripted = scene.queryEntities(ScriptComponent);
      if (scripted.length === 0) return;

      for (const entity of scripted) {
        const comp = entity.getComponent(ScriptComponent);
        if (!comp) continue;
        const defs = comp.getScriptDefinitions();
        for (let i = 0; i < defs.length; i++) {
          const def = defs[i];
          const label = `${entity.name ?? 'Entity'}#${entity.id}`;
          if (!def || typeof def.name !== 'string' || def.name.trim() === '') {
            errors.push(`Script at index ${i} on ${label} has an invalid name`);
            continue;
          }
          if (!BehaviorRegistry.has(def.name)) {
            errors.push(`Script "${def.name}" on ${label} is not registered`);
            continue;
          }
          if (def.params !== undefined && (def.params === null || typeof def.params !== 'object' || Array.isArray(def.params))) {
            warnings.push(`Script "${def.name}" on ${label} has non-object params; will be ignored`);
          }
          if (def.enabled === false) {
            warnings.push(`Script "${def.name}" on ${label} is disabled`);
          }
        }
      }
    } catch (e) {
      errors.push(`Script validation failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

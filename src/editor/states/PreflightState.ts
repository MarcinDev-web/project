import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { createDefaultManifest, validateManifest, type PlayManifest } from '../core/PlayManifest';
import { Logger } from '../../app/utils/logger';
import { quatToEuler } from '@engine/core/math';
import type { Scene } from '../../scene/Scene';
import { ScriptComponent } from '../../scene/components/ScriptComponent';
import { BehaviorRegistry } from '../../logic/BehaviorRegistry';

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
        context.data.set('playerStartPosition', [0, 2, 0]);
        context.data.set('playerStartRotation', 0);
      } else {
        context.data.set('playerStartPosition', playerStart.position);
        context.data.set('playerStartRotation', playerStart.rotation);
      }
      
      // Check 4: Validate components
      // TODO: Add component validation when needed
      
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


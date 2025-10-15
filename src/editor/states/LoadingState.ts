import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { Logger } from '../../logger';
import type { WorldManager } from '../core/WorldManager';
import type { PlayManifest } from '../core/PlayManifest';
import { LightManager } from '../../rendering/lighting/LightManager';
import { LightComponent } from '../../scene/components/LightComponent';

/**
 * Dependencies for LOADING state
 */
export interface LoadingStateDeps {
  /** World manager for authoring/runtime separation */
  worldManager: WorldManager;
  /** Pre-warm WebGPU pipelines */
  prewarmPipelines?: () => Promise<void>;
  /** Setup physics systems */
  setupPhysics: () => void;
  /** Update scene buffers */
  updateSceneBuffers: () => void;
}

/**
 * LOADING State - Build runtime world
 * 
 * Responsibilities:
 * - Create authoring snapshot
 * - Clone authoring → runtime world with manifest filter
 * - Pre-warm WebGPU pipelines (avoid first-frame stutter)
 * - Setup physics/simulation systems for runtime
 * - Auto-transition to PLAY_INTRO when ready
 */
export class LoadingState implements IPlayModeState {
  readonly type = StateType.LOADING;
  
  private deps: LoadingStateDeps;
  private loadingComplete = false;
  private loadingSuccess = false;

  constructor(deps: LoadingStateDeps) {
    this.deps = deps;
  }

  onEnter(context: PlayModeContext): void {
    Logger.debug('Entering LOADING state');
    
    this.loadingComplete = false;
    this.loadingSuccess = false;
    
    try {
      // Step 1: Snapshot authoring world
      Logger.debug('Creating authoring snapshot');
      const snapshot = this.deps.worldManager.snapshotAuthoring();
      context.authoringSnapshot = snapshot;
      
      // Step 2: Build runtime world from manifest
      Logger.debug('Building runtime world');
      const manifest = context.manifest as PlayManifest;
      if (!manifest) {
        throw new Error('No manifest available');
      }
      
      const runtimeScene = this.deps.worldManager.buildRuntimeWorld(manifest);

      // Ensure PBR has lighting: if scene has no lights, inject defaults (Sun + Ambient)
      try {
        const scene = runtimeScene ?? this.deps.worldManager.getRuntimeWorld();
        if (scene) {
          const lights = scene.queryEntities(LightComponent);
          const hasAnyLight = lights.length > 0 && lights.some((e) => {
            const lc = e.getComponent(LightComponent);
            return !!lc && lc.enabled && e.active;
          });
          if (!hasAnyLight) {
            LightManager.createDefaultLights(scene);
            Logger.info('Injected default lights into runtime scene');
          }
        }
      } catch (err) {
        Logger.warn('Default light injection failed:', err as Error);
      }
      
      // Step 3: Setup physics for runtime
      Logger.debug('Setting up physics systems');
      this.deps.setupPhysics();
      
      // Step 4: Update scene buffers for runtime world
      Logger.debug('Updating scene buffers');
      this.deps.updateSceneBuffers();
      
      // Step 5: Pre-warm WebGPU pipelines (optional)
      if (this.deps.prewarmPipelines) {
        Logger.debug('Pre-warming GPU pipelines');
        // Run prewarm synchronously if provided
        void this.deps.prewarmPipelines();
      }
      
      this.loadingSuccess = true;
      Logger.info('Runtime world loaded successfully');
    } catch (error) {
      Logger.error('Failed to load runtime world:', error as Error);
      context.errors.push(`Loading failed: ${error instanceof Error ? error.message : String(error)}`);
      this.loadingSuccess = false;
    } finally {
      this.loadingComplete = true;
    }
  }

  onExit(_context: PlayModeContext): void {
    Logger.debug('Exiting LOADING state');
  }

  onUpdate(_deltaTime: number, _context: PlayModeContext): PlayModeStateType | null {
    if (!this.loadingComplete) {
      return null; // Still loading
    }
    
    if (this.loadingSuccess) {
      return StateType.PLAY_INTRO; // Proceed to intro/handoff
    } else {
      return StateType.RETURN; // Failed, return to edit
    }
  }

  canTransitionTo(target: PlayModeStateType): boolean {
    // Can transition to PLAY_INTRO (success) or RETURN (failure)
    return target === StateType.PLAY_INTRO || target === StateType.RETURN;
  }
}


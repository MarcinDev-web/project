import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { Logger } from '../../app/utils/logger';
import type { WorldManager } from '../core/WorldManager';
import type { InputContextManager } from '@engine/input';
import type { CameraDirector } from '../camera/CameraDirector';

/**
 * Dependencies for RETURN state
 */
export interface ReturnStateDeps {
  /** World manager */
  worldManager: WorldManager;
  /** Input context manager */
  inputContext: InputContextManager;
  /** Camera director */
  cameraDirector: CameraDirector;
  /** Whether gameplay context needs to be popped */
  shouldPopGameplayContext: () => boolean;
  /** Mark gameplay context as inactive once popped */
  markGameplayContextInactive: () => void;
  /** Stop physics */
  stopPhysics: () => void;
  /** Disable scripts */
  disableScripts: () => void;
  /** Disable character input */
  disableCharacterInput: () => void;
  /** Disable FPS camera */
  disableFPSCamera: () => void;
  /** Unbind player session/controller */
  unbindPlayerController: () => void;
  /** Cleanup player entity */
  cleanupPlayer: () => void;
  /** Update scene buffers */
  updateSceneBuffers: () => void;
  /** Dispose GPU resources */
  disposeRuntimeGPUResources?: () => void;
  /** Restore editor UI visibility */
  showEditorUI: () => void;
  /** Re-enable orbit controls */
  enableOrbitControls: () => void;
}

/**
 * RETURN State - Teardown and restore
 * 
 * Responsibilities:
 * - Stop all runtime systems (physics, scripts, audio)
 * - Dispose GPU buffers/resources
 * - Release pointer lock
 * - Restore authoring world from snapshot
 * - Show editor UI
 * - Auto-transition to EDIT
 */
export class ReturnState implements IPlayModeState {
  readonly type = StateType.RETURN;
  
  private deps: ReturnStateDeps;
  private teardownComplete = false;
  private encounteredError: Error | null = null;

  constructor(deps: ReturnStateDeps) {
    this.deps = deps;
  }

  onEnter(context: PlayModeContext): void {
    Logger.debug('Entering RETURN state');
    
    this.teardownComplete = false;
    this.encounteredError = null;
    
    try {
      // Step 1: Stop runtime systems
      Logger.debug('Stopping runtime systems');
      this.deps.stopPhysics();
      this.deps.disableScripts();
      this.deps.disableCharacterInput();
      this.deps.disableFPSCamera();
      this.deps.unbindPlayerController();
      this.deps.cleanupPlayer();
      
      // Step 2: Pop gameplay input context and release pointer lock
      Logger.debug('Releasing pointer lock and input context');
      if (this.deps.shouldPopGameplayContext()) {
        this.deps.inputContext.pop(); // Remove gameplay context
        this.deps.markGameplayContextInactive();
      }
      this.deps.inputContext.releasePointerLock();
      
      // Step 3: Switch camera back to orbit
      Logger.debug('Switching camera to orbit mode');
      this.deps.cameraDirector.setMode('orbit');
      
      // Step 4: Dispose runtime GPU resources
      if (this.deps.disposeRuntimeGPUResources) {
        Logger.debug('Disposing runtime GPU resources');
        this.deps.disposeRuntimeGPUResources();
      }
      
      // Step 5: Clear runtime world
      Logger.debug('Clearing runtime world');
      this.deps.worldManager.clearRuntimeWorld();
      
      // Step 6: Restore authoring world from snapshot
      Logger.debug('Restoring authoring world');
      this.deps.worldManager.restoreAuthoring();
      
      // Step 7: Update scene buffers with restored authoring world
      Logger.debug('Updating scene buffers');
      this.deps.updateSceneBuffers();
      
      // Step 8: Clear snapshot and manifest
      this.deps.worldManager.clearSnapshot();
      context.authoringSnapshot = null;
      context.manifest = null;
      context.data.clear();
      this.deps.showEditorUI();
      this.deps.enableOrbitControls();
      
      Logger.info('Returned to edit mode');
    } catch (error) {
      Logger.error('Error during return to edit:', error as Error);
      context.errors.push(`Return failed: ${error instanceof Error ? error.message : String(error)}`);
      this.encounteredError = error instanceof Error ? error : new Error(String(error));
    } finally {
      this.teardownComplete = true;
      if (this.encounteredError) {
        Logger.warn('Return state completed with errors');
      }
    }
  }

  onExit(_context: PlayModeContext): void {
    Logger.debug('Exiting RETURN state');
  }

  onUpdate(_deltaTime: number, _context: PlayModeContext): PlayModeStateType | null {
    if (this.teardownComplete) {
      return StateType.EDIT; // Return to edit mode
    }
    
    return null; // Still tearing down
  }

  canTransitionTo(target: PlayModeStateType): boolean {
    // Can only transition to EDIT
    return target === StateType.EDIT;
  }
}


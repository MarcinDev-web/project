import type { IPlayModeState, PlayModeContext, PlayModeStateType } from '../core/PlayModeStateMachine';
import { PlayModeStateType as StateType } from '../core/PlayModeStateMachine';
import { Logger } from '../../utils/logger';
import type { Vec3 } from '@engine/core/math';

export interface EditorCameraState {
  position: Vec3;
  yaw: number;
  pitch: number;
}

/**
 * Dependencies for EDIT state
 */
export interface EditStateDeps {
  /** Show/hide editor UI */
  setEditorUIVisible: (visible: boolean) => void;
  /** Enable editor free-fly camera */
  enableEditorCamera: () => void;
  /** Disable editor free-fly camera */
  disableEditorCamera: () => void;
  /** Get current editor camera state */
  getEditorCameraState: () => EditorCameraState;
  /** Save editor camera state for restoration */
  saveEditorCameraState: (state: EditorCameraState) => void;
  /** Restore editor camera state */
  restoreEditorCameraState: (state: EditorCameraState | null) => void;
  /** Stop physics simulation */
  stopPhysics: () => void;
  /** Disable script execution */
  disableScripts: () => void;
  /** Enable history recording */
  enableHistory: () => void;
  /** Disable history recording */
  disableHistory: () => void;
  /** Check if coming from RETURN state (to avoid duplicate cleanup) */
  isReturningFromPlay?: () => boolean;
  /** Disable character input (optional fallback) */
  disableCharacterInput?: () => void;
  /** Disable FPS camera (optional fallback) */
  disableFPSCamera?: () => void;
}

/**
 * EDIT State - Default editor mode
 * 
 * Active systems:
 * - Editor UI (toolbar, inspector, panels)
 * - Free-fly editor camera
 * - Selection and gizmos
 * - History/undo system
 * - Editor tools
 * 
 * Inactive systems:
 * - Physics simulation
 * - Script execution
 * - AI/character controllers
 */
export class EditState implements IPlayModeState {
  readonly type = StateType.EDIT;
  
  private deps: EditStateDeps;
  private triggerPlayMode = false;
  private lastEditorCameraState: EditorCameraState | null = null;

  constructor(deps: EditStateDeps) {
    this.deps = deps;
  }

  onEnter(context: PlayModeContext): void {
    Logger.debug('Entering EDIT state');
    
    // Show editor UI
    this.deps.setEditorUIVisible(true);
    
    // Enable free-fly camera
    this.deps.enableEditorCamera();
    this.deps.restoreEditorCameraState(this.lastEditorCameraState);
    this.lastEditorCameraState = null;
    
    // Stop simulation systems (only if not coming from RETURN, which already stopped them)
    const fromReturn = this.deps.isReturningFromPlay?.() ?? false;
    if (!fromReturn) {
      this.deps.stopPhysics();
      this.deps.disableScripts();
      // Ensure character input and FPS camera are disabled when not coming from RETURN
      this.deps.disableCharacterInput?.();
      this.deps.disableFPSCamera?.();
    }
    
    // Enable history recording
    this.deps.enableHistory();
    
    // Clear any errors from previous play session
    context.errors = [];
    context.warnings = [];
    
    Logger.info('Edit mode active');
  }

  onExit(context: PlayModeContext): void {
    Logger.debug('Exiting EDIT state');
    const cameraState = this.deps.getEditorCameraState();
    this.deps.saveEditorCameraState(cameraState);
    this.lastEditorCameraState = cameraState;
    this.deps.disableEditorCamera();
  }

  onUpdate(_deltaTime: number, _context: PlayModeContext): PlayModeStateType | null {
    // Check if user triggered play mode
    if (this.triggerPlayMode) {
      this.triggerPlayMode = false;
      this.deps.disableHistory();
      return StateType.PREFLIGHT;
    }
    
    return null; // Stay in EDIT
  }

  canTransitionTo(target: PlayModeStateType): boolean {
    // Can only transition to PREFLIGHT from EDIT
    return target === StateType.PREFLIGHT;
  }

  /**
   * Trigger transition to play mode
   * (Called by external systems, e.g., play button)
   */
  requestPlayMode(): void {
    this.triggerPlayMode = true;
  }
}


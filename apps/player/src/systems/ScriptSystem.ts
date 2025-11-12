import type { Scene } from '@engine/world';
import { LogicCubeSystem } from '@engine/script';
import { Logger } from '../utils/logger';

/**
 * ScriptSystem wrapper for player mode
 * 
 * Manages LogicCubes visual scripting system in player runtime
 */
export class ScriptSystem {
  private scriptSystem: LogicCubeSystem | null = null;
  private isEnabled = false;

  /**
   * Initialize script system with scene
   */
  initialize(scene: Scene): void {
    // Check if scene has scriptRuntime
    const runtime = (scene as any).scriptRuntime;
    if (runtime?.scriptSystem) {
      this.scriptSystem = runtime.scriptSystem;
      Logger.debug('[ScriptSystem] Initialized with existing scriptSystem from scene');
    } else {
      // Create new LogicCubeSystem if scene doesn't have one
      // LogicCubeSystem automatically registers itself with the scene in its constructor
      this.scriptSystem = new LogicCubeSystem(scene);
      Logger.debug('[ScriptSystem] Created new LogicCubeSystem');
    }
  }

  /**
   * Update script system (call each frame)
   */
  update(deltaTime: number): void {
    if (!this.isEnabled || !this.scriptSystem) {
      return;
    }

    try {
      // LogicCubeSystem updates automatically when added to scene
      // But we can call update explicitly if needed
      if (typeof (this.scriptSystem as any).update === 'function') {
        (this.scriptSystem as any).update(deltaTime);
      }
    } catch (error) {
      Logger.error('[ScriptSystem] Update error:', error as unknown as Error);
    }
  }

  /**
   * Enable script system
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (this.scriptSystem) {
      try {
        if (typeof (this.scriptSystem as any).setEnabled === 'function') {
          (this.scriptSystem as any).setEnabled(enabled);
        }
      } catch (error) {
        Logger.warn('[ScriptSystem] Could not set enabled state:', error as unknown as Error);
      }
    }
    
    Logger.debug(`[ScriptSystem] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Check if script system is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get underlying LogicCubeSystem
   */
  getLogicCubeSystem(): LogicCubeSystem | null {
    return this.scriptSystem;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.setEnabled(false);
    this.scriptSystem = null;
  }
}


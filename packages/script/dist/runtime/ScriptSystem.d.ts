import type { Scene } from '@engine/world';
import type { ScriptCapabilityPermissions } from '../security/CapabilityTypes.js';
/**
 * Runs Behavior instances on entities with ScriptComponent.
 * Also supports hot-reload by monitoring registry changes via a simple version.
 * Supports capability-based access control when permissions are provided.
 */
export declare class ScriptSystem {
    private readonly scene;
    private lastRegistryVersion;
    private readonly runtime;
    private fixedAccumulator;
    private fixedDeltaTime;
    private maxFixedStepsPerUpdate;
    private enabled;
    private readonly capabilityManager?;
    constructor(scene: Scene, options?: {
        permissions?: ScriptCapabilityPermissions;
    });
    /** Sets the fixed time step in seconds (<=0 disables fixed updates). */
    setFixedTimeStep(seconds: number): void;
    /** Limits the number of fixed steps processed per variable update. */
    setMaxFixedStepsPerUpdate(steps: number): void;
    /** Enable or disable script execution. When disabled, update() and lateUpdate() do nothing. */
    setEnabled(enabled: boolean): void;
    /** Check if script execution is enabled. */
    isEnabled(): boolean;
    update(deltaTime: number): void;
    lateUpdate(deltaTime: number): void;
    /** Resets cached services and coroutine state. */
    reset(): void;
}
//# sourceMappingURL=ScriptSystem.d.ts.map
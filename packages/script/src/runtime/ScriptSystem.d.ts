import type { Scene } from '@engine/world';
/**
 * Runs Behavior instances on entities with ScriptComponent.
 * Also supports hot-reload by monitoring registry changes via a simple version.
 */
export declare class ScriptSystem {
    private readonly scene;
    private lastRegistryVersion;
    private readonly runtime;
    private fixedAccumulator;
    private fixedDeltaTime;
    private maxFixedStepsPerUpdate;
    constructor(scene: Scene);
    /** Sets the fixed time step in seconds (<=0 disables fixed updates). */
    setFixedTimeStep(seconds: number): void;
    /** Limits the number of fixed steps processed per variable update. */
    setMaxFixedStepsPerUpdate(steps: number): void;
    update(deltaTime: number): void;
    lateUpdate(deltaTime: number): void;
    /** Resets cached services and coroutine state. */
    reset(): void;
}
//# sourceMappingURL=ScriptSystem.d.ts.map
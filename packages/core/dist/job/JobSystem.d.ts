/**
 * Job System - Task scheduling with priorities
 * TODO: Full implementation with Worker pool
 */
export declare enum TaskPriority {
    RenderCritical = 0,// Main thread, executed immediately
    Background = 1,// Worker thread, heavy computation
    Idle = 2
}
export interface Task {
    execute(): void | Promise<void>;
    priority: TaskPriority;
}
export interface JobHandle {
    id: number;
    cancel(): void;
    isComplete(): boolean;
    await(): Promise<void>;
}
/**
 * Job System for task scheduling.
 * Currently a simple skeleton - full implementation TODO.
 */
export declare class JobSystem {
    readonly workerCount: number;
    private nextId;
    private tasks;
    constructor(workerCount?: number);
    /**
     * Schedule a task for execution.
     */
    schedule(task: Task): JobHandle;
    /**
     * Update job system (call per frame).
     */
    update(): void;
    private executeTask;
}
//# sourceMappingURL=JobSystem.d.ts.map
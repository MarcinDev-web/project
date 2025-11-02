/**
 * Job System - Task scheduling with priorities and Worker pool
 *
 * Features:
 * - Priority-based task scheduling (RenderCritical, Background, Idle)
 * - Web Worker pool for background tasks
 * - Task queue management
 * - Async execution with promises
 * - Task cancellation support
 * - Idle callback for low-priority tasks
 */
export declare enum TaskPriority {
    RenderCritical = 0,// Main thread, executed immediately
    Background = 1,// Worker thread, heavy computation
    Idle = 2
}
export interface Task {
    execute(): void | Promise<void>;
    priority: TaskPriority;
    /** Optional: Worker script URL for Background tasks */
    workerScript?: string;
    /** Optional: Data to pass to worker */
    workerData?: unknown;
}
export interface JobHandle {
    id: number;
    cancel(): void;
    isComplete(): boolean;
    await(): Promise<void>;
}
/**
 * Job System for task scheduling with Worker pool support.
 */
export declare class JobSystem {
    readonly workerCount: number;
    private nextId;
    private tasks;
    private renderCriticalQueue;
    private backgroundQueue;
    private idleQueue;
    private workerPool;
    private idleCallbackId;
    private isShutdown;
    constructor(workerCount?: number);
    /**
     * Initialize worker pool (only if Workers are supported)
     */
    private initializeWorkerPool;
    /**
     * Schedule a task for execution.
     */
    schedule(task: Task): JobHandle;
    /**
     * Create a queued task with promise handling
     */
    private createQueuedTask;
    /**
     * Execute RenderCritical task immediately (synchronously or async)
     */
    private executeRenderCriticalTask;
    /**
     * Enqueue background task for worker execution
     */
    private enqueueBackgroundTask;
    /**
     * Process background queue with available workers
     */
    private processBackgroundQueue;
    /**
     * Execute background task in worker or main thread fallback
     */
    private executeBackgroundTask;
    /**
     * Execute task in Web Worker
     */
    private executeInWorker;
    /**
     * Execute task asynchronously in main thread
     */
    private executeTaskAsync;
    /**
     * Enqueue idle task for execution during idle time
     */
    private enqueueIdleTask;
    /**
     * Schedule idle callback for low-priority tasks
     */
    private scheduleIdleCallback;
    /**
     * Process idle queue during idle time
     */
    private processIdleQueue;
    /**
     * Cancel a task
     */
    private cancelTask;
    /**
     * Update job system (call per frame).
     * Processes background queue and checks for completed tasks.
     */
    update(): void;
    /**
     * Shutdown job system and cleanup resources
     */
    shutdown(): void;
    /**
     * Get statistics about the job system
     */
    getStats(): {
        pendingTasks: number;
        activeWorkers: number;
        queuedBackground: number;
        queuedIdle: number;
    };
}
//# sourceMappingURL=JobSystem.d.ts.map
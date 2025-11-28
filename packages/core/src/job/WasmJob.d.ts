import type { Task } from './JobSystem';
import { TaskPriority } from './JobSystem';
export interface WasmTaskOptions {
    /** URL to the WASM glue JS file (e.g. '/assets/physics.js') */
    moduleUrl: string;
    /** Name of the function to call in the WASM module */
    functionName: string;
    /** Arguments to pass to the function */
    args?: unknown[];
    /** Optional init arguments for the module default export */
    initArgs?: unknown[];
    /** Priority of the task. Defaults to Background. */
    priority?: TaskPriority;
    /**
     * URL to the generic JobWorker script.
     * This should point to the built version of packages/core/src/job/worker/JobWorker.ts
     */
    jobWorkerUrl: string;
}
/**
 * Helper for creating WASM-based tasks that run in the generic JobWorker.
 */
export declare class WasmJob {
    /**
     * Creates a Task configuration for a WASM job.
     */
    static create(options: WasmTaskOptions): Task;
    /**
     * Executes the WASM task on the main thread (fallback).
     */
    private static executeMainThread;
}
//# sourceMappingURL=WasmJob.d.ts.map
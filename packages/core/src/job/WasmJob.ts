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
export class WasmJob {
  /**
   * Creates a Task configuration for a WASM job.
   */
  static create(options: WasmTaskOptions): Task {
    return {
      priority: options.priority ?? TaskPriority.Background,
      workerScript: options.jobWorkerUrl,
      workerData: {
        moduleUrl: options.moduleUrl,
        functionName: options.functionName,
        args: options.args || [],
        initArgs: options.initArgs,
      },
      execute: () => {
        // Fallback execution on main thread
        return WasmJob.executeMainThread(options);
      }
    };
  }

  /**
   * Executes the WASM task on the main thread (fallback).
   */
  private static async executeMainThread(options: WasmTaskOptions): Promise<void> {
    try {
      // Dynamic import on main thread
      // Note: This expects the moduleUrl to be loadable from the main thread context
      const module = await import(options.moduleUrl);
      
      // Initialize if it has a default export that is a function (wasm-bindgen pattern)
      if (module.default && typeof module.default === 'function') {
        await module.default(...(options.initArgs || []));
      }
      
      const fn = module[options.functionName];
      if (typeof fn !== 'function') {
        throw new Error(`Function '${options.functionName}' not found in module '${options.moduleUrl}'`);
      }
      
      await fn(...(options.args || []));
    } catch (error) {
      console.error('[WasmJob] Main thread execution failed:', error);
      throw error;
    }
  }
}


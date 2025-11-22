/**
 * Generic Job Worker
 * 
 * Handles dynamic loading of WASM modules (via JS glue) and execution of functions.
 * Intended to be used as a module worker.
 */

interface JobData {
  moduleUrl: string;
  functionName: string;
  args: unknown[];
  initArgs?: unknown[]; // Optional arguments for the default init function
}

// Cache for loaded modules
const moduleCache = new Map<string, any>();

self.onmessage = async (e: MessageEvent) => {
  const { taskId, data } = e.data;

  try {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid job data');
    }

    const { moduleUrl, functionName, args, initArgs } = data as JobData;

    if (!moduleUrl || !functionName) {
      throw new Error('Missing moduleUrl or functionName');
    }

    // Load module if not cached
    let module = moduleCache.get(moduleUrl);
    if (!module) {
      // Dynamic import of the WASM glue JS
      module = await import(moduleUrl);

      // Initialize if it has a default export that is a function (wasm-bindgen pattern)
      // This typically initializes the WASM memory
      if (module.default && typeof module.default === 'function') {
        await module.default(...(initArgs || []));
      }

      moduleCache.set(moduleUrl, module);
    }

    // Find function
    const fn = module[functionName];
    if (typeof fn !== 'function') {
      throw new Error(`Function '${functionName}' not found in module '${moduleUrl}'`);
    }

    // Execute function
    const result = await fn(...(args || []));

    // Send result back
    self.postMessage({
      taskId,
      result,
    });

  } catch (error) {
    console.error('[JobWorker] Error:', error);
    self.postMessage({
      taskId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};


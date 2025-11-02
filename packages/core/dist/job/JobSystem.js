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
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["RenderCritical"] = 0] = "RenderCritical";
    TaskPriority[TaskPriority["Background"] = 1] = "Background";
    TaskPriority[TaskPriority["Idle"] = 2] = "Idle";
})(TaskPriority || (TaskPriority = {}));
/**
 * Job System for task scheduling with Worker pool support.
 */
export class JobSystem {
    workerCount;
    nextId = 0;
    tasks = new Map();
    renderCriticalQueue = [];
    backgroundQueue = [];
    idleQueue = [];
    workerPool = [];
    idleCallbackId = null;
    isShutdown = false;
    constructor(workerCount = 4) {
        this.workerCount = workerCount;
        this.initializeWorkerPool();
    }
    /**
     * Initialize worker pool (only if Workers are supported)
     */
    initializeWorkerPool() {
        if (typeof Worker === 'undefined') {
            // Workers not supported (Node.js, SSR)
            return;
        }
        for (let i = 0; i < this.workerCount; i++) {
            this.workerPool.push({
                worker: null,
                busy: false,
                currentTaskId: null,
            });
        }
    }
    /**
     * Schedule a task for execution.
     */
    schedule(task) {
        if (this.isShutdown) {
            throw new Error('JobSystem is shutdown');
        }
        const id = this.nextId++;
        const queuedTask = this.createQueuedTask(id, task);
        this.tasks.set(id, queuedTask);
        // Auto-execute RenderCritical tasks immediately
        if (task.priority === TaskPriority.RenderCritical) {
            this.executeRenderCriticalTask(queuedTask);
        }
        else if (task.priority === TaskPriority.Background) {
            this.enqueueBackgroundTask(queuedTask);
        }
        else {
            // Idle priority
            this.enqueueIdleTask(queuedTask);
        }
        return {
            id,
            cancel: () => {
                this.cancelTask(id);
            },
            isComplete: () => {
                const queued = this.tasks.get(id);
                return queued === undefined || queued.cancelled;
            },
            await: () => queuedTask.promise,
        };
    }
    /**
     * Create a queued task with promise handling
     */
    createQueuedTask(id, task) {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return {
            id,
            task,
            promise,
            resolve: resolve,
            reject: reject,
            cancelled: false,
        };
    }
    /**
     * Execute RenderCritical task immediately (synchronously or async)
     */
    async executeRenderCriticalTask(queuedTask) {
        if (queuedTask.cancelled) {
            queuedTask.resolve();
            this.tasks.delete(queuedTask.id);
            return;
        }
        try {
            const result = queuedTask.task.execute();
            if (result instanceof Promise) {
                await result;
            }
            queuedTask.resolve();
        }
        catch (error) {
            console.error(`[JobSystem] RenderCritical task ${queuedTask.id} failed:`, error);
            queuedTask.reject(error);
        }
        finally {
            this.tasks.delete(queuedTask.id);
        }
    }
    /**
     * Enqueue background task for worker execution
     */
    enqueueBackgroundTask(queuedTask) {
        this.backgroundQueue.push(queuedTask);
        this.processBackgroundQueue();
    }
    /**
     * Process background queue with available workers
     */
    processBackgroundQueue() {
        // Find available worker
        const availableWorker = this.workerPool.find((pool) => !pool.busy);
        if (!availableWorker || this.backgroundQueue.length === 0) {
            return;
        }
        const queuedTask = this.backgroundQueue.shift();
        if (!queuedTask || queuedTask.cancelled) {
            // Skip cancelled tasks
            if (queuedTask) {
                queuedTask.resolve();
                this.tasks.delete(queuedTask.id);
            }
            this.processBackgroundQueue();
            return;
        }
        this.executeBackgroundTask(queuedTask, availableWorker);
    }
    /**
     * Execute background task in worker or main thread fallback
     */
    async executeBackgroundTask(queuedTask, workerPool) {
        workerPool.busy = true;
        workerPool.currentTaskId = queuedTask.id;
        try {
            if (queuedTask.task.workerScript && typeof Worker !== 'undefined') {
                // Use Web Worker
                await this.executeInWorker(queuedTask, workerPool);
            }
            else {
                // Fallback to main thread (async)
                await this.executeTaskAsync(queuedTask);
            }
        }
        finally {
            workerPool.busy = false;
            workerPool.currentTaskId = null;
            // Process next task in queue
            this.processBackgroundQueue();
        }
    }
    /**
     * Execute task in Web Worker
     */
    async executeInWorker(queuedTask, workerPool) {
        return new Promise((resolve, reject) => {
            if (queuedTask.cancelled) {
                resolve();
                return;
            }
            // Create or reuse worker
            if (!workerPool.worker) {
                try {
                    workerPool.worker = new Worker(queuedTask.task.workerScript, { type: 'module' });
                }
                catch (error) {
                    console.warn('[JobSystem] Failed to create worker, falling back to main thread:', error);
                    this.executeTaskAsync(queuedTask).then(resolve).catch(reject);
                    return;
                }
            }
            const worker = workerPool.worker;
            const taskId = queuedTask.id;
            // Setup message handler
            const messageHandler = (e) => {
                if (e.data.taskId !== taskId) {
                    return; // Message for different task
                }
                worker.removeEventListener('message', messageHandler);
                worker.removeEventListener('error', errorHandler);
                if (queuedTask.cancelled) {
                    resolve();
                    return;
                }
                if (e.data.error) {
                    reject(new Error(e.data.error));
                }
                else {
                    resolve();
                }
            };
            const errorHandler = (error) => {
                worker.removeEventListener('message', messageHandler);
                worker.removeEventListener('error', errorHandler);
                reject(error);
            };
            worker.addEventListener('message', messageHandler);
            worker.addEventListener('error', errorHandler);
            // Send task to worker
            worker.postMessage({
                taskId,
                data: queuedTask.task.workerData,
            });
        });
    }
    /**
     * Execute task asynchronously in main thread
     */
    async executeTaskAsync(queuedTask) {
        if (queuedTask.cancelled) {
            queuedTask.resolve();
            this.tasks.delete(queuedTask.id);
            return;
        }
        try {
            const result = queuedTask.task.execute();
            if (result instanceof Promise) {
                await result;
            }
            queuedTask.resolve();
        }
        catch (error) {
            queuedTask.reject(error);
            console.error(`[JobSystem] Task ${queuedTask.id} failed:`, error);
        }
        finally {
            this.tasks.delete(queuedTask.id);
        }
    }
    /**
     * Enqueue idle task for execution during idle time
     */
    enqueueIdleTask(queuedTask) {
        this.idleQueue.push(queuedTask);
        this.scheduleIdleCallback();
    }
    /**
     * Schedule idle callback for low-priority tasks
     */
    scheduleIdleCallback() {
        if (this.idleCallbackId !== null || this.idleQueue.length === 0) {
            return;
        }
        if (typeof requestIdleCallback !== 'undefined') {
            this.idleCallbackId = requestIdleCallback((deadline) => {
                this.idleCallbackId = null;
                this.processIdleQueue(deadline);
            });
        }
        else {
            // Fallback: use setTimeout
            this.idleCallbackId = setTimeout(() => {
                this.idleCallbackId = null;
                this.processIdleQueue({ timeRemaining: () => 5 });
            }, 0);
        }
    }
    /**
     * Process idle queue during idle time
     */
    processIdleQueue(deadline) {
        while (deadline.timeRemaining() > 0 && this.idleQueue.length > 0) {
            const queuedTask = this.idleQueue.shift();
            if (!queuedTask) {
                break;
            }
            if (queuedTask.cancelled) {
                queuedTask.resolve();
                this.tasks.delete(queuedTask.id);
                continue;
            }
            // Execute synchronously if quick, otherwise async
            const result = queuedTask.task.execute();
            if (result instanceof Promise) {
                result
                    .then(() => {
                    queuedTask.resolve();
                    this.tasks.delete(queuedTask.id);
                })
                    .catch((error) => {
                    queuedTask.reject(error);
                    console.error(`[JobSystem] Idle task ${queuedTask.id} failed:`, error);
                    this.tasks.delete(queuedTask.id);
                });
            }
            else {
                queuedTask.resolve();
                this.tasks.delete(queuedTask.id);
            }
        }
        // Schedule next batch if queue not empty
        if (this.idleQueue.length > 0) {
            this.scheduleIdleCallback();
        }
    }
    /**
     * Cancel a task
     */
    cancelTask(id) {
        const queuedTask = this.tasks.get(id);
        if (!queuedTask) {
            return;
        }
        queuedTask.cancelled = true;
        // Remove from queues
        const renderIndex = this.renderCriticalQueue.findIndex((t) => t.id === id);
        if (renderIndex !== -1) {
            this.renderCriticalQueue.splice(renderIndex, 1);
        }
        const backgroundIndex = this.backgroundQueue.findIndex((t) => t.id === id);
        if (backgroundIndex !== -1) {
            this.backgroundQueue.splice(backgroundIndex, 1);
        }
        const idleIndex = this.idleQueue.findIndex((t) => t.id === id);
        if (idleIndex !== -1) {
            this.idleQueue.splice(idleIndex, 1);
        }
        // Cancel worker task if in progress
        const workerPool = this.workerPool.find((pool) => pool.currentTaskId === id);
        if (workerPool && workerPool.worker) {
            try {
                workerPool.worker.terminate();
                workerPool.worker = null;
                workerPool.busy = false;
                workerPool.currentTaskId = null;
            }
            catch (error) {
                console.warn('[JobSystem] Error terminating worker:', error);
            }
        }
        // Resolve promise (task was cancelled)
        queuedTask.resolve();
        this.tasks.delete(id);
    }
    /**
     * Update job system (call per frame).
     * Processes background queue and checks for completed tasks.
     */
    update() {
        // Process background queue if workers available
        this.processBackgroundQueue();
        // Cleanup cancelled tasks
        for (const [id, queuedTask] of this.tasks.entries()) {
            if (queuedTask.cancelled) {
                this.tasks.delete(id);
            }
        }
    }
    /**
     * Shutdown job system and cleanup resources
     */
    shutdown() {
        this.isShutdown = true;
        // Cancel all pending tasks
        for (const id of this.tasks.keys()) {
            this.cancelTask(id);
        }
        // Terminate all workers
        for (const pool of this.workerPool) {
            if (pool.worker) {
                try {
                    pool.worker.terminate();
                }
                catch (error) {
                    console.warn('[JobSystem] Error terminating worker during shutdown:', error);
                }
                pool.worker = null;
            }
            pool.busy = false;
            pool.currentTaskId = null;
        }
        // Cancel idle callback
        if (this.idleCallbackId !== null) {
            if (typeof cancelIdleCallback !== 'undefined') {
                cancelIdleCallback(this.idleCallbackId);
            }
            else {
                clearTimeout(this.idleCallbackId);
            }
            this.idleCallbackId = null;
        }
        // Clear queues
        this.renderCriticalQueue.length = 0;
        this.backgroundQueue.length = 0;
        this.idleQueue.length = 0;
        this.tasks.clear();
    }
    /**
     * Get statistics about the job system
     */
    getStats() {
        return {
            pendingTasks: this.tasks.size,
            activeWorkers: this.workerPool.filter((p) => p.busy).length,
            queuedBackground: this.backgroundQueue.length,
            queuedIdle: this.idleQueue.length,
        };
    }
}
//# sourceMappingURL=JobSystem.js.map
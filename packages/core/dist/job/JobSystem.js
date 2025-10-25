/**
 * Job System - Task scheduling with priorities
 * TODO: Full implementation with Worker pool
 */
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority[TaskPriority["RenderCritical"] = 0] = "RenderCritical";
    TaskPriority[TaskPriority["Background"] = 1] = "Background";
    TaskPriority[TaskPriority["Idle"] = 2] = "Idle";
})(TaskPriority || (TaskPriority = {}));
/**
 * Job System for task scheduling.
 * Currently a simple skeleton - full implementation TODO.
 */
export class JobSystem {
    workerCount;
    nextId = 0;
    tasks = new Map();
    constructor(workerCount = 4) {
        this.workerCount = workerCount;
        // TODO: Initialize worker pool
    }
    /**
     * Schedule a task for execution.
     */
    schedule(task) {
        const id = this.nextId++;
        this.tasks.set(id, task);
        const handle = {
            id,
            cancel: () => {
                this.tasks.delete(id);
            },
            isComplete: () => {
                return !this.tasks.has(id);
            },
            await: async () => {
                // TODO: Implement proper async waiting
                await this.executeTask(task);
                this.tasks.delete(id);
            },
        };
        // Auto-execute RenderCritical tasks immediately
        if (task.priority === TaskPriority.RenderCritical) {
            this.executeTask(task).then(() => this.tasks.delete(id));
        }
        return handle;
    }
    /**
     * Update job system (call per frame).
     */
    update() {
        // TODO: Process queued tasks
    }
    async executeTask(task) {
        try {
            await task.execute();
        }
        catch (error) {
            console.error('Task execution failed:', error);
        }
    }
}
//# sourceMappingURL=JobSystem.js.map
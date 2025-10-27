/**
 * Performance Monitor
 *
 * Tracks and reports CPU/GPU performance metrics in real-time.
 * Provides comprehensive profiling data for optimization efforts.
 */
/**
 * PerformanceMonitor tracks and aggregates performance metrics.
 */
export class PerformanceMonitor {
    cpuMetrics = this.createEmptyCPUMetrics();
    gpuMetrics = this.createEmptyGPUMetrics();
    sceneStats = this.createEmptySceneStats();
    memoryStats = this.createEmptyMemoryStats();
    fpsHistory = [];
    frameTimeHistory = [];
    maxHistorySize = 120; // 2 seconds at 60fps
    lastFrameTime = 0;
    frameCount = 0;
    fpsUpdateInterval = 500; // Update FPS every 500ms
    lastFpsUpdate = 0;
    currentFPS = 0;
    thresholds = {
        targetFPS: 60,
        warningFPS: 30,
        criticalFPS: 15,
        maxFrameTime: 16.67,
    };
    listeners = [];
    enabled = true;
    constructor(thresholds) {
        if (thresholds) {
            this.thresholds = { ...this.thresholds, ...thresholds };
        }
    }
    /**
     * Marks the start of a frame for CPU timing.
     */
    beginFrame() {
        if (!this.enabled)
            return;
        this.lastFrameTime = this.now();
    }
    /**
     * Marks the end of a frame and updates FPS.
     */
    endFrame() {
        if (!this.enabled)
            return;
        const now = this.now();
        const frameTime = now - this.lastFrameTime;
        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > this.maxHistorySize) {
            this.frameTimeHistory.shift();
        }
        this.frameCount++;
        // Update FPS at regular intervals
        if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
            const deltaTime = (now - this.lastFpsUpdate) / 1000;
            this.currentFPS = this.frameCount / deltaTime;
            this.fpsHistory.push(this.currentFPS);
            if (this.fpsHistory.length > this.maxHistorySize) {
                this.fpsHistory.shift();
            }
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            // Notify listeners
            this.notifyListeners();
        }
    }
    /**
     * Records CPU timing for a specific operation.
     */
    recordCPUTime(operation, timeMs) {
        if (!this.enabled)
            return;
        this.cpuMetrics[operation] = timeMs;
    }
    /**
     * Records GPU timing from timestamp queries.
     */
    recordGPUTime(pass, timeMs) {
        if (!this.enabled)
            return;
        this.gpuMetrics[pass] = timeMs;
        // Update total GPU time
        if (pass !== 'totalGPUTime') {
            this.gpuMetrics.totalGPUTime =
                this.gpuMetrics.shadowPassTime +
                    this.gpuMetrics.computePassTime +
                    this.gpuMetrics.mainPassTime +
                    this.gpuMetrics.postProcessTime;
        }
    }
    /**
     * Updates scene statistics.
     */
    updateSceneStats(stats) {
        if (!this.enabled)
            return;
        this.sceneStats = { ...this.sceneStats, ...stats };
    }
    /**
     * Updates memory statistics.
     */
    updateMemoryStats(stats) {
        if (!this.enabled)
            return;
        this.memoryStats = { ...this.memoryStats, ...stats };
        // Track peak memory
        if (this.memoryStats.totalMemory > this.memoryStats.peakMemory) {
            this.memoryStats.peakMemory = this.memoryStats.totalMemory;
        }
    }
    /**
     * Gets the current FPS.
     */
    getFPS() {
        return this.currentFPS;
    }
    /**
     * Gets the average FPS over the history window.
     */
    getAverageFPS() {
        if (this.fpsHistory.length === 0)
            return 0;
        const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
        return sum / this.fpsHistory.length;
    }
    /**
     * Gets the average frame time over the history window.
     */
    getAverageFrameTime() {
        if (this.frameTimeHistory.length === 0)
            return 0;
        const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
        return sum / this.frameTimeHistory.length;
    }
    /**
     * Gets the current performance snapshot.
     */
    getSnapshot() {
        return {
            timestamp: this.now(),
            fps: this.currentFPS,
            cpuMetrics: { ...this.cpuMetrics },
            gpuMetrics: { ...this.gpuMetrics },
            sceneStats: { ...this.sceneStats },
            memoryStats: { ...this.memoryStats },
        };
    }
    /**
     * Gets FPS history for visualization.
     */
    getFPSHistory() {
        return this.fpsHistory;
    }
    /**
     * Gets frame time history for visualization.
     */
    getFrameTimeHistory() {
        return this.frameTimeHistory;
    }
    /**
     * Checks if current performance is below thresholds.
     */
    getPerformanceStatus() {
        const fps = this.currentFPS;
        if (fps >= this.thresholds.warningFPS)
            return 'good';
        if (fps >= this.thresholds.criticalFPS)
            return 'warning';
        return 'critical';
    }
    /**
     * Registers a listener for performance updates.
     */
    addListener(callback) {
        this.listeners.push(callback);
    }
    /**
     * Removes a listener.
     */
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * Exports performance data as JSON for offline analysis.
     */
    exportJSON() {
        return JSON.stringify({
            timestamp: Date.now(),
            thresholds: this.thresholds,
            currentSnapshot: this.getSnapshot(),
            fpsHistory: this.fpsHistory,
            frameTimeHistory: this.frameTimeHistory,
            averageFPS: this.getAverageFPS(),
            averageFrameTime: this.getAverageFrameTime(),
            status: this.getPerformanceStatus(),
        }, null, 2);
    }
    /**
     * Resets all metrics and history.
     */
    reset() {
        this.cpuMetrics = this.createEmptyCPUMetrics();
        this.gpuMetrics = this.createEmptyGPUMetrics();
        this.sceneStats = this.createEmptySceneStats();
        this.memoryStats = this.createEmptyMemoryStats();
        this.fpsHistory = [];
        this.frameTimeHistory = [];
        this.frameCount = 0;
        this.currentFPS = 0;
        this.lastFpsUpdate = this.now();
    }
    /**
     * Enables or disables monitoring (for performance when not profiling).
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /**
     * Checks if monitoring is enabled.
     */
    isEnabled() {
        return this.enabled;
    }
    notifyListeners() {
        const snapshot = this.getSnapshot();
        for (const listener of this.listeners) {
            try {
                listener(snapshot);
            }
            catch (err) {
                console.warn('Performance listener failed:', err);
            }
        }
    }
    now() {
        return typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
    }
    createEmptyCPUMetrics() {
        return {
            frameTime: 0,
            ecsUpdateTime: 0,
            cullingTime: 0,
            instanceUpdateTime: 0,
            otherTime: 0,
        };
    }
    createEmptyGPUMetrics() {
        return {
            shadowPassTime: 0,
            computePassTime: 0,
            mainPassTime: 0,
            postProcessTime: 0,
            totalGPUTime: 0,
        };
    }
    createEmptySceneStats() {
        return {
            entityCount: 0,
            visibleCount: 0,
            culledCount: 0,
            drawCalls: 0,
            triangleCount: 0,
            instanceCount: 0,
        };
    }
    createEmptyMemoryStats() {
        return {
            bufferMemory: 0,
            textureMemory: 0,
            totalMemory: 0,
            peakMemory: 0,
        };
    }
}
//# sourceMappingURL=PerformanceMonitor.js.map
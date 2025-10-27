/**
 * Performance Monitor
 *
 * Tracks and reports CPU/GPU performance metrics in real-time.
 * Provides comprehensive profiling data for optimization efforts.
 */
export interface CPUMetrics {
    frameTime: number;
    ecsUpdateTime: number;
    cullingTime: number;
    instanceUpdateTime: number;
    otherTime: number;
}
export interface GPUMetrics {
    shadowPassTime: number;
    computePassTime: number;
    mainPassTime: number;
    postProcessTime: number;
    totalGPUTime: number;
}
export interface SceneStats {
    entityCount: number;
    visibleCount: number;
    culledCount: number;
    drawCalls: number;
    triangleCount: number;
    instanceCount: number;
}
export interface MemoryStats {
    bufferMemory: number;
    textureMemory: number;
    totalMemory: number;
    peakMemory: number;
}
export interface PerformanceSnapshot {
    timestamp: number;
    fps: number;
    cpuMetrics: CPUMetrics;
    gpuMetrics: GPUMetrics;
    sceneStats: SceneStats;
    memoryStats: MemoryStats;
}
export interface PerformanceThresholds {
    targetFPS: number;
    warningFPS: number;
    criticalFPS: number;
    maxFrameTime: number;
}
/**
 * PerformanceMonitor tracks and aggregates performance metrics.
 */
export declare class PerformanceMonitor {
    private cpuMetrics;
    private gpuMetrics;
    private sceneStats;
    private memoryStats;
    private fpsHistory;
    private frameTimeHistory;
    private maxHistorySize;
    private lastFrameTime;
    private frameCount;
    private fpsUpdateInterval;
    private lastFpsUpdate;
    private currentFPS;
    private thresholds;
    private listeners;
    private enabled;
    constructor(thresholds?: Partial<PerformanceThresholds>);
    /**
     * Marks the start of a frame for CPU timing.
     */
    beginFrame(): void;
    /**
     * Marks the end of a frame and updates FPS.
     */
    endFrame(): void;
    /**
     * Records CPU timing for a specific operation.
     */
    recordCPUTime(operation: keyof CPUMetrics, timeMs: number): void;
    /**
     * Records GPU timing from timestamp queries.
     */
    recordGPUTime(pass: keyof GPUMetrics, timeMs: number): void;
    /**
     * Updates scene statistics.
     */
    updateSceneStats(stats: Partial<SceneStats>): void;
    /**
     * Updates memory statistics.
     */
    updateMemoryStats(stats: Partial<MemoryStats>): void;
    /**
     * Gets the current FPS.
     */
    getFPS(): number;
    /**
     * Gets the average FPS over the history window.
     */
    getAverageFPS(): number;
    /**
     * Gets the average frame time over the history window.
     */
    getAverageFrameTime(): number;
    /**
     * Gets the current performance snapshot.
     */
    getSnapshot(): PerformanceSnapshot;
    /**
     * Gets FPS history for visualization.
     */
    getFPSHistory(): ReadonlyArray<number>;
    /**
     * Gets frame time history for visualization.
     */
    getFrameTimeHistory(): ReadonlyArray<number>;
    /**
     * Checks if current performance is below thresholds.
     */
    getPerformanceStatus(): 'good' | 'warning' | 'critical';
    /**
     * Registers a listener for performance updates.
     */
    addListener(callback: (snapshot: PerformanceSnapshot) => void): void;
    /**
     * Removes a listener.
     */
    removeListener(callback: (snapshot: PerformanceSnapshot) => void): void;
    /**
     * Exports performance data as JSON for offline analysis.
     */
    exportJSON(): string;
    /**
     * Resets all metrics and history.
     */
    reset(): void;
    /**
     * Enables or disables monitoring (for performance when not profiling).
     */
    setEnabled(enabled: boolean): void;
    /**
     * Checks if monitoring is enabled.
     */
    isEnabled(): boolean;
    private notifyListeners;
    private now;
    private createEmptyCPUMetrics;
    private createEmptyGPUMetrics;
    private createEmptySceneStats;
    private createEmptyMemoryStats;
}
//# sourceMappingURL=PerformanceMonitor.d.ts.map
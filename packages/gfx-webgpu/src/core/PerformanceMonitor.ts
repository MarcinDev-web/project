/**
 * Performance Monitor
 *
 * Tracks and reports CPU/GPU performance metrics in real-time.
 * Provides comprehensive profiling data for optimization efforts.
 */

export interface CPUMetrics {
  frameTime: number; // Total frame time (ms)
  ecsUpdateTime: number; // ECS system updates (ms)
  cullingTime: number; // Frustum/occlusion culling (ms)
  instanceUpdateTime: number; // Instance buffer updates (ms)
  otherTime: number; // Other CPU work (ms)
}

export interface GPUMetrics {
  shadowPassTime: number; // Shadow map generation (ms)
  computePassTime: number; // Compute pre-pass (ms)
  mainPassTime: number; // Main render pass (ms)
  postProcessTime: number; // Post-processing (ms)
  totalGPUTime: number; // Total GPU time (ms)
}

export interface SceneStats {
  entityCount: number; // Total entities in scene
  visibleCount: number; // Entities after culling
  culledCount: number; // Entities culled
  drawCalls: number; // Number of draw calls
  triangleCount: number; // Total triangles rendered
  instanceCount: number; // Total instances
}

export interface MemoryStats {
  bufferMemory: number; // GPU buffer memory (bytes)
  textureMemory: number; // GPU texture memory (bytes)
  totalMemory: number; // Total GPU memory (bytes)
  peakMemory: number; // Peak memory usage (bytes)
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
  targetFPS: number; // Target FPS (default 60)
  warningFPS: number; // Warning threshold (default 30)
  criticalFPS: number; // Critical threshold (default 15)
  maxFrameTime: number; // Max acceptable frame time in ms (default 16.67 for 60fps)
}

/**
 * PerformanceMonitor tracks and aggregates performance metrics.
 */
export class PerformanceMonitor {
  private cpuMetrics: CPUMetrics = this.createEmptyCPUMetrics();
  private gpuMetrics: GPUMetrics = this.createEmptyGPUMetrics();
  private sceneStats: SceneStats = this.createEmptySceneStats();
  private memoryStats: MemoryStats = this.createEmptyMemoryStats();

  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private maxHistorySize = 120; // 2 seconds at 60fps
  private lastFrameTime: number = 0;
  private frameCount = 0;
  private fpsUpdateInterval = 500; // Update FPS every 500ms
  private lastFpsUpdate = 0;
  private currentFPS = 0;

  private thresholds: PerformanceThresholds = {
    targetFPS: 60,
    warningFPS: 30,
    criticalFPS: 15,
    maxFrameTime: 16.67,
  };

  private listeners: Array<(snapshot: PerformanceSnapshot) => void> = [];
  private enabled = true;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    if (thresholds) {
      this.thresholds = { ...this.thresholds, ...thresholds };
    }
  }

  /**
   * Marks the start of a frame for CPU timing.
   */
  beginFrame(): void {
    if (!this.enabled) return;
    this.lastFrameTime = this.now();
  }

  /**
   * Marks the end of a frame and updates FPS.
   */
  endFrame(): void {
    if (!this.enabled) return;

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
  recordCPUTime(operation: keyof CPUMetrics, timeMs: number): void {
    if (!this.enabled) return;
    this.cpuMetrics[operation] = timeMs;
  }

  /**
   * Records GPU timing from timestamp queries.
   */
  recordGPUTime(pass: keyof GPUMetrics, timeMs: number): void {
    if (!this.enabled) return;
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
  updateSceneStats(stats: Partial<SceneStats>): void {
    if (!this.enabled) return;
    this.sceneStats = { ...this.sceneStats, ...stats };
  }

  /**
   * Updates memory statistics.
   */
  updateMemoryStats(stats: Partial<MemoryStats>): void {
    if (!this.enabled) return;
    this.memoryStats = { ...this.memoryStats, ...stats };

    // Track peak memory
    if (this.memoryStats.totalMemory > this.memoryStats.peakMemory) {
      this.memoryStats.peakMemory = this.memoryStats.totalMemory;
    }
  }

  /**
   * Gets the current FPS.
   */
  getFPS(): number {
    return this.currentFPS;
  }

  /**
   * Gets the average FPS over the history window.
   */
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return sum / this.fpsHistory.length;
  }

  /**
   * Gets the average frame time over the history window.
   */
  getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.frameTimeHistory.length;
  }

  /**
   * Gets the current performance snapshot.
   */
  getSnapshot(): PerformanceSnapshot {
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
  getFPSHistory(): ReadonlyArray<number> {
    return this.fpsHistory;
  }

  /**
   * Gets frame time history for visualization.
   */
  getFrameTimeHistory(): ReadonlyArray<number> {
    return this.frameTimeHistory;
  }

  /**
   * Checks if current performance is below thresholds.
   */
  getPerformanceStatus(): 'good' | 'warning' | 'critical' {
    const fps = this.currentFPS;
    if (fps >= this.thresholds.warningFPS) return 'good';
    if (fps >= this.thresholds.criticalFPS) return 'warning';
    return 'critical';
  }

  /**
   * Registers a listener for performance updates.
   */
  addListener(callback: (snapshot: PerformanceSnapshot) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Removes a listener.
   */
  removeListener(callback: (snapshot: PerformanceSnapshot) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Exports performance data as JSON for offline analysis.
   */
  exportJSON(): string {
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
  reset(): void {
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
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Checks if monitoring is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.warn('Performance listener failed:', err);
      }
    }
  }

  private now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  private createEmptyCPUMetrics(): CPUMetrics {
    return {
      frameTime: 0,
      ecsUpdateTime: 0,
      cullingTime: 0,
      instanceUpdateTime: 0,
      otherTime: 0,
    };
  }

  private createEmptyGPUMetrics(): GPUMetrics {
    return {
      shadowPassTime: 0,
      computePassTime: 0,
      mainPassTime: 0,
      postProcessTime: 0,
      totalGPUTime: 0,
    };
  }

  private createEmptySceneStats(): SceneStats {
    return {
      entityCount: 0,
      visibleCount: 0,
      culledCount: 0,
      drawCalls: 0,
      triangleCount: 0,
      instanceCount: 0,
    };
  }

  private createEmptyMemoryStats(): MemoryStats {
    return {
      bufferMemory: 0,
      textureMemory: 0,
      totalMemory: 0,
      peakMemory: 0,
    };
  }
}


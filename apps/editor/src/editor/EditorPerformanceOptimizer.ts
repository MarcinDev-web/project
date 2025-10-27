/**
 * Editor Performance Optimizer
 *
 * Optimizes editor viewport rendering for smooth interaction:
 * - Lazy updates (skip render when idle)
 * - Frame throttling (adaptive quality)
 * - Gizmo LOD (simplify distant gizmos)
 * - Async scene updates (don't block UI)
 */

export interface EditorPerformanceConfig {
  idleThreshold: number; // ms without input before considered idle
  minFrameTime: number; // ms - minimum time between frames
  enableLazyUpdates: boolean;
  enableAdaptiveQuality: boolean;
  targetFPS: number;
}

const DEFAULT_CONFIG: EditorPerformanceConfig = {
  idleThreshold: 100, // 100ms idle = skip render
  minFrameTime: 16, // ~60 FPS
  enableLazyUpdates: true,
  enableAdaptiveQuality: true,
  targetFPS: 60,
};

export interface PerformanceState {
  isIdle: boolean;
  lastInputTime: number;
  lastRenderTime: number;
  frameCount: number;
  droppedFrames: number;
  currentFPS: number;
  qualityLevel: 'low' | 'medium' | 'high';
}

/**
 * EditorPerformanceOptimizer manages editor rendering performance.
 */
export class EditorPerformanceOptimizer {
  private config: EditorPerformanceConfig;
  private state: PerformanceState = {
    isIdle: false,
    lastInputTime: 0,
    lastRenderTime: 0,
    frameCount: 0,
    droppedFrames: 0,
    currentFPS: 60,
    qualityLevel: 'high',
  };

  private idleCheckInterval: number | null = null;
  private inputListeners: Array<() => void> = [];
  private fpsHistory: number[] = [];
  private fpsHistorySize = 60; // 1 second at 60fps

  constructor(config?: Partial<EditorPerformanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state.lastInputTime = this.now();
    this.startIdleCheck();
  }

  /**
   * Checks if a frame should be rendered based on idle state and throttling.
   */
  shouldRender(): boolean {
    if (!this.config.enableLazyUpdates) return true;

    const now = this.now();
    const timeSinceLastRender = now - this.state.lastRenderTime;

    // Check if we're idle
    if (this.state.isIdle && timeSinceLastRender < 1000) {
      // When idle, render at 1 FPS to show any passive animations
      return false;
    }

    // Throttle frame rate
    if (timeSinceLastRender < this.config.minFrameTime) {
      return false;
    }

    return true;
  }

  /**
   * Marks that a frame has been rendered.
   */
  frameRendered(): void {
    const now = this.now();
    const timeSinceLastRender = now - this.state.lastRenderTime;
    
    this.state.lastRenderTime = now;
    this.state.frameCount++;

    // Calculate FPS
    if (timeSinceLastRender > 0) {
      const fps = 1000 / timeSinceLastRender;
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > this.fpsHistorySize) {
        this.fpsHistory.shift();
      }

      // Average FPS over history
      const avgFPS = this.fpsHistory.reduce((sum, f) => sum + f, 0) / this.fpsHistory.length;
      this.state.currentFPS = avgFPS;

      // Adapt quality based on FPS
      if (this.config.enableAdaptiveQuality) {
        this.adaptQuality(avgFPS);
      }
    }
  }

  /**
   * Registers input activity (mouse, keyboard, etc).
   */
  registerInput(): void {
    this.state.lastInputTime = this.now();
    this.state.isIdle = false;
  }

  /**
   * Gets the current quality level for rendering.
   */
  getQualityLevel(): 'low' | 'medium' | 'high' {
    return this.state.qualityLevel;
  }

  /**
   * Gets performance statistics.
   */
  getStats(): PerformanceState {
    return { ...this.state };
  }

  /**
   * Attaches input listeners to DOM elements.
   */
  attachInputListeners(element: HTMLElement): void {
    const handleInput = () => this.registerInput();

    const events = ['mousemove', 'mousedown', 'mouseup', 'wheel', 'keydown', 'keyup'];
    for (const event of events) {
      element.addEventListener(event, handleInput, { passive: true });
      this.inputListeners.push(() => element.removeEventListener(event, handleInput));
    }
  }

  /**
   * Detaches all input listeners.
   */
  detachInputListeners(): void {
    for (const cleanup of this.inputListeners) {
      cleanup();
    }
    this.inputListeners = [];
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<EditorPerformanceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Disposes the optimizer.
   */
  dispose(): void {
    if (this.idleCheckInterval !== null) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    this.detachInputListeners();
  }

  /**
   * Adapts rendering quality based on FPS.
   */
  private adaptQuality(fps: number): void {
    const targetFPS = this.config.targetFPS;

    if (fps < targetFPS * 0.5) {
      // Very low FPS - drop to low quality
      if (this.state.qualityLevel !== 'low') {
        this.state.qualityLevel = 'low';
        console.log('EditorPerformance: Switched to low quality (FPS:', fps.toFixed(1), ')');
      }
    } else if (fps < targetFPS * 0.75) {
      // Low FPS - drop to medium quality
      if (this.state.qualityLevel !== 'medium') {
        this.state.qualityLevel = 'medium';
        console.log('EditorPerformance: Switched to medium quality (FPS:', fps.toFixed(1), ')');
      }
    } else if (fps >= targetFPS * 0.9) {
      // Good FPS - use high quality
      if (this.state.qualityLevel !== 'high') {
        this.state.qualityLevel = 'high';
        console.log('EditorPerformance: Switched to high quality (FPS:', fps.toFixed(1), ')');
      }
    }
  }

  /**
   * Starts periodic idle check.
   */
  private startIdleCheck(): void {
    if (this.idleCheckInterval !== null) return;

    this.idleCheckInterval = setInterval(() => {
      const now = this.now();
      const timeSinceInput = now - this.state.lastInputTime;

      if (timeSinceInput >= this.config.idleThreshold) {
        if (!this.state.isIdle) {
          this.state.isIdle = true;
          console.log('EditorPerformance: Entering idle mode');
        }
      } else {
        if (this.state.isIdle) {
          this.state.isIdle = false;
          console.log('EditorPerformance: Exiting idle mode');
        }
      }
    }, this.config.idleThreshold / 2) as unknown as number;
  }

  /**
   * Gets current timestamp.
   */
  private now(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }
}

/**
 * Gizmo LOD (Level of Detail) Manager
 * Simplifies gizmo rendering based on distance and screen size.
 */
export class GizmoLODManager {
  private screenSizeThresholds = {
    high: 100, // px - above this, render full detail
    medium: 50, // px - above this, render medium detail
    low: 20, // px - above this, render low detail
    // below 20px - skip rendering
  };

  /**
   * Determines LOD level for a gizmo based on screen size.
   */
  getLODLevel(screenSize: number): 'high' | 'medium' | 'low' | 'skip' {
    if (screenSize >= this.screenSizeThresholds.high) return 'high';
    if (screenSize >= this.screenSizeThresholds.medium) return 'medium';
    if (screenSize >= this.screenSizeThresholds.low) return 'low';
    return 'skip';
  }

  /**
   * Calculates approximate screen size for a gizmo.
   * @param worldPosition Gizmo position in world space
   * @param cameraDistance Distance from camera
   * @param gizmoSize Base gizmo size in world units
   * @param viewportHeight Viewport height in pixels
   * @param fov Field of view in radians
   */
  calculateScreenSize(
    worldPosition: [number, number, number],
    cameraDistance: number,
    gizmoSize: number,
    viewportHeight: number,
    fov: number
  ): number {
    // Simple projection: screenSize = (objectSize * viewportHeight) / (2 * distance * tan(fov/2))
    const tanHalfFov = Math.tan(fov / 2);
    const screenSize = (gizmoSize * viewportHeight) / (2 * cameraDistance * tanHalfFov);
    return Math.max(0, screenSize);
  }

  /**
   * Updates LOD thresholds.
   */
  updateThresholds(thresholds: Partial<typeof this.screenSizeThresholds>): void {
    this.screenSizeThresholds = { ...this.screenSizeThresholds, ...thresholds };
  }
}

/**
 * Async Scene Update Manager
 * Manages async scene updates to avoid blocking the UI thread.
 */
export class AsyncSceneUpdateManager {
  private pendingUpdates: Array<() => void> = [];
  private isProcessing = false;
  private batchSize = 50; // Process 50 updates per batch
  private batchInterval = 16; // Process batches every 16ms (~60fps)

  /**
   * Schedules an async scene update.
   */
  scheduleUpdate(update: () => void): void {
    this.pendingUpdates.push(update);
    
    if (!this.isProcessing) {
      this.processUpdates();
    }
  }

  /**
   * Gets the number of pending updates.
   */
  getPendingCount(): number {
    return this.pendingUpdates.length;
  }

  /**
   * Clears all pending updates.
   */
  clear(): void {
    this.pendingUpdates = [];
  }

  /**
   * Processes updates in batches.
   */
  private async processUpdates(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.pendingUpdates.length > 0) {
      // Process a batch
      const batch = this.pendingUpdates.splice(0, this.batchSize);
      
      for (const update of batch) {
        try {
          update();
        } catch (err) {
          console.error('AsyncSceneUpdate: Update failed:', err);
        }
      }

      // Yield to browser
      await this.delay(this.batchInterval);
    }

    this.isProcessing = false;
  }

  /**
   * Delays execution.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}


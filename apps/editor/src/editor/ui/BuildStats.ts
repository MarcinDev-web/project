/**
 * BuildStats - Performance and scene statistics overlay
 * 
 * Inspired by:
 * - Minecraft F3 debug screen
 * - Roblox Studio stats
 * - Game engine debug overlays
 * 
 * Features:
 * - FPS counter
 * - Object count
 * - Memory usage (if available)
 * - Render stats
 * - Toggleable with F3
 */

import type { Scene } from '@engine/world';
import type { Renderer } from '@engine/gfx-webgpu/core/Renderer';
import type { RendererCapabilities } from '@engine/gfx-webgpu/config';

export interface BuildStatsConfig {
  scene: Scene;
  renderer: Renderer;
}

export class BuildStats {
  private scene: Scene;
  private renderer: Renderer;
  private container: HTMLElement | null = null;
  private isVisible = false;
  
  // Stats tracking
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 0;
  private frameTime = 0;
  private gpuTimings: { label: string; timeMs: number }[] = [];
  private cpuTimings: {
    cullingTime: number;
    instanceUpdateTime: number;
    totalCPUTime: number;
  } = { cullingTime: 0, instanceUpdateTime: 0, totalCPUTime: 0 };
  private shadowMetrics: readonly [number, number, number, number] | null = null;
  private renderStats: { drawCalls: number; triangles: number } | null = null;
  private capabilities: RendererCapabilities;
  
  private updateInterval: number | null = null;
  private rafHandle: number | null = null;

  constructor(config: BuildStatsConfig) {
    this.scene = config.scene;
    this.renderer = config.renderer;
    this.capabilities = this.renderer.getCapabilities();
    
    // Load saved visibility preference
    this.isVisible = localStorage.getItem('buildStatsVisible') === 'true';

    // Register render stats callback
    this.renderer.onRenderStats((stats) => {
      this.renderStats = stats;
    });
  }

  /**
   * Mounts the build stats overlay.
   */
  public mount(): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'build-stats';
    if (!this.isVisible) {
      this.container.classList.add('hidden');
    }

    document.body.appendChild(this.container);

    // Setup keyboard shortcut (F3)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Start tracking
    this.startTracking();

    // Update UI periodically (every 500ms for readable numbers)
    this.updateInterval = window.setInterval(() => {
      this.updateUI();
    }, 500);
  }

  /**
   * Starts FPS tracking.
   */
  private startTracking(): void {
    const trackFrame = () => {
      const now = performance.now();
      const delta = now - this.lastTime;
      
      this.frameCount++;
      this.frameTime = delta;

      // Update FPS every second
      if (delta >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / delta);
        this.frameCount = 0;
        this.lastTime = now;
      }

      this.rafHandle = requestAnimationFrame(trackFrame);
    };

    trackFrame();
  }

  /**
   * Updates the UI with current stats.
   */
  private updateUI(): void {
    if (!this.container || !this.isVisible) return;

    // Scene stats
    const entities = this.scene.getAllEntities();
    const entityCount = entities.length;
    
    // Get renderer stats (if available)
    const rendererStats = this.getRendererStats();

    // Get memory stats (if available)
    const memoryStats = this.getMemoryStats();

    const supportsGpuTiming = this.capabilities.features.timestampQuery;

    // Build HTML
    const html = `
      <div class="build-stats-header">
        <span class="build-stats-title">📊 Build Stats</span>
        <span class="build-stats-hint">Press F3 to toggle</span>
      </div>

      <div class="build-stats-section">
        <div class="build-stats-label">Performance</div>
        <div class="build-stats-item">
          <span class="build-stats-key">FPS</span>
          <span class="build-stats-value ${this.getFPSClass()}">${this.fps}</span>
        </div>
        <div class="build-stats-item">
          <span class="build-stats-key">Frame Time</span>
          <span class="build-stats-value">${this.frameTime.toFixed(1)}ms</span>
        </div>
        ${this.cpuTimings.totalCPUTime > 0 ? `
          <div class="build-stats-item">
            <span class="build-stats-key">CPU Total</span>
            <span class="build-stats-value">${this.cpuTimings.totalCPUTime.toFixed(2)}ms</span>
          </div>
          <div class="build-stats-item">
            <span class="build-stats-key">CPU Culling</span>
            <span class="build-stats-value">${this.cpuTimings.cullingTime.toFixed(2)}ms</span>
          </div>
          <div class="build-stats-item">
            <span class="build-stats-key">CPU Instance Update</span>
            <span class="build-stats-value">${this.cpuTimings.instanceUpdateTime.toFixed(2)}ms</span>
          </div>
        ` : ''}
      </div>

      <div class="build-stats-section">
        <div class="build-stats-label">Scene</div>
        <div class="build-stats-item">
          <span class="build-stats-key">Objects</span>
          <span class="build-stats-value">${entityCount}</span>
        </div>
        ${rendererStats.drawCalls !== null ? `
          <div class="build-stats-item">
            <span class="build-stats-key">Draw Calls</span>
            <span class="build-stats-value">${rendererStats.drawCalls}</span>
          </div>
        ` : ''}
        ${rendererStats.triangles !== null ? `
          <div class="build-stats-item">
            <span class="build-stats-key">Triangles</span>
            <span class="build-stats-value">${this.formatNumber(rendererStats.triangles)}</span>
          </div>
        ` : ''}
      </div>

      ${memoryStats.used !== null ? `
        <div class="build-stats-section">
          <div class="build-stats-label">Memory</div>
          <div class="build-stats-item">
            <span class="build-stats-key">Used</span>
            <span class="build-stats-value">${this.formatBytes(memoryStats.used)}</span>
          </div>
          ${memoryStats.total !== null ? `
            <div class="build-stats-item">
              <span class="build-stats-key">Total</span>
              <span class="build-stats-value">${this.formatBytes(memoryStats.total)}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${supportsGpuTiming && this.gpuTimings.length > 0
        ? `
        <div class="build-stats-section">
          <div class="build-stats-label">GPU time per pass</div>
          ${this.gpuTimings
            .map(
              (timing) => `
                <div class="build-stats-item">
                  <span class="build-stats-key">${timing.label}</span>
                  <span class="build-stats-value">${timing.timeMs.toFixed(3)}ms</span>
                </div>
              `
            )
            .join('')}
        </div>
      `
        : supportsGpuTiming
        ? `
        <div class="build-stats-section">
          <div class="build-stats-label">GPU time per pass</div>
          <div class="build-stats-item">
            <span class="build-stats-key">Collecting...</span>
            <span class="build-stats-value">--</span>
          </div>
        </div>
      `
        : ''}

      ${this.shadowMetrics ? `
        <div class="build-stats-section">
          <div class="build-stats-label">Shadow Cascades</div>
          <div class="build-stats-item">
            <span class="build-stats-key">Cascade 0</span>
            <span class="build-stats-value">${this.shadowMetrics[0]}</span>
          </div>
          <div class="build-stats-item">
            <span class="build-stats-key">Cascade 1</span>
            <span class="build-stats-value">${this.shadowMetrics[1]}</span>
          </div>
          <div class="build-stats-item">
            <span class="build-stats-key">Cascade 2</span>
            <span class="build-stats-value">${this.shadowMetrics[2]}</span>
          </div>
          <div class="build-stats-item">
            <span class="build-stats-key">Cascade 3</span>
            <span class="build-stats-value">${this.shadowMetrics[3]}</span>
          </div>
        </div>
      ` : ''}
    `;

    this.container.innerHTML = html;
  }

  public updateGpuTimings(timings: { label: string; timeMs: number }[]): void {
    this.gpuTimings = timings;
    this.updateUI();
  }

  /**
   * Updates CPU timing metrics.
   */
  public updateCpuTimings(timings: {
    cullingTime: number;
    instanceUpdateTime: number;
    totalCPUTime: number;
  }): void {
    this.cpuTimings = timings;
    this.updateUI();
  }

  /**
   * Updates shadow cascade metrics.
   */
  public updateShadowMetrics(metrics: readonly [number, number, number, number]): void {
    this.shadowMetrics = metrics;
    this.updateUI();
  }

  /**
   * Gets renderer statistics from the Renderer API callback.
   */
  private getRendererStats(): { drawCalls: number | null; triangles: number | null } {
    if (this.renderStats) {
      return {
        drawCalls: this.renderStats.drawCalls,
        triangles: this.renderStats.triangles,
      };
    }
    return {
      drawCalls: null,
      triangles: null,
    };
  }

  /**
   * Gets memory statistics (if available in browser).
   */
  private getMemoryStats(): { used: number | null; total: number | null } {
    // @ts-ignore - performance.memory is non-standard but available in Chrome
    if (performance.memory) {
      // @ts-ignore
      return {
        // @ts-ignore
        used: performance.memory.usedJSHeapSize,
        // @ts-ignore
        total: performance.memory.totalJSHeapSize,
      };
    }
    return { used: null, total: null };
  }

  /**
   * Gets CSS class for FPS value based on performance.
   */
  private getFPSClass(): string {
    if (this.fps >= 55) return 'fps-good';
    if (this.fps >= 30) return 'fps-ok';
    return 'fps-bad';
  }

  /**
   * Formats large numbers with K/M suffixes.
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Formats bytes to human-readable string.
   */
  private formatBytes(bytes: number): string {
    if (bytes >= 1073741824) {
      return (bytes / 1073741824).toFixed(2) + ' GB';
    }
    if (bytes >= 1048576) {
      return (bytes / 1048576).toFixed(2) + ' MB';
    }
    if (bytes >= 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    }
    return bytes + ' B';
  }

  /**
   * Toggles the stats overlay visibility.
   */
  public toggle(): void {
    this.isVisible = !this.isVisible;
    
    if (this.container) {
      if (this.isVisible) {
        this.container.classList.remove('hidden');
        this.updateUI();
      } else {
        this.container.classList.add('hidden');
      }
    }

    // Save preference
    localStorage.setItem('buildStatsVisible', this.isVisible.toString());
  }

  /**
   * Shows the stats overlay.
   */
  public show(): void {
    if (!this.isVisible) {
      this.toggle();
    }
  }

  /**
   * Hides the stats overlay.
   */
  public hide(): void {
    if (this.isVisible) {
      this.toggle();
    }
  }

  /**
   * Disposes of the stats overlay.
   */
  public dispose(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}


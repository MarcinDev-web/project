import type { Scene } from '@engine/world';
import type { Renderer } from '@engine/gfx-webgpu';
import { Logger } from '../utils/logger';
import type { Vec3 } from '@engine/core/math';

/**
 * LOD level for entities
 */
export enum LODLevel {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2,
  CULLED = 3,
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  entities: number;
  memoryUsage?: number;
  resolutionScale?: number;
}

/**
 * PerformanceSystem manages LOD, frustum culling, and performance monitoring
 */
export class PerformanceSystem {
  private scene: Scene | null = null;
  private renderer: Renderer | null = null;
  private cameraPosition: Vec3 | null = null;
  private cameraForward: Vec3 | null = null;
  
  // LOD settings
  private lodDistances = [50, 100, 200]; // High, Medium, Low distances
  private enableLOD = true;
  private enableFrustumCulling = true;
  
  // Performance monitoring
  private lastFPSUpdate = 0;
  private frameTimes: number[] = [];
  private maxFrameTimeSamples = 60;
  private currentDrawCalls = 0;
  private currentTriangles = 0;
  private currentMetrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 16.67,
    drawCalls: 0,
    triangles: 0,
    entities: 0,
    resolutionScale: 1.0,
  };

  // Dynamic Resolution Scaling
  private enableDynamicResolution = true;
  private currentResolutionScale = 1.0;
  private minResolutionScale = 0.5;
  private maxResolutionScale = 1.0;
  private lowFpsThreshold = 30;
  private highFpsThreshold = 55;
  private resolutionUpdateTimer = 0;
  private resolutionUpdateInterval = 2000; // Check every 2 seconds

  /**
   * Initialize performance system
   */
  initialize(scene: Scene, renderer: Renderer): void {
    this.scene = scene;
    this.renderer = renderer;
    
    // Subscribe to render stats updates
    renderer.onRenderStats((stats) => {
      this.currentDrawCalls = stats.drawCalls;
      this.currentTriangles = stats.triangles;
    });
    
    Logger.debug('[PerformanceSystem] Initialized');
  }

  /**
   * Update - call each frame
   */
  update(deltaTime: number, cameraPosition: Vec3, cameraForward: Vec3): void {
    this.cameraPosition = cameraPosition;
    this.cameraForward = cameraForward;
    
    // Update LOD
    if (this.enableLOD) {
      this.updateLOD();
    }
    
    // Update frustum culling
    if (this.enableFrustumCulling) {
      this.updateFrustumCulling();
    }
    
    // Update performance metrics & Dynamic Resolution
    this.updateMetrics(deltaTime);
  }

  /**
   * Update LOD levels for entities based on distance from camera
   */
  private updateLOD(): void {
    if (!this.scene || !this.cameraPosition) {
      return;
    }

    const entities = this.scene.getAllEntities();
    
    for (const entity of entities) {
      // Skip if entity doesn't support LOD
      if (!entity.userData.supportsLOD) {
        continue;
      }

      const entityPosition = entity.transform.getWorldPosition();
      const distance = this.calculateDistance(this.cameraPosition, entityPosition);
      
      let lodLevel: LODLevel;
      if (distance < this.lodDistances[0]!) {
        lodLevel = LODLevel.HIGH;
      } else if (distance < this.lodDistances[1]!) {
        lodLevel = LODLevel.MEDIUM;
      } else if (distance < this.lodDistances[2]!) {
        lodLevel = LODLevel.LOW;
      } else {
        lodLevel = LODLevel.CULLED;
      }
      
      // Store LOD level in entity userData
      entity.userData.lodLevel = lodLevel;
      
      // TODO: Apply LOD to renderer (simplify geometry, reduce quality, etc.)
    }
  }

  /**
   * Update frustum culling - hide entities outside camera view
   */
  private updateFrustumCulling(): void {
    if (!this.scene || !this.cameraPosition || !this.cameraForward) {
      return;
    }

    // TODO: Implement proper frustum culling using camera FOV and bounds
    // For now, this is a placeholder
    const entities = this.scene.getAllEntities();
    
    for (const entity of entities) {
      // Skip if entity doesn't support culling
      if (!entity.userData.supportsCulling) {
        continue;
      }

      const entityPosition = entity.transform.getWorldPosition();
      const distance = this.calculateDistance(this.cameraPosition, entityPosition);
      
      // Simple distance-based culling (can be enhanced with proper frustum)
      const cullDistance = 500; // Max render distance
      entity.userData.isCulled = distance > cullDistance;
    }
  }

  /**
   * Update performance metrics and handle dynamic resolution
   */
  private updateMetrics(deltaTime: number): void {
    const frameTime = deltaTime * 1000; // Convert to ms
    
    // Store frame time
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameTimeSamples) {
      this.frameTimes.shift();
    }
    
    // Calculate average frame time and FPS
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / avgFrameTime;
    
    // Update metrics
    this.currentMetrics = {
      fps: Math.round(fps),
      frameTime: Math.round(avgFrameTime * 100) / 100,
      drawCalls: this.currentDrawCalls,
      triangles: this.currentTriangles,
      entities: this.scene?.getAllEntities().length ?? 0,
      resolutionScale: this.currentResolutionScale,
    };
    
    // Dynamic Resolution Scaling
    if (this.enableDynamicResolution && this.renderer) {
      this.resolutionUpdateTimer += deltaTime * 1000;
      if (this.resolutionUpdateTimer > this.resolutionUpdateInterval) {
        this.updateResolutionScale(fps);
        this.resolutionUpdateTimer = 0;
      }
    }

    // Log FPS every second (optional, can remove to reduce noise)
    const now = Date.now();
    if (now - this.lastFPSUpdate > 1000) {
      // Logger.debug(`[PerformanceSystem] FPS: ${this.currentMetrics.fps}, Res: ${this.currentResolutionScale.toFixed(2)}`);
      this.lastFPSUpdate = now;
    }
  }

  private updateResolutionScale(fps: number): void {
    let newScale = this.currentResolutionScale;

    if (fps < this.lowFpsThreshold) {
      // Decrease resolution
      newScale = Math.max(this.minResolutionScale, this.currentResolutionScale - 0.1);
    } else if (fps > this.highFpsThreshold) {
      // Increase resolution
      newScale = Math.min(this.maxResolutionScale, this.currentResolutionScale + 0.1);
    }

    if (newScale !== this.currentResolutionScale) {
      this.currentResolutionScale = newScale;
      Logger.info(`[PerformanceSystem] Adjusting resolution scale to ${newScale.toFixed(2)} (FPS: ${Math.round(fps)})`);
      
      // Apply to renderer
      if (this.renderer) {
        this.renderer.updateRenderSettings({
          resolutionScale: newScale,
        });
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): Readonly<PerformanceMetrics> {
    return this.currentMetrics;
  }

  /**
   * Set LOD distances
   */
  setLODDistances(high: number, medium: number, low: number): void {
    this.lodDistances = [high, medium, low];
  }

  /**
   * Enable/disable LOD
   */
  setLODEnabled(enabled: boolean): void {
    this.enableLOD = enabled;
  }

  /**
   * Enable/disable frustum culling
   */
  setFrustumCullingEnabled(enabled: boolean): void {
    this.enableFrustumCulling = enabled;
  }

  /**
   * Enable/disable dynamic resolution
   */
  setDynamicResolutionEnabled(enabled: boolean): void {
    this.enableDynamicResolution = enabled;
    if (!enabled && this.renderer) {
      // Reset to full resolution when disabled
      this.currentResolutionScale = 1.0;
      this.renderer.updateRenderSettings({ resolutionScale: 1.0 });
    }
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(a: Vec3, b: Vec3): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.scene = null;
    this.renderer = null;
    this.cameraPosition = null;
    this.cameraForward = null;
    this.frameTimes = [];
  }
}

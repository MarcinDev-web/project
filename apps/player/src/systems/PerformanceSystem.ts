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
}

/**
 * PerformanceSystem manages LOD, frustum culling, and performance monitoring
 */
export class PerformanceSystem {
  private scene: Scene | null = null;
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
  };

  /**
   * Initialize performance system
   */
  initialize(scene: Scene, renderer: Renderer): void {
    this.scene = scene;
    
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
    
    // Update performance metrics
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
   * Update performance metrics
   */
  private updateMetrics(deltaTime: number): void {
    const frameTime = deltaTime * 1000; // Convert to ms
    
    // Store frame time
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameTimeSamples) {
      this.frameTimes.shift();
    }
    
    // Calculate average frame time
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / avgFrameTime;
    
    // Update metrics
    this.currentMetrics = {
      fps: Math.round(fps),
      frameTime: Math.round(avgFrameTime * 100) / 100,
      drawCalls: this.currentDrawCalls,
      triangles: this.currentTriangles,
      entities: this.scene?.getAllEntities().length ?? 0,
    };
    
    // Log FPS every second
    const now = Date.now();
    if (now - this.lastFPSUpdate > 1000) {
      Logger.debug(`[PerformanceSystem] FPS: ${this.currentMetrics.fps}, Frame time: ${this.currentMetrics.frameTime}ms`);
      this.lastFPSUpdate = now;
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
    this.cameraPosition = null;
    this.cameraForward = null;
    this.frameTimes = [];
  }
}


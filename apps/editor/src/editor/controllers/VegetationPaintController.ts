/**
 * VegetationPaintController - Controller for vegetation paint tool
 * 
 * Integrates VegetationPaintTool with editor UI and input handling
 */

import type { Scene } from '@engine/world';
import type { OrbitControls, CameraDirector } from '@engine/camera';
import type { EditorState } from '../core/state';
import type { AssetPreset } from '../types/BlockAssetTypes';
import { VegetationPaintTool } from '../tools/VegetationPaintTool';
import type { Vec3 } from '@engine/core/math';
import { Logger } from '../../utils/logger';

export interface VegetationPaintControllerConfig {
  canvas: HTMLCanvasElement;
  scene: Scene;
  controls: OrbitControls;
  cameraDirector?: CameraDirector;
  state: EditorState;
  onStatusMessage?: (message: string, duration?: number) => void;
}

/**
 * VegetationPaintController - Manages vegetation paint tool interactions
 */
export class VegetationPaintController {
  private paintTool: VegetationPaintTool;
  private config: VegetationPaintControllerConfig;
  private abortController: AbortController | null = null;
  private isActive = false;
  private activePreset: AssetPreset | null = null;

  constructor(config: VegetationPaintControllerConfig) {
    this.config = config;
    this.paintTool = new VegetationPaintTool(config.scene);
  }

  /**
   * Initializes the paint controller
   */
  initialize(): () => void {
    this.abortController = new AbortController();
    this.setupInputHandlers();

    return () => {
      this.dispose();
    };
  }

  /**
   * Activates paint mode with given vegetation preset
   */
  activate(preset: AssetPreset): void {
    if (!preset.vegetationConfig) {
      Logger.warn('[VegetationPaintController] Preset must have vegetationConfig');
      return;
    }

    this.activePreset = preset;
    this.paintTool.setActivePreset(preset);
    this.isActive = true;
    this.config.onStatusMessage?.('Vegetation paint mode active - Click and drag to paint', 3000);
  }

  /**
   * Deactivates paint mode
   */
  deactivate(): void {
    this.isActive = false;
    this.paintTool.stopPaint();
    this.activePreset = null;
    this.config.onStatusMessage?.('Vegetation paint mode deactivated', 2000);
  }

  /**
   * Checks if paint mode is active
   */
  isPaintModeActive(): boolean {
    return this.isActive;
  }

  /**
   * Gets the currently active preset, or null if not active
   */
  getActivePreset(): AssetPreset | null {
    return this.activePreset;
  }

  /**
   * Sets up input handlers for painting
   */
  private setupInputHandlers(): void {
    if (!this.abortController) return;

    let isMouseDown = false;

    // Mouse down - start painting
    this.config.canvas.addEventListener(
      'mousedown',
      (event: MouseEvent) => {
        if (!this.isActive || event.button !== 0) return; // Only left mouse button

        isMouseDown = true;
        const ray = this.createRayFromMouseEvent(event);
        if (ray) {
          const hit = this.raycastToSurface(ray.origin, ray.direction);
          if (hit) {
            this.paintTool.startPaint(hit, ray.origin, ray.direction);
          }
        }
      },
      { signal: this.abortController.signal }
    );

    // Mouse move - continue painting while dragging
    this.config.canvas.addEventListener(
      'mousemove',
      (event: MouseEvent) => {
        if (!this.isActive || !isMouseDown) return;

        const ray = this.createRayFromMouseEvent(event);
        if (ray) {
          const hit = this.raycastToSurface(ray.origin, ray.direction);
          if (hit) {
            this.paintTool.paintAt(hit, ray.origin, ray.direction);
          }
        }
      },
      { signal: this.abortController.signal }
    );

    // Mouse up - stop painting
    this.config.canvas.addEventListener(
      'mouseup',
      () => {
        if (isMouseDown) {
          isMouseDown = false;
          this.paintTool.stopPaint();
        }
      },
      { signal: this.abortController.signal }
    );

    // ESC key - deactivate paint mode
    window.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (this.isActive && event.key === 'Escape') {
          this.deactivate();
        }
      },
      { signal: this.abortController.signal }
    );
  }

  /**
   * Creates ray from mouse event
   */
  private createRayFromMouseEvent(event: MouseEvent): { origin: Vec3; direction: Vec3 } | null {
    const canvas = this.config.canvas;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Get camera view/projection from controls or camera director
    const controls = this.config.controls;
    
    // Try to use CameraDirector if available (has getPosition method)
    let cameraPosition: Vec3;
    let target: Vec3 = [0, 0, 0];
    
    if (this.config.cameraDirector) {
      cameraPosition = this.config.cameraDirector.getPosition();
      // CameraDirector doesn't have getTarget, assume orbiting around origin
    } else {
      // Convert orbit controls state (yaw/pitch/distance) to camera position
      const { yaw, pitch, distance } = controls.getState();
      const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
      const eyeY = Math.sin(pitch) * distance;
      const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
      cameraPosition = [eyeX, eyeY, eyeZ];
      // Orbit controls orbit around origin [0, 0, 0]
    }

    // Calculate view direction (from camera to target)
    const forward: Vec3 = [
      target[0] - cameraPosition[0],
      target[1] - cameraPosition[1],
      target[2] - cameraPosition[2],
    ];

    const forwardLength = Math.sqrt(
      forward[0] * forward[0] + forward[1] * forward[1] + forward[2] * forward[2]
    );
    if (forwardLength < 0.001) {
      return null;
    }

    // Normalize forward
    forward[0] /= forwardLength;
    forward[1] /= forwardLength;
    forward[2] /= forwardLength;

    // Calculate right and up vectors (simplified)
    const up: Vec3 = [0, 1, 0];
    const right: Vec3 = [
      forward[1] * up[2] - forward[2] * up[1],
      forward[2] * up[0] - forward[0] * up[2],
      forward[0] * up[1] - forward[1] * up[0],
    ];

    const rightLength = Math.sqrt(
      right[0] * right[0] + right[1] * right[1] + right[2] * right[2]
    );
    if (rightLength > 0.001) {
      right[0] /= rightLength;
      right[1] /= rightLength;
      right[2] /= rightLength;
    }

    // Calculate ray direction (simplified - would use proper projection matrix in production)
    const fov = Math.PI / 4; // 45 degrees
    const aspect = rect.width / rect.height;
    const tanFov = Math.tan(fov / 2);

    const rayDir: Vec3 = [
      forward[0] + right[0] * x * tanFov * aspect + up[0] * y * tanFov,
      forward[1] + right[1] * x * tanFov * aspect + up[1] * y * tanFov,
      forward[2] + right[2] * x * tanFov * aspect + up[2] * y * tanFov,
    ];

    const dirLength = Math.sqrt(
      rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]
    );
    if (dirLength > 0.001) {
      rayDir[0] /= dirLength;
      rayDir[1] /= dirLength;
      rayDir[2] /= dirLength;
    }

    return {
      origin: cameraPosition,
      direction: rayDir,
    };
  }

  /**
   * Raycasts to find surface
   */
  private raycastToSurface(origin: Vec3, direction: Vec3): Vec3 | null {
    // Simple implementation: project to Y=0 plane
    if (direction[1] < 0) {
      const t = -origin[1] / direction[1];
      if (t > 0) {
        return [
          origin[0] + direction[0] * t,
          0,
          origin[2] + direction[2] * t,
        ];
      }
    }
    return null;
  }

  /**
   * Updates paint tool configuration
   */
  updatePaintConfig(config: Partial<Parameters<VegetationPaintTool['updateConfig']>[0]>): void {
    this.paintTool.updateConfig(config);
  }

  /**
   * Gets paint tool statistics
   */
  getStatistics(): ReturnType<VegetationPaintTool['getStatistics']> {
    return this.paintTool.getStatistics();
  }

  /**
   * Disposes the controller
   */
  dispose(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.deactivate();
    this.paintTool.dispose();
  }
}


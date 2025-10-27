/**
 * EditorPlacementController - Manages placement mode and raycasting.
 * 
 * Responsibilities:
 * - Track mouse movement during placement
 * - Raycast from mouse to world space
 * - Compute adjacent placement positions
 * - Update placement preview position
 * - Handle double-click to confirm placement
 * - Handle ESC to cancel placement
 * 
 * Extracted from EditorUI to reduce complexity and improve maintainability.
 */

import type { OrbitControls, CameraDirector } from '@engine/camera';
import type { Scene, Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { PlacementMode } from '../placement/PlacementMode';
import { Raycaster } from '@engine/world';
import type { Vec3, Mat4 } from '@engine/core/math';
import { mat4Perspective, mat4LookAt } from '@engine/core/math';
import { FOV_RADIANS, Z_FAR, Z_NEAR } from '@engine/gfx-webgpu/config';
import { Logger } from '../../utils/logger';

export interface EditorPlacementControllerConfig {
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  /** Active camera director (preferred for view/projection) */
  cameraDirector?: CameraDirector;
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  placementMode: PlacementMode;
  updateSceneBuffers: () => void;
  recordSnapshot: (description: string) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
}

/**
 * Manages placement mode interactions and raycasting.
 */
export class EditorPlacementController {
  private raycaster: Raycaster;
  private abortController: AbortController | null = null;

  constructor(private readonly config: EditorPlacementControllerConfig) {
    this.raycaster = new Raycaster();
  }

  /**
   * Initializes placement controller and sets up event listeners.
   */
  initialize(): () => void {
    this.abortController = new AbortController();
    this.setupMouseTracking();
    this.setupConfirmationHandlers();

    // Return cleanup function
    return () => {
      this.dispose();
    };
  }

  /**
   * Sets up mouse movement tracking for placement preview.
   */
  private setupMouseTracking(): void {
    if (!this.abortController) return;

    this.config.canvas.addEventListener(
      'mousemove',
      (event: MouseEvent) => {
        if (!this.config.placementMode.isActive()) {
          return;
        }

        const ray = this.createRayFromMouseEvent(event);
        if (!ray) return;

        // Try adjacent placement first (snapping to existing entities)
        const adjacent = this.getAdjacentPlacementFromRay(ray);
        if (adjacent) {
          const exclude = this.getLastRaycastEntity(ray);
          if (exclude) {
            this.config.placementMode.updatePreviewPosition(adjacent, {
              ignoreEntities: [exclude],
            });
          } else {
            this.config.placementMode.updatePreviewPosition(adjacent);
          }
          return;
        }

        // Fall back to ground plane intersection
        const groundIntersection = this.raycastToGroundPlane(ray);
        if (groundIntersection) {
          this.config.placementMode.updatePreviewPosition(groundIntersection);
        }
      },
      { signal: this.abortController.signal }
    );
  }

  /**
   * Sets up double-click to confirm and ESC to cancel.
   */
  private setupConfirmationHandlers(): void {
    if (!this.abortController) return;

    // Double-click to confirm placement
    this.config.canvas.addEventListener(
      'dblclick',
      (event: MouseEvent) => {
        if (!this.config.placementMode.isActive()) {
          return;
        }

        // Update position one last time before confirming
        const ray = this.createRayFromMouseEvent(event);
        if (ray) {
          const adjacent = this.getAdjacentPlacementFromRay(ray);
          if (adjacent) {
            const exclude = this.getLastRaycastEntity(ray);
            if (exclude) {
              this.config.placementMode.updatePreviewPosition(adjacent, {
                ignoreEntities: [exclude],
              });
            } else {
              this.config.placementMode.updatePreviewPosition(adjacent);
            }
          } else {
            const groundIntersection = this.raycastToGroundPlane(ray);
            if (groundIntersection) {
              this.config.placementMode.updatePreviewPosition(groundIntersection);
            }
          }
        }

        // Confirm placement
        const placed = this.config.placementMode.confirmPlacement();
        if (placed) {
          this.config.selection.select(placed);
          this.config.updateSceneBuffers();
          this.config.state.placementMode.value = false;
          this.config.recordSnapshot('Place object');
          try {
            this.config.state?.adaptiveUI?.trackPlacement?.();
          } catch {}
          this.config.onStatusMessage?.('Object placed!', 1000);
          Logger.debug(`Placed entity: ${placed.name}`);
        } else {
          this.config.onStatusMessage?.('Cannot place here (collision)', 1000);
          Logger.debug('Placement failed: collision detected');
        }
      },
      { signal: this.abortController.signal }
    );
  }

  /**
   * Creates a world-space ray from a mouse event.
   */
  private createRayFromMouseEvent(event: MouseEvent): { origin: Vec3; direction: Vec3 } | null {
    const rect = this.config.canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) * (this.config.canvas.width / rect.width);
    const mouseY = (event.clientY - rect.top) * (this.config.canvas.height / rect.height);

    // Prefer CameraDirector matrices (supports free-fly/FPS/third-person)
    const director = this.config.cameraDirector;
    if (director) {
      const viewMatrix = director.getViewMatrix();
      const projectionMatrix = director.getProjectionMatrix();
      return this.raycaster.createRayFromScreen(
        mouseX,
        mouseY,
        this.config.canvas.width,
        this.config.canvas.height,
        viewMatrix,
        projectionMatrix
      );
    }

    // Fallback to legacy orbit-controls derived matrices
    const { yaw, pitch, distance } = this.config.controls.getState();
    const aspect = this.config.canvas.width / this.config.canvas.height;

    const projectionMatrix = new Float32Array(16) as Mat4;
    const viewMatrix = new Float32Array(16) as Mat4;

    mat4Perspective(projectionMatrix, FOV_RADIANS, aspect, Z_NEAR, Z_FAR);

    const eyeX = Math.cos(pitch) * Math.sin(yaw) * distance;
    const eyeY = Math.sin(pitch) * distance;
    const eyeZ = Math.cos(pitch) * Math.cos(yaw) * distance;
    mat4LookAt(viewMatrix, [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);

    return this.raycaster.createRayFromScreen(
      mouseX,
      mouseY,
      this.config.canvas.width,
      this.config.canvas.height,
      viewMatrix,
      projectionMatrix
    );
  }

  /**
   * Attempts to compute an adjacent placement position from a ray hit on an entity.
   */
  private getAdjacentPlacementFromRay(ray: { origin: Vec3; direction: Vec3 }): Vec3 | null {
    const preview = this.config.placementMode.getPreviewEntity();
    if (!preview) return null;

    // Exclude preview entity from raycast
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => e !== preview && !e.userData.isPreview);

    if (entities.length === 0) return null;

    const hit = this.raycaster.raycastClosest(ray as any, entities);
    if (!hit) return null;

    const target = hit.entity;
    const center = target.transform.position;

    // Use axis-aligned extents from scale (default AABB assumption)
    const halfTarget: Vec3 = [
      Math.abs(target.transform.scale[0]) * 0.5,
      Math.abs(target.transform.scale[1]) * 0.5,
      Math.abs(target.transform.scale[2]) * 0.5,
    ];
    const halfPreview: Vec3 = [
      Math.abs(preview.transform.scale[0]) * 0.5,
      Math.abs(preview.transform.scale[1]) * 0.5,
      Math.abs(preview.transform.scale[2]) * 0.5,
    ];

    // Determine which face was hit by comparing to extents
    const dx = Math.abs(Math.abs(hit.point[0] - center[0]) - halfTarget[0]);
    const dy = Math.abs(Math.abs(hit.point[1] - center[1]) - halfTarget[1]);
    const dz = Math.abs(Math.abs(hit.point[2] - center[2]) - halfTarget[2]);

    let axis: 0 | 1 | 2 = 0;
    let sign = 1;
    
    if (dy <= dx && dy <= dz) {
      // Hit Y face (top/bottom)
      axis = 1;
      sign = hit.point[1] >= center[1] ? 1 : -1;
    } else if (dz <= dx && dz <= dy) {
      // Hit Z face (front/back)
      axis = 2;
      sign = hit.point[2] >= center[2] ? 1 : -1;
    } else {
      // Hit X face (left/right)
      axis = 0;
      sign = hit.point[0] >= center[0] ? 1 : -1;
    }

    const pos: Vec3 = [center[0], center[1], center[2]];
    
    // Slight epsilon to avoid touching collision due to numerical issues
    const EPSILON = 1e-4;
    pos[axis] = center[axis] + sign * (halfTarget[axis] + halfPreview[axis] + EPSILON);

    return pos;
  }

  /**
   * Helper to get the entity last hit by a ray (closest).
   */
  private getLastRaycastEntity(ray: { origin: Vec3; direction: Vec3 }): Entity | null {
    const preview = this.config.placementMode.getPreviewEntity();
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => e !== preview && !e.userData.isPreview);
    
    if (entities.length === 0) return null;
    
    const hit = this.raycaster.raycastClosest(ray as any, entities);
    return hit?.entity ?? null;
  }

  /**
   * Raycasts to the ground plane (y = 0).
   */
  private raycastToGroundPlane(ray: { origin: Vec3; direction: Vec3 }): Vec3 | null {
    const { origin, direction } = ray;

    if (!origin || !direction) {
      return null;
    }

    const dy = direction[1];
    if (!Number.isFinite(dy) || Math.abs(dy) < 0.0001) {
      return null;
    }

    const t = -origin[1] / dy;

    if (!Number.isFinite(t) || t < 0) {
      return null;
    }

    const x = origin[0] + t * direction[0];
    const z = origin[2] + t * direction[2];
    
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    return [x, 0, z];
  }

  /**
   * Gets the raycaster instance (for external use if needed).
   */
  getRaycaster(): Raycaster {
    return this.raycaster;
  }

  /**
   * Checks if placement mode is currently active.
   */
  isPlacementActive(): boolean {
    return this.config.placementMode.isActive();
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    Logger.debug('EditorPlacementController disposed');
  }
}


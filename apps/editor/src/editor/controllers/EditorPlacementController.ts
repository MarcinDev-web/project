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
import { CameraComponent } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { PlacementMode } from '../placement/PlacementMode';
import { Raycaster } from '@engine/world';
import type { Vec3, Mat4 } from '@engine/core/math';
import { CollisionDetector } from '../placement/CollisionDetector';
import { mat4Perspective, mat4LookAt, mat4Invert, normalizeVec3Out, dotVec3 } from '@engine/core/math';
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
  /** Throttle mouse move updates using requestAnimationFrame */
  private pendingMouseUpdate: { event: MouseEvent; rafId: number | null } | null = null;
  /** Helper for OBB math (reuses CollisionDetector's OBB helpers) */
  private obbHelper: CollisionDetector;

  constructor(private readonly config: EditorPlacementControllerConfig) {
    this.raycaster = new Raycaster();
    this.obbHelper = new CollisionDetector(this.config.scene);
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
   * Sets up mouse movement tracking for placement preview with throttling.
   */
  private setupMouseTracking(): void {
    if (!this.abortController) return;

    this.config.canvas.addEventListener(
      'mousemove',
      (event: MouseEvent) => {
        if (!this.config.placementMode.isActive()) {
          return;
        }

        // Cancel any pending update
        if (this.pendingMouseUpdate && this.pendingMouseUpdate.rafId !== null) {
          cancelAnimationFrame(this.pendingMouseUpdate.rafId);
        }

        // Schedule update on next animation frame (throttles to ~60fps)
        const rafId = requestAnimationFrame(() => {
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
              void this.config.placementMode.updatePreviewPosition(adjacent, {
                ignoreEntities: [exclude],
                applySnap: false,
              });
            } else {
              void this.config.placementMode.updatePreviewPosition(adjacent, {
                applySnap: false,
              });
            }
            return;
          }

          // Fall back to ground plane intersection
          const groundIntersection = this.raycastToGroundPlane(ray);
          if (groundIntersection) {
            void this.config.placementMode.updatePreviewPosition(groundIntersection);
            return;
          }

          // Final fallback: place at fixed distance along ray (prevents ghost from following camera)
          const DEFAULT_PLACEMENT_DISTANCE = 5.0;
          const fallbackPosition: Vec3 = [
            ray.origin[0] + ray.direction[0] * DEFAULT_PLACEMENT_DISTANCE,
            ray.origin[1] + ray.direction[1] * DEFAULT_PLACEMENT_DISTANCE,
            ray.origin[2] + ray.direction[2] * DEFAULT_PLACEMENT_DISTANCE,
          ];
          void this.config.placementMode.updatePreviewPosition(fallbackPosition);

          // Clear pending update
          if (this.pendingMouseUpdate?.rafId === rafId) {
            this.pendingMouseUpdate = null;
          }
        });

        this.pendingMouseUpdate = { event, rafId };
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
              void this.config.placementMode.updatePreviewPosition(adjacent, {
                ignoreEntities: [exclude],
                applySnap: false,
              });
            } else {
              void this.config.placementMode.updatePreviewPosition(adjacent, {
                applySnap: false,
              });
            }
          } else {
            const groundIntersection = this.raycastToGroundPlane(ray);
            if (groundIntersection) {
              void this.config.placementMode.updatePreviewPosition(groundIntersection);
            } else {
              // Final fallback: place at fixed distance along ray
              const DEFAULT_PLACEMENT_DISTANCE = 5.0;
              const fallbackPosition: Vec3 = [
                ray.origin[0] + ray.direction[0] * DEFAULT_PLACEMENT_DISTANCE,
                ray.origin[1] + ray.direction[1] * DEFAULT_PLACEMENT_DISTANCE,
                ray.origin[2] + ray.direction[2] * DEFAULT_PLACEMENT_DISTANCE,
              ];
              void this.config.placementMode.updatePreviewPosition(fallbackPosition);
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

    // Fallback: global Esc cancels placement even if other handlers miss it
    window.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this.config.placementMode.isActive()) {
          try {
            this.config.placementMode.cancelPlacement();
            this.config.state.placementMode.value = false;
            this.config.onStatusMessage?.('Placement cancelled', 500);
          } catch {}
        }
      },
      { signal: this.abortController.signal }
    );

    // Right-click to cancel (matches on-screen hint). Prevent default context menu.
    this.config.canvas.addEventListener(
      'contextmenu',
      (event: MouseEvent) => {
        event.preventDefault();
        if (this.config.placementMode.isActive()) {
          try {
            this.config.placementMode.cancelPlacement();
            this.config.state.placementMode.value = false;
            this.config.onStatusMessage?.('Placement cancelled', 500);
          } catch {}
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
    // Calculate mouse position in canvas coordinates (accounting for canvas size vs display size)
    const canvasDisplayWidth = rect.width;
    const canvasDisplayHeight = rect.height;
    const canvasInternalWidth = this.config.canvas.width;
    const canvasInternalHeight = this.config.canvas.height;
    
    const mouseX = ((event.clientX - rect.left) / canvasDisplayWidth) * canvasInternalWidth;
    const mouseY = ((event.clientY - rect.top) / canvasDisplayHeight) * canvasInternalHeight;

    // Prefer CameraDirector matrices (supports free-fly/FPS/third-person)
    const director = this.config.cameraDirector;
    if (director) {
      const viewMatrix = director.getViewMatrix();
      const projectionMatrix = director.getProjectionMatrix();
      
      // Validate matrices before using
      if (!viewMatrix || !projectionMatrix) {
        Logger.warn('EditorPlacementController: Invalid camera matrices, falling back to orbit controls');
        // Explicitly fall through to orbit controls fallback
      } else {
        // Additional validation: check if matrices are valid arrays
        if (viewMatrix.length === 16 && projectionMatrix.length === 16) {
          return this.raycaster.createRayFromScreen(
            mouseX,
            mouseY,
            canvasInternalWidth,
            canvasInternalHeight,
            viewMatrix,
            projectionMatrix
          );
        } else {
          Logger.warn('EditorPlacementController: Invalid matrix dimensions, falling back to orbit controls');
          // Fall through to orbit controls fallback
        }
      }
    }

    // Fallback to legacy orbit-controls derived matrices
    const { yaw, pitch, distance } = this.config.controls.getState();
    const aspect = canvasInternalWidth / canvasInternalHeight;

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
      canvasInternalWidth,
      canvasInternalHeight,
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
      .filter((e) => e !== preview && !e.userData.isPreview && !e.getComponent(CameraComponent));

    if (entities.length === 0) return null;

    let hit = this.raycaster.raycastClosest(ray as any, entities) as { entity: Entity; point: Vec3 } | null;
    // Fallback: if triangle raycast fails (e.g., missing mesh acceleration), use OBB raycast
    if (!hit) {
      hit = this.raycastClosestOBB(ray, entities);
      if (!hit) return null;
    }

    const target = hit.entity;
    const targetWorld = target.transform.getWorldMatrix();
    const previewWorld = preview.transform.getWorldMatrix();
    const invTargetWorld = new Float32Array(16) as Mat4;
    try {
      mat4Invert(invTargetWorld, targetWorld);
    } catch {
      return null;
    }

    // Transform hit point into target local space to determine the impacted face
    const hx = hit.point[0];
    const hy = hit.point[1];
    const hz = hit.point[2];
    const lx =
      (invTargetWorld[0] ?? 0) * hx +
      (invTargetWorld[4] ?? 0) * hy +
      (invTargetWorld[8] ?? 0) * hz +
      (invTargetWorld[12] ?? 0);
    const ly =
      (invTargetWorld[1] ?? 0) * hx +
      (invTargetWorld[5] ?? 0) * hy +
      (invTargetWorld[9] ?? 0) * hz +
      (invTargetWorld[13] ?? 0);
    const lz =
      (invTargetWorld[2] ?? 0) * hx +
      (invTargetWorld[6] ?? 0) * hy +
      (invTargetWorld[10] ?? 0) * hz +
      (invTargetWorld[14] ?? 0);
    const lw =
      (invTargetWorld[3] ?? 0) * hx +
      (invTargetWorld[7] ?? 0) * hy +
      (invTargetWorld[11] ?? 0) * hz +
      (invTargetWorld[15] ?? 1);
    const invW = Math.abs(lw) > 1e-6 && Math.abs(lw - 1) > 1e-6 ? 1 / lw : 1;
    const hitLocal: Vec3 = [lx * invW, ly * invW, lz * invW];

    const targetScale = target.transform.scale;
    const halfTargetLocal: Vec3 = [
      Math.max(Math.abs(targetScale[0]) * 0.5, 0.0005),
      Math.max(Math.abs(targetScale[1]) * 0.5, 0.0005),
      Math.max(Math.abs(targetScale[2]) * 0.5, 0.0005),
    ];

    const deltaX = Math.abs(Math.abs(hitLocal[0]) - halfTargetLocal[0]);
    const deltaY = Math.abs(Math.abs(hitLocal[1]) - halfTargetLocal[1]);
    const deltaZ = Math.abs(Math.abs(hitLocal[2]) - halfTargetLocal[2]);

    let axis: 0 | 1 | 2 = 0;
    let minDelta = deltaX;
    if (deltaY <= minDelta && deltaY <= deltaZ) {
      axis = 1;
      minDelta = deltaY;
    } else if (deltaZ < minDelta && deltaZ <= deltaY) {
      axis = 2;
      minDelta = deltaZ;
    }

    const sign = hitLocal[axis] >= 0 ? 1 : -1;
    const axisColumnOffset = axis * 4;
    const axisVector: Vec3 = [
      targetWorld[axisColumnOffset + 0] ?? 0,
      targetWorld[axisColumnOffset + 1] ?? 0,
      targetWorld[axisColumnOffset + 2] ?? 0,
    ];
    const axisLength = Math.hypot(axisVector[0], axisVector[1], axisVector[2]) || 1;
    normalizeVec3Out(axisVector, axisVector);
    const targetHalf = Math.max(0.0005, axisLength * 0.5);

    const previewColX = [
      previewWorld[0] ?? 0,
      previewWorld[1] ?? 0,
      previewWorld[2] ?? 0,
    ] as Vec3;
    const previewColY = [
      previewWorld[4] ?? 0,
      previewWorld[5] ?? 0,
      previewWorld[6] ?? 0,
    ] as Vec3;
    const previewColZ = [
      previewWorld[8] ?? 0,
      previewWorld[9] ?? 0,
      previewWorld[10] ?? 0,
    ] as Vec3;

    const previewHalf = Math.max(
      0.0005,
      0.5 *
        (Math.abs(dotVec3(axisVector, previewColX)) +
          Math.abs(dotVec3(axisVector, previewColY)) +
          Math.abs(dotVec3(axisVector, previewColZ)))
    );

    const placementConfig = this.config.placementMode.getConfig();
    const minHalfForTolerance = Math.min(targetHalf, previewHalf);
    const dimensionForTolerance =
      Number.isFinite(minHalfForTolerance) && minHalfForTolerance > 0
        ? minHalfForTolerance * 2
        : 1;
    const epsilon = Math.max(
      1e-4,
      (placementConfig.contactTolerance ?? 0) * dimensionForTolerance
    );

    const offset = (targetHalf + previewHalf + epsilon) * sign;

    const centerWorld: Vec3 = [
      targetWorld[12] ?? 0,
      targetWorld[13] ?? 0,
      targetWorld[14] ?? 0,
    ];

    const pos: Vec3 = [
      centerWorld[0] + axisVector[0] * offset,
      centerWorld[1] + axisVector[1] * offset,
      centerWorld[2] + axisVector[2] * offset,
    ];

    return pos;
  }

  /**
   * Fallback raycast against entity OBBs using a slab test in OBB space.
   * Returns closest hit in front of the ray origin.
   */
  private raycastClosestOBB(
    ray: { origin: Vec3; direction: Vec3 },
    entities: Entity[]
  ): { entity: Entity; point: Vec3 } | null {
    let bestT = Number.POSITIVE_INFINITY;
    let best: { entity: Entity; point: Vec3 } | null = null;

    const EPS = 1e-6;
    for (const ent of entities) {
      // Skip virtual camera holders
      try { if (ent.getComponent(CameraComponent)) continue; } catch {}
      const obb = this.obbHelper.getOBB(ent);
      // Transform ray into OBB local coordinates: project onto axes
      const px = ray.origin[0] - obb.center[0];
      const py = ray.origin[1] - obb.center[1];
      const pz = ray.origin[2] - obb.center[2];
      const p: Vec3 = [
        px * obb.axes[0][0] + py * obb.axes[0][1] + pz * obb.axes[0][2],
        px * obb.axes[1][0] + py * obb.axes[1][1] + pz * obb.axes[1][2],
        px * obb.axes[2][0] + py * obb.axes[2][1] + pz * obb.axes[2][2],
      ];
      const d: Vec3 = [
        ray.direction[0] * obb.axes[0][0] + ray.direction[1] * obb.axes[0][1] + ray.direction[2] * obb.axes[0][2],
        ray.direction[0] * obb.axes[1][0] + ray.direction[1] * obb.axes[1][1] + ray.direction[2] * obb.axes[1][2],
        ray.direction[0] * obb.axes[2][0] + ray.direction[1] * obb.axes[2][1] + ray.direction[2] * obb.axes[2][2],
      ];

      let tmin = -Infinity;
      let tmax = Infinity;
      const half = obb.halfSizes;

      // Slab test for each axis in OBB local space
      for (let i = 0; i < 3; i++) {
        const pi = p[i]!;
        const di = d[i]!;
        const hi = half[i]!;
        if (Math.abs(di) < EPS) {
          if (pi < -hi || pi > hi) {
            tmin = Infinity;
            break; // No intersection with this box
          }
          // Parallel and inside slab → no bounds update
          continue;
        }
        let t1 = (-hi - pi) / di;
        let t2 = (hi - pi) / di;
        if (t1 > t2) {
          const tmp = t1; t1 = t2; t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { tmin = Infinity; break; }
      }

      // Choose the nearest valid intersection in front of origin
      if (tmin !== Infinity) {
        const tHit = tmin >= 0 ? tmin : tmax;
        if (tHit >= 0 && tHit < bestT) {
          bestT = tHit;
          const point: Vec3 = [
            ray.origin[0] + ray.direction[0] * tHit,
            ray.origin[1] + ray.direction[1] * tHit,
            ray.origin[2] + ray.direction[2] * tHit,
          ];
          best = { entity: ent, point };
        }
      }
    }

    return best;
  }

  /**
   * Helper to get the entity last hit by a ray (closest).
   */
  private getLastRaycastEntity(ray: { origin: Vec3; direction: Vec3 }): Entity | null {
    const preview = this.config.placementMode.getPreviewEntity();
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => e !== preview && !e.userData.isPreview && !e.getComponent(CameraComponent));
    
    if (entities.length === 0) return null;
    
    const hit = this.raycaster.raycastClosest(ray as any, entities) as { entity: Entity } | null;
    if (hit?.entity) return hit.entity;
    const obbHit = this.raycastClosestOBB(ray, entities);
    return obbHit?.entity ?? null;
  }

  /**
   * Raycasts to find ground position. Tries terrain entities first, falls back to y=0 plane.
   */
  private raycastToGroundPlane(ray: { origin: Vec3; direction: Vec3 }): Vec3 | null {
    const { origin, direction } = ray;

    if (!origin || !direction) {
      return null;
    }

    // Try raycasting to scene entities first (terrain, ground meshes, etc.)
    const preview = this.config.placementMode.getPreviewEntity();
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => e !== preview && !e.userData.isPreview);

    if (entities.length > 0) {
      const hit = this.raycaster.raycastClosest(ray as any, entities);
      if (hit && hit.point[1] >= -0.1) {
        // Use hit point if it's near ground level (allow slight below ground)
        // Position placement above the hit surface
        const hitY = hit.point[1];
        const previewScale = preview?.transform.scale ?? [1, 1, 1];
        const placementY = hitY + Math.max(0.001, Math.abs(previewScale[1]) / 2);
        return [hit.point[0], placementY, hit.point[2]];
      }
    }

    // Fallback: raycast to y=0 plane (ground plane)
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

    // Place above ground plane based on preview scale
    const previewScale = preview?.transform.scale ?? [1, 1, 1];
    const placementY = Math.max(0.001, Math.abs(previewScale[1]) / 2);

    return [x, placementY, z];
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
    // Cancel any pending animation frame
    if (this.pendingMouseUpdate && this.pendingMouseUpdate.rafId !== null) {
      cancelAnimationFrame(this.pendingMouseUpdate.rafId);
      this.pendingMouseUpdate = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    Logger.debug('EditorPlacementController disposed');
  }
}

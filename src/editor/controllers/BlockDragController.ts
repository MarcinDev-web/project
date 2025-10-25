/**
 * BlockDragController - KoGaMa-style block dragging system.
 * 
 * Allows users to drag existing blocks in 3D space:
 * - Click and hold on a block to start dragging
 * - Block follows cursor in 3D space
 * - Can snap to adjacent blocks
 * - Release to place in new position
 * - Collision detection prevents invalid placement
 */

import type { OrbitControls } from '../../input';
import type { Scene, Entity } from '../../engine/scene';
import type { SelectionManager } from '../../scene/Selection';
import type { EditorState } from '../core/state';
import type { PlacementMode } from '../placement/PlacementMode';
import { Raycaster } from '../../scene/Raycaster';
import type { Vec3, Mat4, Quat } from '@engine/core/math';
import { mat4Perspective, mat4LookAt, mat4Invert, mat4GetRotation, mat4GetScale, dotVec3 } from '@engine/core/math';
import { FOV_RADIANS, Z_FAR, Z_NEAR } from '../../rendering/config';
import { Logger } from '../../app/utils/logger';
import { CollisionDetector } from '../placement/CollisionDetector';

export interface BlockDragControllerConfig {
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  placementMode: PlacementMode;
  collisionDetector: CollisionDetector;
  updateSceneBuffers: () => void;
  recordSnapshot: (description: string) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
}

interface DragState {
  /** Entity being dragged */
  entity: Entity;
  /** Original position before drag started */
  originalPosition: Vec3;
  /** Original rotation before drag started */
  originalRotation: Quat;
  /** Original scale before drag started */
  originalScale: Vec3;
  /** Original color before drag started */
  originalColor: [number, number, number, number];
  /** Pointer ID for tracking */
  pointerId: number;
  /** Initial mouse position */
  startMousePos: [number, number];
  /** Preview mode - show ghost while dragging */
  isPreview: boolean;
  /** Whether current position is valid (no collision) */
  canPlace: boolean;
}

/**
 * Manages block dragging interactions.
 */
export class BlockDragController {
  private raycaster: Raycaster;
  private dragState: DragState | null = null;
  private abortController: AbortController | null = null;
  private isDragging = false;
  private dragThreshold = 5; // pixels before drag starts

  constructor(private readonly config: BlockDragControllerConfig) {
    this.raycaster = new Raycaster();
  }

  /**
   * Initializes drag controller and sets up event listeners.
   */
  initialize(): () => void {
    this.abortController = new AbortController();
    this.setupDragHandlers();

    // Return cleanup function
    return () => {
      this.dispose();
    };
  }

  /**
   * Sets up drag event handlers.
   */
  private setupDragHandlers(): void {
    if (!this.abortController) return;

    // Mousedown to start potential drag
    this.config.canvas.addEventListener(
      'pointerdown',
      (event: PointerEvent) => this.handlePointerDown(event),
      { signal: this.abortController.signal }
    );

    // Mousemove to update drag position
    window.addEventListener(
      'pointermove',
      (event: PointerEvent) => this.handlePointerMove(event),
      { signal: this.abortController.signal }
    );

    // Mouseup to complete drag
    window.addEventListener(
      'pointerup',
      (event: PointerEvent) => this.handlePointerUp(event),
      { signal: this.abortController.signal }
    );

    // Handle pointercancel (common on touch) to avoid stuck drag state
    window.addEventListener(
      'pointercancel',
      (event: PointerEvent) => this.handlePointerCancel(event),
      { signal: this.abortController.signal }
    );

    // If pointer capture is lost, cancel the drag safely
    this.config.canvas.addEventListener(
      'lostpointercapture',
      (event: PointerEvent) => this.handlePointerCancel(event),
      { signal: this.abortController.signal }
    );

    // If window loses focus, cancel any active drag
    window.addEventListener(
      'blur',
      () => this.cancelDrag(),
      { signal: this.abortController.signal }
    );
  }

  /**
   * Handles pointer down - checks if user clicked on a draggable block.
   */
  private handlePointerDown(event: PointerEvent): void {
    // Only handle left mouse button
    if (event.button !== 0) return;

    // Don't interfere with placement mode
    if (this.config.placementMode.isActive()) return;

    // Don't drag in play mode
    if (this.config.state.editorMode.value === 'play') return;

    // Check if we're clicking on the canvas
    if (event.target !== this.config.canvas) return;

    // Raycast to find entity under cursor
    const ray = this.createRayFromPointerEvent(event);
    if (!ray) return;

    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => !e.userData.isPreview);

    if (entities.length === 0) return;

    const hit = this.raycaster.raycastClosest(ray as any, entities);
    if (!hit) return;

    const entity = hit.entity;

    // Store initial drag state (but don't start dragging yet - wait for movement)
    this.dragState = {
      entity,
      originalPosition: [...entity.transform.position] as Vec3,
      originalRotation: [...entity.transform.rotation] as Quat,
      originalScale: [...entity.transform.scale] as Vec3,
      originalColor: [...entity.color] as [number, number, number, number],
      pointerId: event.pointerId,
      startMousePos: [event.clientX, event.clientY],
      isPreview: false,
      canPlace: true,
    };

    // Capture pointer for smooth dragging
    try {
      this.config.canvas.setPointerCapture(event.pointerId);
    } catch (err) {
      Logger.warn('Failed to capture pointer', err as Error);
    }

    event.preventDefault();
  }

  /**
   * Handles pointer move - updates block position during drag.
   */
  private handlePointerMove(event: PointerEvent): void {
    if (!this.dragState) return;
    if (this.dragState.pointerId !== event.pointerId) return;

    // Check if we've moved enough to start dragging
    if (!this.isDragging) {
      const dx = event.clientX - this.dragState.startMousePos[0];
      const dy = event.clientY - this.dragState.startMousePos[1];
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.dragThreshold) {
        return; // Not moved enough yet
      }

      // Start dragging
      this.startDragging();
    }

    // Update position based on raycast
    const ray = this.createRayFromPointerEvent(event);
    if (!ray) return;

    // Try adjacent placement first (snapping to existing entities)
    const adjacent = this.getAdjacentPlacementFromRay(ray);
    if (adjacent) {
      this.updateDragPosition(adjacent);
      return;
    }

    // Fall back to ground plane intersection
    const groundIntersection = this.raycastToGroundPlane(ray);
    if (groundIntersection) {
      this.updateDragPosition(groundIntersection);
    }

    event.preventDefault();
  }

  /**
   * Starts the drag operation - converts entity to preview mode.
   */
  private startDragging(): void {
    if (!this.dragState) return;

    this.isDragging = true;
    this.dragState.isPreview = true;

    // Select the entity
    this.config.selection.select(this.dragState.entity);

    // Mark as preview
    this.dragState.entity.userData.isPreview = true;

    // Disable orbit controls during drag
    this.config.controls.setEnabled(false);

    this.config.onStatusMessage?.('Dragging block (Esc to cancel)');
    Logger.debug(`Started dragging entity: ${this.dragState.entity.name}`);
  }

  /**
   * Updates the position of the dragged block.
   */
  private updateDragPosition(worldPosition: Vec3): void {
    if (!this.dragState || !this.isDragging) return;

    const entity = this.dragState.entity;

    // Convert world position to local space of the parent and apply
    const localPosition = this.worldToLocalPosition(worldPosition, entity.parent);
    entity.transform.position = localPosition;

    // Check collision at this position
    // Build world-space OBB: use world rotation and world scale at the updated position
    const worldMatrix = entity.transform.getWorldMatrix();
    const worldRotation = mat4GetRotation(worldMatrix);
    const worldScale = mat4GetScale(worldMatrix);
    const CONTACT_TOLERANCE = 0.001;
    const testScale: Vec3 = [
      Math.max(0.001, worldScale[0] - CONTACT_TOLERANCE),
      Math.max(0.001, worldScale[1] - CONTACT_TOLERANCE),
      Math.max(0.001, worldScale[2] - CONTACT_TOLERANCE),
    ];

    // Exclude the entity being dragged from collision check
    const excludeSet = new Set<Entity>([entity]);

    const collisionResult = this.config.collisionDetector.checkCollisionOBB(
      entity,
      worldPosition,
      worldRotation,
      testScale,
      excludeSet
    );

    const canPlace = !collisionResult.hasCollision;
    this.dragState.canPlace = canPlace;

    // Update visual feedback - green if valid, red if collision
    if (canPlace) {
      entity.color = [0.2, 1.0, 0.2, 0.6]; // Green with alpha
    } else {
      entity.color = [1.0, 0.2, 0.2, 0.6]; // Red with alpha
    }

    // Update scene buffers for rendering
    this.config.updateSceneBuffers();
  }

  /**
   * Handles pointer up - completes or cancels drag.
   */
  private handlePointerUp(event: PointerEvent): void {
    if (!this.dragState) return;
    if (this.dragState.pointerId !== event.pointerId) return;

    // Release pointer capture
    try {
      this.config.canvas.releasePointerCapture(event.pointerId);
    } catch (err) {
      // Ignore
    }

    if (this.isDragging) {
      this.completeDrag();
    } else {
      // Was just a click, not a drag - let selection handler deal with it
      this.cancelDrag(true);
    }

    event.preventDefault();
  }

  /**
   * Completes the drag operation - places block in new position.
   */
  private completeDrag(): void {
    if (!this.dragState) return;

    const entity = this.dragState.entity;

    if (this.dragState.canPlace) {
      // Valid placement - restore original color and commit
      entity.color = this.dragState.originalColor;
      entity.userData.isPreview = false;

      this.config.updateSceneBuffers();
      this.config.recordSnapshot('Move block');
      this.config.onStatusMessage?.('Block moved', 1000);
      Logger.debug(`Completed drag: ${entity.name}`);
    } else {
      // Invalid placement - revert to original position
      entity.transform.position = this.dragState.originalPosition;
      entity.transform.rotation = this.dragState.originalRotation;
      entity.transform.scale = this.dragState.originalScale;
      entity.color = this.dragState.originalColor;
      entity.userData.isPreview = false;

      this.config.updateSceneBuffers();
      this.config.onStatusMessage?.('Cannot place here (collision)', 1000);
      Logger.debug(`Drag cancelled due to collision: ${entity.name}`);
    }

    // Re-enable orbit controls
    this.config.controls.setEnabled(true);

    // Clear drag state
    this.dragState = null;
    this.isDragging = false;
  }

  /**
   * Cancels the drag operation - reverts block to original position.
   */
  public cancelDrag(silent = false): void {
    if (!this.dragState) return;

    if (this.isDragging) {
      const entity = this.dragState.entity;

      // Revert to original position
      entity.transform.position = this.dragState.originalPosition;
      entity.transform.rotation = this.dragState.originalRotation;
      entity.transform.scale = this.dragState.originalScale;
      entity.color = this.dragState.originalColor;
      entity.userData.isPreview = false;

      this.config.updateSceneBuffers();

      if (!silent) {
        this.config.onStatusMessage?.('Drag cancelled', 1000);
      }
      Logger.debug(`Drag cancelled: ${entity.name}`);

      // Re-enable orbit controls
      this.config.controls.setEnabled(true);
    }

    // Clear drag state
    this.dragState = null;
    this.isDragging = false;
  }

  /**
   * Creates a world-space ray from a pointer event.
   */
  private createRayFromPointerEvent(event: PointerEvent): { origin: Vec3; direction: Vec3 } | null {
    const rect = this.config.canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) * (this.config.canvas.width / rect.width);
    const mouseY = (event.clientY - rect.top) * (this.config.canvas.height / rect.height);

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
    if (!this.dragState) return null;

    const draggedEntity = this.dragState.entity;

    // Exclude dragged entity from raycast
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => e !== draggedEntity && !e.userData.isPreview);

    if (entities.length === 0) return null;

    const hit = this.raycaster.raycastClosest(ray as any, entities);
    if (!hit) return null;

    const target = hit.entity;

    // Compute target world OBB axes, center and half sizes
    const { center, axes: targetAxes, halfSizes: targetHalf } = this.getWorldOBBParams(target);
    const toHit: Vec3 = [hit.point[0] - center[0], hit.point[1] - center[1], hit.point[2] - center[2]];

    // Project vector to hit on each target axis to find closest face
    const proj0 = dotVec3(toHit, targetAxes[0]);
    const proj1 = dotVec3(toHit, targetAxes[1]);
    const proj2 = dotVec3(toHit, targetAxes[2]);

    const distToFace0 = Math.abs(targetHalf[0] - Math.abs(proj0));
    const distToFace1 = Math.abs(targetHalf[1] - Math.abs(proj1));
    const distToFace2 = Math.abs(targetHalf[2] - Math.abs(proj2));

    let axisIndex: 0 | 1 | 2 = 0;
    let signedProj = proj0;
    let minDist = distToFace0;
    if (distToFace1 < minDist) {
      axisIndex = 1;
      signedProj = proj1;
      minDist = distToFace1;
    }
    if (distToFace2 < minDist) {
      axisIndex = 2;
      signedProj = proj2;
      // minDist = distToFace2; // not used further
    }

    const sign = signedProj >= 0 ? 1 : -1;
    const faceNormal: Vec3 = [
      targetAxes[axisIndex][0] * sign,
      targetAxes[axisIndex][1] * sign,
      targetAxes[axisIndex][2] * sign,
    ];

    // Compute dragged entity extent along the face normal
    const draggedParams = this.getWorldOBBParams(draggedEntity);
    const draggedExtentAlongNormal =
      Math.abs(dotVec3(draggedParams.axes[0], faceNormal)) * draggedParams.halfSizes[0] +
      Math.abs(dotVec3(draggedParams.axes[1], faceNormal)) * draggedParams.halfSizes[1] +
      Math.abs(dotVec3(draggedParams.axes[2], faceNormal)) * draggedParams.halfSizes[2];

    // Compute new world position offset from target center along face normal
    const EPSILON = 1e-4; // Slight epsilon to avoid touching collision due to numerical issues
    const offset = targetHalf[axisIndex] + draggedExtentAlongNormal + EPSILON;
    const pos: Vec3 = [
      center[0] + faceNormal[0] * offset,
      center[1] + faceNormal[1] * offset,
      center[2] + faceNormal[2] * offset,
    ];

    return pos;
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

    // If dragging, maintain Y offset from ground
    if (this.dragState) {
      // Use world scale to compute half height
      const worldScale = mat4GetScale(this.dragState.entity.transform.getWorldMatrix());
      const halfHeight = Math.abs(worldScale[1]) * 0.5;
      return [x, halfHeight, z];
    }

    return [x, 0, z];
  }

  /**
   * Checks if currently dragging.
   */
  isDraggingBlock(): boolean {
    return this.isDragging;
  }

  /**
   * Gets the raycaster instance (for external use if needed).
   */
  getRaycaster(): Raycaster {
    return this.raycaster;
  }

  /**
   * Cleans up resources.
   */
  dispose(): void {
    // Cancel any active drag
    if (this.isDragging) {
      this.cancelDrag(true);
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    Logger.debug('BlockDragController disposed');
  }

  /**
   * Safely converts a world position into the local space of the given parent entity.
   */
  private worldToLocalPosition(worldPos: Vec3, parent: Entity | null): Vec3 {
    if (!parent) {
      return [worldPos[0], worldPos[1], worldPos[2]];
    }
    const parentWorld = parent.transform.getWorldMatrix();
    const invParent = new Float32Array(16) as Mat4;
    mat4Invert(invParent, parentWorld);
    return this.transformPointByMatrix(invParent, worldPos);
  }

  /**
   * Transforms a 3D point by a 4x4 matrix (assumes w=1).
   */
  private transformPointByMatrix(m: Mat4, p: Vec3): Vec3 {
    const x = p[0];
    const y = p[1];
    const z = p[2];
    return [
      (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
      (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
      (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0),
    ];
  }

  /**
   * Computes world-space OBB parameters (center, axes, half sizes) from an entity's world matrix.
   */
  private getWorldOBBParams(entity: Entity): { center: Vec3; axes: [Vec3, Vec3, Vec3]; halfSizes: Vec3 } {
    const wm = entity.transform.getWorldMatrix();
    const scale = mat4GetScale(wm);
    const sx = scale[0] || 1;
    const sy = scale[1] || 1;
    const sz = scale[2] || 1;
    // World axes are normalized columns of the world matrix
    const axis0: Vec3 = [
      (wm[0] ?? 0) / sx,
      (wm[1] ?? 0) / sx,
      (wm[2] ?? 0) / sx,
    ];
    const axis1: Vec3 = [
      (wm[4] ?? 0) / sy,
      (wm[5] ?? 0) / sy,
      (wm[6] ?? 0) / sy,
    ];
    const axis2: Vec3 = [
      (wm[8] ?? 0) / sz,
      (wm[9] ?? 0) / sz,
      (wm[10] ?? 0) / sz,
    ];
    const center: Vec3 = [wm[12] ?? 0, wm[13] ?? 0, wm[14] ?? 0];
    const halfSizes: Vec3 = [Math.abs(sx) * 0.5, Math.abs(sy) * 0.5, Math.abs(sz) * 0.5];
    return { center, axes: [axis0, axis1, axis2], halfSizes };
  }

  /**
   * Handles pointer cancellation and lost capture by safely cancelling the drag.
   */
  private handlePointerCancel(event: PointerEvent): void {
    if (!this.dragState) return;
    if (this.dragState.pointerId !== event.pointerId) return;

    // Try to release pointer capture if held
    try {
      this.config.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore
    }
    this.cancelDrag();
    event.preventDefault();
  }
}


import type { OrbitControls, CameraDirector } from '@engine/camera';
import type { Scene, Entity } from '@engine/world';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { PlacementMode } from '../placement/PlacementMode';
import { Raycaster } from '@engine/world';
import type { Vec3, Mat4, Quat } from '@engine/core/math';
import { 
  mat4GetRotation, 
  mat4GetScale, 
  mat4Invert,
  dotVec3,
  quatFromAxisAngle,
  quatMultiply
} from '@engine/core/math';
import { Logger } from '../../utils/logger';
import { CollisionDetector } from '../placement/CollisionDetector';
import type { Ray } from '@engine/world';
import type { InteractionTool } from '../input/InteractionTypes';
import type { GuideLineVisualizer } from '../visuals/GuideLineVisualizer';

export interface BlockDragControllerConfig {
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  /** Active camera director (preferred for view/projection) */
  cameraDirector?: CameraDirector;
  scene: Scene;
  selection: SelectionManager;
  state: EditorState;
  placementMode: PlacementMode;
  collisionDetector: CollisionDetector;
  updateSceneBuffers: () => void;
  recordSnapshot: (description: string) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
  /** Visualizer for debug/guide lines */
  guideLineVisualizer?: GuideLineVisualizer;
}

interface DragState {
  /** Entity being dragged */
  entity: Entity;
  /** Original position before drag started (Local) */
  originalPosition: Vec3;
  /** Original position before drag started (World) */
  originalWorldPosition: Vec3;
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
  /** Whether the entity was created specifically for this drag (e.g. via Alt-clone) */
  createdOnDrag: boolean;
  /** Drag plane normal for free transform */
  dragPlaneNormal?: Vec3;
  /** Intersection point on plane when drag started */
  dragStartPoint?: Vec3;
  /** Whether we are in free transform mode */
  isFreeTransform: boolean;
  /** Height offset accumulated from scroll */
  heightOffset: number;
  /** Rotation accumulated from scroll */
  rotationAngle: number;
}

/**
 * Manages block dragging interactions.
 */
export class BlockDragController implements InteractionTool {
  public readonly name = 'BlockDragController';
  private raycaster: Raycaster;
  private dragState: DragState | null = null;
  private isDragging = false;
  private dragThreshold = 5; // pixels before drag starts

  // Keyboard modifiers state
  private isShiftPressed = false;
  private isAltPressed = false;
  private isCtrlPressed = false;

  // Helper for free transform
  private freeTransformPlaneNormal: Vec3 = [0, 1, 0];

  private abortController: AbortController | null = null;

  constructor(private readonly config: BlockDragControllerConfig) {
    this.raycaster = new Raycaster();
  }

  /**
   * Initializes the controller and sets up event listeners.
   * @returns A cleanup function that disposes the controller
   */
  public initialize(): () => void {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Listen for keyboard modifiers
    window.addEventListener('keydown', (e) => {
      this.isShiftPressed = e.shiftKey;
      this.isAltPressed = e.altKey;
      this.isCtrlPressed = e.ctrlKey;
    }, { signal });

    window.addEventListener('keyup', (e) => {
      this.isShiftPressed = e.shiftKey;
      this.isAltPressed = e.altKey;
      this.isCtrlPressed = e.ctrlKey;
    }, { signal });

    // Listen for pointer events on canvas
    this.config.canvas.addEventListener('pointerdown', (e) => {
      const ray = this.createRayFromEvent(e);
      this.onPointerDown(e, ray);
    }, { signal });

    window.addEventListener('pointermove', (e) => {
      const ray = this.createRayFromEvent(e);
      this.onPointerMove(e, ray);
    }, { signal });

    window.addEventListener('pointerup', (e) => {
      const ray = this.createRayFromEvent(e);
      this.onPointerUp(e, ray);
    }, { signal });

    // Listen for pointer cancel to abort drag
    window.addEventListener('pointercancel', (e) => {
      if (this.dragState && this.dragState.pointerId === e.pointerId) {
        this.config.canvas.releasePointerCapture(e.pointerId);
        this.cancelDrag();
      }
    }, { signal });

    return () => {
      this.dispose();
    };
  }

  /**
   * Creates a ray from a pointer event using the camera.
   */
  private createRayFromEvent(event: PointerEvent): Ray {
    const rect = this.config.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Get camera matrices
    const cameraDirector = this.config.cameraDirector;
    if (cameraDirector) {
      const viewMatrix = cameraDirector.getViewMatrix();
      const projectionMatrix = cameraDirector.getProjectionMatrix();
      return this.raycaster.createRayFromScreenCoords(x, y, viewMatrix, projectionMatrix);
    }

    // Fallback to scene's primary camera
    const camera = this.config.scene.primaryCamera;
    if (camera) {
      const viewMatrix = camera.getViewMatrix?.() ?? camera.transform.getWorldMatrix();
      const projectionMatrix = camera.getProjectionMatrix?.() ?? new Float32Array(16) as Mat4;
      return this.raycaster.createRayFromScreenCoords(x, y, viewMatrix, projectionMatrix);
    }

    // Default ray pointing forward
    return { origin: [0, 0, 0], direction: [0, 0, -1] };
  }

  /**
   * Disposes the controller and cleans up resources.
   */
  public dispose(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.cancelDrag(true);
  }

  /**
   * Returns whether a block is currently being dragged.
   */
  public isDraggingBlock(): boolean {
    return this.isDragging && this.dragState !== null;
  }

  public checkHit(ray: Ray): boolean {
    // If already dragging, we claim it
    if (this.dragState) return true;

    // If play mode, we don't interact
    if (this.config.state.editorMode.value === 'play') return false;

    // Perform raycast to see if we hit a draggable entity
    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => !e.userData.isPreview);

    if (entities.length === 0) return false;

    const hit = this.raycaster.raycastClosest(ray, entities);
    return !!hit;
  }

  public onPointerDown(event: PointerEvent, ray: Ray): void {
    if (event.button !== 0) return;

    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => !e.userData.isPreview);

    const hit = this.raycaster.raycastClosest(ray, entities);
    if (!hit) return;

    const entity = hit.entity;
    const worldMatrix = entity.transform.getWorldMatrix();
    const worldPos: Vec3 = [worldMatrix[12]!, worldMatrix[13]!, worldMatrix[14]!];

    // Determine if we should start in free transform mode
    // For now, toggle with a modifier key or check config/state
    // Let's use CTRL as a toggle for "Free Transform" during drag
    const isFreeTransform = event.ctrlKey;

    this.dragState = {
      entity,
      originalPosition: [...entity.transform.position] as Vec3,
      originalWorldPosition: worldPos,
      originalRotation: [...entity.transform.rotation] as Quat,
      originalScale: [...entity.transform.scale] as Vec3,
      originalColor: [...entity.color] as [number, number, number, number],
      pointerId: event.pointerId,
      startMousePos: [event.clientX, event.clientY],
      isPreview: false,
      canPlace: true,
      createdOnDrag: false,
      isFreeTransform,
      // Initialize plane drag data
      dragPlaneNormal: [0, 1, 0], // Default to ground plane
      dragStartPoint: hit.point,
      heightOffset: 0,
      rotationAngle: 0
    };

    // Calculate initial drag plane based on camera view
    if (isFreeTransform && this.config.cameraDirector) {
       // For free transform, we want a plane perpendicular to camera look direction 
       // or parallel to ground depending on angle?
       // Standard behavior: drag on plane parallel to camera view plane passing through object center
       // OR drag on horizontal plane (XZ) if looking from top/angle
       // Let's default to horizontal XZ plane for "floor" feel, 
       // unless Shift is pressed -> Vertical XY?
       // For this prototype: Always XZ plane for simplicity unless we want to follow camera.
       this.dragState.dragPlaneNormal = [0, 1, 0];
       
       // Recalculate start point on this plane to be precise
       const planeHit = this.intersectRayPlane(ray, worldPos, [0, 1, 0]);
       if (planeHit) {
         this.dragState.dragStartPoint = planeHit;
       }
    }

    this.isAltPressed = event.altKey;
    this.isShiftPressed = event.shiftKey;
    this.isCtrlPressed = event.ctrlKey;
    
    // Note: We don't capture pointer here, Manager handles global listeners.
    // But we can request capture if we want exclusive events even outside window?
    // Manager uses window listener for move/up, so we are good.
    // But capture helps with UI consistency.
    try {
       this.config.canvas.setPointerCapture(event.pointerId);
    } catch {}
  }

  public onPointerMove(event: PointerEvent, ray: Ray): void {
    // Track modifiers
    this.isAltPressed = event.altKey;
    this.isShiftPressed = event.shiftKey;
    this.isCtrlPressed = event.ctrlKey;

    if (!this.dragState) return;
    if (this.dragState.pointerId !== event.pointerId) return;

    // Update free transform state if CTRL is pressed dynamically?
    // Usually dragging mode is set on start, but toggling mid-drag is cool.
    // Let's update the flag.
    this.dragState.isFreeTransform = this.isCtrlPressed;

    // Check start threshold
    if (!this.isDragging) {
      const dx = event.clientX - this.dragState.startMousePos[0];
      const dy = event.clientY - this.dragState.startMousePos[1];
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < this.dragThreshold) {
        return; 
      }

      this.startDragging(event.altKey || this.isAltPressed);
    }

    // Dragging logic
    
    if (this.dragState.isFreeTransform) {
      // Free Transform Logic: Plane Dragging
      const planeNormal = this.dragState.dragPlaneNormal || [0, 1, 0];
      // Use original position as plane origin to keep it stable
      const planeOrigin = this.dragState.originalWorldPosition;
      
      const hit = this.intersectRayPlane(ray, planeOrigin, planeNormal);
      if (hit && this.dragState.dragStartPoint) {
         // Calculate delta from start point
         // Note: dragStartPoint is where ray hit the plane at START.
         // hit is where ray hits plane NOW.
         // The object should move by (hit - dragStartPoint).
         
         // Correction: We need to apply this delta to the ORIGINAL object position.
         const delta = [
           hit[0] - this.dragState.dragStartPoint[0],
           hit[1] - this.dragState.dragStartPoint[1],
           hit[2] - this.dragState.dragStartPoint[2]
         ];
         
         const newPos: Vec3 = [
           this.dragState.originalWorldPosition[0] + delta[0],
           this.dragState.originalWorldPosition[1] + delta[1],
           this.dragState.originalWorldPosition[2] + delta[2]
         ];
         
         void this.updateDragPosition(newPos);
         return;
      }
    }

    // Standard Logic: Grid/Adjacency Snap
    // Try adjacent placement first
    const adjacent = this.getAdjacentPlacementFromRay(ray);
    if (adjacent) {
      void this.updateDragPosition(adjacent);
      return;
    }

    // Fall back to ground plane
    const groundIntersection = this.raycastToGroundPlane(ray);
    if (groundIntersection) {
      void this.updateDragPosition(groundIntersection);
    }
  }

  /**
   * Renders visual guide lines during drag
   */
  private updateGuideLines(currentPos: Vec3): void {
    const viz = this.config.guideLineVisualizer;
    if (!viz) return;

    viz.clear();

    // Draw vertical line to ground (Anchor with Ruler)
    const groundPos: Vec3 = [currentPos[0], 0, currentPos[2]]; // Assumes ground is at Y=0
    // If we have a height offset, draw from original ground level to current height?
    // currentPos is the center of block.
    // If we lifted it, we want to see line to ground.
    
    // Use Ruler if height > 0
    if (Math.abs(currentPos[1]) > 0.1) {
        viz.drawRuler(groundPos, currentPos, [1, 1, 1, 0.5]);
    } else {
        viz.drawLine(currentPos, groundPos, [1, 1, 1, 0.5]);
    }

    // Draw Rotation Circle if Shift is pressed
    if (this.isShiftPressed) {
        // Draw circle at ground or at object center?
        // At object center seems better for "Turntable" feel.
        viz.drawCircle(currentPos, 1.5, 'y', [1, 1, 0, 0.5]); // Yellow circle
    }

    // Draw X/Z axis lines from start point if in free transform
    if (this.dragState?.isFreeTransform && this.dragState.originalWorldPosition) {
       const start = this.dragState.originalWorldPosition;
       
       // Line to X axis of start
       viz.drawLine(currentPos, [start[0], currentPos[1], currentPos[2]], [1, 0, 0, 0.5]);
       // Line to Z axis of start
       viz.drawLine(currentPos, [currentPos[0], currentPos[1], start[2]], [0, 0, 1, 0.5]);
    }
  }

  public onPointerUp(event: PointerEvent, _ray: Ray): void {
    if (!this.dragState) return;
    if (this.dragState.pointerId !== event.pointerId) return;

    try {
       this.config.canvas.releasePointerCapture(event.pointerId);
    } catch {}

    if (this.isDragging) {
      this.completeDrag();
    } else {
      // Click (Select)
      this.cancelDrag(true);
      // Select the entity
      if (this.dragState?.entity) { // State was just cleared by cancelDrag? No, cancelDrag clears it.
         // Wait, cancelDrag clears dragState.
         // But we want to select.
         // Logic:
         // 1. cancelDrag reverts any changes (none if not dragging).
         // 2. select entity.
         // Actually `handlePointerUp` in original code called `cancelDrag(true)`.
         // Original `cancelDrag` logic:
         // "Was just a click, not a drag - let selection handler deal with it"
         // Wait, does SelectionManager handle click separately?
         // "handlePointerDown" in original:
         // "Raycast to find entity... Store initial drag state... event.preventDefault()"
         // It PREVENTED default. So standard selection might not fire?
         // Ah, `EditorUI` might have other listeners?
         // The plan says "BlockDragController takes control."
         // So WE are responsible for selection if we claimed the down event.
         
         // Let's see original `cancelDrag`:
         // It doesn't select.
         // "Was just a click, not a drag - let selection handler deal with it"
         // implies that the event might propagate?
         // But `stopPropagation` was NOT called in `handlePointerDown` (only `preventDefault`).
         // But we are in a manager now. `handlePointerDown` in manager calls `tool.onPointerDown`.
         
         // If BlockDrag is the Selection Tool, we should select here.
         const entity = this.dragState.entity;
         
         // Toggle selection or set selection?
         // Usually click = select exclusive. Ctrl+click = toggle.
         if (event.ctrlKey || event.metaKey) {
            this.config.selection.toggleSelection(entity);
         } else {
            this.config.selection.select(entity);
         }
      }
    }
  }

  public cancel(): void {
    this.cancelDrag();
  }

  // ... Private methods ...

  private startDragging(shouldClone: boolean = false): void {
    if (!this.dragState) return;

    if (shouldClone) {
      try {
        const original = this.dragState.entity;
        const clone = original.deepClone();
        clone.name = `${original.name} (Copy)`;
        
        if (original.parent) {
          original.parent.addChild(clone);
        } else if (original.scene) {
          original.scene.addEntity(clone);
        }
        
        this.dragState.entity = clone;
        this.dragState.createdOnDrag = true;
        Logger.debug(`Cloned entity for drag: ${clone.name}`);
      } catch (err) {
        Logger.error('Failed to clone entity', err as Error);
      }
    }

    this.isDragging = true;
    this.dragState.isPreview = true;
    this.config.selection.select(this.dragState.entity);
    this.dragState.entity.userData.isPreview = true;
    this.config.controls.setEnabled(false);
    this.config.onStatusMessage?.('Dragging block (Esc to cancel)');
  }


  public onWheel(event: WheelEvent): void {
    if (!this.dragState) return;

    // Sensitivity
    const scrollAmount = event.deltaY * -0.002; 

    if (this.isShiftPressed) {
        // Rotate
        this.dragState.rotationAngle += scrollAmount * 100; // Degrees
        
        // Apply rotation immediately
        const axis: Vec3 = [0, 1, 0];
        const deltaQ = quatFromAxisAngle(axis, this.dragState.rotationAngle * (Math.PI / 180));
        this.dragState.entity.transform.rotation = quatMultiply(this.dragState.originalRotation, deltaQ);
    } else {
        // Height
        this.dragState.heightOffset += scrollAmount * 5; // Faster height
    }
    
    // Force update if we have a last known position
    if (this.lastTargetPosition) {
        void this.updateDragPosition(this.lastTargetPosition);
    }
  }

  private lastTargetPosition: Vec3 | null = null;

  private async updateDragPosition(targetPosition: Vec3): Promise<void> {
    if (!this.dragState || !this.isDragging) return;
    
    this.lastTargetPosition = targetPosition;

    const entity = this.dragState.entity;
    let finalPosition = targetPosition;

    if (this.isShiftPressed) {
      const startPos = this.dragState.originalWorldPosition;
      const dx = finalPosition[0] - startPos[0];
      const dy = finalPosition[1] - startPos[1];
      const dz = finalPosition[2] - startPos[2];

      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const az = Math.abs(dz);

      if (ax >= ay && ax >= az) {
        finalPosition = [finalPosition[0], startPos[1], startPos[2]];
      } else if (ay >= ax && ay >= az) {
        finalPosition = [startPos[0], finalPosition[1], startPos[2]];
      } else {
        finalPosition = [startPos[0], startPos[1], finalPosition[2]];
      }
    }

    // Apply Height Offset (The Forklift)
    finalPosition = [
        finalPosition[0],
        finalPosition[1] + this.dragState.heightOffset,
        finalPosition[2]
    ];

    const localPosition = this.worldToLocalPosition(finalPosition, entity.parent);
    entity.transform.position = localPosition;

    const worldMatrix = entity.transform.getWorldMatrix();
    const worldRotation = mat4GetRotation(worldMatrix);
    const worldScale = mat4GetScale(worldMatrix);
    const CONTACT_TOLERANCE = 0.001;
    const testScale: Vec3 = [
      Math.max(0.001, worldScale[0] - CONTACT_TOLERANCE),
      Math.max(0.001, worldScale[1] - CONTACT_TOLERANCE),
      Math.max(0.001, worldScale[2] - CONTACT_TOLERANCE),
    ];

    const excludeSet = new Set<Entity>([entity]);

    const collisionResult = await this.config.collisionDetector.checkCollisionOBB(
      entity,
      finalPosition,
      worldRotation,
      testScale,
      excludeSet
    );

    const canPlace = !collisionResult.hasCollision;
    if (this.dragState) {
      this.dragState.canPlace = canPlace;
    }

    if (canPlace) {
      entity.color = [0.2, 1.0, 0.2, 0.6]; 
    } else {
      entity.color = [1.0, 0.2, 0.2, 0.6]; 
    }

    this.config.updateSceneBuffers();
    this.updateGuideLines(finalPosition);
  }

  private completeDrag(): void {
    if (!this.dragState) return;
    const entity = this.dragState.entity;

    if (this.dragState.canPlace) {
      entity.color = this.dragState.originalColor;
      entity.userData.isPreview = false;

      this.config.updateSceneBuffers();
      this.config.recordSnapshot('Move block');
      this.config.onStatusMessage?.('Block moved', 1000);
    } else {
      entity.transform.position = this.dragState.originalPosition;
      entity.transform.rotation = this.dragState.originalRotation;
      entity.transform.scale = this.dragState.originalScale;
      entity.color = this.dragState.originalColor;
      entity.userData.isPreview = false;

      this.config.updateSceneBuffers();
      this.config.onStatusMessage?.('Cannot place here (collision)', 1000);
    }

    this.config.guideLineVisualizer?.clear();
    this.config.controls.setEnabled(true);
    this.dragState = null;
    this.isDragging = false;
  }

  public cancelDrag(silent = false): void {
    if (!this.dragState) return;

    if (this.isDragging) {
      const entity = this.dragState.entity;

      if (this.dragState.createdOnDrag) {
        if (entity.parent) {
          entity.removeFromParent();
        } else if (entity.scene) {
          entity.scene.removeEntity(entity);
        }
        this.config.selection.removeFromSelection(entity);
      } else {
        entity.transform.position = this.dragState.originalPosition;
        entity.transform.rotation = this.dragState.originalRotation;
        entity.transform.scale = this.dragState.originalScale;
        entity.color = this.dragState.originalColor;
        entity.userData.isPreview = false;
      }

      this.config.updateSceneBuffers();
      this.config.guideLineVisualizer?.clear();

      if (!silent) {
        this.config.onStatusMessage?.('Drag cancelled', 1000);
      }
      this.config.controls.setEnabled(true);
    }

    this.dragState = null;
    this.isDragging = false;
  }

  private getAdjacentPlacementFromRay(ray: { origin: Vec3; direction: Vec3 }): Vec3 | null {
    if (!this.dragState) return null;

    const draggedEntity = this.dragState.entity;

    const entities = this.config.scene
      .getActiveEntities()
      .filter((e) => e !== draggedEntity && !e.userData.isPreview);

    if (entities.length === 0) return null;

    const hit = this.raycaster.raycastClosest(ray as any, entities);
    if (!hit) return null;

    const target = hit.entity;
    const { center, axes: targetAxes, halfSizes: targetHalf } = this.getWorldOBBParams(target);
    const toHit: Vec3 = [hit.point[0] - center[0], hit.point[1] - center[1], hit.point[2] - center[2]];

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
    }

    const sign = signedProj >= 0 ? 1 : -1;
    const faceNormal: Vec3 = [
      targetAxes[axisIndex][0] * sign,
      targetAxes[axisIndex][1] * sign,
      targetAxes[axisIndex][2] * sign,
    ];

    const draggedParams = this.getWorldOBBParams(draggedEntity);
    const draggedExtentAlongNormal =
      Math.abs(dotVec3(draggedParams.axes[0], faceNormal)) * draggedParams.halfSizes[0] +
      Math.abs(dotVec3(draggedParams.axes[1], faceNormal)) * draggedParams.halfSizes[1] +
      Math.abs(dotVec3(draggedParams.axes[2], faceNormal)) * draggedParams.halfSizes[2];

    const EPSILON = 1e-4; 
    const offset = targetHalf[axisIndex] + draggedExtentAlongNormal + EPSILON;
    const pos: Vec3 = [
      center[0] + faceNormal[0] * offset,
      center[1] + faceNormal[1] * offset,
      center[2] + faceNormal[2] * offset,
    ];

    return pos;
  }

  private raycastToGroundPlane(ray: { origin: Vec3; direction: Vec3 }): Vec3 | null {
    const { origin, direction } = ray;

    if (!origin || !direction) return null;

    const dy = direction[1];
    if (!Number.isFinite(dy) || Math.abs(dy) < 0.0001) return null;

    const t = -origin[1] / dy;

    if (!Number.isFinite(t) || t < 0) return null;

    const x = origin[0] + t * direction[0];
    const z = origin[2] + t * direction[2];
    
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;

    if (this.dragState) {
      const worldScale = mat4GetScale(this.dragState.entity.transform.getWorldMatrix());
      const halfHeight = Math.abs(worldScale[1]) * 0.5;
      return [x, halfHeight, z];
    }

    return [x, 0, z];
  }

  private worldToLocalPosition(worldPos: Vec3, parent: Entity | null): Vec3 {
    if (!parent) {
      return [worldPos[0], worldPos[1], worldPos[2]];
    }
    const parentWorld = parent.transform.getWorldMatrix();
    const invParent = new Float32Array(16) as Mat4;
    mat4Invert(invParent, parentWorld);
    return this.transformPointByMatrix(invParent, worldPos);
  }

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

  private getWorldOBBParams(entity: Entity): { center: Vec3; axes: [Vec3, Vec3, Vec3]; halfSizes: Vec3 } {
    const wm = entity.transform.getWorldMatrix();
    const scale = mat4GetScale(wm);
    const sx = scale[0] || 1;
    const sy = scale[1] || 1;
    const sz = scale[2] || 1;
    
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

  private intersectRayPlane(ray: Ray, planeOrigin: Vec3, planeNormal: Vec3): Vec3 | null {
    const denom = dotVec3(planeNormal, ray.direction);
    if (Math.abs(denom) < 1e-6) return null;
    const diff = [
      planeOrigin[0] - ray.origin[0],
      planeOrigin[1] - ray.origin[1],
      planeOrigin[2] - ray.origin[2]
    ] as Vec3;
    const t = dotVec3(diff, planeNormal) / denom;
    if (t < 0) return null;
    
    return [
      ray.origin[0] + ray.direction[0] * t,
      ray.origin[1] + ray.direction[1] * t,
      ray.origin[2] + ray.direction[2] * t
    ];
  }
}

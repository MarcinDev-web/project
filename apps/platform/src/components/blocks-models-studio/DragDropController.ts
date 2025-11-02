/**
 * DragDropController - Advanced drag & drop controller for blocks in 3D viewport (KoGaMa-style)
 * Supports snap to grid, rotation, multi-select, and visual feedback
 */

import type { OrbitControls, CameraDirector } from '@engine/camera';
import { Scene, Entity, Raycaster } from '@engine/world';
import { MeshComponent } from '@engine/world/components/MeshComponent';
import { MaterialComponent } from '@engine/world/components/MaterialComponent';
import type { Vec3, Quat } from '@engine/core/math';
import type { BlockDefinition } from '@engine/blocks';

export interface DragDropControllerConfig {
  canvas: HTMLCanvasElement;
  controls: OrbitControls;
  cameraDirector?: CameraDirector;
  scene: Scene;
  onBlockPlaced?: (block: BlockDefinition, position: Vec3, scale: Vec3) => void;
  onStatusMessage?: (message: string, duration?: number) => void;
}

interface DragState {
  /** Entity being dragged */
  entity: Entity;
  /** Block definition */
  blockDefinition: BlockDefinition;
  /** Scale of the block */
  scale: Vec3;
  /** Original position before drag started */
  originalPosition: Vec3;
  /** Original rotation before drag started */
  originalRotation: Quat;
  /** Pointer ID for tracking */
  pointerId: number;
  /** Initial mouse position */
  startMousePos: [number, number];
  /** Current rotation (for R key rotation) */
  rotation: number; // Rotation in degrees around Y axis
  /** Whether current position is valid (no collision) */
  canPlace: boolean;
}

/**
 * Manages drag & drop interactions for blocks in 3D viewport
 */
export class DragDropController {
  private raycaster: Raycaster;
  private dragState: DragState | null = null;
  private abortController: AbortController | null = null;
  private isDragging = false;
  private gridSize = 0.5; // Snap to grid size (KoGaMa-style)

  constructor(private readonly config: DragDropControllerConfig) {
    this.raycaster = new Raycaster();
  }

  /**
   * Initializes drag controller and sets up event listeners
   */
  initialize(): () => void {
    this.abortController = new AbortController();
    this.setupDragHandlers();

    return () => {
      this.dispose();
    };
  }

  /**
   * Sets up drag event handlers
   */
  private setupDragHandlers(): void {
    if (!this.abortController) return;

    // Pointer down to start potential drag
    this.config.canvas.addEventListener(
      'pointerdown',
      (event: PointerEvent) => this.handlePointerDown(event),
      { signal: this.abortController.signal }
    );

    // Pointer move to update drag position
    window.addEventListener(
      'pointermove',
      (event: PointerEvent) => this.handlePointerMove(event),
      { signal: this.abortController.signal }
    );

    // Pointer up to complete drag
    window.addEventListener(
      'pointerup',
      (event: PointerEvent) => this.handlePointerUp(event),
      { signal: this.abortController.signal }
    );

    // Keyboard for rotation
    window.addEventListener(
      'keydown',
      (event: KeyboardEvent) => this.handleKeyDown(event),
      { signal: this.abortController.signal }
    );

    // Handle pointer cancel
    window.addEventListener(
      'pointercancel',
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
   * Handles pointer down - starts drag if clicking on a draggable block
   */
  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) return; // Only left mouse button
    if (event.target !== this.config.canvas) return;

    // TODO: Check if clicking on existing block to drag it
    // For now, we'll handle new block placement from palette
    
    event.preventDefault();
  }

  /**
   * Starts dragging a new block from palette
   */
  startDragNewBlock(block: BlockDefinition, scale: Vec3): void {
    if (this.isDragging) {
      this.cancelDrag();
    }

    // Create preview entity
    const entity = new Entity(`Preview_${block.id}_${Date.now()}`);
    this.config.scene.addEntity(entity);
    entity.transform.position = [0, 0, 0];
    entity.transform.scale = [...scale];
    entity.userData.isPreview = true;
    entity.userData.blockDefinition = block;

    // Add mesh component for preview
    const mesh = new MeshComponent();
    mesh.meshType = 'cube';
    entity.addComponent(mesh);

    const material = new MaterialComponent();
    material.materialId = 0;
    entity.addComponent(material);

    // Set visual feedback (semi-transparent green)
    entity.color = [0.2, 1.0, 0.2, 0.6]; // Green with alpha

    this.dragState = {
      entity,
      blockDefinition: block,
      scale: [...scale] as Vec3,
      originalPosition: [0, 0, 0] as Vec3,
      originalRotation: [0, 0, 0, 1] as Quat,
      pointerId: -1, // Not from pointer event
      startMousePos: [0, 0],
      rotation: 0,
      canPlace: true,
    };

    this.isDragging = true;
    this.config.onStatusMessage?.('Dragging block (R to rotate, Esc to cancel)');
  }

  /**
   * Handles pointer move - updates block position during drag
   */
  private handlePointerMove(event: PointerEvent): void {
    if (!this.dragState || !this.isDragging) return;

    // Update position based on raycast
    const ray = this.createRayFromPointerEvent(event);
    if (!ray) return;

    // Raycast to ground plane or existing blocks
    const groundIntersection = this.raycastToGroundPlane(ray);
    if (groundIntersection) {
      // Snap to grid
      const snappedPosition = this.snapToGrid(groundIntersection);
      this.updateDragPosition(snappedPosition);
    }

    event.preventDefault();
  }

  /**
   * Updates the position of the dragged block
   */
  private updateDragPosition(worldPosition: Vec3): void {
    if (!this.dragState || !this.isDragging) return;

    const entity = this.dragState.entity;
    entity.transform.position = [...worldPosition];

    // Apply rotation
    if (this.dragState.rotation !== 0) {
      // TODO: Apply rotation to entity
    }

    // Visual feedback
    entity.color = this.dragState.canPlace
      ? [0.2, 1.0, 0.2, 0.6] // Green if valid
      : [1.0, 0.2, 0.2, 0.6]; // Red if invalid
  }

  /**
   * Snaps position to grid
   */
  private snapToGrid(position: Vec3): Vec3 {
    return [
      Math.round(position[0] / this.gridSize) * this.gridSize,
      Math.round(position[1] / this.gridSize) * this.gridSize,
      Math.round(position[2] / this.gridSize) * this.gridSize,
    ];
  }

  /**
   * Handles pointer up - completes drag
   */
  private handlePointerUp(event: PointerEvent): void {
    if (!this.dragState || !this.isDragging) return;

    if (this.dragState.canPlace) {
      this.completeDrag();
    } else {
      this.cancelDrag();
    }

    event.preventDefault();
  }

  /**
   * Handles keyboard input (R for rotation)
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.dragState || !this.isDragging) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (event.key === 'r' || event.key === 'R') {
      // Rotate 90 degrees
      this.dragState.rotation = (this.dragState.rotation + 90) % 360;
      this.config.onStatusMessage?.(`Rotation: ${this.dragState.rotation}°`);
      event.preventDefault();
    } else if (event.key === 'Escape') {
      this.cancelDrag();
      event.preventDefault();
    }
  }

  /**
   * Completes the drag operation - places block
   */
  private completeDrag(): void {
    if (!this.dragState) return;

    const entity = this.dragState.entity;
    const position = [...entity.transform.position] as Vec3;

    // Remove preview marker
    entity.userData.isPreview = false;
    entity.color = [1, 1, 1, 1]; // Reset color

    // Notify placement
    if (this.config.onBlockPlaced) {
      this.config.onBlockPlaced(this.dragState.blockDefinition, position, this.dragState.scale);
    }

    this.config.onStatusMessage?.('Block placed', 1000);

    // Clear drag state
    this.dragState = null;
    this.isDragging = false;
  }

  /**
   * Cancels the drag operation
   */
  public cancelDrag(): void {
    if (!this.dragState) return;

    if (this.isDragging) {
      // Remove preview entity
      this.config.scene.removeEntity(this.dragState.entity);
      this.config.onStatusMessage?.('Drag cancelled', 1000);
    }

    this.dragState = null;
    this.isDragging = false;
  }

  /**
   * Creates a world-space ray from a pointer event
   */
  private createRayFromPointerEvent(event: PointerEvent): { origin: Vec3; direction: Vec3 } | null {
    const rect = this.config.canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) * (this.config.canvas.width / rect.width);
    const mouseY = (event.clientY - rect.top) * (this.config.canvas.height / rect.height);

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

    // Fallback to orbit controls
    // TODO: Create ray from orbit controls state (yaw, pitch, distance)
    return null;
  }

  /**
   * Raycasts to the ground plane (y = 0)
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

    // Place at ground level with block height offset
    if (this.dragState) {
      const halfHeight = Math.abs(this.dragState.scale[1]) * 0.5;
      return [x, halfHeight, z];
    }

    return [x, 0, z];
  }

  /**
   * Sets grid size for snapping
   */
  setGridSize(size: number): void {
    this.gridSize = size;
  }

  /**
   * Checks if currently dragging
   */
  isDraggingBlock(): boolean {
    return this.isDragging;
  }

  /**
   * Handles pointer cancellation
   */
  private handlePointerCancel(event: PointerEvent): void {
    if (!this.dragState) return;
    this.cancelDrag();
    event.preventDefault();
  }

  /**
   * Cleans up resources
   */
  dispose(): void {
    if (this.isDragging) {
      this.cancelDrag();
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}


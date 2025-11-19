import type { Vec3, Quat } from '@engine/core/math';
import { quatFromAxisAngle, quatMultiply } from '@engine/core/math';
import type { SelectionManager, Entity } from '@engine/world';
import type { EditorState } from '../core/state';
import type { SnapSystem } from '@engine/editor-utils';
import { GizmoRenderer } from './GizmoRenderer';
import type {
  AxisKey,
  PlaneKey,
  HandleKey,
  GizmoState,
  GizmoMode,
  TransformSpace,
} from './GizmoTypes';
import { DEFAULT_GIZMO_CONFIG } from './GizmoTypes';
import {
  calculateScreenSpaceScale,
  calculateViewAngle,
  calculateAxisOpacity,
  calculateCenterPoint,
  transformDirectionByRotation,
} from './GizmoMath';

// Temporary variables to avoid allocations in hot paths
const TEMP_VEC3_A: Vec3 = [0, 0, 0];
const TEMP_VEC3_B: Vec3 = [0, 0, 0];
const TEMP_VEC3_C: Vec3 = [0, 0, 0];

export interface GizmoControllerOptions {
  state: EditorState;
  selection: SelectionManager;
  canvas: HTMLCanvasElement;
  projectWorldToScreen: (world: Vec3) => { x: number; y: number } | null;
  snapSystem: SnapSystem | null;
  updateSceneBuffers: () => void;
  setControlsEnabled: (enabled: boolean) => void;
  getCameraPosition?: () => Vec3;
  getCameraRotation?: () => Quat;
  /** Called when transform changes (for replication) */
  onTransformChanged?: (entity: Entity) => void;
}

/**
 * Enhanced Gizmo Controller with multi-axis movement, adaptive sizing,
 * improved visuals, and better UX.
 */
export class GizmoController {
  private renderer: GizmoRenderer;
  private eventListeners: Array<{ element: Element; type: string; handler: EventListener }> = [];
  private activePointerCleanup: (() => void) | null = null;
  private gizmoState: GizmoState | null = null;
  
  // Performance: dirty flags
  private needsUpdate = true;
  private lastSelectionId: string | null = null;
  private lastCameraPos: Vec3 | null = null;
  
  // Transform space
  private transformSpace: TransformSpace = 'world';

  constructor(private readonly options: GizmoControllerOptions) {
    this.renderer = new GizmoRenderer(DEFAULT_GIZMO_CONFIG);
  }

  public mount(): void {
    this.renderer.mount();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Axis handles
    (['x', 'y', 'z'] as AxisKey[]).forEach((axis) => {
      const visual = this.renderer.axisVisuals[axis];
      const handler: EventListener = (event: Event) => {
        const pe = event as PointerEvent;
        if (pe.button !== 0) return;
        this.startDrag(axis, pe);
      };
      visual.group.addEventListener('pointerdown', handler);
      this.eventListeners.push({ element: visual.group, type: 'pointerdown', handler });
    });

    // Plane handles
    (['xy', 'xz', 'yz'] as PlaneKey[]).forEach((plane) => {
      const visual = this.renderer.planeVisuals[plane];
      const handler: EventListener = (event: Event) => {
        const pe = event as PointerEvent;
        if (pe.button !== 0) return;
        this.startDrag(plane, pe);
      };
      visual.group.addEventListener('pointerdown', handler);
      this.eventListeners.push({ element: visual.group, type: 'pointerdown', handler });
    });

    // Center handle
    const centerHandler: EventListener = (event: Event) => {
      const pe = event as PointerEvent;
      if (pe.button !== 0) return;
      this.startDrag('center', pe);
    };
    this.renderer.centerVisual.element.addEventListener('pointerdown', centerHandler);
    this.eventListeners.push({
      element: this.renderer.centerVisual.element,
      type: 'pointerdown',
      handler: centerHandler,
    });

    // Hover detection
    const container = document.getElementById('gizmo-container');
    if (container) {
      const hoverHandler: EventListener = (event: Event) => {
        const me = event as MouseEvent;
        if (this.gizmoState) return; // Don't update hover during drag
        
        const handle = this.renderer.getHandleAtPosition(me.clientX, me.clientY);
        this.renderer.setHoveredHandle(handle);
      };
      container.addEventListener('pointermove', hoverHandler);
      this.eventListeners.push({ element: container, type: 'pointermove', handler: hoverHandler });
    }
  }

  public updateOverlay(): void {
    const selected = this.getSelectedEntities();
    
    if (selected.length === 0) {
      this.renderer.setVisible(false);
      this.gizmoState = null;
      this.options.setControlsEnabled(true);
      this.lastSelectionId = null;
      return;
    }

    // Get world position (center for multi-selection)
    const worldPosition = this.getGizmoPosition(selected);
    
    // Check if we need to update (dirty flag optimization)
    const selectionId = selected.map((e) => e.id).join(',');
    const cameraPos = this.options.getCameraPosition?.() ?? [0, 0, 0];
    
    const selectionChanged = selectionId !== this.lastSelectionId;
    const cameraMoved = this.hasCameraMoved(cameraPos);
    
    if (!this.needsUpdate && !selectionChanged && !cameraMoved && !this.gizmoState) {
      return; // Skip update
    }

    this.lastSelectionId = selectionId;
    this.lastCameraPos = [...cameraPos];
    this.needsUpdate = false;

    // Project to screen
    const base = this.options.projectWorldToScreen(worldPosition);
    if (!base) {
      this.renderer.setVisible(false);
      return;
    }

    const rect = this.options.canvas.getBoundingClientRect();
    const originX = rect.left + (base.x / this.options.canvas.width) * rect.width;
    const originY = rect.top + (base.y / this.options.canvas.height) * rect.height;

    this.renderer.setVisible(true);

    // Calculate adaptive scale
    const scale = calculateScreenSpaceScale(worldPosition, cameraPos, 60);
    const axisLength = DEFAULT_GIZMO_CONFIG.axisLength * (scale / 10); // Normalize scale

    // Update axes
    const primary = selected[0];
    if (primary) {
      this.updateAxes(worldPosition, originX, originY, rect, axisLength, primary);
    }

    // Update plane handles
    this.updatePlanes(originX, originY, axisLength);

    // Update center (for uniform scale)
    const mode = this.options.state.gizmoMode.value ?? 'translate';
    const showCenter = mode === 'scale' || mode === 'uniform';
    this.renderer.updateCenterVisual(originX, originY, showCenter);
  }

  private updateAxes(
    worldPosition: Vec3,
    originX: number,
    originY: number,
    rect: DOMRect,
    axisLength: number,
    primaryEntity: Entity
  ): void {
    const cameraRot = this.options.getCameraRotation?.() ?? [0, 0, 0, 1];
    
    // Camera forward for visibility calculation
    // Optimized: reuse TEMP_VEC3_A instead of allocating new array
    TEMP_VEC3_A[0] = -2 * (cameraRot[0] * cameraRot[2] + cameraRot[3] * cameraRot[1]);
    TEMP_VEC3_A[1] = -2 * (cameraRot[1] * cameraRot[2] - cameraRot[3] * cameraRot[0]);
    TEMP_VEC3_A[2] = -(1 - 2 * (cameraRot[0] * cameraRot[0] + cameraRot[1] * cameraRot[1]));
    const cameraForward = TEMP_VEC3_A;

    (['x', 'y', 'z'] as AxisKey[]).forEach((axis) => {
      const visual = this.renderer.axisVisuals[axis];
      
      // Get world direction (transform by entity rotation if local space)
      let worldDir = visual.worldDir;
      if (this.transformSpace === 'local' && primaryEntity) {
        worldDir = transformDirectionByRotation(
          visual.worldDir,
          primaryEntity.transform.rotation as Quat
        );
      }

      // Optimized: reuse TEMP_VEC3_B for target position
      TEMP_VEC3_B[0] = worldPosition[0] + worldDir[0] * axisLength;
      TEMP_VEC3_B[1] = worldPosition[1] + worldDir[1] * axisLength;
      TEMP_VEC3_B[2] = worldPosition[2] + worldDir[2] * axisLength;
      const target = TEMP_VEC3_B;

      const screen = this.options.projectWorldToScreen(target);
      if (!screen) {
        visual.group.style.display = 'none';
        return;
      }

      const targetX = rect.left + (screen.x / this.options.canvas.width) * rect.width;
      const targetY = rect.top + (screen.y / this.options.canvas.height) * rect.height;

      // Calculate visibility/opacity based on angle to camera
      const viewAngle = calculateViewAngle(worldDir, cameraForward);
      const opacity = calculateAxisOpacity(viewAngle, DEFAULT_GIZMO_CONFIG.fadeAngleThreshold);

      this.renderer.updateAxisVisual(axis, originX, originY, targetX, targetY, opacity);
    });
  }

  private updatePlanes(originX: number, originY: number, axisLength: number): void {
    const mode = this.options.state.gizmoMode.value ?? 'translate';
    const showPlanes = mode === 'translate';

    if (!showPlanes) {
      (['xy', 'xz', 'yz'] as PlaneKey[]).forEach((plane) => {
        this.renderer.updatePlaneVisual(plane, 0, 0, false);
      });
      return;
    }

    (['xy', 'xz', 'yz'] as PlaneKey[]).forEach((plane) => {
      const visual = this.renderer.planeVisuals[plane];
      const [axis1, axis2] = visual.axes;
      
      const axis1Visual = this.renderer.axisVisuals[axis1];
      const axis2Visual = this.renderer.axisVisuals[axis2];
      
      // Only show plane if both axes are visible
      if (axis1Visual.screenLength < 10 || axis2Visual.screenLength < 10) {
        this.renderer.updatePlaneVisual(plane, 0, 0, false);
        return;
      }

      // Position plane at 1/3 distance along both axes
      const offset1 = (axis1Visual.screenDir[0] * axisLength * 0.33);
      const offset2 = (axis1Visual.screenDir[1] * axisLength * 0.33);
      const offset3 = (axis2Visual.screenDir[0] * axisLength * 0.33);
      const offset4 = (axis2Visual.screenDir[1] * axisLength * 0.33);
      
      const planeX = originX + offset1 + offset3;
      const planeY = originY + offset2 + offset4;

      this.renderer.updatePlaneVisual(plane, planeX, planeY, true);
    });
  }

  private startDrag(handle: HandleKey, event: PointerEvent): void {
    const selected = this.getSelectedEntities();
    if (selected.length === 0) return;
    const primary = selected[0];
    if (!primary) return;

    // Cleanup any existing drag
    if (this.activePointerCleanup) {
      this.activePointerCleanup();
      this.activePointerCleanup = null;
    }

    this.options.setControlsEnabled(false);
    this.renderer.setActiveHandle(handle);

    const originalPosition = this.getGizmoPosition(selected);
    const originalRotation = primary.transform.rotation as Quat;
    const originalScale = primary.transform.scale as Vec3;

    // Store original transforms for multi-selection
    const originalPositions = new Map<string, Vec3>();
    const originalRotations = new Map<string, Quat>();
    const originalScales = new Map<string, Vec3>();
    
    selected.forEach((entity) => {
      originalPositions.set(entity.id, [...entity.transform.position]);
      originalRotations.set(entity.id, [...(entity.transform.rotation as Quat)]);
      originalScales.set(entity.id, [...(entity.transform.scale as Vec3)]);
    });

    this.gizmoState = {
      handle,
      pointerId: event.pointerId,
      dragStartMouse: [event.clientX, event.clientY],
      originalPosition: [...originalPosition],
      originalRotation: [...originalRotation],
      originalScale: [...originalScale],
      originalPositions,
      originalRotations,
      originalScales,
      modifiers: {
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
      },
    };

    const onPointerMove = (moveEvent: PointerEvent) => this.handleDrag(moveEvent);
    const finalizePointerSequence = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      this.activePointerCleanup = null;
    };
    
    const onPointerUp = (upEvent: PointerEvent) => {
      if (!this.gizmoState || upEvent.pointerId !== this.gizmoState.pointerId) return;
      finalizePointerSequence();
      this.endDrag();
    };
    
    const onPointerCancel = (cancelEvent: PointerEvent) => {
      if (!this.gizmoState || cancelEvent.pointerId !== this.gizmoState.pointerId) return;
      finalizePointerSequence();
      this.endDrag();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerCancel, { passive: false });
    
    this.activePointerCleanup = finalizePointerSequence;

    event.preventDefault();
    event.stopPropagation();
  }

  private handleDrag(event: PointerEvent): void {
    if (!this.gizmoState) return;

    const selected = this.getSelectedEntities();
    if (selected.length === 0) return;

    // Update modifiers
    this.gizmoState.modifiers = {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
    };

    const deltaX = event.clientX - this.gizmoState.dragStartMouse[0];
    const deltaY = event.clientY - this.gizmoState.dragStartMouse[1];

    const mode = this.options.state.gizmoMode.value ?? 'translate';
    const handle = this.gizmoState.handle;

    // Apply transformation based on handle type
    if (handle === 'x' || handle === 'y' || handle === 'z') {
      this.handleAxisDrag(handle, deltaX, deltaY, mode, selected, event);
    } else if (handle === 'xy' || handle === 'xz' || handle === 'yz') {
      this.handlePlaneDrag(handle, deltaX, deltaY, selected, event);
    } else if (handle === 'center') {
      this.handleUniformScale(deltaX, deltaY, selected, event);
    }

    this.options.updateSceneBuffers();
    this.needsUpdate = true;
    requestAnimationFrame(() => this.updateOverlay());

    event.preventDefault();
  }

  private handleAxisDrag(
    axis: AxisKey,
    deltaX: number,
    deltaY: number,
    mode: GizmoMode,
    selected: Entity[],
    pointerEvent: PointerEvent
  ): void {
    if (!this.gizmoState) return;
    const primary = selected[0];
    if (!primary) return;

    const visual = this.renderer.axisVisuals[axis];
    if (visual.screenLength <= 0) return;

    const projected = deltaX * visual.screenDir[0] + deltaY * visual.screenDir[1];
    let worldDelta = projected / visual.screenLength;

    // Apply precision modifier (Shift = 10x finer)
    if (this.gizmoState.modifiers.shift) {
      worldDelta /= 10;
    }

    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

    if (mode === 'translate') {
      const next = [...this.gizmoState.originalPosition] as Vec3;
      next[axisIndex] = this.gizmoState.originalPosition[axisIndex] + worldDelta;

      const snappingEnabled =
        this.gizmoState.modifiers.ctrl
          ? !this.options.state.snapConfig.value.enabled
          : this.options.state.snapConfig.value.enabled;

      const finalPos = snappingEnabled && this.options.snapSystem
        ? this.options.snapSystem.snapPosition(next)
        : next;

      // Apply to all selected entities
      if (selected.length === 1) {
        primary.transform.position = finalPos;
      } else {
        const delta: Vec3 = [
          finalPos[0] - this.gizmoState.originalPosition[0],
          finalPos[1] - this.gizmoState.originalPosition[1],
          finalPos[2] - this.gizmoState.originalPosition[2],
        ];
        selected.forEach((entity) => {
          const orig = this.gizmoState!.originalPositions!.get(entity.id)!;
          entity.transform.position = [orig[0] + delta[0], orig[1] + delta[1], orig[2] + delta[2]];
        });
      }

      // Show value display
      this.renderer.showValueDisplay(
        `${axis.toUpperCase()}: ${finalPos[axisIndex].toFixed(2)}`,
        pointerEvent.clientX,
        pointerEvent.clientY
      );
    } else if (mode === 'scale') {
      const nextScale = [...this.gizmoState.originalScale] as Vec3;
      nextScale[axisIndex] = Math.max(0.001, this.gizmoState.originalScale[axisIndex] + worldDelta);

      const snappingEnabled = this.gizmoState.modifiers.ctrl
        ? !this.options.state.snapConfig.value.enabled
        : this.options.state.snapConfig.value.enabled;

      const finalScale = snappingEnabled && this.options.snapSystem
        ? this.options.snapSystem.snapScale(nextScale)
        : nextScale;

      selected.forEach((entity) => {
        entity.transform.scale = [...finalScale];
      });

      this.renderer.showValueDisplay(
        `Scale ${axis.toUpperCase()}: ${finalScale[axisIndex].toFixed(2)}`,
        pointerEvent.clientX,
        pointerEvent.clientY
      );
    } else if (mode === 'rotate') {
      const angle = worldDelta * Math.PI;
      const axisVec: Vec3 = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
      const deltaQuat = quatFromAxisAngle(axisVec, angle);
      const newRotation = quatMultiply(this.gizmoState.originalRotation, deltaQuat);

      const snappingEnabled = this.gizmoState.modifiers.ctrl
        ? !this.options.state.snapConfig.value.enabled
        : this.options.state.snapConfig.value.enabled;

      const finalRot = snappingEnabled && this.options.snapSystem
        ? this.options.snapSystem.snapRotation(newRotation)
        : newRotation;

      selected.forEach((entity) => {
        entity.transform.rotation = [...finalRot];
      });

      const degrees = ((angle * 180) / Math.PI).toFixed(0);
      this.renderer.showValueDisplay(
        `Rotate ${axis.toUpperCase()}: ${degrees}°`,
        pointerEvent.clientX,
        pointerEvent.clientY
      );
    }
  }

  private handlePlaneDrag(
    plane: PlaneKey,
    deltaX: number,
    deltaY: number,
    selected: Entity[],
    pointerEvent: PointerEvent
  ): void {
    if (!this.gizmoState) return;
    const primary = selected[0];
    if (!primary) return;

    const [axis1, axis2] = this.renderer.planeVisuals[plane].axes;
    const visual1 = this.renderer.axisVisuals[axis1];
    const visual2 = this.renderer.axisVisuals[axis2];

    if (visual1.screenLength <= 0 || visual2.screenLength <= 0) return;

    // Project onto both axes
    const projected1 = (deltaX * visual1.screenDir[0] + deltaY * visual1.screenDir[1]) / visual1.screenLength;
    const projected2 = (deltaX * visual2.screenDir[0] + deltaY * visual2.screenDir[1]) / visual2.screenLength;

    const axis1Index = axis1 === 'x' ? 0 : axis1 === 'y' ? 1 : 2;
    const axis2Index = axis2 === 'x' ? 0 : axis2 === 'y' ? 1 : 2;

    const next = [...this.gizmoState.originalPosition] as Vec3;
    next[axis1Index] = this.gizmoState.originalPosition[axis1Index] + projected1;
    next[axis2Index] = this.gizmoState.originalPosition[axis2Index] + projected2;

    const snappingEnabled = this.gizmoState.modifiers.ctrl
      ? !this.options.state.snapConfig.value.enabled
      : this.options.state.snapConfig.value.enabled;

    const finalPos = snappingEnabled && this.options.snapSystem
      ? this.options.snapSystem.snapPosition(next)
      : next;

    // Apply to all selected
    if (selected.length === 1) {
      primary.transform.position = finalPos;
    } else {
      const delta: Vec3 = [
        finalPos[0] - this.gizmoState.originalPosition[0],
        finalPos[1] - this.gizmoState.originalPosition[1],
        finalPos[2] - this.gizmoState.originalPosition[2],
      ];
      selected.forEach((entity) => {
        const orig = this.gizmoState!.originalPositions!.get(entity.id)!;
        entity.transform.position = [orig[0] + delta[0], orig[1] + delta[1], orig[2] + delta[2]];
      });
    }

    this.renderer.showValueDisplay(
      `${plane.toUpperCase()}: (${finalPos[axis1Index].toFixed(2)}, ${finalPos[axis2Index].toFixed(2)})`,
      pointerEvent.clientX,
      pointerEvent.clientY
    );
  }

  private handleUniformScale(
    deltaX: number,
    deltaY: number,
    selected: Entity[],
    pointerEvent: PointerEvent
  ): void {
    if (!this.gizmoState) return;

    const distance = Math.hypot(deltaX, deltaY);
    const direction = Math.sign(deltaX + deltaY);
    const scaleDelta = (distance / 100) * direction;

    const baseScale = this.gizmoState.originalScale;
    const newScale: Vec3 = [
      Math.max(0.001, baseScale[0] + scaleDelta),
      Math.max(0.001, baseScale[1] + scaleDelta),
      Math.max(0.001, baseScale[2] + scaleDelta),
    ];

    selected.forEach((entity) => {
      entity.transform.scale = [...newScale];
    });

    this.renderer.showValueDisplay(
      `Uniform Scale: ${newScale[0].toFixed(2)}`,
      pointerEvent.clientX,
      pointerEvent.clientY
    );
  }

  private endDrag(): void {
    if (!this.gizmoState) {
      this.options.setControlsEnabled(true);
      return;
    }

    // Replicate transform changes for all affected entities
    const selected = this.getSelectedEntities();
    if (this.options.onTransformChanged) {
      selected.forEach((entity) => {
        this.options.onTransformChanged?.(entity);
      });
    }

    this.renderer.setActiveHandle(null);
    this.renderer.hideValueDisplay(300);
    
    this.gizmoState = null;
    this.options.setControlsEnabled(true);
    this.needsUpdate = true;
    
    window.dispatchEvent(new CustomEvent('editor:gizmo:changed'));
  }

  private getSelectedEntities(): Entity[] {
    const primary = this.options.selection.primarySelection;
    if (!primary) return [];
    
    const all = Array.from(this.options.selection.selectedEntities);
    return all.length > 0 ? all : [primary];
  }

  private getGizmoPosition(entities: Entity[]): Vec3 {
    const [first] = entities;
    if (!first) {
      return [0, 0, 0];
    }

    if (entities.length === 1) {
      return first.transform.getWorldPosition();
    }
    
    const positions = entities.map((e) => e.transform.getWorldPosition());
    return calculateCenterPoint(positions);
  }

  private hasCameraMoved(currentPos: Vec3): boolean {
    if (!this.lastCameraPos) return true;
    
    const threshold = 0.01;
    return (
      Math.abs(currentPos[0] - this.lastCameraPos[0]) > threshold ||
      Math.abs(currentPos[1] - this.lastCameraPos[1]) > threshold ||
      Math.abs(currentPos[2] - this.lastCameraPos[2]) > threshold
    );
  }

  /**
   * Set transform space (world or local).
   */
  public setTransformSpace(space: TransformSpace): void {
    this.transformSpace = space;
    this.needsUpdate = true;
  }

  /**
   * Force an update on next frame.
   */
  public invalidate(): void {
    this.needsUpdate = true;
  }

  /**
   * Check if gizmo is currently being dragged.
   */
  public isDragging(): boolean {
    return this.gizmoState !== null;
  }

  public dispose(): void {
    if (this.activePointerCleanup) {
      this.activePointerCleanup();
      this.activePointerCleanup = null;
    }

    // Remove registered DOM listeners
    for (const { element, type, handler } of this.eventListeners) {
      try {
        element.removeEventListener(type, handler);
      } catch {
        // ignore
      }
    }
    this.eventListeners = [];

    // Dispose renderer
    this.renderer.dispose();

    // Reset state and re-enable controls as a safety
    this.gizmoState = null;
    try {
      this.options.setControlsEnabled(true);
    } catch {}
  }
}

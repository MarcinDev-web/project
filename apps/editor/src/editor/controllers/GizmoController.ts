import type { Vec3, Quat } from '@engine/core/math';
import { 
  quatFromAxisAngle, quatMultiply, subVec3, addVec3, scaleVec3, 
  normalizeVec3, dotVec3, crossVec3, lengthVec3 
} from '@engine/core/math';
import type { SelectionManager, Entity, Scene, Ray } from '@engine/world';
import type { EditorState } from '../core/state';
import type { SnapSystem } from '@engine/editor-utils';
import { GizmoMeshRenderer } from './GizmoMeshRenderer';
import type {
  HandleKey,
  GizmoState,
  TransformSpace,
  PlaneKey
} from './GizmoTypes';
import {
  calculateCenterPoint,
  calculateScreenSpaceScale,
  transformDirectionByRotation
} from './GizmoMath';
import { Raycaster } from '@engine/world';
import type { InteractionTool } from '../input/InteractionTypes';

export interface GizmoControllerOptions {
  state: EditorState;
  selection: SelectionManager;
  canvas: HTMLCanvasElement;
  scene: Scene;
  projectWorldToScreen: (world: Vec3) => { x: number; y: number } | null;
  snapSystem: SnapSystem | null;
  updateSceneBuffers: () => void;
  setControlsEnabled: (enabled: boolean) => void;
  getCameraPosition?: () => Vec3;
  getCameraRotation?: () => Quat;
  onTransformChanged?: (entity: Entity) => void;
}

interface ExtendedGizmoState extends GizmoState {
  dragPlaneNormal: Vec3;
  dragStartPoint: Vec3; // World space intersection point at start
  startAngle?: number; // For rotation
}

export class GizmoController implements InteractionTool {
  public readonly name = 'GizmoTool';
  private renderer: GizmoMeshRenderer;
  private gizmoState: ExtendedGizmoState | null = null;
  
  private raycaster = new Raycaster();
  
  private transformSpace: TransformSpace = 'world';

  constructor(private readonly options: GizmoControllerOptions) {
    this.renderer = new GizmoMeshRenderer(options.scene);
  }

  // InteractionTool implementation
  
  public checkHit(ray: Ray): boolean {
    // Used for hover and to determine if click should start drag
    return this.raycast(ray) !== null;
  }

  public onPointerDown(event: PointerEvent, ray: Ray): void {
    const hit = this.raycast(ray);
    if (hit) {
      this.startDrag(hit, event, ray);
    }
  }

  public onPointerMove(event: PointerEvent, ray: Ray): void {
    if (this.gizmoState) {
      this.handleDrag(event, ray);
    } else {
      // Hover logic
      const hit = this.raycast(ray);
      
      if (hit !== this.hoveredHandle) {
          this.hoveredHandle = hit;
          this.renderer.setHighlight(hit);
          this.options.canvas.style.cursor = hit ? 'pointer' : 'default';
      }
    }
  }

  public onPointerUp(_event: PointerEvent, _ray: Ray): void {
    if (this.gizmoState) {
      this.endDrag();
    }
  }

  public cancel(): void {
    this.endDrag();
  }

  private hoveredHandle: HandleKey | null = null;

  private raycast(ray: Ray): HandleKey | null {
    const pickables = this.renderer.getPickableEntities();
    if (pickables.length === 0) return null;

    const hit = this.raycaster.raycastClosest(ray, pickables);
    if (hit) {
        return this.renderer.getEntityHandle(hit.entity.id) ?? null;
    }
    return null;
  }

  public updateOverlay(): void {
    const selected = this.getSelectedEntities();
    
    if (selected.length === 0) {
      this.renderer.setVisible(false);
      this.gizmoState = null;
      this.options.setControlsEnabled(true);
      return;
    }

    const worldPosition = this.getGizmoPosition(selected);
    const cameraPos = this.options.getCameraPosition?.() ?? [0, 0, 0];
    const scale = calculateScreenSpaceScale(worldPosition, cameraPos, 60);
    
    let rotation: Quat = [0, 0, 0, 1];
    const firstEntity = selected[0];
    if (this.transformSpace === 'local' && firstEntity) {
        rotation = firstEntity.transform.rotation as Quat;
    }

    this.renderer.setTransformSpace(this.transformSpace);
    this.renderer.setMode(this.options.state.gizmoMode.value ?? 'translate');
    this.renderer.update(worldPosition, rotation, scale);
    this.renderer.setVisible(true);
  }

  private startDrag(handle: HandleKey, event: PointerEvent, ray: Ray): void {
    const selected = this.getSelectedEntities();
    if (selected.length === 0) return;
    const primary = selected[0];
    if (!primary) return;

    this.options.setControlsEnabled(false);
    this.renderer.setHighlight(handle);

    const originalPosition = this.getGizmoPosition(selected);
    const originalRotation = primary.transform.rotation as Quat;
    const originalScale = primary.transform.scale as Vec3;

    const originalPositions = new Map<string, Vec3>();
    const originalRotations = new Map<string, Quat>();
    const originalScales = new Map<string, Vec3>();
    
    selected.forEach((entity) => {
      originalPositions.set(entity.id, [...entity.transform.position]);
      originalRotations.set(entity.id, [...(entity.transform.rotation as Quat)]);
      originalScales.set(entity.id, [...(entity.transform.scale as Vec3)]);
    });

    // Calculate drag plane normal and start intersection
    const cameraPos = this.options.getCameraPosition?.() ?? [0, 0, 0];
    const toCamera = normalizeVec3(subVec3(cameraPos, originalPosition));
    let dragPlaneNormal: Vec3 = [0, 1, 0];
    
    // For rotation, plane is the ring plane
    if (this.options.state.gizmoMode.value === 'rotate') {
        const axis = this.getHandleAxis(handle, originalRotation);
        if (axis) dragPlaneNormal = axis;
    } 
    // For translation/scale axes, plane contains axis and faces camera
    else if (['x', 'y', 'z'].includes(handle)) {
         const axis = this.getHandleAxis(handle, originalRotation);
         if (axis) {
             const cross = crossVec3(axis, toCamera);
             dragPlaneNormal = crossVec3(cross, axis);
             normalizeVec3(dragPlaneNormal); // Re-normalize
         }
    }
    // For planes (xy, xz, yz), use plane normal
    else if (['xy', 'xz', 'yz'].includes(handle)) {
         dragPlaneNormal = this.getPlaneNormal(handle as PlaneKey, originalRotation);
    }
    
    // Calculate start point
    const hit = this.intersectRayPlane(ray, originalPosition, dragPlaneNormal);
    if (!hit) {
        // Fallback if ray parallel to plane (should affect dragging behavior?)
        // Just use projection on line closest point?
        return; 
    }

    const startAngle = 0; // Placeholder
    // if (this.options.state.gizmoMode.value === 'rotate') {
    //     // Calculate angle relative to local axis
    //     // const localHit = subVec3(hit, originalPosition);
    //     // We need a reference vector on the plane. 
    //     // Just store current angle? 
    //     // Or project hit to local 2D plane basis?
    //     // Simplified: we compute delta angle from start point.
    // }

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
      dragPlaneNormal,
      dragStartPoint: hit,
      startAngle,
      modifiers: {
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
      },
    };
    
    this.options.canvas.setPointerCapture(event.pointerId);
  }

  private handleDrag(event: PointerEvent, ray: Ray): void {
    if (!this.gizmoState) return;

    const selected = this.getSelectedEntities();
    if (selected.length === 0) return;

    this.gizmoState.modifiers = {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
    };

    const hit = this.intersectRayPlane(ray, this.gizmoState.originalPosition, this.gizmoState.dragPlaneNormal);
    if (!hit) return;

    const mode = this.options.state.gizmoMode.value ?? 'translate';
    const handle = this.gizmoState.handle;

    if (mode === 'translate') {
        const delta = subVec3(hit, this.gizmoState.dragStartPoint);
        
        // If axis constraint, project delta onto axis
        if (['x', 'y', 'z'].includes(handle)) {
            const axis = this.getHandleAxis(handle, this.gizmoState.originalRotation as Quat);
            if (axis) {
                const projection = dotVec3(delta, axis);
                // Overwrite delta with projected vector
                delta[0] = axis[0] * projection;
                delta[1] = axis[1] * projection;
                delta[2] = axis[2] * projection;
            }
        }

        // Apply
        const newPos = addVec3(this.gizmoState.originalPosition, delta);
        
        // Snapping
        const snappingEnabled = this.gizmoState.modifiers.ctrl
          ? !this.options.state.snapConfig.value.enabled
          : this.options.state.snapConfig.value.enabled;
        
        const finalPos = snappingEnabled && this.options.snapSystem
          ? this.options.snapSystem.snapPosition(newPos)
          : newPos;
        
        const finalDelta = subVec3(finalPos, this.gizmoState.originalPosition);

        const firstEntity = selected[0];
        if (selected.length === 1 && firstEntity) {
            firstEntity.transform.position = finalPos;
        } else {
            selected.forEach(e => {
                const orig = this.gizmoState!.originalPositions!.get(e.id)!;
                e.transform.position = addVec3(orig, finalDelta);
            });
        }
    }
    else if (mode === 'rotate') {
        const center = this.gizmoState.originalPosition;
        const startVec = subVec3(this.gizmoState.dragStartPoint, center);
        const currVec = subVec3(hit, center);
        
        // Calculate angle between start and current
        // Axis of rotation
        const axis = this.gizmoState.dragPlaneNormal;
        
        // Project vectors onto plane (redundant if we hit the plane correctly, but good for safety)
        // Cross product gives sine-like, Dot gives cosine-like
        const cross = crossVec3(startVec, currVec);
        const dot = dotVec3(startVec, currVec);
        
        // Angle direction depends on dot(cross, axis)
        const dir = dotVec3(cross, axis) > 0 ? 1 : -1;
        const angle = Math.atan2(lengthVec3(cross), dot) * dir;
        
        // Apply rotation
        const deltaQuat = quatFromAxisAngle(axis, angle);
        
        // Snapping
        // For rotation snapping, we need to accumulate total angle and snap that?
        // Or snap the delta? 
        // Snapping usually works on discrete steps from original rotation.
        // Let's calculate target rotation and snap it.
        
        const newRotation = quatMultiply(this.gizmoState.originalRotation, deltaQuat);
        // This is local rotation accumulation.

        const baseSnapEnabled = this.options.snapSystem?.isEnabled?.() ?? false;
        const rotationSnapEnabled = this.gizmoState.modifiers.ctrl ? !baseSnapEnabled : baseSnapEnabled;
        const snapRotation = (rot: Quat): Quat =>
          rotationSnapEnabled && this.options.snapSystem
            ? this.options.snapSystem.snapRotation(rot)
            : rot;

        const firstEntity = selected[0];
        if (selected.length === 1 && firstEntity) {
            firstEntity.transform.rotation = snapRotation(newRotation);
        } else {
             // Multi-object rotation usually rotates each around its own center or group center?
             // Here we just replicate local rotation.
             selected.forEach(e => {
                 const orig = this.gizmoState!.originalRotations!.get(e.id)!;
                 e.transform.rotation = snapRotation(quatMultiply(orig, deltaQuat));
             });
        }
    }
    else if (mode === 'scale') {
         // Similar to translate but modifying scale
         // Project delta onto axis
         const delta = subVec3(hit, this.gizmoState.dragStartPoint);
         const axis = this.getHandleAxis(handle, this.gizmoState.originalRotation as Quat);
         if (axis) {
             const projection = dotVec3(delta, axis);
             // Use projection to scale
             // We need screen space scale factor? Or world units?
             // Usually 1 unit drag = 1 unit scale change or proportional.
             
             const scaleDelta = projection; // 1 unit world drag = +1 scale
             
             const axisIndex = handle === 'x' ? 0 : handle === 'y' ? 1 : 2;
             const origScale = this.gizmoState.originalScale;
             
             const newScaleVal = Math.max(0.01, origScale[axisIndex] + scaleDelta);
             const newScale = [...origScale] as Vec3;
             newScale[axisIndex] = newScaleVal;
             
             selected.forEach(e => {
                 const orig = this.gizmoState!.originalScales!.get(e.id)!;
                 const ns = [...orig] as Vec3;
                 ns[axisIndex] = Math.max(0.01, orig[axisIndex] + scaleDelta);
                 e.transform.scale = ns;
             });
         }
    }
    
    this.options.updateSceneBuffers();
  }

  private intersectRayPlane(ray: Ray, planeOrigin: Vec3, planeNormal: Vec3): Vec3 | null {
      const denom = dotVec3(planeNormal, ray.direction);
      if (Math.abs(denom) < 1e-6) return null;
      const diff = subVec3(planeOrigin, ray.origin);
      const t = dotVec3(diff, planeNormal) / denom;
      if (t < 0) return null;
      return addVec3(ray.origin, scaleVec3(ray.direction, t));
  }
  
  private getHandleAxis(handle: string, rotation: Quat): Vec3 | null {
      let axis: Vec3 = [0, 0, 0];
      if (handle === 'x') axis = [1, 0, 0];
      else if (handle === 'y') axis = [0, 1, 0];
      else if (handle === 'z') axis = [0, 0, 1];
      else return null;
      
      if (this.transformSpace === 'local') {
           return transformDirectionByRotation(axis, rotation);
      }
      return axis;
  }

  private getPlaneNormal(plane: PlaneKey, rotation: Quat): Vec3 {
      let normal: Vec3;
      if (plane === 'xy') normal = [0, 0, 1];
      else if (plane === 'xz') normal = [0, 1, 0];
      else if (plane === 'yz') normal = [1, 0, 0];
      else normal = [0, 1, 0];
      
      if (this.transformSpace === 'local') {
          return transformDirectionByRotation(normal, rotation);
      }
      return normal;
  }

  private endDrag(): void {
    if (this.gizmoState) {
        this.options.canvas.releasePointerCapture(this.gizmoState.pointerId);
        this.gizmoState = null;
        this.renderer.setHighlight(null);
        this.hoveredHandle = null;
        this.options.setControlsEnabled(true);
        
        const selected = this.getSelectedEntities();
        if (this.options.onTransformChanged) {
            selected.forEach((entity) => {
                this.options.onTransformChanged?.(entity);
            });
        }
    }
  }
  
  private getSelectedEntities(): Entity[] {
    const primary = this.options.selection.primarySelection;
    if (!primary) return [];
    const all = Array.from(this.options.selection.selectedEntities);
    return all.length > 0 ? all : [primary];
  }

  private getGizmoPosition(entities: Entity[]): Vec3 {
    const [first] = entities;
    if (!first) return [0, 0, 0];
    if (entities.length === 1) return first.transform.getWorldPosition();
    const positions = entities.map((e) => e.transform.getWorldPosition());
    return calculateCenterPoint(positions);
  }

  public setTransformSpace(space: TransformSpace): void {
    this.transformSpace = space;
    this.renderer.setTransformSpace(space);
  }
  
  public isDragging(): boolean {
      return !!this.gizmoState;
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}

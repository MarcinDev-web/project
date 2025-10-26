import type { Vec3, Quat } from '@engine/core/math';
import { quatFromAxisAngle, quatMultiply } from '@engine/core/math';
import type { SelectionManager } from '@engine/world';
import type { EditorState } from '../core/state';
import type { SnapSystem } from '../snap/SnapSystem';

type AxisKey = 'x' | 'y' | 'z';

interface AxisVisual {
  group: HTMLElement;
  line: HTMLElement;
  handle: HTMLElement;
  color: string;
  worldDir: Vec3;
  screenDir: [number, number];
  screenLength: number;
}

function createAxisVisual(worldDir: Vec3, color: string): AxisVisual {
  return {
    group: document.createElement('div'),
    line: document.createElement('div'),
    handle: document.createElement('div'),
    color,
    worldDir: [...worldDir] as Vec3,
    screenDir: [1, 0],
    screenLength: 0,
  };
}

export interface GizmoControllerOptions {
  state: EditorState;
  selection: SelectionManager;
  canvas: HTMLCanvasElement;
  projectWorldToScreen: (world: Vec3) => { x: number; y: number } | null;
  snapSystem: SnapSystem | null;
  updateSceneBuffers: () => void;
  setControlsEnabled: (enabled: boolean) => void;
}

export class GizmoController {
  private container: HTMLElement | null = null;
  private eventListeners: Array<{ element: Element; type: string; handler: EventListener }> = [];
  private activePointerCleanup: (() => void) | null = null;
  private gizmoState: {
    axis: AxisKey;
    pointerId: number;
    dragStartMouse: [number, number];
    originalPosition: Vec3;
    originalRotation: Quat;
    originalScale: Vec3;
  } | null = null;
  private readonly axisVisuals: Record<AxisKey, AxisVisual> = {
    x: createAxisVisual([1, 0, 0], '#ff5f56'),
    y: createAxisVisual([0, 1, 0], '#27c93f'),
    z: createAxisVisual([0, 0, 1], '#2775c9'),
  };

  constructor(private readonly options: GizmoControllerOptions) {}

  public mount(): void {
    if (this.container) return;
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '17',
    });
    document.body.appendChild(this.container);

    (['x', 'y', 'z'] as AxisKey[]).forEach((axis) => {
      const axisConfig = this.axisVisuals[axis];
      const group = axisConfig.group;
      group.dataset.axis = axis;
      Object.assign(group.style, {
        position: 'absolute',
        pointerEvents: 'auto',
        transformOrigin: '0 50%',
      } as CSSStyleDeclaration);

      const line = axisConfig.line;
      Object.assign(line.style, {
        position: 'absolute',
        left: '0',
        top: '-1px',
        height: '2px',
        borderRadius: '2px',
        background: axisConfig.color,
        pointerEvents: 'none',
      } as CSSStyleDeclaration);

      const handle = axisConfig.handle;
      Object.assign(handle.style, {
        position: 'absolute',
        width: '12px',
        height: '12px',
        top: '-6px',
        borderRadius: '50%',
        background: axisConfig.color,
        border: '2px solid rgba(0,0,0,0.45)',
        boxShadow: '0 0 10px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
      } as CSSStyleDeclaration);

      group.appendChild(line);
      group.appendChild(handle);

      const handler: EventListener = (event: Event) => {
        const pe = event as PointerEvent;
        if (pe.button !== 0) return;
        this.startDrag(axis, pe);
      };
      group.addEventListener('pointerdown', handler);
      this.eventListeners.push({ element: group, type: 'pointerdown', handler });

      this.container!.appendChild(group);
    });
  }

  public updateOverlay(): void {
    if (!this.container) return;
    const selected = this.options.selection.primarySelection;
    if (!selected) {
      this.container.style.display = 'none';
      this.gizmoState = null;
      this.options.setControlsEnabled(true);
      return;
    }

    const worldPosition = selected.transform.getWorldPosition();
    const base = this.options.projectWorldToScreen(worldPosition);
    if (!base) {
      this.container.style.display = 'none';
      return;
    }
    const rect = this.options.canvas.getBoundingClientRect();
    const originX = rect.left + (base.x / this.options.canvas.width) * rect.width;
    const originY = rect.top + (base.y / this.options.canvas.height) * rect.height;
    this.container.style.display = 'block';

    (['x', 'y', 'z'] as AxisKey[]).forEach((axis) => {
      const axisConfig = this.axisVisuals[axis];
      const target: Vec3 = [
        worldPosition[0] + axisConfig.worldDir[0],
        worldPosition[1] + axisConfig.worldDir[1],
        worldPosition[2] + axisConfig.worldDir[2],
      ];
      const screen = this.options.projectWorldToScreen(target);
      if (!screen) {
        axisConfig.group.style.display = 'none';
        return;
      }
      const targetX = rect.left + (screen.x / this.options.canvas.width) * rect.width;
      const targetY = rect.top + (screen.y / this.options.canvas.height) * rect.height;
      const dx = targetX - originX;
      const dy = targetY - originY;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length < 4) {
        axisConfig.group.style.display = 'none';
        return;
      }
      axisConfig.screenDir = [dx / length, dy / length];
      axisConfig.screenLength = length;
      axisConfig.group.style.display = 'block';
      axisConfig.group.style.left = `${originX}px`;
      axisConfig.group.style.top = `${originY}px`;
      axisConfig.group.style.transform = `translate(-1px, -1px) rotate(${Math.atan2(dy, dx)}rad)`;
      axisConfig.line.style.width = `${length}px`;
      axisConfig.handle.style.left = `${length - 6}px`;
    });
  }

  private startDrag(axis: AxisKey, event: PointerEvent): void {
    const selected = this.options.selection.primarySelection;
    if (!selected) return;
    const axisConfig = this.axisVisuals[axis];
    if (axisConfig.screenLength <= 0) return;
    if (this.activePointerCleanup) {
      this.activePointerCleanup();
      this.activePointerCleanup = null;
    }
    this.options.setControlsEnabled(false);

    const originalPosition = selected.transform.position;
    const originalRotation = selected.transform.rotation as Quat;
    const originalScale = selected.transform.scale as Vec3;
    this.gizmoState = {
      axis,
      pointerId: event.pointerId,
      dragStartMouse: [event.clientX, event.clientY],
      originalPosition: [...originalPosition] as Vec3,
      originalRotation: [...originalRotation] as Quat,
      originalScale: [...originalScale] as Vec3,
    };

    const onPointerMove = (moveEvent: PointerEvent) => this.handleDrag(moveEvent);
    const finalizePointerSequence = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      axisConfig.group.removeEventListener('lostpointercapture', onLostPointerCapture as EventListener);
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
    const onLostPointerCapture = (lostEvent: PointerEvent) => {
      if (!this.gizmoState || lostEvent.pointerId !== this.gizmoState.pointerId) return;
      finalizePointerSequence();
      this.endDrag();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerCancel, { passive: false });
    axisConfig.group.addEventListener('lostpointercapture', onLostPointerCapture as EventListener);
    this.activePointerCleanup = finalizePointerSequence;
    try {
      const target: EventTarget | null = axisConfig.group;
      if (target && 'setPointerCapture' in target) {
        const fn = (target as unknown as { setPointerCapture: (id: number) => void })
          .setPointerCapture;
        if (typeof fn === 'function') {
          fn.call(target, event.pointerId);
        }
      }
    } catch {}
    event.preventDefault();
    event.stopPropagation();
  }

  private handleDrag(event: PointerEvent): void {
    if (!this.gizmoState) return;
    const selected = this.options.selection.primarySelection;
    if (!selected) return;
    const axisConfig = this.axisVisuals[this.gizmoState.axis];
    if (axisConfig.screenLength <= 0) return;

    const deltaX = event.clientX - this.gizmoState.dragStartMouse[0];
    const deltaY = event.clientY - this.gizmoState.dragStartMouse[1];
    const projected = deltaX * axisConfig.screenDir[0] + deltaY * axisConfig.screenDir[1];
    const worldDelta = projected / axisConfig.screenLength;

    const mode = this.options.state.gizmoMode.value ?? 'translate';
    const axisIndex = this.gizmoState.axis === 'x' ? 0 : this.gizmoState.axis === 'y' ? 1 : 2;

    if (mode === 'translate') {
      const next = [...this.gizmoState.originalPosition] as Vec3;
      next[axisIndex] = this.gizmoState.originalPosition[axisIndex] + worldDelta;
      if (this.options.snapSystem && this.options.state.snapConfig.value.enabled) {
        const snapped = this.options.snapSystem.snapPosition(next);
        selected.transform.position = snapped;
      } else {
        selected.transform.position = next;
      }
    } else if (mode === 'scale') {
      const nextScale = [...this.gizmoState.originalScale] as Vec3;
      nextScale[axisIndex] = Math.max(0.001, this.gizmoState.originalScale[axisIndex] + worldDelta);
      if (this.options.snapSystem && this.options.state.snapConfig.value.enabled) {
        const snapped = this.options.snapSystem.snapScale(nextScale);
        selected.transform.scale = snapped;
      } else {
        selected.transform.scale = nextScale;
      }
    } else if (mode === 'rotate') {
      const angle = worldDelta * Math.PI;
      const axisVec: Vec3 =
        this.gizmoState.axis === 'x'
          ? [1, 0, 0]
          : this.gizmoState.axis === 'y'
            ? [0, 1, 0]
            : [0, 0, 1];
      const deltaQuat = quatFromAxisAngle(axisVec, angle);
      const newRotation = quatMultiply(this.gizmoState.originalRotation, deltaQuat);
      if (this.options.snapSystem && this.options.state.snapConfig.value.enabled) {
        const snapped = this.options.snapSystem.snapRotation(newRotation);
        selected.transform.rotation = snapped;
      } else {
        selected.transform.rotation = newRotation;
      }
    }

    this.options.updateSceneBuffers();
    requestAnimationFrame(() => this.updateOverlay());
    event.preventDefault();
  }

  private endDrag(): void {
    if (!this.gizmoState) {
      this.options.setControlsEnabled(true);
      return;
    }
    const axisConfig = this.axisVisuals[this.gizmoState.axis];
    try {
      const target: EventTarget | null = axisConfig.group;
      if (target && 'releasePointerCapture' in target) {
        const fn = (target as unknown as { releasePointerCapture: (id: number) => void })
          .releasePointerCapture;
        if (typeof fn === 'function') {
          fn.call(target, this.gizmoState.pointerId);
        }
      }
    } catch {}
    this.gizmoState = null;
    this.options.setControlsEnabled(true);
    window.dispatchEvent(new CustomEvent('editor:gizmo:changed'));
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

    // Remove container from DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;

    // Reset state and re-enable controls as a safety
    this.gizmoState = null;
    try {
      this.options.setControlsEnabled(true);
    } catch {}
  }
}

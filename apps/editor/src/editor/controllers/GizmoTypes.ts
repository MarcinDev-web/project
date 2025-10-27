import type { Vec3, Quat } from '@engine/core/math';

export type AxisKey = 'x' | 'y' | 'z';
export type PlaneKey = 'xy' | 'xz' | 'yz';
export type HandleKey = AxisKey | PlaneKey | 'center';
export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'uniform';
export type TransformSpace = 'world' | 'local';

export interface AxisVisual {
  group: HTMLElement;
  line: HTMLElement;
  handle: HTMLElement;
  color: string;
  hoverColor: string;
  worldDir: Vec3;
  screenDir: [number, number];
  screenLength: number;
  opacity: number;
}

export interface PlaneVisual {
  group: HTMLElement;
  square: HTMLElement;
  color: string;
  hoverColor: string;
  axes: [AxisKey, AxisKey];
  normal: Vec3;
  screenPosition: [number, number] | null;
  visible: boolean;
}

export interface CenterVisual {
  element: HTMLElement;
  screenPosition: [number, number] | null;
  visible: boolean;
}

export interface GizmoState {
  handle: HandleKey;
  pointerId: number;
  dragStartMouse: [number, number];
  originalPosition: Vec3;
  originalRotation: Quat;
  originalScale: Vec3;
  originalPositions?: Map<string, Vec3>; // For multi-selection
  originalRotations?: Map<string, Quat>;
  originalScales?: Map<string, Vec3>;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
  };
}

export interface GizmoColors {
  x: { base: string; hover: string; active: string };
  y: { base: string; hover: string; active: string };
  z: { base: string; hover: string; active: string };
  xy: { base: string; hover: string };
  xz: { base: string; hover: string };
  yz: { base: string; hover: string };
  center: { base: string; hover: string };
}

export const GIZMO_COLORS: GizmoColors = {
  x: {
    base: '#E74856',
    hover: '#FF6B78',
    active: '#FF8A95',
  },
  y: {
    base: '#16C60C',
    hover: '#2EE821',
    active: '#50FF42',
  },
  z: {
    base: '#0078D4',
    hover: '#1E8FEF',
    active: '#3DA5FF',
  },
  xy: {
    base: 'rgba(255, 235, 59, 0.3)',
    hover: 'rgba(255, 235, 59, 0.6)',
  },
  xz: {
    base: 'rgba(156, 39, 176, 0.3)',
    hover: 'rgba(156, 39, 176, 0.6)',
  },
  yz: {
    base: 'rgba(0, 188, 212, 0.3)',
    hover: 'rgba(0, 188, 212, 0.6)',
  },
  center: {
    base: 'rgba(255, 255, 255, 0.9)',
    hover: 'rgba(255, 255, 255, 1)',
  },
};

export interface GizmoConfig {
  axisLength: number; // Screen-space length in pixels
  axisThickness: number;
  handleSize: number;
  centerSize: number;
  planeSize: number;
  minAxisLength: number;
  fadeAngleThreshold: number; // Degrees
  hoverScaleFactor: number;
  transitionDuration: number; // ms
}

export const DEFAULT_GIZMO_CONFIG: GizmoConfig = {
  axisLength: 100,
  axisThickness: 3,
  handleSize: 20,
  centerSize: 10,
  planeSize: 25,
  minAxisLength: 10,
  fadeAngleThreshold: 85,
  hoverScaleFactor: 1.15,
  transitionDuration: 150,
};


import type { Vec3, Quat } from '@engine/core/math';

export type AxisKey = 'x' | 'y' | 'z';
export type PlaneKey = 'xy' | 'xz' | 'yz';
export type HandleKey = AxisKey | PlaneKey | 'center';
export type GizmoMode = 'translate' | 'rotate' | 'scale' | 'uniform';
export type TransformSpace = 'world' | 'local';

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
    base: '#FF3B30', // Modern Red
    hover: '#FF6D64',
    active: '#FF8E86',
  },
  y: {
    base: '#4CD964', // Modern Green
    hover: '#76E48A',
    active: '#96EDA6',
  },
  z: {
    base: '#007AFF', // Modern Blue
    hover: '#479EFA',
    active: '#76B9FB',
  },
  xy: {
    base: 'rgba(255, 204, 0, 0.25)', // Yellowish
    hover: 'rgba(255, 204, 0, 0.5)',
  },
  xz: {
    base: 'rgba(255, 45, 85, 0.2)', // Magenta tint
    hover: 'rgba(255, 45, 85, 0.5)',
  },
  yz: {
    base: 'rgba(90, 200, 250, 0.2)', // Cyan tint
    hover: 'rgba(90, 200, 250, 0.5)',
  },
  center: {
    base: 'rgba(255, 255, 255, 0.9)',
    hover: 'rgba(255, 255, 255, 1)',
  },
};

import type { Vec3, Quat, Mat4 } from '@engine/core/math';
import { dotVec3, mat4FromQuatTranslation } from '@engine/core/math';

// Shared temporary variables to avoid allocations
const TEMP_MAT4 = new Float32Array(16) as Mat4;

/**
 * Calculate the angle between a direction vector and the camera's forward direction.
 * Returns angle in degrees.
 */
export function calculateViewAngle(
  direction: Vec3,
  cameraForward: Vec3
): number {
  const dot = dotVec3(direction, cameraForward);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  return (angle * 180) / Math.PI;
}

/**
 * Calculate opacity for an axis based on its angle to the camera.
 * Fades out when perpendicular to view.
 */
export function calculateAxisOpacity(
  viewAngle: number,
  fadeThreshold: number
): number {
  if (viewAngle < fadeThreshold) {
    return 1.0;
  }
  const fadeRange = 90 - fadeThreshold;
  const t = (viewAngle - fadeThreshold) / fadeRange;
  return Math.max(0.1, 1.0 - t * 0.9);
}

/**
 * Project a screen-space delta onto a world-space plane.
 * Returns the world-space movement vector.
 */
export function projectScreenDeltaToPlane(
  screenDelta: [number, number],
  planeNormal: Vec3,
  cameraRight: Vec3,
  cameraUp: Vec3
): Vec3 {
  // Convert screen delta to world delta using camera basis vectors
  const worldDelta: Vec3 = [
    screenDelta[0] * cameraRight[0] + screenDelta[1] * cameraUp[0],
    screenDelta[0] * cameraRight[1] + screenDelta[1] * cameraUp[1],
    screenDelta[0] * cameraRight[2] + screenDelta[1] * cameraUp[2],
  ];

  // Project onto plane by removing component along normal
  const dotProduct = dotVec3(worldDelta, planeNormal);
  return [
    worldDelta[0] - planeNormal[0] * dotProduct,
    worldDelta[1] - planeNormal[1] * dotProduct,
    worldDelta[2] - planeNormal[2] * dotProduct,
  ];
}

/**
 * Get the camera's right and up vectors from its rotation.
 */
export function getCameraBasisVectors(
  cameraRotation: Quat
): { right: Vec3; up: Vec3; forward: Vec3 } {
  mat4FromQuatTranslation(TEMP_MAT4, cameraRotation, [0, 0, 0]);
  
  return {
    right: [TEMP_MAT4[0] ?? 0, TEMP_MAT4[1] ?? 0, TEMP_MAT4[2] ?? 0],
    up: [TEMP_MAT4[4] ?? 0, TEMP_MAT4[5] ?? 0, TEMP_MAT4[6] ?? 0],
    forward: [-(TEMP_MAT4[8] ?? 0), -(TEMP_MAT4[9] ?? 0), -(TEMP_MAT4[10] ?? 0)],
  };
}

/**
 * Transform a world-space direction by an entity's rotation (for local space gizmo).
 */
export function transformDirectionByRotation(
  direction: Vec3,
  rotation: Quat
): Vec3 {
  mat4FromQuatTranslation(TEMP_MAT4, rotation, [0, 0, 0]);
  return [
    direction[0] * (TEMP_MAT4[0] ?? 0) + direction[1] * (TEMP_MAT4[4] ?? 0) + direction[2] * (TEMP_MAT4[8] ?? 0),
    direction[0] * (TEMP_MAT4[1] ?? 0) + direction[1] * (TEMP_MAT4[5] ?? 0) + direction[2] * (TEMP_MAT4[9] ?? 0),
    direction[0] * (TEMP_MAT4[2] ?? 0) + direction[1] * (TEMP_MAT4[6] ?? 0) + direction[2] * (TEMP_MAT4[10] ?? 0),
  ];
}

/**
 * Calculate adaptive screen-space scale based on distance to camera.
 * Keeps gizmo constant size on screen regardless of distance.
 */
export function calculateScreenSpaceScale(
  worldPosition: Vec3,
  cameraPosition: Vec3,
  fov: number = 60
): number {
  const dx = worldPosition[0] - cameraPosition[0];
  const dy = worldPosition[1] - cameraPosition[1];
  const dz = worldPosition[2] - cameraPosition[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  // Calculate scale based on FOV and distance
  const fovRad = (fov * Math.PI) / 180;
  return distance * Math.tan(fovRad / 2) * 0.15;
}

/**
 * Calculate the center point of multiple positions (for multi-selection).
 */
export function calculateCenterPoint(positions: Vec3[]): Vec3 {
  if (positions.length === 0) {
    return [0, 0, 0];
  }
  
  const sum: Vec3 = [0, 0, 0];
  for (const pos of positions) {
    sum[0] += pos[0];
    sum[1] += pos[1];
    sum[2] += pos[2];
  }
  
  return [
    sum[0] / positions.length,
    sum[1] / positions.length,
    sum[2] / positions.length,
  ];
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Check if a point is inside a circle (for hit testing).
 */
export function isPointInCircle(
  pointX: number,
  pointY: number,
  circleX: number,
  circleY: number,
  radius: number
): boolean {
  const dx = pointX - circleX;
  const dy = pointY - circleY;
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Check if a point is inside a rectangle (for plane hit testing).
 */
export function isPointInRect(
  pointX: number,
  pointY: number,
  rectX: number,
  rectY: number,
  width: number,
  height: number
): boolean {
  return (
    pointX >= rectX &&
    pointX <= rectX + width &&
    pointY >= rectY &&
    pointY <= rectY + height
  );
}

/**
 * Get the plane normal for a given plane key.
 */
export function getPlaneNormal(plane: 'xy' | 'xz' | 'yz'): Vec3 {
  switch (plane) {
    case 'xy':
      return [0, 0, 1];
    case 'xz':
      return [0, 1, 0];
    case 'yz':
      return [1, 0, 0];
  }
}

/**
 * Get the two axes that define a plane.
 */
export function getPlaneAxes(plane: 'xy' | 'xz' | 'yz'): [Vec3, Vec3] {
  switch (plane) {
    case 'xy':
      return [
        [1, 0, 0],
        [0, 1, 0],
      ];
    case 'xz':
      return [
        [1, 0, 0],
        [0, 0, 1],
      ];
    case 'yz':
      return [
        [0, 1, 0],
        [0, 0, 1],
      ];
  }
}

import type { Mat3, Vec3 } from '@engine/core/math';
/**
 * Geometry descriptors supported by calculateInertiaTensor
 * All tensors are returned in body-local principal axes (diagonal matrices).
 */
export type InertiaShape = {
    type: 'box';
    size: Vec3;
} | {
    type: 'sphere';
    radius: number;
} | {
    type: 'capsule';
    radius: number;
    height: number;
};
/**
 * Calculates the 3x3 inertia tensor (Mat3, column-major) for a solid shape with the given mass.
 * Returned matrix is diagonal in the shape's principal axes (x, y, z).
 *
 * Conventions:
 * - Box `size` is full width/height/depth (consistent with physics usage elsewhere)
 * - Capsule is aligned along the local Y axis; `height` is the cylindrical segment length
 */
export declare function calculateInertiaTensor(shape: InertiaShape, mass: number): Mat3;
//# sourceMappingURL=inertia.d.ts.map
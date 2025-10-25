import type { Mat3, Vec3 } from '@engine/core/math';

/**
 * Geometry descriptors supported by calculateInertiaTensor
 * All tensors are returned in body-local principal axes (diagonal matrices).
 */
export type InertiaShape =
  | { type: 'box'; size: Vec3 } // size = full extents [width, height, depth]
  | { type: 'sphere'; radius: number }
  | { type: 'capsule'; radius: number; height: number }; // height = cylinder section length (not including hemispheres)

/**
 * Calculates the 3x3 inertia tensor (Mat3, column-major) for a solid shape with the given mass.
 * Returned matrix is diagonal in the shape's principal axes (x, y, z).
 *
 * Conventions:
 * - Box `size` is full width/height/depth (consistent with physics usage elsewhere)
 * - Capsule is aligned along the local Y axis; `height` is the cylindrical segment length
 */
export function calculateInertiaTensor(shape: InertiaShape, mass: number): Mat3 {
  if (!(typeof mass === 'number' && Number.isFinite(mass) && mass > 0)) {
    throw new RangeError('mass must be a finite positive number');
  }

  switch (shape.type) {
    case 'box': {
      const [w, h, d] = shape.size;
      if (!isFiniteVec3(shape.size) || !(w > 0 && h > 0 && d > 0)) {
        throw new RangeError('box.size must be a positive Vec3');
      }
      // Solid box inertia about principal axes through center
      const ixx = (mass / 12) * (h * h + d * d);
      const iyy = (mass / 12) * (w * w + d * d);
      const izz = (mass / 12) * (w * w + h * h);
      return diagonalMat3(ixx, iyy, izz);
    }
    case 'sphere': {
      const r = shape.radius;
      if (!(typeof r === 'number' && Number.isFinite(r) && r > 0)) {
        throw new RangeError('sphere.radius must be a finite positive number');
      }
      // Solid sphere inertia: I = 2/5 m r^2
      const i = (2 / 5) * mass * r * r;
      return diagonalMat3(i, i, i);
    }
    case 'capsule': {
      const r = shape.radius;
      const L = shape.height; // cylinder length (without hemispheres)
      if (!(isFinitePositive(r) && isFinitePositive(L))) {
        throw new RangeError('capsule.radius and capsule.height must be finite positive numbers');
      }

      // Approximate as cylinder of length L plus two hemispheres (equivalent to one full sphere)
      // with uniform density. Compute mass split via volumes, then sum tensors with parallel axis.
      const Vc = Math.PI * r * r * L; // cylinder volume
      const Vs = (4 / 3) * Math.PI * r * r * r; // total volume of two hemispheres (one full sphere)
      const V = Vc + Vs;
      const mc = (Vc / V) * mass;
      const ms = (Vs / V) * mass; // mass of the spherical part (sum of both hemispheres)

      // Cylinder (aligned with Y)
      const Iyy_cyl = 0.5 * mc * r * r;
      const Ixx_cyl = (1 / 12) * mc * (3 * r * r + L * L);
      const Izz_cyl = Ixx_cyl;

      // Two hemispheres approximated as two half-mass spheres centered at y = ±L/2
      const ms_each = ms / 2;
      const d = L / 2;
      const I_sphere_center = (2 / 5) * ms_each * r * r;

      // About Y (axis through both sphere centers) -> no parallel-axis term required
      const Iyy_spheres = 2 * I_sphere_center;

      // About X/Z: add parallel axis term m*d^2 for each sphere
      const Ixx_spheres = 2 * (I_sphere_center + ms_each * d * d);
      const Izz_spheres = Ixx_spheres;

      const ixx = Ixx_cyl + Ixx_spheres;
      const iyy = Iyy_cyl + Iyy_spheres;
      const izz = Izz_cyl + Izz_spheres;

      return diagonalMat3(ixx, iyy, izz);
    }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = shape;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unsupported shape type: ${String(_exhaustive)}`);
    }
  }
}

function diagonalMat3(ixx: number, iyy: number, izz: number): Mat3 {
  return [
    ixx, 0, 0,
    0, iyy, 0,
    0, 0, izz,
  ];
}

function isFinitePositive(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isFiniteVec3(v: Vec3): boolean {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}



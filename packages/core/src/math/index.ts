// Math utilities with input validation (wrapping gl-matrix)
import { mat4 as m4, vec3 as v3, quat as glmQuat } from 'gl-matrix';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Mat4 = Float32Array;
// 3x3 matrix in column-major order to match gl-matrix conventions
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Quat = [number, number, number, number];

export type Vec3Like = [number, number, number] | { 0: number; 1: number; 2: number };

// Shared scratch buffers to reduce transient allocations in hot paths.
// Never return these from public APIs; use them only for intermediate calculations.
const TMP_V3A = new Float32Array(3) as unknown as Vec3;
const TMP_Q4A = new Float32Array(4) as unknown as Quat;

function assertFinite(name: string, value: number): void {
  if (!(typeof value === 'number' && Number.isFinite(value))) {
    throw new RangeError(`${name} must be a finite number`);
  }
}

function assertFinitePositive(name: string, value: number): void {
  if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) {
    throw new RangeError(`${name} must be a finite positive number`);
  }
}

function assertMat4(name: string, out: Mat4): void {
  if (!out || out.length < 16) {
    throw new TypeError(`${name} must be a Mat4 (Float32Array length >= 16)`);
  }
  // Note: We don't validate all 16 elements for performance reasons
  // gl-matrix functions will handle NaN/Infinity appropriately
}

function assertVec3(name: string, v: Vec3): void {
  if (!v || v.length < 3) throw new TypeError(`${name} must be a Vec3`);
  const [x, y, z] = v;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new RangeError(`${name} components must be finite numbers`);
  }
}

/**
 * Computes a perspective projection matrix using WebGPU's 0..1 depth range.
 * @param out - Output matrix that receives the projection values.
 * @param fovy - Vertical field of view in radians. Must be finite, positive, and less than `Math.PI`.
 * @param aspect - Aspect ratio (width divided by height). Must be a finite positive number.
 * @param near - Distance to the near clipping plane. Must be a finite positive number.
 * @param far - Distance to the far clipping plane. Must be a finite number greater than `near`.
 * @returns The same `out` matrix populated with the perspective projection values.
 * @throws {RangeError} If any argument is not finite or violates geometric constraints.
 * @throws {TypeError} If `out` is not a valid 4x4 matrix.
 */
export function mat4Perspective(
  out: Mat4,
  fovy: number,
  aspect: number,
  near: number,
  far: number
): Mat4 {
  assertMat4('out', out);
  assertFinitePositive('fovy', fovy);
  assertFinitePositive('aspect', aspect);
  assertFinitePositive('near', near);
  assertFinite('far', far);
  if (!(far > near)) throw new RangeError('far must be greater than near');
  if (!(fovy < Math.PI)) throw new RangeError('fovy must be < PI radians');
  // WebGPU 0..1 depth range
  m4.perspectiveZO(out as unknown as m4, fovy, aspect, near, far);
  return out;
}

/**
 * Builds an orthographic projection matrix using WebGPU's 0..1 depth range.
 * @param out Output matrix
 * @param left Left plane
 * @param right Right plane
 * @param bottom Bottom plane
 * @param top Top plane
 * @param near Near plane distance
 * @param far Far plane distance
 */
export function mat4Ortho(
  out: Mat4,
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Mat4 {
  assertMat4('out', out);
  assertFinite('left', left);
  assertFinite('right', right);
  assertFinite('bottom', bottom);
  assertFinite('top', top);
  assertFinite('near', near);
  assertFinite('far', far);
  if (!(far > near)) throw new RangeError('far must be greater than near');
  // orthoZO exists in gl-matrix but types are incomplete
  /* eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
  (m4 as any).orthoZO(out as unknown as m4, left, right, bottom, top, near, far);
  return out;
}

/**
 * Builds a right-handed look-at view matrix.
 * @param out - Output matrix that receives the view transform.
 * @param eye - Viewer position in world space.
 * @param target - Target point the viewer looks at.
 * @param up - Up direction used to construct the camera basis. Must not be parallel to the forward vector.
 * @returns The same `out` matrix filled with the view transform.
 * @throws {RangeError} If the input vectors are invalid or degenerate.
 * @throws {TypeError} If inputs are not the expected vector or matrix types.
 */
export function mat4LookAt(out: Mat4, eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  assertMat4('out', out);
  assertVec3('eye', eye);
  assertVec3('target', target);
  assertVec3('up', up);
  const upLen = Math.hypot(up[0], up[1], up[2]);
  if (!(upLen > 0)) throw new RangeError('up vector must be non-zero');
  // Ensure up is not parallel to forward
  const fx = eye[0] - target[0];
  const fy = eye[1] - target[1];
  const fz = eye[2] - target[2];
  const cx = up[1] * fz - up[2] * fy;
  const cy = up[2] * fx - up[0] * fz;
  const cz = up[0] * fy - up[1] * fx;
  if (Math.hypot(cx, cy, cz) === 0) {
    throw new RangeError('up vector must not be parallel to the view direction');
  }
  m4.lookAt(
    out as unknown as m4,
    eye as unknown as v3,
    target as unknown as v3,
    up as unknown as v3
  );
  return out;
}

/**
 * Creates a transformation matrix from a Y-axis rotation followed by a translation.
 * @param out - Output matrix that receives the transform.
 * @param angle - Rotation angle in radians around the Y axis.
 * @param translation - Translation vector applied after the rotation.
 * @returns The same `out` matrix containing the transformation values.
 * @throws {RangeError} If `angle` is not a finite number.
 * @throws {TypeError} If `out` or `translation` are not valid matrix/vector instances.
 */
export function mat4FromRotationTranslation(out: Mat4, angle: number, translation: Vec3): Mat4 {
  assertMat4('out', out);
  assertFinite('angle', angle);
  assertVec3('translation', translation);
  const qq = glmQuat.create();
  glmQuat.setAxisAngle(qq, [0, 1, 0] as unknown as v3, angle);
  m4.fromRotationTranslation(out as unknown as m4, qq, translation as unknown as v3);
  return out;
}

/**
 * Creates a transformation matrix from a quaternion rotation and a translation.
 * @param out - Output matrix that receives the transform.
 * @param rotation - Rotation quaternion [x, y, z, w].
 * @param translation - Translation vector applied after the rotation.
 * @returns The same `out` matrix containing the transformation values.
 */
export function mat4FromQuatTranslation(out: Mat4, rotation: Quat, translation: Vec3): Mat4 {
  assertMat4('out', out);
  assertQuat('rotation', rotation);
  assertVec3('translation', translation);
  m4.fromRotationTranslation(
    out as unknown as m4,
    rotation as unknown as glmQuat,
    translation as unknown as v3
  );
  return out;
}

/**
 * Creates a transformation matrix from a quaternion rotation, translation and non-uniform scale.
 * @param out - Output matrix that receives the transform.
 * @param rotation - Rotation quaternion [x, y, z, w].
 * @param translation - Translation vector applied after the rotation.
 * @param scale - Non-uniform scale [sx, sy, sz].
 * @returns The same `out` matrix containing the transformation values.
 */
export function mat4FromQuatTranslationScale(
  out: Mat4,
  rotation: Quat,
  translation: Vec3,
  scale: Vec3
): Mat4 {
  assertMat4('out', out);
  assertQuat('rotation', rotation);
  assertVec3('translation', translation);
  assertVec3('scale', scale);
  // Use gl-matrix to compose rotation, translation and scale in one pass
  // This avoids temporary allocations in hot paths
  // Note: fromRotationTranslationScale is available in gl-matrix v3+
  m4.fromRotationTranslationScale(
    out as unknown as m4,
    rotation as unknown as glmQuat,
    translation as unknown as v3,
    scale as unknown as v3
  );
  return out;
}

/**
 * Multiplies two 4x4 matrices and stores the result in `out`.
 * @param out - Output matrix that receives the product.
 * @param a - Left operand matrix.
 * @param b - Right operand matrix.
 * @returns The same `out` matrix containing the multiplication result.
 * @throws {TypeError} If any argument is not a valid 4x4 matrix.
 */
export function mat4Multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  assertMat4('out', out);
  assertMat4('a', a);
  assertMat4('b', b);
  m4.multiply(out as unknown as m4, a as unknown as m4, b as unknown as m4);
  return out;
}

/**
 * Inverts a 4x4 matrix into `out`. Throws if the matrix is not invertible.
 * @param out - Output matrix to receive the inverse.
 * @param a - Matrix to invert.
 * @returns The same `out` matrix containing the inverse of `a`.
 * @throws {Error} If the matrix is not invertible.
 */
export function mat4Invert(out: Mat4, a: Mat4): Mat4 {
  assertMat4('out', out);
  assertMat4('a', a);
  const inv = m4.invert(out as unknown as m4, a as unknown as m4);
  if (!inv) {
    throw new Error('Matrix is not invertible');
  }
  return out;
}

/**
 * Sets `out` to the 4x4 identity matrix.
 * @param out Output matrix to receive the identity values
 * @returns The same `out` matrix
 */
export function mat4Identity(out: Mat4): Mat4 {
  assertMat4('out', out);
  m4.identity(out as unknown as m4);
  return out;
}

/**
 * Creates a pure translation matrix in `out`.
 * @param out Output matrix to receive the translation matrix
 * @param translation Translation vector [tx, ty, tz]
 * @returns The same `out` matrix
 */
export function mat4Translate(out: Mat4, translation: Vec3): Mat4 {
  assertMat4('out', out);
  assertVec3('translation', translation);
  m4.fromTranslation(out as unknown as m4, translation as unknown as v3);
  return out;
}

/**
 * Creates a pure scaling matrix in `out`.
 * @param out Output matrix to receive the scaling matrix
 * @param scale Non-uniform scale [sx, sy, sz]
 * @returns The same `out` matrix
 */
export function mat4Scale(out: Mat4, scale: Vec3): Mat4 {
  assertMat4('out', out);
  assertVec3('scale', scale);
  m4.fromScaling(out as unknown as m4, scale as unknown as v3);
  return out;
}

/**
 * Creates a pure rotation matrix in `out` from an axis-angle.
 * @param out Output matrix to receive the rotation matrix
 * @param axis Rotation axis (must be non-zero)
 * @param angle Rotation angle in radians
 * @returns The same `out` matrix
 */
export function mat4Rotate(out: Mat4, axis: Vec3, angle: number): Mat4 {
  assertMat4('out', out);
  assertVec3('axis', axis);
  assertFinite('angle', angle);
  const unit = normalizeVec3(axis);
  m4.fromRotation(out as unknown as m4, angle, unit as unknown as v3);
  return out;
}

/**
 * Extracts the translation vector from a 4x4 transform matrix.
 * @param a Source matrix
 * @returns Translation as [x, y, z]
 */
export function mat4GetTranslation(a: Mat4): Vec3 {
  assertMat4('a', a);
  return [a[12]!, a[13]!, a[14]!];
}

/**
 * Writes translation component of matrix `a` into `out`.
 */
export function mat4GetTranslationOut(out: Vec3, a: Mat4): Vec3 {
  assertVec3('out', out);
  assertMat4('a', a);
  (out as unknown as v3)[0] = a[12]!;
  (out as unknown as v3)[1] = a[13]!;
  (out as unknown as v3)[2] = a[14]!;
  return out;
}

/**
 * Extracts uniform/non-uniform scale from the upper-left 3x3 of a 4x4 matrix.
 * Returns magnitudes of the basis vectors (always non-negative).
 * @param a Source matrix
 * @returns Scale as [sx, sy, sz]
 */
export function mat4GetScale(a: Mat4): Vec3 {
  assertMat4('a', a);
  const sx = Math.hypot(a[0]!, a[1]!, a[2]!);
  const sy = Math.hypot(a[4]!, a[5]!, a[6]!);
  const sz = Math.hypot(a[8]!, a[9]!, a[10]!);
  return [sx, sy, sz];
}

/**
 * Writes scale components of matrix `a` into `out`.
 */
export function mat4GetScaleOut(out: Vec3, a: Mat4): Vec3 {
  assertVec3('out', out);
  assertMat4('a', a);
  (out as unknown as v3)[0] = Math.hypot(a[0]!, a[1]!, a[2]!);
  (out as unknown as v3)[1] = Math.hypot(a[4]!, a[5]!, a[6]!);
  (out as unknown as v3)[2] = Math.hypot(a[8]!, a[9]!, a[10]!);
  return out;
}

/**
 * Extracts the rotation (as a quaternion [x, y, z, w]) from a 4x4 TRS matrix.
 * Any scale is factored out before converting to a quaternion.
 * @param a Source matrix
 * @returns Rotation quaternion [x, y, z, w]
 */
export function mat4GetRotation(a: Mat4): Quat {
  assertMat4('a', a);
  // Compute and factor out scale
  const sx = Math.hypot(a[0]!, a[1]!, a[2]!);
  const sy = Math.hypot(a[4]!, a[5]!, a[6]!);
  const sz = Math.hypot(a[8]!, a[9]!, a[10]!);
  const eps = 1e-12;
  if (!(sx > eps && sy > eps && sz > eps)) {
    throw new RangeError('mat4GetRotation: matrix has zero scale component');
  }

  // Build a normalized 3x3 rotation (column-major basis vectors normalized)
  const r00 = a[0]! / sx,
    r01 = a[4]! / sy,
    r02 = a[8]! / sz;
  const r10 = a[1]! / sx,
    r11 = a[5]! / sy,
    r12 = a[9]! / sz;
  const r20 = a[2]! / sx,
    r21 = a[6]! / sy,
    r22 = a[10]! / sz;

  // Convert 3x3 rotation to quaternion (right-handed, column-major)
  const trace = r00 + r11 + r22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const S = Math.sqrt(trace + 1.0) * 2; // S = 4 * qw
    w = 0.25 * S;
    x = (r21 - r12) / S;
    y = (r02 - r20) / S;
    z = (r10 - r01) / S;
  } else if (r00 > r11 && r00 > r22) {
    const S = Math.sqrt(1.0 + r00 - r11 - r22) * 2; // S = 4 * qx
    w = (r21 - r12) / S;
    x = 0.25 * S;
    y = (r01 + r10) / S;
    z = (r02 + r20) / S;
  } else if (r11 > r22) {
    const S = Math.sqrt(1.0 + r11 - r00 - r22) * 2; // S = 4 * qy
    w = (r02 - r20) / S;
    x = (r01 + r10) / S;
    y = 0.25 * S;
    z = (r12 + r21) / S;
  } else {
    const S = Math.sqrt(1.0 + r22 - r00 - r11) * 2; // S = 4 * qz
    w = (r10 - r01) / S;
    x = (r02 + r20) / S;
    y = (r12 + r21) / S;
    z = 0.25 * S;
  }

  return quatNormalize([x, y, z, w]);
}

/**
 * Writes rotation (as quaternion) extracted from matrix `a` into `out`.
 * Any scale is factored out before converting to quaternion.
 */
export function mat4GetRotationOut(out: Quat, a: Mat4): Quat {
  assertQuat('out', out);
  assertMat4('a', a);
  const sx = Math.hypot(a[0]!, a[1]!, a[2]!);
  const sy = Math.hypot(a[4]!, a[5]!, a[6]!);
  const sz = Math.hypot(a[8]!, a[9]!, a[10]!);
  const eps = 1e-12;
  if (!(sx > eps && sy > eps && sz > eps)) {
    throw new RangeError('mat4GetRotationOut: matrix has zero scale component');
  }
  const r00 = a[0]! / sx,
    r01 = a[4]! / sy,
    r02 = a[8]! / sz;
  const r10 = a[1]! / sx,
    r11 = a[5]! / sy,
    r12 = a[9]! / sz;
  const r20 = a[2]! / sx,
    r21 = a[6]! / sy,
    r22 = a[10]! / sz;
  const trace = r00 + r11 + r22;
  if (trace > 0) {
    const S = Math.sqrt(trace + 1.0) * 2;
    (out as unknown as glmQuat)[3] = 0.25 * S;
    (out as unknown as glmQuat)[0] = (r21 - r12) / S;
    (out as unknown as glmQuat)[1] = (r02 - r20) / S;
    (out as unknown as glmQuat)[2] = (r10 - r01) / S;
  } else if (r00 > r11 && r00 > r22) {
    const S = Math.sqrt(1.0 + r00 - r11 - r22) * 2;
    (out as unknown as glmQuat)[3] = (r21 - r12) / S;
    (out as unknown as glmQuat)[0] = 0.25 * S;
    (out as unknown as glmQuat)[1] = (r01 + r10) / S;
    (out as unknown as glmQuat)[2] = (r02 + r20) / S;
  } else if (r11 > r22) {
    const S = Math.sqrt(1.0 + r11 - r00 - r22) * 2;
    (out as unknown as glmQuat)[3] = (r02 - r20) / S;
    (out as unknown as glmQuat)[0] = (r01 + r10) / S;
    (out as unknown as glmQuat)[1] = 0.25 * S;
    (out as unknown as glmQuat)[2] = (r12 + r21) / S;
  } else {
    const S = Math.sqrt(1.0 + r22 - r00 - r11) * 2;
    (out as unknown as glmQuat)[3] = (r10 - r01) / S;
    (out as unknown as glmQuat)[0] = (r02 + r20) / S;
    (out as unknown as glmQuat)[1] = (r12 + r21) / S;
    (out as unknown as glmQuat)[2] = 0.25 * S;
  }
  return quatNormalizeOut(out, out);
}

/**
 * Linearly interpolate between two matrices
 * @param out - Output matrix
 * @param a - First matrix
 * @param b - Second matrix
 * @param t - Interpolation factor (0 to 1)
 * @returns The interpolated matrix
 */
export function mat4Lerp(out: Mat4, a: Mat4, b: Mat4, t: number): Mat4 {
  assertMat4('out', out);
  assertMat4('a', a);
  assertMat4('b', b);
  assertFinite('t', t);

  const t1 = 1 - t;
  for (let i = 0; i < 16; i++) {
    out[i] = a[i]! * t1 + b[i]! * t;
  }

  return out;
}

// ========== Vector utilities ==========
/**
 * Returns a normalized copy of the provided 3D vector.
 * @param vec - Vector to normalize. Must be non-zero.
 * @returns A new normalized vector.
 * @throws {RangeError} If the vector has zero length.
 * @throws {TypeError} If `vec` is not a valid `Vec3`.
 */
export function normalizeVec3(vec: Vec3): Vec3 {
  // Backward-compatible wrapper returning a new vector
  normalizeVec3Out(TMP_V3A, vec);
  return [TMP_V3A[0], TMP_V3A[1], TMP_V3A[2]];
}

/**
 * Normalizes `vec` into `out`.
 * @param out Destination vector
 * @param vec Source vector (must be non-zero)
 */
export function normalizeVec3Out(out: Vec3, vec: Vec3): Vec3 {
  assertVec3('vec', vec);
  assertVec3('out', out);
  const len = Math.hypot(vec[0], vec[1], vec[2]);
  if (!(len > 0)) {
    throw new RangeError('normalizeVec3: zero-length vector');
  }
  (out as unknown as v3)[0] = vec[0] / len;
  (out as unknown as v3)[1] = vec[1] / len;
  (out as unknown as v3)[2] = vec[2] / len;
  return out;
}

export function normalizeVec3Like(vec: Vec3Like): Vec3 {
  return normalizeVec3([vec[0], vec[1], vec[2]]);
}

// ========== Quaternion utilities ==========
function assertQuat(name: string, q: Quat): void {
  if (!q || q.length < 4) throw new TypeError(`${name} must be a Quat`);
  const [x, y, z, w] = q;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(w)) {
    throw new RangeError(`${name} components must be finite numbers`);
  }
}

/**
 * Normalizes the provided quaternion.
 * @param q - Quaternion to normalize.
 * @returns A new normalized quaternion.
 * @throws {RangeError} If `q` has zero length.
 * @throws {TypeError} If `q` is not a valid `Quat`.
 */
export function quatNormalize(q: Quat): Quat {
  // Backward-compatible wrapper returning a new quaternion
  quatNormalizeOut(TMP_Q4A, q);
  return [TMP_Q4A[0], TMP_Q4A[1], TMP_Q4A[2], TMP_Q4A[3]];
}

/**
 * Normalizes quaternion `q` into `out`.
 */
export function quatNormalizeOut(out: Quat, q: Quat): Quat {
  assertQuat('q', q);
  assertQuat('out', out);
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (!(len > 0)) throw new RangeError('quatNormalize: zero-length quaternion');
  if (Math.abs(len - 1) < 1e-6) {
    (out as unknown as glmQuat)[0] = q[0];
    (out as unknown as glmQuat)[1] = q[1];
    (out as unknown as glmQuat)[2] = q[2];
    (out as unknown as glmQuat)[3] = q[3];
    return out;
  }
  glmQuat.normalize(out as unknown as glmQuat, q as unknown as glmQuat);
  return out;
}

/**
 * Multiplies two quaternions.
 * @param a - Left operand quaternion.
 * @param b - Right operand quaternion.
 * @returns A new quaternion representing `a * b`.
 * @throws {TypeError} If either argument is not a valid `Quat`.
 */
export function quatMultiply(a: Quat, b: Quat): Quat {
  quatMultiplyOut(TMP_Q4A, a, b);
  return [TMP_Q4A[0], TMP_Q4A[1], TMP_Q4A[2], TMP_Q4A[3]];
}

export function quatMultiplyOut(out: Quat, a: Quat, b: Quat): Quat {
  assertQuat('out', out);
  assertQuat('a', a);
  assertQuat('b', b);
  glmQuat.multiply(out as unknown as glmQuat, a as unknown as glmQuat, b as unknown as glmQuat);
  return out;
}

/**
 * Creates a quaternion that represents a rotation around an arbitrary axis.
 * @param axis - Axis of rotation. Must be non-zero.
 * @param angle - Rotation angle in radians.
 * @returns A new quaternion representing the axis-angle rotation.
 * @throws {RangeError} If the axis is zero length or if `angle` is not finite.
 * @throws {TypeError} If `axis` is not a valid `Vec3`.
 */
export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  quatFromAxisAngleOut(TMP_Q4A, axis, angle);
  return [TMP_Q4A[0], TMP_Q4A[1], TMP_Q4A[2], TMP_Q4A[3]];
}

export function quatFromAxisAngleOut(out: Quat, axis: Vec3, angle: number): Quat {
  assertQuat('out', out);
  assertVec3('axis', axis);
  assertFinite('angle', angle);
  const unit = normalizeVec3(axis);
  glmQuat.setAxisAngle(out as unknown as glmQuat, unit as unknown as v3, angle);
  return out;
}

/**
 * Converts a quaternion to Euler angles (XYZ order) in radians.
 * @param q - Quaternion to convert.
 * @returns Euler angles [x, y, z] in radians.
 * @throws {TypeError} If `q` is not a valid `Quat`.
 */
export function quatToEuler(q: Quat): Vec3 {
  assertQuat('q', q);
  const [x, y, z, w] = q;

  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  // Pitch (y-axis rotation)
  const sinp = 2 * (w * y - z * x);
  let pitch: number;
  if (Math.abs(sinp) >= 1) {
    pitch = Math.sign(sinp) * (Math.PI / 2); // Use 90 degrees if out of range
  } else {
    pitch = Math.asin(sinp);
  }

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (w * z + x * y);
  const cosy_cosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return [roll, pitch, yaw];
}

/**
 * Creates a quaternion from Euler angles (XYZ order) in radians.
 * @param euler - Euler angles [x, y, z] in radians.
 * @returns A new quaternion.
 * @throws {TypeError} If `euler` is not a valid `Vec3`.
 */
export function quatFromEuler(euler: Vec3): Quat {
  quatFromEulerOut(TMP_Q4A, euler);
  return [TMP_Q4A[0], TMP_Q4A[1], TMP_Q4A[2], TMP_Q4A[3]];
}

export function quatFromEulerOut(out: Quat, euler: Vec3): Quat {
  assertQuat('out', out);
  assertVec3('euler', euler);
  const [roll, pitch, yaw] = euler;

  const cy = Math.cos(yaw * 0.5);
  const sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5);
  const sp = Math.sin(pitch * 0.5);
  const cr = Math.cos(roll * 0.5);
  const sr = Math.sin(roll * 0.5);

  (out as unknown as glmQuat)[3] = cr * cp * cy + sr * sp * sy; // w
  (out as unknown as glmQuat)[0] = sr * cp * cy - cr * sp * sy; // x
  (out as unknown as glmQuat)[1] = cr * sp * cy + sr * cp * sy; // y
  (out as unknown as glmQuat)[2] = cr * cp * sy - sr * sp * cy; // z
  return out;
}

/**
 * Converts a quaternion to a 3x3 rotation matrix (column-major order).
 * @param q - Quaternion to convert.
 * @returns A 9-element array representing the 3x3 rotation matrix in column-major order.
 * @throws {TypeError} If `q` is not a valid `Quat`.
 */
export function quatToMatrix3(q: Quat): number[] {
  assertQuat('q', q);
  const [x, y, z, w] = q;

  // Column 0
  const m00 = 1 - 2 * (y * y + z * z);
  const m10 = 2 * (x * y + z * w);
  const m20 = 2 * (x * z - y * w);

  // Column 1
  const m01 = 2 * (x * y - z * w);
  const m11 = 1 - 2 * (x * x + z * z);
  const m21 = 2 * (y * z + x * w);

  // Column 2
  const m02 = 2 * (x * z + y * w);
  const m12 = 2 * (y * z - x * w);
  const m22 = 1 - 2 * (x * x + y * y);

  return [m00, m10, m20, m01, m11, m21, m02, m12, m22];
}

/**
 * Transforms a vector by a quaternion (rotation)
 * @param vec The vector to transform
 * @param quat The quaternion representing the rotation
 * @returns The transformed vector
 */
export function transformVec3ByQuat(vec: Vec3, quat: Quat): Vec3 {
  transformVec3ByQuatOut(TMP_V3A, vec, quat);
  return [TMP_V3A[0], TMP_V3A[1], TMP_V3A[2]];
}

export function transformVec3ByQuatOut(out: Vec3, vec: Vec3, quat: Quat): Vec3 {
  assertVec3('out', out);
  assertVec3('vec', vec);
  assertQuat('quat', quat);

  const [x, y, z] = vec;
  const [qx, qy, qz, qw] = quat;

  // Calculate quat * vec
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  // Calculate result * inverse quat
  (out as unknown as v3)[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  (out as unknown as v3)[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  (out as unknown as v3)[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
  return out;
}

/**
 * Adds two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The sum of a and b
 */
export function addVec3(a: Vec3, b: Vec3): Vec3 {
  addVec3Out(TMP_V3A, a, b);
  return [TMP_V3A[0], TMP_V3A[1], TMP_V3A[2]];
}

export function addVec3Out(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  assertVec3('out', out);
  assertVec3('a', a);
  assertVec3('b', b);
  (out as unknown as v3)[0] = a[0] + b[0];
  (out as unknown as v3)[1] = a[1] + b[1];
  (out as unknown as v3)[2] = a[2] + b[2];
  return out;
}

/**
 * Subtracts two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The difference a - b
 */
export function subVec3(a: Vec3, b: Vec3): Vec3 {
  subVec3Out(TMP_V3A, a, b);
  return [TMP_V3A[0], TMP_V3A[1], TMP_V3A[2]];
}

export function subVec3Out(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  assertVec3('out', out);
  assertVec3('a', a);
  assertVec3('b', b);
  (out as unknown as v3)[0] = a[0] - b[0];
  (out as unknown as v3)[1] = a[1] - b[1];
  (out as unknown as v3)[2] = a[2] - b[2];
  return out;
}

/**
 * Scales a Vec3 vector by a scalar
 * @param vec The vector to scale
 * @param scalar The scalar value
 * @returns The scaled vector
 */
export function scaleVec3(vec: Vec3, scalar: number): Vec3 {
  scaleVec3Out(TMP_V3A, vec, scalar);
  return [TMP_V3A[0], TMP_V3A[1], TMP_V3A[2]];
}

export function scaleVec3Out(out: Vec3, vec: Vec3, scalar: number): Vec3 {
  assertVec3('out', out);
  assertVec3('vec', vec);
  assertFinite('scalar', scalar);
  (out as unknown as v3)[0] = vec[0] * scalar;
  (out as unknown as v3)[1] = vec[1] * scalar;
  (out as unknown as v3)[2] = vec[2] * scalar;
  return out;
}

/**
 * Calculates the dot product of two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The dot product
 */
export function dotVec3(a: Vec3, b: Vec3): number {
  assertVec3('a', a);
  assertVec3('b', b);
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Calculates the cross product of two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The cross product a × b
 */
export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  crossVec3Out(TMP_V3A, a, b);
  return [TMP_V3A[0], TMP_V3A[1], TMP_V3A[2]];
}

export function crossVec3Out(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  assertVec3('out', out);
  assertVec3('a', a);
  assertVec3('b', b);
  (out as unknown as v3)[0] = a[1] * b[2] - a[2] * b[1];
  (out as unknown as v3)[1] = a[2] * b[0] - a[0] * b[2];
  (out as unknown as v3)[2] = a[0] * b[1] - a[1] * b[0];
  return out;
}

/**
 * Calculates the length (magnitude) of a Vec3 vector
 * @param vec The vector
 * @returns The length
 */
export function lengthVec3(vec: Vec3): number {
  assertVec3('vec', vec);
  return Math.hypot(vec[0], vec[1], vec[2]);
}

/**
 * Clamps each component of `vec` to the inclusive range [minVal, maxVal]
 * @param vec Vector to clamp
 * @param minVal Minimum value
 * @param maxVal Maximum value
 * @returns New clamped vector
 */
export function clampVec3(vec: Vec3, minVal: number, maxVal: number): Vec3 {
  assertVec3('vec', vec);
  assertFinite('minVal', minVal);
  assertFinite('maxVal', maxVal);
  const lo = Math.min(minVal, maxVal);
  const hi = Math.max(minVal, maxVal);
  return [
    Math.min(Math.max(vec[0], lo), hi),
    Math.min(Math.max(vec[1], lo), hi),
    Math.min(Math.max(vec[2], lo), hi),
  ];
}

/**
 * Component-wise minimum of two vectors
 * @param a First vector
 * @param b Second vector
 * @returns Component-wise min(a, b)
 */
export function minVec3(a: Vec3, b: Vec3): Vec3 {
  assertVec3('a', a);
  assertVec3('b', b);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
}

/**
 * Component-wise maximum of two vectors
 * @param a First vector
 * @param b Second vector
 * @returns Component-wise max(a, b)
 */
export function maxVec3(a: Vec3, b: Vec3): Vec3 {
  assertVec3('a', a);
  assertVec3('b', b);
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
}

/**
 * Approximate equality test for two Vec3 using epsilon tolerance per component.
 * @param a First vector
 * @param b Second vector
 * @param epsilon Tolerance (default 1e-6)
 * @returns true if all components are within epsilon
 */
export function vec3Equals(a: Vec3, b: Vec3, epsilon = 1e-6): boolean {
  assertVec3('a', a);
  assertVec3('b', b);
  assertFinite('epsilon', epsilon);
  return (
    Math.abs(a[0] - b[0]) <= epsilon &&
    Math.abs(a[1] - b[1]) <= epsilon &&
    Math.abs(a[2] - b[2]) <= epsilon
  );
}

/**
 * Calculates the squared length of a Vec3 vector (faster than lengthVec3)
 * @param vec The vector
 * @returns The squared length
 */
export function lengthSquaredVec3(vec: Vec3): number {
  assertVec3('vec', vec);
  return vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2];
}

/**
 * Calculates the distance between two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The distance between a and b
 */
export function distanceVec3(a: Vec3, b: Vec3): number {
  assertVec3('a', a);
  assertVec3('b', b);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.hypot(dx, dy, dz);
}

/**
 * Computes squared distance (faster than distanceVec3) between two vectors.
 */
export function distanceSquaredVec3(a: Vec3, b: Vec3): number {
  assertVec3('a', a);
  assertVec3('b', b);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Linearly interpolates between two Vec3 vectors
 * @param a Start vector
 * @param b End vector
 * @param t Interpolation factor (0-1)
 * @returns The interpolated vector
 */
export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  lerpVec3Out(TMP_V3A, a, b, t);
  return [TMP_V3A[0], TMP_V3A[1], TMP_V3A[2]];
}

export function lerpVec3Out(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3 {
  assertVec3('out', out);
  assertVec3('a', a);
  assertVec3('b', b);
  assertFinite('t', t);
  (out as unknown as v3)[0] = a[0] + (b[0] - a[0]) * t;
  (out as unknown as v3)[1] = a[1] + (b[1] - a[1]) * t;
  (out as unknown as v3)[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/**
 * Computes the inverse of a quaternion
 * @param q The quaternion to invert
 * @returns The inverse quaternion
 */
export function quatInverse(q: Quat): Quat {
  quatInverseOut(TMP_Q4A, q);
  return [TMP_Q4A[0], TMP_Q4A[1], TMP_Q4A[2], TMP_Q4A[3]];
}

export function quatInverseOut(out: Quat, q: Quat): Quat {
  assertQuat('out', out);
  assertQuat('q', q);
  glmQuat.invert(out as unknown as glmQuat, q as unknown as glmQuat);
  return out;
}

/**
 * Spherical linear interpolation between two quaternions
 * @param a Start quaternion
 * @param b End quaternion
 * @param t Interpolation factor (0-1)
 * @returns The interpolated quaternion
 */
export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  quatSlerpOut(TMP_Q4A, a, b, t);
  return [TMP_Q4A[0], TMP_Q4A[1], TMP_Q4A[2], TMP_Q4A[3]];
}

export function quatSlerpOut(out: Quat, a: Quat, b: Quat, t: number): Quat {
  assertQuat('out', out);
  assertQuat('a', a);
  assertQuat('b', b);
  assertFinite('t', t);
  glmQuat.slerp(out as unknown as glmQuat, a as unknown as glmQuat, b as unknown as glmQuat, t);
  return out;
}

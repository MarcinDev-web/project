export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Mat4 = Float32Array;
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Quat = [number, number, number, number];
export type Vec3Like = [number, number, number] | {
    0: number;
    1: number;
    2: number;
};
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
export declare function mat4Perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number): Mat4;
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
export declare function mat4Ortho(out: Mat4, left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4;
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
export declare function mat4LookAt(out: Mat4, eye: Vec3, target: Vec3, up: Vec3): Mat4;
/**
 * Creates a transformation matrix from a Y-axis rotation followed by a translation.
 * @param out - Output matrix that receives the transform.
 * @param angle - Rotation angle in radians around the Y axis.
 * @param translation - Translation vector applied after the rotation.
 * @returns The same `out` matrix containing the transformation values.
 * @throws {RangeError} If `angle` is not a finite number.
 * @throws {TypeError} If `out` or `translation` are not valid matrix/vector instances.
 */
export declare function mat4FromRotationTranslation(out: Mat4, angle: number, translation: Vec3): Mat4;
/**
 * Creates a transformation matrix from a quaternion rotation and a translation.
 * @param out - Output matrix that receives the transform.
 * @param rotation - Rotation quaternion [x, y, z, w].
 * @param translation - Translation vector applied after the rotation.
 * @returns The same `out` matrix containing the transformation values.
 */
export declare function mat4FromQuatTranslation(out: Mat4, rotation: Quat, translation: Vec3): Mat4;
/**
 * Creates a transformation matrix from a quaternion rotation, translation and non-uniform scale.
 * @param out - Output matrix that receives the transform.
 * @param rotation - Rotation quaternion [x, y, z, w].
 * @param translation - Translation vector applied after the rotation.
 * @param scale - Non-uniform scale [sx, sy, sz].
 * @returns The same `out` matrix containing the transformation values.
 */
export declare function mat4FromQuatTranslationScale(out: Mat4, rotation: Quat, translation: Vec3, scale: Vec3): Mat4;
/**
 * Multiplies two 4x4 matrices and stores the result in `out`.
 * @param out - Output matrix that receives the product.
 * @param a - Left operand matrix.
 * @param b - Right operand matrix.
 * @returns The same `out` matrix containing the multiplication result.
 * @throws {TypeError} If any argument is not a valid 4x4 matrix.
 */
export declare function mat4Multiply(out: Mat4, a: Mat4, b: Mat4): Mat4;
/**
 * Inverts a 4x4 matrix into `out`. Throws if the matrix is not invertible.
 * @param out - Output matrix to receive the inverse.
 * @param a - Matrix to invert.
 * @returns The same `out` matrix containing the inverse of `a`.
 * @throws {Error} If the matrix is not invertible.
 */
export declare function mat4Invert(out: Mat4, a: Mat4): Mat4;
/**
 * Sets `out` to the 4x4 identity matrix.
 * @param out Output matrix to receive the identity values
 * @returns The same `out` matrix
 */
export declare function mat4Identity(out: Mat4): Mat4;
/**
 * Creates a pure translation matrix in `out`.
 * @param out Output matrix to receive the translation matrix
 * @param translation Translation vector [tx, ty, tz]
 * @returns The same `out` matrix
 */
export declare function mat4Translate(out: Mat4, translation: Vec3): Mat4;
/**
 * Creates a pure scaling matrix in `out`.
 * @param out Output matrix to receive the scaling matrix
 * @param scale Non-uniform scale [sx, sy, sz]
 * @returns The same `out` matrix
 */
export declare function mat4Scale(out: Mat4, scale: Vec3): Mat4;
/**
 * Creates a pure rotation matrix in `out` from an axis-angle.
 * @param out Output matrix to receive the rotation matrix
 * @param axis Rotation axis (must be non-zero)
 * @param angle Rotation angle in radians
 * @returns The same `out` matrix
 */
export declare function mat4Rotate(out: Mat4, axis: Vec3, angle: number): Mat4;
/**
 * Extracts the translation vector from a 4x4 transform matrix.
 * @param a Source matrix
 * @returns Translation as [x, y, z]
 */
export declare function mat4GetTranslation(a: Mat4): Vec3;
/**
 * Writes translation component of matrix `a` into `out`.
 */
export declare function mat4GetTranslationOut(out: Vec3, a: Mat4): Vec3;
/**
 * Extracts uniform/non-uniform scale from the upper-left 3x3 of a 4x4 matrix.
 * Returns magnitudes of the basis vectors (always non-negative).
 * @param a Source matrix
 * @returns Scale as [sx, sy, sz]
 */
export declare function mat4GetScale(a: Mat4): Vec3;
/**
 * Writes scale components of matrix `a` into `out`.
 */
export declare function mat4GetScaleOut(out: Vec3, a: Mat4): Vec3;
/**
 * Extracts the rotation (as a quaternion [x, y, z, w]) from a 4x4 TRS matrix.
 * Any scale is factored out before converting to a quaternion.
 * @param a Source matrix
 * @returns Rotation quaternion [x, y, z, w]
 */
export declare function mat4GetRotation(a: Mat4): Quat;
/**
 * Writes rotation (as quaternion) extracted from matrix `a` into `out`.
 * Any scale is factored out before converting to quaternion.
 */
export declare function mat4GetRotationOut(out: Quat, a: Mat4): Quat;
/**
 * Linearly interpolate between two matrices
 * @param out - Output matrix
 * @param a - First matrix
 * @param b - Second matrix
 * @param t - Interpolation factor (0 to 1)
 * @returns The interpolated matrix
 */
export declare function mat4Lerp(out: Mat4, a: Mat4, b: Mat4, t: number): Mat4;
/**
 * Returns a normalized copy of the provided 3D vector.
 * @param vec - Vector to normalize. Must be non-zero.
 * @returns A new normalized vector.
 * @throws {RangeError} If the vector has zero length.
 * @throws {TypeError} If `vec` is not a valid `Vec3`.
 */
export declare function normalizeVec3(vec: Vec3): Vec3;
/**
 * Normalizes `vec` into `out`.
 * @param out Destination vector
 * @param vec Source vector (must be non-zero)
 */
export declare function normalizeVec3Out(out: Vec3, vec: Vec3): Vec3;
export declare function normalizeVec3Like(vec: Vec3Like): Vec3;
/**
 * Normalizes the provided quaternion.
 * @param q - Quaternion to normalize.
 * @returns A new normalized quaternion.
 * @throws {RangeError} If `q` has zero length.
 * @throws {TypeError} If `q` is not a valid `Quat`.
 */
export declare function quatNormalize(q: Quat): Quat;
/**
 * Normalizes quaternion `q` into `out`.
 */
export declare function quatNormalizeOut(out: Quat, q: Quat): Quat;
/**
 * Multiplies two quaternions.
 * @param a - Left operand quaternion.
 * @param b - Right operand quaternion.
 * @returns A new quaternion representing `a * b`.
 * @throws {TypeError} If either argument is not a valid `Quat`.
 */
export declare function quatMultiply(a: Quat, b: Quat): Quat;
export declare function quatMultiplyOut(out: Quat, a: Quat, b: Quat): Quat;
/**
 * Creates a quaternion that represents a rotation around an arbitrary axis.
 * @param axis - Axis of rotation. Must be non-zero.
 * @param angle - Rotation angle in radians.
 * @returns A new quaternion representing the axis-angle rotation.
 * @throws {RangeError} If the axis is zero length or if `angle` is not finite.
 * @throws {TypeError} If `axis` is not a valid `Vec3`.
 */
export declare function quatFromAxisAngle(axis: Vec3, angle: number): Quat;
export declare function quatFromAxisAngleOut(out: Quat, axis: Vec3, angle: number): Quat;
/**
 * Converts a quaternion to Euler angles (XYZ order) in radians.
 * @param q - Quaternion to convert.
 * @returns Euler angles [x, y, z] in radians.
 * @throws {TypeError} If `q` is not a valid `Quat`.
 */
export declare function quatToEuler(q: Quat): Vec3;
/**
 * Creates a quaternion from Euler angles (XYZ order) in radians.
 * @param euler - Euler angles [x, y, z] in radians.
 * @returns A new quaternion.
 * @throws {TypeError} If `euler` is not a valid `Vec3`.
 */
export declare function quatFromEuler(euler: Vec3): Quat;
export declare function quatFromEulerOut(out: Quat, euler: Vec3): Quat;
/**
 * Converts a quaternion to a 3x3 rotation matrix (column-major order).
 * @param q - Quaternion to convert.
 * @returns A 9-element array representing the 3x3 rotation matrix in column-major order.
 * @throws {TypeError} If `q` is not a valid `Quat`.
 */
export declare function quatToMatrix3(q: Quat): number[];
/**
 * Converts a quaternion to a 3x3 rotation matrix (column-major order), writing to output buffer.
 * This is an allocation-free version for performance-critical code paths.
 * @param out - Output Float32Array (must have length >= 9) to receive the rotation matrix.
 * @param q - Quaternion to convert.
 * @returns The same `out` array populated with the rotation matrix values.
 * @throws {TypeError} If `q` is not a valid `Quat` or `out` is too small.
 */
export declare function quatToMatrix3Out(out: Float32Array, q: Quat): Float32Array;
/**
 * Transforms a vector by a quaternion (rotation)
 * @param vec The vector to transform
 * @param quat The quaternion representing the rotation
 * @returns The transformed vector
 */
export declare function transformVec3ByQuat(vec: Vec3, quat: Quat): Vec3;
export declare function transformVec3ByQuatOut(out: Vec3, vec: Vec3, quat: Quat): Vec3;
/**
 * Adds two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The sum of a and b
 */
export declare function addVec3(a: Vec3, b: Vec3): Vec3;
export declare function addVec3Out(out: Vec3, a: Vec3, b: Vec3): Vec3;
/**
 * Subtracts two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The difference a - b
 */
export declare function subVec3(a: Vec3, b: Vec3): Vec3;
export declare function subVec3Out(out: Vec3, a: Vec3, b: Vec3): Vec3;
/**
 * Scales a Vec3 vector by a scalar
 * @param vec The vector to scale
 * @param scalar The scalar value
 * @returns The scaled vector
 */
export declare function scaleVec3(vec: Vec3, scalar: number): Vec3;
export declare function scaleVec3Out(out: Vec3, vec: Vec3, scalar: number): Vec3;
/**
 * Calculates the dot product of two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The dot product
 */
export declare function dotVec3(a: Vec3, b: Vec3): number;
/**
 * Calculates the cross product of two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The cross product a × b
 */
export declare function crossVec3(a: Vec3, b: Vec3): Vec3;
export declare function crossVec3Out(out: Vec3, a: Vec3, b: Vec3): Vec3;
/**
 * Calculates the length (magnitude) of a Vec3 vector
 * @param vec The vector
 * @returns The length
 */
export declare function lengthVec3(vec: Vec3): number;
/**
 * Clamps each component of `vec` to the inclusive range [minVal, maxVal]
 * @param vec Vector to clamp
 * @param minVal Minimum value
 * @param maxVal Maximum value
 * @returns New clamped vector
 */
export declare function clampVec3(vec: Vec3, minVal: number, maxVal: number): Vec3;
/**
 * Component-wise minimum of two vectors
 * @param a First vector
 * @param b Second vector
 * @returns Component-wise min(a, b)
 */
export declare function minVec3(a: Vec3, b: Vec3): Vec3;
/**
 * Component-wise maximum of two vectors
 * @param a First vector
 * @param b Second vector
 * @returns Component-wise max(a, b)
 */
export declare function maxVec3(a: Vec3, b: Vec3): Vec3;
/**
 * Approximate equality test for two Vec3 using epsilon tolerance per component.
 * @param a First vector
 * @param b Second vector
 * @param epsilon Tolerance (default 1e-6)
 * @returns true if all components are within epsilon
 */
export declare function vec3Equals(a: Vec3, b: Vec3, epsilon?: number): boolean;
/**
 * Calculates the squared length of a Vec3 vector (faster than lengthVec3)
 * @param vec The vector
 * @returns The squared length
 */
export declare function lengthSquaredVec3(vec: Vec3): number;
/**
 * Calculates the distance between two Vec3 vectors
 * @param a First vector
 * @param b Second vector
 * @returns The distance between a and b
 */
export declare function distanceVec3(a: Vec3, b: Vec3): number;
/**
 * Computes squared distance (faster than distanceVec3) between two vectors.
 */
export declare function distanceSquaredVec3(a: Vec3, b: Vec3): number;
/**
 * Linearly interpolates between two Vec3 vectors
 * @param a Start vector
 * @param b End vector
 * @param t Interpolation factor (0-1)
 * @returns The interpolated vector
 */
export declare function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3;
export declare function lerpVec3Out(out: Vec3, a: Vec3, b: Vec3, t: number): Vec3;
/**
 * Computes the inverse of a quaternion
 * @param q The quaternion to invert
 * @returns The inverse quaternion
 */
export declare function quatInverse(q: Quat): Quat;
export declare function quatInverseOut(out: Quat, q: Quat): Quat;
/**
 * Spherical linear interpolation between two quaternions
 * @param a Start quaternion
 * @param b End quaternion
 * @param t Interpolation factor (0-1)
 * @returns The interpolated quaternion
 */
export declare function quatSlerp(a: Quat, b: Quat, t: number): Quat;
export declare function quatSlerpOut(out: Quat, a: Quat, b: Quat, t: number): Quat;
/**
 * Frustum plane in Hessian normal form: n·p + d = 0
 */
export interface FrustumPlane {
    /** Plane normal (nx, ny, nz) */
    normal: Vec3;
    /** Plane distance from origin */
    d: number;
}
/**
 * Extracts frustum planes from a view-projection matrix.
 * @param out - Output array of 6 frustum planes (must have length >= 6)
 * @param vp - View-projection matrix (column-major)
 * @returns Array of 6 frustum planes [left, right, bottom, top, near, far]
 */
export declare function extractFrustumPlanes(out: FrustumPlane[], vp: Mat4): FrustumPlane[];
/**
 * Tests if an AABB intersects with a frustum plane.
 * @param aabbMin - AABB minimum corner
 * @param aabbMax - AABB maximum corner
 * @param plane - Frustum plane
 * @returns Positive distance if AABB is in front of plane, negative if behind
 */
export declare function frustumPlaneTestAABB(aabbMin: Vec3, aabbMax: Vec3, plane: FrustumPlane): number;
export { cullAABBBatch } from './culling.js';
//# sourceMappingURL=index.d.ts.map
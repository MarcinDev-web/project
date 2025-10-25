import { Entity } from '../core/Entity';
import { mat4Invert } from '@engine/core/math';
/**
 * Raycaster for mouse picking and intersection tests.
 *
 * This is an instance-based class (not static) for better performance and memory management.
 * Use object pooling for rays to reduce allocations in hot code paths.
 *
 * @example
 * ```ts
 * const raycaster = new Raycaster();
 * const ray = raycaster.createRayFromScreen(mouseX, mouseY, width, height, view, proj);
 * const hit = raycaster.raycastClosest(ray, entities);
 * raycaster.recycleRay(ray); // Recycle when done
 * ```
 */
export class Raycaster {
    /** Scratch buffer for matrix inversions - reused to avoid allocations */
    scratchMat;
    /** Ray object pool - reuse rays to reduce GC pressure */
    rayPool = [];
    /**
     * Creates a new Raycaster instance.
     */
    constructor() {
        this.scratchMat = new Float32Array(16);
    }
    /**
     * Creates a ray from screen coordinates through the camera.
     * Uses object pooling to reduce allocations.
     *
     * @param x - Screen X coordinate (0 to canvas.width)
     * @param y - Screen Y coordinate (0 to canvas.height)
     * @param canvasWidth - Canvas width in pixels
     * @param canvasHeight - Canvas height in pixels
     * @param viewMatrix - Camera view matrix
     * @param projectionMatrix - Camera projection matrix
     * @returns Ray in world space (from pool if available)
     */
    createRayFromScreen(x, y, canvasWidth, canvasHeight, viewMatrix, projectionMatrix) {
        // Get ray from pool or create new one
        const ray = this.rayPool.pop() ?? {
            origin: [0, 0, 0],
            direction: [0, 0, 0],
        };
        // Convert screen coordinates to NDC (Normalized Device Coordinates)
        const ndcX = (x / canvasWidth) * 2 - 1;
        const ndcY = 1 - (y / canvasHeight) * 2; // Y is inverted in screen space
        // Create ray in clip space
        const clipRay = [ndcX, ndcY, -1, 1];
        // Inverse projection to get ray in view space
        const invProj = this.invertMatrix(projectionMatrix);
        const viewRay = this.transformVector4(clipRay, invProj);
        viewRay[2] = -1;
        viewRay[3] = 0;
        // Inverse view to get ray in world space
        const invView = this.invertMatrix(viewMatrix);
        const worldRay = this.transformVector4(viewRay, invView);
        // Normalize direction (safe for noUncheckedIndexedAccess)
        const wx = worldRay[0] ?? 0;
        const wy = worldRay[1] ?? 0;
        const wz = worldRay[2] ?? 0;
        const len = Math.hypot(wx, wy, wz) || 1;
        // Populate ray
        ray.origin[0] = invView[12] ?? 0;
        ray.origin[1] = invView[13] ?? 0;
        ray.origin[2] = invView[14] ?? 0;
        ray.direction[0] = wx / len;
        ray.direction[1] = wy / len;
        ray.direction[2] = wz / len;
        return ray;
    }
    /**
     * Returns a ray to the pool for reuse.
     * Call this when you're done with a ray to reduce allocations.
     *
     * @param ray - Ray to recycle
     */
    recycleRay(ray) {
        if (this.rayPool.length < 100) {
            // Cap pool size to prevent unbounded growth
            this.rayPool.push(ray);
        }
    }
    /**
     * Tests if a ray intersects an entity's bounding volume.
     * Supports AABB, Sphere, and OBB bounds types.
     * @param ray - The ray to test
     * @param entity - The entity to test against
     * @returns RaycastHit if intersection occurs, null otherwise
     */
    raycastEntity(ray, entity) {
        if (!entity.active) {
            return null;
        }
        // Get entity world position and scale
        const worldPos = entity.transform.getWorldPosition();
        const scale = entity.transform.scale;
        let t = null;
        // Use custom bounds if available
        if (entity.meshBounds) {
            switch (entity.meshBounds.type) {
                case 'sphere': {
                    const sphereBounds = entity.meshBounds.sphere;
                    if (sphereBounds) {
                        // Transform sphere center to world space
                        const worldCenter = [
                            worldPos[0] + sphereBounds.center[0] * scale[0],
                            worldPos[1] + sphereBounds.center[1] * scale[1],
                            worldPos[2] + sphereBounds.center[2] * scale[2],
                        ];
                        // Scale radius by average scale
                        const avgScale = (scale[0] + scale[1] + scale[2]) / 3;
                        const worldRadius = sphereBounds.radius * avgScale;
                        t = this.intersectSphere(ray, worldCenter, worldRadius);
                    }
                    break;
                }
                case 'obb': {
                    const obbBounds = entity.meshBounds.obb;
                    if (obbBounds) {
                        // Transform OBB to world space
                        const worldOBB = {
                            center: [
                                worldPos[0] + obbBounds.center[0] * scale[0],
                                worldPos[1] + obbBounds.center[1] * scale[1],
                                worldPos[2] + obbBounds.center[2] * scale[2],
                            ],
                            halfExtents: [
                                obbBounds.halfExtents[0] * scale[0],
                                obbBounds.halfExtents[1] * scale[1],
                                obbBounds.halfExtents[2] * scale[2],
                            ],
                            rotation: obbBounds.rotation,
                        };
                        t = this.intersectOBB(ray, worldOBB);
                    }
                    break;
                }
                case 'aabb': {
                    const aabbBounds = entity.meshBounds.aabb;
                    if (aabbBounds) {
                        // Transform AABB to world space
                        const worldAABB = {
                            min: [
                                worldPos[0] + aabbBounds.min[0] * scale[0],
                                worldPos[1] + aabbBounds.min[1] * scale[1],
                                worldPos[2] + aabbBounds.min[2] * scale[2],
                            ],
                            max: [
                                worldPos[0] + aabbBounds.max[0] * scale[0],
                                worldPos[1] + aabbBounds.max[1] * scale[1],
                                worldPos[2] + aabbBounds.max[2] * scale[2],
                            ],
                        };
                        t = this.intersectAABB(ray, worldAABB);
                    }
                    break;
                }
            }
        }
        else {
            // Default: use AABB from scale (cube mesh with size 1x1x1)
            const halfSize = [scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5];
            const aabb = {
                min: [worldPos[0] - halfSize[0], worldPos[1] - halfSize[1], worldPos[2] - halfSize[2]],
                max: [worldPos[0] + halfSize[0], worldPos[1] + halfSize[1], worldPos[2] + halfSize[2]],
            };
            t = this.intersectAABB(ray, aabb);
        }
        if (t === null) {
            return null;
        }
        // Calculate hit point
        const point = [
            ray.origin[0] + ray.direction[0] * t,
            ray.origin[1] + ray.direction[1] * t,
            ray.origin[2] + ray.direction[2] * t,
        ];
        return {
            entity,
            distance: t,
            point,
        };
    }
    /**
     * Raycasts against multiple entities and returns all hits sorted by distance.
     * @param ray - The ray to test
     * @param entities - Entities to test against
     * @returns Array of hits sorted by distance (closest first)
     */
    raycastAll(ray, entities) {
        const hits = [];
        for (const entity of entities) {
            const hit = this.raycastEntity(ray, entity);
            if (hit) {
                hits.push(hit);
            }
        }
        // Sort by distance (closest first)
        hits.sort((a, b) => a.distance - b.distance);
        return hits;
    }
    /**
     * Raycasts and returns the closest hit.
     * @param ray - The ray to test
     * @param entities - Entities to test against
     * @returns Closest hit or null
     */
    raycastClosest(ray, entities) {
        const hits = this.raycastAll(ray, entities);
        return hits[0] ?? null;
    }
    /**
     * Tests ray-AABB intersection using slab method.
     * @param ray - The ray to test
     * @param aabb - Axis-aligned bounding box
     * @returns Distance to intersection or null if no intersection
     */
    intersectAABB(ray, aabb) {
        let tmin = -Infinity;
        let tmax = Infinity;
        // Test X slab
        if (Math.abs(ray.direction[0]) > 1e-10) {
            const tx1 = (aabb.min[0] - ray.origin[0]) / ray.direction[0];
            const tx2 = (aabb.max[0] - ray.origin[0]) / ray.direction[0];
            tmin = Math.max(tmin, Math.min(tx1, tx2));
            tmax = Math.min(tmax, Math.max(tx1, tx2));
        }
        else if (ray.origin[0] < aabb.min[0] || ray.origin[0] > aabb.max[0]) {
            return null;
        }
        // Test Y slab
        if (Math.abs(ray.direction[1]) > 1e-10) {
            const ty1 = (aabb.min[1] - ray.origin[1]) / ray.direction[1];
            const ty2 = (aabb.max[1] - ray.origin[1]) / ray.direction[1];
            tmin = Math.max(tmin, Math.min(ty1, ty2));
            tmax = Math.min(tmax, Math.max(ty1, ty2));
        }
        else if (ray.origin[1] < aabb.min[1] || ray.origin[1] > aabb.max[1]) {
            return null;
        }
        // Test Z slab
        if (Math.abs(ray.direction[2]) > 1e-10) {
            const tz1 = (aabb.min[2] - ray.origin[2]) / ray.direction[2];
            const tz2 = (aabb.max[2] - ray.origin[2]) / ray.direction[2];
            tmin = Math.max(tmin, Math.min(tz1, tz2));
            tmax = Math.min(tmax, Math.max(tz1, tz2));
        }
        else if (ray.origin[2] < aabb.min[2] || ray.origin[2] > aabb.max[2]) {
            return null;
        }
        // Check if intersection is valid
        if (tmax < tmin || tmax < 0) {
            return null;
        }
        // Return closest intersection in front of ray
        return tmin >= 0 ? tmin : tmax;
    }
    /**
     * Tests ray-sphere intersection using geometric method.
     * @param ray - The ray to test
     * @param center - Sphere center in world space
     * @param radius - Sphere radius
     * @returns Distance to intersection or null if no intersection
     */
    intersectSphere(ray, center, radius) {
        // Vector from ray origin to sphere center
        const ocX = center[0] - ray.origin[0];
        const ocY = center[1] - ray.origin[1];
        const ocZ = center[2] - ray.origin[2];
        // Project oc onto ray direction
        const tca = ocX * ray.direction[0] + ocY * ray.direction[1] + ocZ * ray.direction[2];
        // Sphere is behind ray
        if (tca < 0) {
            return null;
        }
        // Distance squared from sphere center to ray
        const ocLengthSq = ocX * ocX + ocY * ocY + ocZ * ocZ;
        const d2 = ocLengthSq - tca * tca;
        // Ray misses sphere
        const radius2 = radius * radius;
        if (d2 > radius2) {
            return null;
        }
        // Distance from projection point to intersection
        const thc = Math.sqrt(radius2 - d2);
        // Two intersection points
        const t0 = tca - thc;
        const t1 = tca + thc;
        // Return closest intersection in front of ray
        if (t0 >= 0)
            return t0;
        if (t1 >= 0)
            return t1;
        return null;
    }
    /**
     * Tests ray-OBB intersection using separating axis theorem.
     * This is a simplified version that transforms the ray to OBB local space.
     * @param ray - The ray to test
     * @param obb - Oriented bounding box in world space
     * @returns Distance to intersection or null if no intersection
     */
    intersectOBB(ray, obb) {
        // For simplicity, we transform the ray to OBB local space
        // and then treat it as an AABB test
        // Extract rotation quaternion
        const [qx, qy, qz, qw] = obb.rotation;
        // Compute inverse rotation (conjugate for unit quaternion)
        const invQx = -qx;
        const invQy = -qy;
        const invQz = -qz;
        const invQw = qw;
        // Transform ray origin to OBB local space
        // First, translate to OBB center
        const localOriginX = ray.origin[0] - obb.center[0];
        const localOriginY = ray.origin[1] - obb.center[1];
        const localOriginZ = ray.origin[2] - obb.center[2];
        // Then rotate by inverse quaternion
        const rotatedOrigin = this.rotateVectorByQuaternion([localOriginX, localOriginY, localOriginZ], [invQx, invQy, invQz, invQw]);
        // Transform ray direction to OBB local space (no translation needed)
        const rotatedDirection = this.rotateVectorByQuaternion(ray.direction, [invQx, invQy, invQz, invQw]);
        // Create local space AABB
        const localAABB = {
            min: [
                -obb.halfExtents[0],
                -obb.halfExtents[1],
                -obb.halfExtents[2],
            ],
            max: [
                obb.halfExtents[0],
                obb.halfExtents[1],
                obb.halfExtents[2],
            ],
        };
        // Create local space ray
        const localRay = {
            origin: rotatedOrigin,
            direction: rotatedDirection,
        };
        // Test against local AABB
        return this.intersectAABB(localRay, localAABB);
    }
    /**
     * Rotates a vector by a quaternion.
     * @param v - Vector to rotate
     * @param q - Quaternion [x, y, z, w]
     * @returns Rotated vector
     */
    rotateVectorByQuaternion(v, q) {
        const [qx, qy, qz, qw] = q;
        const [vx, vy, vz] = v;
        // v' = q * v * q^-1
        // Optimized formula: v' = v + 2 * cross(q.xyz, cross(q.xyz, v) + q.w * v)
        const ix = qw * vx + qy * vz - qz * vy;
        const iy = qw * vy + qz * vx - qx * vz;
        const iz = qw * vz + qx * vy - qy * vx;
        const iw = -qx * vx - qy * vy - qz * vz;
        return [
            ix * qw + iw * -qx + iy * -qz - iz * -qy,
            iy * qw + iw * -qy + iz * -qx - ix * -qz,
            iz * qw + iw * -qz + ix * -qy - iy * -qx,
        ];
    }
    /**
     * Inverts a 4x4 matrix using the instance's scratch buffer.
     * @param m - Matrix to invert
     * @returns Inverted matrix (reuses scratch buffer)
     */
    invertMatrix(m) {
        return mat4Invert(this.scratchMat, m);
    }
    /**
     * Transforms a 4D vector by a matrix.
     * @param v - Vector to transform
     * @param m - Transformation matrix
     * @returns Transformed vector
     */
    transformVector4(v, m) {
        const v0 = v[0] ?? 0;
        const v1 = v[1] ?? 0;
        const v2 = v[2] ?? 0;
        const v3 = v[3] ?? 0;
        return [
            v0 * (m[0] ?? 0) + v1 * (m[4] ?? 0) + v2 * (m[8] ?? 0) + v3 * (m[12] ?? 0),
            v0 * (m[1] ?? 0) + v1 * (m[5] ?? 0) + v2 * (m[9] ?? 0) + v3 * (m[13] ?? 0),
            v0 * (m[2] ?? 0) + v1 * (m[6] ?? 0) + v2 * (m[10] ?? 0) + v3 * (m[14] ?? 0),
            v0 * (m[3] ?? 0) + v1 * (m[7] ?? 0) + v2 * (m[11] ?? 0) + v3 * (m[15] ?? 0),
        ];
    }
}
//# sourceMappingURL=Raycaster.js.map
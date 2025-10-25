/**
 * Instance Data Management System
 *
 * Efficiently builds and manages per-instance GPU data for rendering.
 * Reuses buffers to eliminate per-frame allocations.
 *
 * Performance: Zero-allocation instance data building for large scenes.
 */
import { MaterialComponent } from '../../scene/components/MaterialComponent';
/**
 * InstanceDataBuilder builds instance data by reusing internal buffers.
 * Avoids per-frame allocations for better performance.
 */
export class InstanceDataBuilder {
    offsetBuffer;
    colorScaleBuffer;
    rotationBuffer;
    materialIdBuffer;
    capacity;
    constructor(initialCapacity = 1000) {
        this.capacity = initialCapacity;
        this.offsetBuffer = new Float32Array(initialCapacity * 3);
        this.colorScaleBuffer = new Float32Array(initialCapacity * 4);
        this.rotationBuffer = new Float32Array(initialCapacity * 4);
        this.materialIdBuffer = new Float32Array(initialCapacity);
    }
    /**
     * Grows internal buffers to accommodate more instances.
     */
    grow(newCapacity) {
        this.capacity = newCapacity;
        this.offsetBuffer = new Float32Array(newCapacity * 3);
        this.colorScaleBuffer = new Float32Array(newCapacity * 4);
        this.rotationBuffer = new Float32Array(newCapacity * 4);
        this.materialIdBuffer = new Float32Array(newCapacity);
    }
    /**
     * Builds instance data by reusing internal buffers.
     * Returns views into reusable buffers (no allocations).
     */
    build(entities) {
        const count = entities.length;
        // Grow if needed (only reallocates when exceeding capacity)
        if (count > this.capacity) {
            this.grow(Math.max(count, this.capacity * 2));
        }
        // Fill buffers
        for (let i = 0; i < count; i++) {
            const entity = entities[i];
            if (!entity)
                continue;
            const pos = entity.transform.getWorldPosition();
            const rot = entity.transform.rotation;
            const scale = entity.transform.scale;
            // Position
            this.offsetBuffer[i * 3 + 0] = pos[0];
            this.offsetBuffer[i * 3 + 1] = pos[1];
            this.offsetBuffer[i * 3 + 2] = pos[2];
            // Color and scale
            const material = entity.getComponent(MaterialComponent);
            const color = material?.color ?? [1, 1, 1, 1];
            this.colorScaleBuffer[i * 4 + 0] = color[0];
            this.colorScaleBuffer[i * 4 + 1] = color[1];
            this.colorScaleBuffer[i * 4 + 2] = color[2];
            const maxScale = Math.max(scale[0], scale[1], scale[2]);
            this.colorScaleBuffer[i * 4 + 3] = maxScale;
            // Rotation (quaternion)
            this.rotationBuffer[i * 4 + 0] = rot[0];
            this.rotationBuffer[i * 4 + 1] = rot[1];
            this.rotationBuffer[i * 4 + 2] = rot[2];
            this.rotationBuffer[i * 4 + 3] = rot[3];
            // Material ID (for texture atlas)
            this.materialIdBuffer[i] = material?.materialId ?? 0;
        }
        // Return views (no allocations)
        return {
            instanceCount: count,
            instanceOffsetData: this.offsetBuffer.subarray(0, count * 3),
            instanceColorScaleData: this.colorScaleBuffer.subarray(0, count * 4),
            instanceRotationData: this.rotationBuffer.subarray(0, count * 4),
            instanceMaterialIdData: this.materialIdBuffer.subarray(0, count),
        };
    }
    /**
     * Gets current capacity.
     */
    getCapacity() {
        return this.capacity;
    }
}
/**
 * InstanceManager coordinates instance data building and scene updates.
 */
export class InstanceManager {
    builder;
    constructor(initialCapacity = 1000) {
        this.builder = new InstanceDataBuilder(initialCapacity);
    }
    /**
     * Builds instance data from scene entities.
     */
    buildFromScene(scene, frustum) {
        const allEntities = scene.getActiveEntities();
        let entities = allEntities;
        // Apply frustum culling if provided
        if (frustum) {
            // Note: Frustum culling is handled by FrustumCuller externally
            // This is just a placeholder for potential future integration
            entities = allEntities;
        }
        return this.builder.build(entities);
    }
    /**
     * Builds instance data from entity array.
     */
    buildFromEntities(entities) {
        return this.builder.build(entities);
    }
    /**
     * Gets the internal builder's capacity.
     */
    getCapacity() {
        return this.builder.getCapacity();
    }
}
/**
 * Creates instance data from scene entities.
 * Legacy function for backward compatibility.
 * @deprecated Use InstanceManager for better performance
 */
export function createInstanceDataFromScene(scene, frustum) {
    const allEntities = scene.getActiveEntities();
    let entities = allEntities;
    if (frustum) {
        // Frustum culling would be done by FrustumCuller externally
        entities = allEntities;
    }
    // Legacy path: still allocates per call
    const builder = new InstanceDataBuilder(entities.length);
    return builder.build(entities);
}
//# sourceMappingURL=InstanceManager.js.map
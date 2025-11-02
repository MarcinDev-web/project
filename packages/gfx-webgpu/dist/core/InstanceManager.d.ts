/**
 * Instance Data Management System
 *
 * Efficiently builds and manages per-instance GPU data for rendering.
 * Reuses buffers to eliminate per-frame allocations.
 *
 * Performance: Zero-allocation instance data building for large scenes.
 */
import type { Entity, Scene } from '@engine/world';
import { MeshComponent } from '@engine/world';
import type { Frustum } from './FrustumCuller';
export interface InstanceData {
    instanceCount: number;
    opaqueCount: number;
    instanceOffsetData: Float32Array;
    instanceColorScaleData: Float32Array;
    instanceSecondaryColorData: Float32Array;
    instanceEmissiveColorData: Float32Array;
    instanceMaterialParamsData: Float32Array;
    instanceRotationData: Float32Array;
    instanceMaterialIdData: Float32Array;
}
/**
 * Entity with custom geometry (meshData)
 */
export interface CustomGeometryEntity {
    entity: Entity;
    meshComponent: MeshComponent;
}
/**
 * InstanceDataBuilder builds instance data by reusing internal buffers.
 * Avoids per-frame allocations for better performance.
 */
export declare class InstanceDataBuilder {
    private offsetBuffer;
    private colorScaleBuffer;
    private secondaryColorBuffer;
    private emissiveColorBuffer;
    private materialParamsBuffer;
    private rotationBuffer;
    private materialIdBuffer;
    private capacity;
    constructor(initialCapacity?: number);
    /**
     * Grows internal buffers to accommodate more instances.
     */
    private grow;
    /**
     * Separates entities with custom meshData from default geometry entities
     */
    separateCustomGeometry(entities: Entity[]): {
        defaultGeometry: Entity[];
        customGeometry: CustomGeometryEntity[];
    };
    /**
     * Builds instance data by reusing internal buffers.
     * Returns views into reusable buffers (no allocations).
     * Only processes entities without custom meshData.
     */
    build(entities: Entity[]): InstanceData;
    /**
     * Gets current capacity.
     */
    getCapacity(): number;
}
/**
 * InstanceManager coordinates instance data building and scene updates.
 */
export declare class InstanceManager {
    private builder;
    constructor(initialCapacity?: number);
    /**
     * Builds instance data from scene entities.
     */
    buildFromScene(scene: Scene, frustum?: Frustum): InstanceData;
    /**
     * Builds instance data from entity array.
     */
    buildFromEntities(entities: Entity[]): InstanceData;
    /**
     * Gets the internal builder's capacity.
     */
    getCapacity(): number;
}
/**
 * Creates instance data from scene entities.
 * Legacy function for backward compatibility.
 * @deprecated Use InstanceManager for better performance
 */
export declare function createInstanceDataFromScene(scene: Scene, frustum?: Frustum): InstanceData;
//# sourceMappingURL=InstanceManager.d.ts.map
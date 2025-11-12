/**
 * Instance Data Management System
 *
 * Efficiently builds and manages per-instance GPU data for rendering.
 * Reuses buffers to eliminate per-frame allocations.
 *
 * Performance: Zero-allocation instance data building for large scenes.
 */

import type { Entity, Scene } from '@engine/world';
import { MaterialComponent, MeshComponent } from '@engine/world';
import type { Frustum } from './FrustumCuller';
import { Logger } from '@engine/core/utils';
import { generateSphereMesh, generateCapsuleY, generateHeroicTorsoMesh } from '@engine/avatar';

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
export class InstanceDataBuilder {
  private offsetBuffer: Float32Array;
  private colorScaleBuffer: Float32Array;
  private secondaryColorBuffer: Float32Array;
  private emissiveColorBuffer: Float32Array;
  private materialParamsBuffer: Float32Array;
  private rotationBuffer: Float32Array;
  private materialIdBuffer: Float32Array;
  private capacity: number;

  constructor(initialCapacity = 1000) {
    this.capacity = initialCapacity;
    this.offsetBuffer = new Float32Array(initialCapacity * 3);
    this.colorScaleBuffer = new Float32Array(initialCapacity * 4);
    this.secondaryColorBuffer = new Float32Array(initialCapacity * 4);
    this.emissiveColorBuffer = new Float32Array(initialCapacity * 4);
    this.materialParamsBuffer = new Float32Array(initialCapacity * 4);
    this.rotationBuffer = new Float32Array(initialCapacity * 4);
    this.materialIdBuffer = new Float32Array(initialCapacity);
  }

  /**
   * Grows internal buffers to accommodate more instances.
   */
  private grow(newCapacity: number): void {
    this.capacity = newCapacity;
    this.offsetBuffer = new Float32Array(newCapacity * 3);
    this.colorScaleBuffer = new Float32Array(newCapacity * 4);
    this.secondaryColorBuffer = new Float32Array(newCapacity * 4);
    this.emissiveColorBuffer = new Float32Array(newCapacity * 4);
    this.materialParamsBuffer = new Float32Array(newCapacity * 4);
    this.rotationBuffer = new Float32Array(newCapacity * 4);
    this.materialIdBuffer = new Float32Array(newCapacity);
  }

  /**
   * Separates entities with custom meshData from default geometry entities.
   * Generates fallback geometry for meshType='sphere' if meshData is missing.
   */
  separateCustomGeometry(entities: Entity[]): {
    defaultGeometry: Entity[];
    customGeometry: CustomGeometryEntity[];
  } {
    const defaultGeometry: Entity[] = [];
    const customGeometry: CustomGeometryEntity[] = [];

    for (const entity of entities) {
      if (!entity) continue;
      const meshComponent = entity.getComponent(MeshComponent);
      
      if (!meshComponent) {
        defaultGeometry.push(entity);
        continue;
      }

      // Entity has custom geometry if meshData is present
      if (meshComponent.meshData?.vertices && meshComponent.meshData.indices) {
        customGeometry.push({ entity, meshComponent });
        continue;
      }

      // Fallback: generate geometry for procedural mesh types if meshData is missing
      let fallbackGeometry: ReturnType<typeof generateSphereMesh> | null = null;
      
      if (meshComponent.meshType === 'sphere') {
        try {
          fallbackGeometry = generateSphereMesh(16);
        } catch (error) {
          Logger.warn(
            `[InstanceManager] Failed to generate fallback sphere geometry for entity "${entity.name || entity.id || 'unnamed'}":`,
            error
          );
        }
      } else if (meshComponent.meshType === 'capsule_y') {
        try {
          fallbackGeometry = generateCapsuleY(0.5, 1.0, 16, 8);
        } catch (error) {
          Logger.warn(
            `[InstanceManager] Failed to generate fallback capsule_y geometry for entity "${entity.name || entity.id || 'unnamed'}":`,
            error
          );
        }
      } else if (meshComponent.meshType === 'avatar_torso') {
        try {
          fallbackGeometry = generateHeroicTorsoMesh();
        } catch (error) {
          Logger.warn(
            `[InstanceManager] Failed to generate fallback avatar_torso geometry for entity "${entity.name || entity.id || 'unnamed'}":`,
            error
          );
        }
      }

      if (fallbackGeometry?.vertices && fallbackGeometry.indices) {
        meshComponent.meshData = fallbackGeometry;
        customGeometry.push({ entity, meshComponent });
        Logger.debug(
          `[InstanceManager] Generated fallback ${meshComponent.meshType} geometry for entity "${entity.name || entity.id || 'unnamed'}"`
        );
        continue;
      }

      // No custom geometry available - use default (cube)
      defaultGeometry.push(entity);
    }

    return { defaultGeometry, customGeometry };
  }

  /**
   * Builds instance data by reusing internal buffers.
   * Returns views into reusable buffers (no allocations).
   * Only processes entities without custom meshData.
   */
  build(entities: Entity[]): InstanceData {
    // Filter out entities with custom geometry
    const entitiesWithoutCustom = entities.filter(e => {
      if (!e) return false;
      const meshComponent = e.getComponent(MeshComponent);
      return !meshComponent?.meshData?.vertices || !meshComponent.meshData.indices;
    });

    const count = entitiesWithoutCustom.length;
    if (count === 0) {
      Logger.debug('[InstanceManager] build(): no renderable entities detected in scene');
    } else {
      Logger.debug('[InstanceManager] build(): processing entities', { count });
    }

    // Grow if needed (only reallocates when exceeding capacity)
    if (count > this.capacity) {
      this.grow(Math.max(count, this.capacity * 2));
    }

    let opaqueCount = 0;
    for (let i = 0; i < count; i++) {
      const entity = entitiesWithoutCustom[i];
      if (!entity) continue;
      const material = entity.getComponent(MaterialComponent);
      const alpha = material?.primaryColor?.[3] ?? material?.opacity ?? 1;
      const flags = material?.flags ?? 0;
      const isTransparent =
        (flags & MaterialComponent.FLAG_TRANSPARENT) !== 0 || alpha < 0.999;
      if (!isTransparent) {
        opaqueCount++;
      }
    }

    let opaqueCursor = 0;
    let transparentCursor = opaqueCount;

    // Fill buffers with opaques first, transparent instances appended after
    for (let i = 0; i < count; i++) {
      const entity = entitiesWithoutCustom[i];
      if (!entity) continue;

      const pos = entity.transform.getWorldPosition();
      const rot = entity.transform.rotation;
      const scale = entity.transform.scale;
      const material = entity.getComponent(MaterialComponent);
      const primary = material?.primaryColor ?? [1, 1, 1, 1];
      const alpha = primary[3] ?? (material?.opacity ?? 1);
      const flags = material?.flags ?? 0;
      const isTransparent =
        (flags & MaterialComponent.FLAG_TRANSPARENT) !== 0 || alpha < 0.999;
      const index = isTransparent ? transparentCursor++ : opaqueCursor++;

      // Position
      this.offsetBuffer[index * 3 + 0] = pos[0];
      this.offsetBuffer[index * 3 + 1] = pos[1];
      this.offsetBuffer[index * 3 + 2] = pos[2];

      // Primary color + scale
      this.colorScaleBuffer[index * 4 + 0] = primary[0];
      this.colorScaleBuffer[index * 4 + 1] = primary[1];
      this.colorScaleBuffer[index * 4 + 2] = primary[2];
      const maxScale = Math.max(scale[0], scale[1], scale[2]);
      this.colorScaleBuffer[index * 4 + 3] = maxScale;

      // Use accentColor if available, otherwise fallback to secondaryColor, then primary
      const accent = material?.accentColor;
      const secondary = accent ?? material?.secondaryColor ?? primary;
      this.secondaryColorBuffer[index * 4 + 0] = secondary[0];
      this.secondaryColorBuffer[index * 4 + 1] = secondary[1];
      this.secondaryColorBuffer[index * 4 + 2] = secondary[2];
      this.secondaryColorBuffer[index * 4 + 3] = secondary[3] ?? 1;

      const emissive = material?.emissiveColor ?? [0, 0, 0, 1];
      this.emissiveColorBuffer[index * 4 + 0] = emissive[0];
      this.emissiveColorBuffer[index * 4 + 1] = emissive[1];
      this.emissiveColorBuffer[index * 4 + 2] = emissive[2];
      this.emissiveColorBuffer[index * 4 + 3] = material?.emissiveIntensity ?? 0;

      const metallic = material?.metallic ?? 0;
      const roughness = material?.roughness ?? 1;
      this.materialParamsBuffer[index * 4 + 0] = alpha;
      this.materialParamsBuffer[index * 4 + 1] = metallic;
      this.materialParamsBuffer[index * 4 + 2] = roughness;
      this.materialParamsBuffer[index * 4 + 3] = flags;

      // Rotation (quaternion)
      this.rotationBuffer[index * 4 + 0] = rot[0];
      this.rotationBuffer[index * 4 + 1] = rot[1];
      this.rotationBuffer[index * 4 + 2] = rot[2];
      this.rotationBuffer[index * 4 + 3] = rot[3];

      // Material ID (for texture atlas)
      this.materialIdBuffer[index] = material?.materialId ?? 0;
    }

    // Return views (no allocations)
    return {
      instanceCount: count,
      opaqueCount,
      instanceOffsetData: this.offsetBuffer.subarray(0, count * 3),
      instanceColorScaleData: this.colorScaleBuffer.subarray(0, count * 4),
      instanceSecondaryColorData: this.secondaryColorBuffer.subarray(0, count * 4),
      instanceEmissiveColorData: this.emissiveColorBuffer.subarray(0, count * 4),
      instanceMaterialParamsData: this.materialParamsBuffer.subarray(0, count * 4),
      instanceRotationData: this.rotationBuffer.subarray(0, count * 4),
      instanceMaterialIdData: this.materialIdBuffer.subarray(0, count),
    };
  }

  /**
   * Gets current capacity.
   */
  getCapacity(): number {
    return this.capacity;
  }
}

/**
 * InstanceManager coordinates instance data building and scene updates.
 */
export class InstanceManager {
  private builder: InstanceDataBuilder;

  constructor(initialCapacity = 1000) {
    this.builder = new InstanceDataBuilder(initialCapacity);
  }

  /**
   * Builds instance data from scene entities.
   */
  buildFromScene(scene: Scene, frustum?: Frustum): InstanceData {
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
  buildFromEntities(entities: Entity[]): InstanceData {
    return this.builder.build(entities);
  }

  /**
   * Gets the internal builder's capacity.
   */
  getCapacity(): number {
    return this.builder.getCapacity();
  }
}

/**
 * Creates instance data from scene entities.
 * Legacy function for backward compatibility.
 * @deprecated Use InstanceManager for better performance
 */
export function createInstanceDataFromScene(
  scene: Scene,
  frustum?: Frustum
): InstanceData {
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

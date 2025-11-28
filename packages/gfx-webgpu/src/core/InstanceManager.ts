/**
 * Instance Data Management System
 *
 * Efficiently builds and manages per-instance GPU data for rendering.
 * Uses interleaved buffer layout for optimal GPU compaction (single pass).
 *
 * Performance: Zero-allocation instance data building for large scenes.
 */

import type { Entity, Scene } from '@engine/world';
import { MaterialComponent, MeshComponent, InstancedMeshComponent } from '@engine/world';
import type { Frustum } from './FrustumCuller';
import { Logger } from '@engine/core/utils';
import { generateCapsuleY, generateHeroicTorsoMesh } from '@engine/avatar';
import { generateSphereMesh, generateCylinderMesh, generatePlaneMesh, generateCapsuleMesh, generateBoxMesh } from '../utils/geometry';
import { resolveAtlasIndex as resolveAtlasIndexFromLibrary, DEFAULT_ATLAS_INDEX } from '../materials/MaterialLibrary';

/**
 * Interleaved buffer layout constants (in floats)
 * Total stride: 24 floats = 96 bytes per instance
 */
export const INSTANCE_STRIDE = 24; // floats per instance
export const INSTANCE_STRIDE_BYTES = INSTANCE_STRIDE * 4; // 96 bytes

// Offsets within interleaved buffer (in floats)
export const INSTANCE_OFFSET_OFFSET = 0;      // vec3 (3 floats)
export const INSTANCE_COLOR_SCALE_OFFSET = 3; // vec4 (4 floats)
export const INSTANCE_SECONDARY_COLOR_OFFSET = 7;  // vec4 (4 floats)
export const INSTANCE_EMISSIVE_COLOR_OFFSET = 11;  // vec4 (4 floats)
export const INSTANCE_MATERIAL_PARAMS_OFFSET = 15; // vec4 (4 floats)
export const INSTANCE_ROTATION_OFFSET = 19;   // vec4 (4 floats)
export const INSTANCE_MATERIAL_ID_OFFSET = 23; // f32 (1 float)

export interface InstanceData {
  instanceCount: number;
  opaqueCount: number;
  /** Interleaved instance data: [offset(3), colorScale(4), secondaryColor(4), emissiveColor(4), materialParams(4), rotation(4), materialId(1)] per instance */
  instanceInterleavedData: Float32Array;
  /** Bounds data for frustum culling: [centerX, centerY, centerZ, radius] per instance */
  instanceBoundsData: Float32Array;
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
 * Uses interleaved layout for optimal GPU compaction.
 * Avoids per-frame allocations for better performance.
 */
export class InstanceDataBuilder {
  /** Interleaved buffer: 24 floats per instance */
  private interleavedBuffer: Float32Array;
  /** Bounds buffer for frustum culling: 4 floats per instance */
  private boundsBuffer: Float32Array;
  private capacity: number;

  constructor(initialCapacity = 1000) {
    this.capacity = initialCapacity;
    this.interleavedBuffer = new Float32Array(initialCapacity * INSTANCE_STRIDE);
    this.boundsBuffer = new Float32Array(initialCapacity * 4);
  }

  /**
   * Grows internal buffers to accommodate more instances.
   */
  private grow(newCapacity: number): void {
    this.capacity = newCapacity;
    this.interleavedBuffer = new Float32Array(newCapacity * INSTANCE_STRIDE);
    this.boundsBuffer = new Float32Array(newCapacity * 4);
  }

  /**
   * Separates entities with custom meshData from default geometry entities.
   * Generates fallback geometry for meshType='sphere' if meshData is missing.
   * Skips entities with meshType='none' (structural entities).
   */
  separateCustomGeometry(entities: Entity[]): {
    defaultGeometry: Entity[];
    customGeometry: CustomGeometryEntity[];
  } {
    const defaultGeometry: Entity[] = [];
    const customGeometry: CustomGeometryEntity[] = [];

    for (const entity of entities) {
      if (!entity) continue;
      // Skip entities with meshType='none' (structural entities like joints, roots)
      if (entity.meshType === 'none') continue;
      
      // Skip explicit InstancedMeshComponent entities (handled in build)
      if (entity.getComponent(InstancedMeshComponent)) continue;

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
      // Use 'any' to allow assignment of different return types (interleaved vs separate)
      // GeometryCache handles both formats now.
      let fallbackGeometry: any = null;
      
      if (meshComponent.meshType === 'sphere') {
        try {
          const opts = meshComponent.options || {};
          fallbackGeometry = generateSphereMesh(
            opts.radius ?? 1,
            opts.segments ?? 16,
            opts.segments ?? 16
          );
        } catch (error) {
          Logger.warn(
            `[InstanceManager] Failed to generate fallback sphere geometry for entity "${entity.name || entity.id || 'unnamed'}":`,
            error
          );
        }
      } else if (meshComponent.meshType === 'box') {
        try {
          const opts = meshComponent.options || {};
          // Use size array [width, height, depth] if available, or individual properties
          let w = opts.width ?? 1;
          let h = opts.height ?? 1;
          let d = opts.depth ?? 1;
          if (opts.size && opts.size.length >= 3) {
            w = opts.size[0];
            h = opts.size[1];
            d = opts.size[2];
          }
          fallbackGeometry = generateBoxMesh(w, h, d, opts.segments ?? 1);
        } catch (error) {
          Logger.warn(
            `[InstanceManager] Failed to generate fallback box geometry for entity "${entity.name || entity.id || 'unnamed'}":`,
            error
          );
        }
      } else if (meshComponent.meshType === 'cylinder') {
        try {
          const opts = meshComponent.options || {};
          fallbackGeometry = generateCylinderMesh(
            opts.radius ?? 0.5,
            opts.radius ?? 0.5,
            opts.height ?? 1,
            opts.segments ?? 16
          );
        } catch (error) {
          Logger.warn(
            `[InstanceManager] Failed to generate fallback cylinder geometry for entity "${entity.name || entity.id || 'unnamed'}":`,
            error
          );
        }
      } else if (meshComponent.meshType === 'plane') {
        try {
          const opts = meshComponent.options || {};
          fallbackGeometry = generatePlaneMesh(
            opts.width ?? 1,
            opts.depth ?? 1,
            opts.segments ?? 1
          );
        } catch (error) {
          Logger.warn(
            `[InstanceManager] Failed to generate fallback plane geometry for entity "${entity.name || entity.id || 'unnamed'}":`,
            error
          );
        }
      } else if (meshComponent.meshType === 'capsule') {
        try {
          const opts = meshComponent.options || {};
          fallbackGeometry = generateCapsuleMesh(
            opts.radius ?? 0.5,
            opts.height ?? 1,
            opts.segments ?? 16
          );
        } catch (error) {
          Logger.warn(
            `[InstanceManager] Failed to generate fallback capsule geometry for entity "${entity.name || entity.id || 'unnamed'}":`,
            error
          );
        }
      } else if (meshComponent.meshType === 'capsule_y') {
        try {
          fallbackGeometry = generateCapsuleY({ radius: 0.5, cylinderHeight: 1.0, radialSegments: 16, hemisphereSegments: 8 });
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
   * Skips entities with meshType='none' (structural entities).
   */
  build(entities: Entity[]): InstanceData {
    const singleEntities: Entity[] = [];
    const instancedContainers: { entity: Entity; component: InstancedMeshComponent }[] = [];

    // 1. Classify entities
    for (const e of entities) {
      if (!e) continue;
      
      const instanced = e.getComponent(InstancedMeshComponent);
      if (instanced && instanced.count > 0) {
        instancedContainers.push({ entity: e, component: instanced });
        continue;
      }

      // Skip entities with meshType='none' (structural entities like joints, roots)
      if (e.meshType === 'none') continue;
      
      const meshComponent = e.getComponent(MeshComponent);
      // Only process default geometry (entities with custom mesh data are handled by separateCustomGeometry and filtered out before reaching here in typical flow)
      // But if they are passed here, we should filter them out to be safe.
      if (meshComponent?.meshData?.vertices && meshComponent.meshData.indices) {
         continue; 
      }
      
      singleEntities.push(e);
    }

    const singleCount = singleEntities.length;
    const instancedCount = instancedContainers.reduce((acc, item) => acc + item.component.count, 0);
    const totalCount = singleCount + instancedCount;

    if (totalCount === 0) {
      // Logger.debug('[InstanceManager] build(): no renderable entities detected in scene');
    } else {
      // Logger.debug('[InstanceManager] build(): processing entities', { count: totalCount });
    }

    // 2. Grow if needed
    if (totalCount > this.capacity) {
      this.grow(Math.max(totalCount, this.capacity * 2));
    }

    // 3. Count opaque for sorting
    let opaqueCount = 0;
    
    for (const entity of singleEntities) {
      const material = entity.getComponent(MaterialComponent);
      const alpha = material?.primaryColor?.[3] ?? material?.opacity ?? 1;
      const flags = material?.flags ?? 0;
      const isTransparent = (flags & MaterialComponent.FLAG_TRANSPARENT) !== 0 || alpha < 0.999;
      if (!isTransparent) opaqueCount++;
    }
    
    for (const { entity, component } of instancedContainers) {
      const material = entity.getComponent(MaterialComponent);
      const alpha = material?.primaryColor?.[3] ?? material?.opacity ?? 1;
      const flags = material?.flags ?? 0;
      const isTransparent = (flags & MaterialComponent.FLAG_TRANSPARENT) !== 0 || alpha < 0.999;
      if (!isTransparent) opaqueCount += component.count;
    }

    // 4. Fill Buffers (interleaved layout)
    let opaqueCursor = 0;
    let transparentCursor = opaqueCount;

    // 4a. Single Entities
    for (const entity of singleEntities) {
      const pos = entity.transform.getWorldPosition();
      const rot = entity.transform.rotation;
      const scale = entity.transform.scale;
      const material = entity.getComponent(MaterialComponent);
      const primary = material?.primaryColor ?? [1, 1, 1, 1];
      const alpha = primary[3] ?? (material?.opacity ?? 1);
      const flags = material?.flags ?? 0;
      const isTransparent = (flags & MaterialComponent.FLAG_TRANSPARENT) !== 0 || alpha < 0.999;
      
      const index = isTransparent ? transparentCursor++ : opaqueCursor++;
      const base = index * INSTANCE_STRIDE;

      // Position (offset 0, 3 floats)
      this.interleavedBuffer[base + INSTANCE_OFFSET_OFFSET + 0] = pos[0];
      this.interleavedBuffer[base + INSTANCE_OFFSET_OFFSET + 1] = pos[1];
      this.interleavedBuffer[base + INSTANCE_OFFSET_OFFSET + 2] = pos[2];

      // Primary color + scale (offset 3, 4 floats)
      this.interleavedBuffer[base + INSTANCE_COLOR_SCALE_OFFSET + 0] = primary[0];
      this.interleavedBuffer[base + INSTANCE_COLOR_SCALE_OFFSET + 1] = primary[1];
      this.interleavedBuffer[base + INSTANCE_COLOR_SCALE_OFFSET + 2] = primary[2];
      const maxScale = Math.max(scale[0], scale[1], scale[2]);
      this.interleavedBuffer[base + INSTANCE_COLOR_SCALE_OFFSET + 3] = maxScale;

      // Secondary color (offset 7, 4 floats)
      const accent = material?.accentColor;
      const secondary = accent ?? material?.secondaryColor ?? primary;
      this.interleavedBuffer[base + INSTANCE_SECONDARY_COLOR_OFFSET + 0] = secondary[0];
      this.interleavedBuffer[base + INSTANCE_SECONDARY_COLOR_OFFSET + 1] = secondary[1];
      this.interleavedBuffer[base + INSTANCE_SECONDARY_COLOR_OFFSET + 2] = secondary[2];
      this.interleavedBuffer[base + INSTANCE_SECONDARY_COLOR_OFFSET + 3] = secondary[3] ?? 1;

      // Emissive color (offset 11, 4 floats)
      const emissive = material?.emissiveColor ?? [0, 0, 0, 1];
      this.interleavedBuffer[base + INSTANCE_EMISSIVE_COLOR_OFFSET + 0] = emissive[0];
      this.interleavedBuffer[base + INSTANCE_EMISSIVE_COLOR_OFFSET + 1] = emissive[1];
      this.interleavedBuffer[base + INSTANCE_EMISSIVE_COLOR_OFFSET + 2] = emissive[2];
      this.interleavedBuffer[base + INSTANCE_EMISSIVE_COLOR_OFFSET + 3] = material?.emissiveIntensity ?? 0;

      // Material params (offset 15, 4 floats)
      const metallic = material?.metallic ?? 0;
      const roughness = material?.roughness ?? 1;
      this.interleavedBuffer[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 0] = alpha;
      this.interleavedBuffer[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 1] = metallic;
      this.interleavedBuffer[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 2] = roughness;
      this.interleavedBuffer[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 3] = flags;

      // Rotation (offset 19, 4 floats)
      this.interleavedBuffer[base + INSTANCE_ROTATION_OFFSET + 0] = rot[0];
      this.interleavedBuffer[base + INSTANCE_ROTATION_OFFSET + 1] = rot[1];
      this.interleavedBuffer[base + INSTANCE_ROTATION_OFFSET + 2] = rot[2];
      this.interleavedBuffer[base + INSTANCE_ROTATION_OFFSET + 3] = rot[3];

      // Material ID (offset 23, 1 float)
      const resolvedMaterialId = material?.materialRef 
        ? resolveAtlasIndexFromLibrary(material.materialRef, material.materialId ?? DEFAULT_ATLAS_INDEX)
        : (material?.materialId ?? DEFAULT_ATLAS_INDEX);
      this.interleavedBuffer[base + INSTANCE_MATERIAL_ID_OFFSET] = resolvedMaterialId;

      // Bounds (separate buffer for classify pass)
      const maxExtent = Math.max(scale[0], scale[1], scale[2]);
      const radius = Math.max(maxExtent * 0.5, 0.001);
      this.boundsBuffer[index * 4 + 0] = pos[0];
      this.boundsBuffer[index * 4 + 1] = pos[1];
      this.boundsBuffer[index * 4 + 2] = pos[2];
      this.boundsBuffer[index * 4 + 3] = radius;
    }

    // 4b. Instanced Components
    for (const { entity, component } of instancedContainers) {
      const material = entity.getComponent(MaterialComponent);
      const alpha = material?.primaryColor?.[3] ?? material?.opacity ?? 1;
      const flags = material?.flags ?? 0;
      const isTransparent = (flags & MaterialComponent.FLAG_TRANSPARENT) !== 0 || alpha < 0.999;
      
      let idx = isTransparent ? transparentCursor : opaqueCursor;
      const count = component.count;
      
      for (let k = 0; k < count; k++) {
        const i = idx + k;
        const base = i * INSTANCE_STRIDE;
        
        // Position (offset 0, 3 floats)
        this.interleavedBuffer[base + INSTANCE_OFFSET_OFFSET + 0] = component.offsetData[k * 3 + 0] ?? 0;
        this.interleavedBuffer[base + INSTANCE_OFFSET_OFFSET + 1] = component.offsetData[k * 3 + 1] ?? 0;
        this.interleavedBuffer[base + INSTANCE_OFFSET_OFFSET + 2] = component.offsetData[k * 3 + 2] ?? 0;
        
        // Color + scale (offset 3, 4 floats)
        this.interleavedBuffer[base + INSTANCE_COLOR_SCALE_OFFSET + 0] = component.colorData[k * 4 + 0] ?? 0;
        this.interleavedBuffer[base + INSTANCE_COLOR_SCALE_OFFSET + 1] = component.colorData[k * 4 + 1] ?? 0;
        this.interleavedBuffer[base + INSTANCE_COLOR_SCALE_OFFSET + 2] = component.colorData[k * 4 + 2] ?? 0;
        const sx = component.scaleData[k * 3 + 0] ?? 0;
        const sy = component.scaleData[k * 3 + 1] ?? 0;
        const sz = component.scaleData[k * 3 + 2] ?? 0;
        this.interleavedBuffer[base + INSTANCE_COLOR_SCALE_OFFSET + 3] = Math.max(sx, sy, sz);
        
        // Secondary color (offset 7, 4 floats)
        this.interleavedBuffer[base + INSTANCE_SECONDARY_COLOR_OFFSET + 0] = component.secondaryColorData[k * 4 + 0] ?? 0;
        this.interleavedBuffer[base + INSTANCE_SECONDARY_COLOR_OFFSET + 1] = component.secondaryColorData[k * 4 + 1] ?? 0;
        this.interleavedBuffer[base + INSTANCE_SECONDARY_COLOR_OFFSET + 2] = component.secondaryColorData[k * 4 + 2] ?? 0;
        this.interleavedBuffer[base + INSTANCE_SECONDARY_COLOR_OFFSET + 3] = component.secondaryColorData[k * 4 + 3] ?? 1;

        // Emissive color (offset 11, 4 floats)
        this.interleavedBuffer[base + INSTANCE_EMISSIVE_COLOR_OFFSET + 0] = component.emissiveColorData[k * 4 + 0] ?? 0;
        this.interleavedBuffer[base + INSTANCE_EMISSIVE_COLOR_OFFSET + 1] = component.emissiveColorData[k * 4 + 1] ?? 0;
        this.interleavedBuffer[base + INSTANCE_EMISSIVE_COLOR_OFFSET + 2] = component.emissiveColorData[k * 4 + 2] ?? 0;
        this.interleavedBuffer[base + INSTANCE_EMISSIVE_COLOR_OFFSET + 3] = component.emissiveColorData[k * 4 + 3] ?? 0;

        // Material params (offset 15, 4 floats)
        this.interleavedBuffer[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 0] = component.materialParamsData[k * 4 + 0] ?? 0;
        this.interleavedBuffer[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 1] = component.materialParamsData[k * 4 + 1] ?? 0;
        this.interleavedBuffer[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 2] = component.materialParamsData[k * 4 + 2] ?? 0;
        this.interleavedBuffer[base + INSTANCE_MATERIAL_PARAMS_OFFSET + 3] = component.materialParamsData[k * 4 + 3] ?? 0;

        // Rotation (offset 19, 4 floats)
        this.interleavedBuffer[base + INSTANCE_ROTATION_OFFSET + 0] = component.rotationData[k * 4 + 0] ?? 0;
        this.interleavedBuffer[base + INSTANCE_ROTATION_OFFSET + 1] = component.rotationData[k * 4 + 1] ?? 0;
        this.interleavedBuffer[base + INSTANCE_ROTATION_OFFSET + 2] = component.rotationData[k * 4 + 2] ?? 0;
        this.interleavedBuffer[base + INSTANCE_ROTATION_OFFSET + 3] = component.rotationData[k * 4 + 3] ?? 0;

        // Material ID (offset 23, 1 float)
        this.interleavedBuffer[base + INSTANCE_MATERIAL_ID_OFFSET] = component.materialIdData[k] ?? 0;
        
        // Bounds (separate buffer)
        const radius = Math.max(sx, sy, sz) * 0.5;
        this.boundsBuffer[i * 4 + 0] = component.offsetData[k * 3 + 0] ?? 0;
        this.boundsBuffer[i * 4 + 1] = component.offsetData[k * 3 + 1] ?? 0;
        this.boundsBuffer[i * 4 + 2] = component.offsetData[k * 3 + 2] ?? 0;
        this.boundsBuffer[i * 4 + 3] = radius;
      }
      
      if (isTransparent) transparentCursor += count;
      else opaqueCursor += count;
    }

    return {
      instanceCount: totalCount,
      opaqueCount,
      instanceInterleavedData: this.interleavedBuffer.subarray(0, totalCount * INSTANCE_STRIDE),
      instanceBoundsData: this.boundsBuffer.subarray(0, totalCount * 4),
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

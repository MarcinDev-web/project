import { MaterialComponent, type Entity, type RgbaColor } from '@engine/world';
import { Logger } from '@engine/core/utils';
import type { CustomGeometryEntity } from './InstanceManager';
import { INSTANCE_STRIDE } from './InstanceManager';
import type { FrameResources } from '../resources/resources';
import type { GeometryCache } from './GeometryCache';

interface CustomGeometryParams {
  encoder: GPURenderPassEncoder;
  device: GPUDevice;
  frameResources: FrameResources;
  entities: CustomGeometryEntity[];
}

export class CustomGeometryRenderer {
  /**
   * Interleaved scratch buffer (24 floats per instance):
   * - offset: vec3 (3 floats) at offset 0
   * - colorScale: vec4 (4 floats) at offset 3
   * - secondaryColor: vec4 (4 floats) at offset 7
   * - emissiveColor: vec4 (4 floats) at offset 11
   * - materialParams: vec4 (4 floats) at offset 15
   * - rotation: vec4 (4 floats) at offset 19
   * - materialId: f32 (1 float) at offset 23
   */
  private readonly interleavedScratch = new Float32Array(INSTANCE_STRIDE);

  constructor(private readonly geometryCache: GeometryCache) {}

  render(params: CustomGeometryParams): void {
    const { encoder, device, frameResources, entities } = params;
    if (!entities.length) {
      return;
    }

    for (const { entity, meshComponent } of entities) {
      if (!entity.active) {
        continue;
      }
      const meshData = meshComponent.meshData;
      if (!this.isMeshValid(meshData)) {
        this.logInvalidMesh(entity, meshComponent.meshType);
        continue;
      }
      const geometryBuffers = this.geometryCache.getGeometryBuffers(device, meshData!);
      if (!geometryBuffers) {
        this.logInvalidGeometry(entity, meshComponent.meshType);
        continue;
      }

      const material = this.prepareMaterial(entity);
      this.writeInstanceBuffers(device, geometryBuffers, entity, material);

      this.bindGeometry(encoder, geometryBuffers);
      encoder.setBindGroup(0, frameResources.uniformBindGroup);
      encoder.setBindGroup(1, frameResources.textureBindGroup);

      const isTransparent = this.isTransparent(material);
      if (isTransparent && frameResources.transparentPipeline) {
        encoder.setPipeline(frameResources.transparentPipeline);
        encoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
      } else {
        encoder.setPipeline(frameResources.renderPipeline);
        encoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
      }

      encoder.setPipeline(frameResources.overlayPipeline);
      encoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
    }
  }

  private prepareMaterial(entity: Entity): MaterialComponent | null {
    const material = entity.getComponent(MaterialComponent);
    if (!material) {
      return null;
    }
    const slots = entity.userData?.avatarColorSlots as Record<string, RgbaColor> | undefined;
    if (slots) {
      if (slots.primary) material.primaryColor = slots.primary;
      if (slots.secondary) material.secondaryColor = slots.secondary;
      if (slots.accent) material.accentColor = slots.accent;
      if (slots.emissive) {
        material.emissiveColor = slots.emissive;
        material.emissiveIntensity = slots.emissive[3] ?? material.emissiveIntensity ?? 0;
      }
      material.updateFlags();
    }
    return material;
  }

  private writeInstanceBuffers(
    device: GPUDevice,
    geometryBuffers: ReturnType<GeometryCache['getGeometryBuffers']>,
    entity: Entity,
    material: MaterialComponent | null
  ): void {
    if (!geometryBuffers) {
      return;
    }
    const position = entity.transform.getWorldPosition();
    const rotation = entity.transform.rotation;
    const scale = entity.transform.scale;
    const maxScale = Math.max(scale[0], scale[1], scale[2]);

    const primary = material?.primaryColor ?? [1, 1, 1, 1];
    const alpha = primary[3] ?? material?.opacity ?? 1;
    const accent = material?.accentColor;
    const secondaryColor = accent ?? material?.secondaryColor ?? primary;
    const emissive = material?.emissiveColor ?? [0, 0, 0, 1];
    const emissiveIntensity = material?.emissiveIntensity ?? 0;
    const metallic = material?.metallic ?? 0;
    const roughness = material?.roughness ?? 1;
    const flags = material?.flags ?? 0;

    const buf = this.interleavedScratch;

    // offset (3 floats at offset 0)
    buf[0] = position[0];
    buf[1] = position[1];
    buf[2] = position[2];

    // colorScale (4 floats at offset 3)
    buf[3] = primary[0] ?? 1;
    buf[4] = primary[1] ?? 1;
    buf[5] = primary[2] ?? 1;
    buf[6] = maxScale;

    // secondaryColor (4 floats at offset 7)
    buf[7] = secondaryColor[0] ?? 1;
    buf[8] = secondaryColor[1] ?? 1;
    buf[9] = secondaryColor[2] ?? 1;
    buf[10] = secondaryColor[3] ?? 1;

    // emissiveColor (4 floats at offset 11)
    buf[11] = emissive[0] ?? 0;
    buf[12] = emissive[1] ?? 0;
    buf[13] = emissive[2] ?? 0;
    buf[14] = emissiveIntensity;

    // materialParams (4 floats at offset 15)
    buf[15] = alpha;
    buf[16] = metallic;
    buf[17] = roughness;
    buf[18] = flags;

    // rotation (4 floats at offset 19)
    buf[19] = rotation[0];
    buf[20] = rotation[1];
    buf[21] = rotation[2];
    buf[22] = rotation[3];

    // materialId (1 float at offset 23)
    buf[23] = material?.materialId ?? 0;

    // Write entire interleaved buffer in one call
    device.queue.writeBuffer(geometryBuffers.instanceInterleavedBuffer, 0, buf);
  }

  private bindGeometry(
    encoder: GPURenderPassEncoder,
    geometryBuffers: ReturnType<GeometryCache['getGeometryBuffers']>
  ): void {
    if (!geometryBuffers) {
      return;
    }
    encoder.setVertexBuffer(0, geometryBuffers.vertexBuffer);
    encoder.setVertexBuffer(1, geometryBuffers.instanceInterleavedBuffer);
    encoder.setIndexBuffer(geometryBuffers.indexBuffer, 'uint16');
  }

  private isTransparent(material: MaterialComponent | null): boolean {
    if (!material) {
      return false;
    }
    const alpha = material.primaryColor?.[3] ?? material.opacity ?? 1;
    return (
      (material.flags & MaterialComponent.FLAG_TRANSPARENT) !== 0 ||
      alpha < 0.999
    );
  }

  private isMeshValid(meshData: CustomGeometryEntity['meshComponent']['meshData']): boolean {
    return Boolean(meshData?.vertices && meshData.indices);
  }

  private logInvalidMesh(entity: Entity, meshType?: string): void {
    const id = entity.id ?? 'unknown';
    const name = entity.name ?? id;
    Logger.warn(
      `[FrameRenderer] Skipping entity "${name}" (id: ${id}) with meshType="${
        meshType ?? 'unknown'
      }" due to missing or invalid geometry.`
    );
  }

  private logInvalidGeometry(entity: Entity, meshType?: string): void {
    const id = entity.id ?? 'unknown';
    const name = entity.name ?? id;
    Logger.warn(
      `[FrameRenderer] Skipping entity "${name}" (id: ${id}) with meshType="${
        meshType ?? 'unknown'
      }" due to invalid geometry buffers.`
    );
  }
}

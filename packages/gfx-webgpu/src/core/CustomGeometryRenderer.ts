import { MaterialComponent, type Entity, type RgbaColor } from '@engine/world';
import { Logger } from '@engine/core/utils';
import type { CustomGeometryEntity } from './InstanceManager';
import type { FrameResources } from '../resources/resources';
import type { GeometryCache } from './GeometryCache';

interface CustomGeometryParams {
  encoder: GPURenderPassEncoder;
  device: GPUDevice;
  frameResources: FrameResources;
  entities: CustomGeometryEntity[];
}

export class CustomGeometryRenderer {
  private readonly positionScratch = new Float32Array(3);
  private readonly colorScaleScratch = new Float32Array(4);
  private readonly secondaryColorScratch = new Float32Array(4);
  private readonly emissiveScratch = new Float32Array(4);
  private readonly materialParamsScratch = new Float32Array(4);
  private readonly rotationScratch = new Float32Array(4);
  private readonly materialIdScratch = new Uint32Array(1);

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

    this.positionScratch[0] = position[0];
    this.positionScratch[1] = position[1];
    this.positionScratch[2] = position[2];
    this.colorScaleScratch[0] = primary[0] ?? 1;
    this.colorScaleScratch[1] = primary[1] ?? 1;
    this.colorScaleScratch[2] = primary[2] ?? 1;
    this.colorScaleScratch[3] = maxScale;

    this.secondaryColorScratch[0] = secondaryColor[0] ?? 1;
    this.secondaryColorScratch[1] = secondaryColor[1] ?? 1;
    this.secondaryColorScratch[2] = secondaryColor[2] ?? 1;
    this.secondaryColorScratch[3] = secondaryColor[3] ?? 1;

    this.emissiveScratch[0] = emissive[0] ?? 0;
    this.emissiveScratch[1] = emissive[1] ?? 0;
    this.emissiveScratch[2] = emissive[2] ?? 0;
    this.emissiveScratch[3] = emissiveIntensity;

    this.materialParamsScratch[0] = alpha;
    this.materialParamsScratch[1] = metallic;
    this.materialParamsScratch[2] = roughness;
    this.materialParamsScratch[3] = flags;

    this.rotationScratch[0] = rotation[0];
    this.rotationScratch[1] = rotation[1];
    this.rotationScratch[2] = rotation[2];
    this.rotationScratch[3] = rotation[3];

    this.materialIdScratch[0] = material?.materialId ?? 0;

    device.queue.writeBuffer(geometryBuffers.instanceOffsetBuffer, 0, this.positionScratch);
    device.queue.writeBuffer(geometryBuffers.instanceColorScaleBuffer, 0, this.colorScaleScratch);
    device.queue.writeBuffer(
      geometryBuffers.instanceSecondaryColorBuffer,
      0,
      this.secondaryColorScratch
    );
    device.queue.writeBuffer(
      geometryBuffers.instanceEmissiveColorBuffer,
      0,
      this.emissiveScratch
    );
    device.queue.writeBuffer(
      geometryBuffers.instanceMaterialParamsBuffer,
      0,
      this.materialParamsScratch
    );
    device.queue.writeBuffer(geometryBuffers.instanceRotationBuffer, 0, this.rotationScratch);
    device.queue.writeBuffer(geometryBuffers.instanceMaterialIdBuffer, 0, this.materialIdScratch);
  }

  private bindGeometry(
    encoder: GPURenderPassEncoder,
    geometryBuffers: ReturnType<GeometryCache['getGeometryBuffers']>
  ): void {
    if (!geometryBuffers) {
      return;
    }
    encoder.setVertexBuffer(0, geometryBuffers.vertexBuffer);
    encoder.setVertexBuffer(1, geometryBuffers.instanceOffsetBuffer);
    encoder.setVertexBuffer(2, geometryBuffers.instanceColorScaleBuffer);
    encoder.setVertexBuffer(3, geometryBuffers.instanceSecondaryColorBuffer);
    encoder.setVertexBuffer(4, geometryBuffers.instanceEmissiveColorBuffer);
    encoder.setVertexBuffer(5, geometryBuffers.instanceMaterialParamsBuffer);
    encoder.setVertexBuffer(6, geometryBuffers.instanceRotationBuffer);
    encoder.setVertexBuffer(7, geometryBuffers.instanceMaterialIdBuffer);
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

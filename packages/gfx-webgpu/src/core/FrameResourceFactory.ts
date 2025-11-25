/**
 * Frame Resource Factory
 *
 * Centralizes creation and disposal of frame rendering resources.
 * Eliminates code duplication between initial creation and device recovery.
 *
 * Responsibilities:
 * - Create all GPU buffers (vertex, index, instance, uniform)
 * - Create texture atlas and bind groups
 * - Create render pipelines
 * - Create depth and MSAA textures
 * - Dispose all resources safely
 */

import { Logger } from '@engine/core/utils';
import {
  DEFAULT_GEOMETRY,
  createGeometryBuffers,
  createTimestampResources,
  createUniformResources,
  createTextureAtlas,
  createPipelines,
  createDepthTexture,
  createMsaaColorTarget,
} from '../resources/resources';
import type { FrameResources, GeometryData } from '../resources/resources';
import { GPUBufferPool } from './bufferPool';
import { getTimestampPeriod } from './helpers';
import {
  MSAA_SAMPLE_COUNT,
  TIMESTAMP_QUERY_COUNT,
  UNIFORM_BUFFER_SIZE,
  UNIFORM_DATA_LENGTH,
  TIMESTAMP_BUFFER_SIZE,
} from '../config';
import type { ExtendedFrameResources, ResourceCreationOptions, MsaaSampleCount } from './RendererTypes';
import type { TextureAtlas } from '../textures/TextureAtlas';

// Vertex buffer layout constants
const VERTEX_STRIDE = 24;
const INSTANCE_OFFSET_STRIDE = 12;

/**
 * Creates vertex buffer layouts for the render pipeline.
 * These define the structure of vertex and instance data.
 */
export function createVertexBufferLayouts(): GPUVertexBufferLayout[] {
  return [
    // Vertex buffer (position, normal, uv, AO)
    {
      arrayStride: VERTEX_STRIDE,
      stepMode: 'vertex',
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
        { shaderLocation: 1, offset: 12, format: 'snorm8x4' },  // normal
        { shaderLocation: 2, offset: 16, format: 'float16x2' }, // uv
        { shaderLocation: 3, offset: 20, format: 'unorm8x4' },  // AO (x), rest unused
      ],
    },
    // Instance offset buffer
    {
      arrayStride: INSTANCE_OFFSET_STRIDE,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x3' }],
    },
    // Instance color scale buffer
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x4' }],
    },
    // Instance secondary color buffer
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 6, offset: 0, format: 'float32x4' }],
    },
    // Instance emissive color buffer
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 7, offset: 0, format: 'float32x4' }],
    },
    // Instance material params buffer
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 8, offset: 0, format: 'float32x4' }],
    },
    // Instance rotation buffer
    {
      arrayStride: 16,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 9, offset: 0, format: 'float32x4' }],
    },
    // Instance material ID buffer
    {
      arrayStride: 4,
      stepMode: 'instance',
      attributes: [{ shaderLocation: 10, offset: 0, format: 'float32' }],
    },
  ];
}

/**
 * Result of frame resource creation.
 */
export interface FrameResourceCreationResult {
  /** All frame resources */
  resources: ExtendedFrameResources;
  /** Texture atlas instance for material management */
  atlas: TextureAtlas;
  /** Buffer pool for efficient buffer reuse */
  bufferPool: GPUBufferPool;
}

/**
 * FrameResourceFactory handles creation and disposal of GPU frame resources.
 *
 * This class consolidates resource creation logic that was previously duplicated
 * between initRenderer and recreateFrameResources.
 *
 * @example
 * ```typescript
 * const factory = new FrameResourceFactory(device, adapter);
 * const { resources, atlas, bufferPool } = await factory.createAll({
 *   geometry: sceneGeometry,
 *   presentationFormat: 'bgra8unorm',
 *   msaaSampleCount: 4,
 *   timestampQuerySupported: true,
 * });
 *
 * // Later, when disposing
 * factory.dispose(resources);
 * ```
 */
export class FrameResourceFactory {
  private readonly device: GPUDevice;
  private readonly adapter: GPUAdapter;

  constructor(device: GPUDevice, adapter: GPUAdapter) {
    this.device = device;
    this.adapter = adapter;
  }

  /**
   * Creates all frame resources needed for rendering.
   *
   * @param options - Resource creation options
   * @returns Promise resolving to created resources
   */
  async createAll(options: ResourceCreationOptions): Promise<FrameResourceCreationResult> {
    const {
      geometry,
      presentationFormat,
      msaaSampleCount,
      statusEl,
      timestampQuerySupported,
    } = options;

    // Create geometry buffers
    const geometryBuffers = createGeometryBuffers(this.device, geometry);

    // Create uniform resources
    const uniformResources = createUniformResources(this.device, {
      bufferSize: UNIFORM_BUFFER_SIZE,
      dataLength: UNIFORM_DATA_LENGTH,
    });

    // Create vertex buffer layouts
    const vertexBuffers = createVertexBufferLayouts();

    // Create texture atlas
    const {
      textureBindGroupLayout,
      textureBindGroup,
      atlasTexture,
      normalAtlasTexture,
      sampler,
      atlas,
      atlasMetaBuffer,
    } = createTextureAtlas(this.device, undefined, 2048, 128);

    // Create render pipelines
    // Note: statusEl is used for error display, create a dummy element if not provided
    const dummyStatusEl = statusEl ?? document.createElement('div');
    const { renderPipeline, transparentPipeline, overlayPipeline } = await createPipelines(
      this.device,
      'rgba16float', // HDR render target format
      uniformResources.uniformBindGroupLayout,
      textureBindGroupLayout,
      vertexBuffers,
      { sampleCount: msaaSampleCount, statusEl: dummyStatusEl }
    );

    // Create uniform bind group
    const uniformBindGroup = this.device.createBindGroup({
      label: 'frame-uniform-bg',
      layout: uniformResources.uniformBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformResources.uniformBuffer,
            offset: 0,
            size: UNIFORM_BUFFER_SIZE,
          },
        },
      ],
    });

    // Create timestamp resources
    const {
      querySet: timestampQuerySet,
      resolveBuffer: timestampResolveBuffer,
      readBuffer: timestampReadBuffer,
    } = createTimestampResources(this.device, timestampQuerySupported, {
      queryCount: TIMESTAMP_QUERY_COUNT,
      bufferSize: TIMESTAMP_BUFFER_SIZE,
    });

    // Create buffer pool
    const bufferPool = new GPUBufferPool(this.device);

    // Create depth and MSAA textures (need a canvas reference for dimensions)
    // For now, we'll create placeholder textures that will be resized on first frame
    // This is handled by the caller providing a canvas or dimensions

    const resources: ExtendedFrameResources = {
      ...geometryBuffers,
      uniformBuffer: uniformResources.uniformBuffer,
      uniformBindGroupLayout: uniformResources.uniformBindGroupLayout,
      textureBindGroupLayout,
      renderPipeline,
      transparentPipeline,
      overlayPipeline,
      uniformBindGroup,
      uniformData: uniformResources.uniformData,
      timestampQuerySet,
      timestampResolveBuffer,
      timestampReadBuffer,
      timestampPeriod: getTimestampPeriod(this.device, this.adapter),
      sideTexture: atlasTexture, // Atlas texture (backward compatibility field name)
      topTexture: atlasTexture,  // Same atlas texture (backward compatibility field name)
      normalAtlasTexture,
      sampler,
      textureBindGroup,
      atlasMetaBuffer,
      // Depth and MSAA textures will be set by caller (need canvas dimensions)
      depthTexture: null as unknown as GPUTexture,
      msaaColorTexture: null as unknown as GPUTexture,
      depthTextureView: null as unknown as GPUTextureView,
      msaaColorView: null as unknown as GPUTextureView,
      // Extended properties
      bufferPool,
      atlas,
    };

    return { resources, atlas, bufferPool };
  }

  /**
   * Creates depth and MSAA textures based on canvas dimensions.
   *
   * @param canvas - Canvas element for dimensions
   * @param format - Presentation format for MSAA target
   * @param msaaSampleCount - MSAA sample count
   * @returns Object with created textures and views
   */
  createRenderTargets(
    canvas: HTMLCanvasElement,
    format: GPUTextureFormat,
    msaaSampleCount: MsaaSampleCount
  ): {
    depthTexture: GPUTexture;
    depthTextureView: GPUTextureView;
    msaaColorTexture: GPUTexture;
    msaaColorView: GPUTextureView;
  } {
    const depthTexture = createDepthTexture(this.device, canvas, msaaSampleCount);
    const depthTextureView = depthTexture.createView({ label: 'frame-depth-view' });

    const msaaColorTexture = createMsaaColorTarget(
      this.device,
      canvas,
      format,
      msaaSampleCount
    );
    const msaaColorView = msaaColorTexture.createView({ label: 'frame-msaa-color-view' });

    return {
      depthTexture,
      depthTextureView,
      msaaColorTexture,
      msaaColorView,
    };
  }

  /**
   * Safely disposes all GPU resources.
   * This is idempotent and safe to call multiple times.
   *
   * @param resources - Resources to dispose
   */
  dispose(resources: FrameResources | ExtendedFrameResources | null): void {
    if (!resources) return;

    const safeDestroy = (resource: { destroy?: () => void } | null | undefined) => {
      try {
        resource?.destroy?.();
      } catch (e) {
        Logger.debug('Resource destroy failed during disposal', e);
      }
    };

    try {
      // Dispose timestamp resources
      safeDestroy(resources.timestampReadBuffer);
      safeDestroy(resources.timestampResolveBuffer);
      safeDestroy(resources.timestampQuerySet);

      // Dispose uniform buffer
      safeDestroy(resources.uniformBuffer);

      // Dispose geometry buffers
      safeDestroy(resources.vertexBuffer);
      safeDestroy(resources.indexBuffer);

      // Dispose instance buffers
      safeDestroy(resources.instanceOffsetBuffer);
      safeDestroy(resources.instanceOffsetStagingBuffer);
      safeDestroy(resources.instanceColorScaleBuffer);
      safeDestroy(resources.instanceColorScaleStagingBuffer);
      safeDestroy(resources.instanceSecondaryColorBuffer);
      safeDestroy(resources.instanceSecondaryColorStagingBuffer);
      safeDestroy(resources.instanceEmissiveColorBuffer);
      safeDestroy(resources.instanceEmissiveColorStagingBuffer);
      safeDestroy(resources.instanceMaterialParamsBuffer);
      safeDestroy(resources.instanceMaterialParamsStagingBuffer);
      safeDestroy(resources.instanceRotationBuffer);
      safeDestroy(resources.instanceRotationStagingBuffer);
      safeDestroy(resources.instanceMaterialIdBuffer);
      safeDestroy(resources.instanceMaterialIdStagingBuffer);
      safeDestroy(resources.instanceBoundsBuffer);
      safeDestroy(resources.instanceIndirectArgsBuffer);

      // Dispose textures
      safeDestroy(resources.sideTexture);
      safeDestroy(resources.topTexture);
      safeDestroy(resources.msaaColorTexture);
      safeDestroy(resources.depthTexture);
      safeDestroy(resources.atlasMetaBuffer);

      // Dispose buffer pool if it's an extended resource
      if ('bufferPool' in resources && resources.bufferPool) {
        try {
          (resources as ExtendedFrameResources).bufferPool.disposeAll();
        } catch (e) {
          Logger.debug('Buffer pool disposal failed', e);
        }
      }
    } catch (e) {
      Logger.warn('Frame resources disposal failed', e);
    }
  }

  /**
   * Creates default geometry data for testing/fallback.
   */
  static getDefaultGeometry(): GeometryData {
    return { ...DEFAULT_GEOMETRY };
  }
}


import type { FrameResources } from '../resources/resources';
import type { GPUBufferPool } from './bufferPool';

export interface InstanceBufferData {
  instanceOffsetData: Float32Array;
  instanceColorScaleData: Float32Array;
  instanceSecondaryColorData: Float32Array;
  instanceEmissiveColorData: Float32Array;
  instanceMaterialParamsData: Float32Array;
  instanceRotationData: Float32Array;
  instanceMaterialIdData: Float32Array;
  instanceBoundsData: Float32Array;
}

interface BufferConfig {
  frameKey: keyof FrameResources;
  dataKey: keyof InstanceBufferData;
  poolKey: string;
  usage: GPUBufferUsageFlags;
  label: string;
}

const RENDER_INSTANCE_USAGE =
  GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
const STAGING_INSTANCE_USAGE = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;

const INSTANCE_BUFFER_CONFIGS: BufferConfig[] = [
  {
    frameKey: 'instanceOffsetBuffer',
    dataKey: 'instanceOffsetData',
    poolKey: 'instance-offset',
    usage: RENDER_INSTANCE_USAGE,
    label: 'instance-offset-buffer',
  },
  {
    frameKey: 'instanceOffsetStagingBuffer',
    dataKey: 'instanceOffsetData',
    poolKey: 'instance-offset-staging',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-offset-staging-buffer',
  },
  {
    frameKey: 'instanceColorScaleBuffer',
    dataKey: 'instanceColorScaleData',
    poolKey: 'instance-color-scale',
    usage: RENDER_INSTANCE_USAGE,
    label: 'instance-color-scale-buffer',
  },
  {
    frameKey: 'instanceColorScaleStagingBuffer',
    dataKey: 'instanceColorScaleData',
    poolKey: 'instance-color-scale-staging',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-color-scale-staging-buffer',
  },
  {
    frameKey: 'instanceSecondaryColorBuffer',
    dataKey: 'instanceSecondaryColorData',
    poolKey: 'instance-secondary-color',
    usage: RENDER_INSTANCE_USAGE,
    label: 'instance-secondary-color-buffer',
  },
  {
    frameKey: 'instanceSecondaryColorStagingBuffer',
    dataKey: 'instanceSecondaryColorData',
    poolKey: 'instance-secondary-color-staging',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-secondary-color-staging-buffer',
  },
  {
    frameKey: 'instanceEmissiveColorBuffer',
    dataKey: 'instanceEmissiveColorData',
    poolKey: 'instance-emissive-color',
    usage: RENDER_INSTANCE_USAGE,
    label: 'instance-emissive-color-buffer',
  },
  {
    frameKey: 'instanceEmissiveColorStagingBuffer',
    dataKey: 'instanceEmissiveColorData',
    poolKey: 'instance-emissive-color-staging',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-emissive-color-staging-buffer',
  },
  {
    frameKey: 'instanceMaterialParamsBuffer',
    dataKey: 'instanceMaterialParamsData',
    poolKey: 'instance-material-params',
    usage: RENDER_INSTANCE_USAGE,
    label: 'instance-material-params-buffer',
  },
  {
    frameKey: 'instanceMaterialParamsStagingBuffer',
    dataKey: 'instanceMaterialParamsData',
    poolKey: 'instance-material-params-staging',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-material-params-staging-buffer',
  },
  {
    frameKey: 'instanceRotationBuffer',
    dataKey: 'instanceRotationData',
    poolKey: 'instance-rotation',
    usage: RENDER_INSTANCE_USAGE,
    label: 'instance-rotation-buffer',
  },
  {
    frameKey: 'instanceRotationStagingBuffer',
    dataKey: 'instanceRotationData',
    poolKey: 'instance-rotation-staging',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-rotation-staging-buffer',
  },
  {
    frameKey: 'instanceMaterialIdBuffer',
    dataKey: 'instanceMaterialIdData',
    poolKey: 'instance-material-id',
    usage: RENDER_INSTANCE_USAGE,
    label: 'instance-material-id-buffer',
  },
  {
    frameKey: 'instanceMaterialIdStagingBuffer',
    dataKey: 'instanceMaterialIdData',
    poolKey: 'instance-material-id-staging',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-material-id-staging-buffer',
  },
  {
    frameKey: 'instanceBoundsBuffer',
    dataKey: 'instanceBoundsData',
    poolKey: 'instance-bounds',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-bounds-buffer',
  },
];

export function updateInstanceBuffers(
  device: GPUDevice,
  frameResources: FrameResources,
  data: InstanceBufferData
): void {
  for (const config of INSTANCE_BUFFER_CONFIGS) {
    const source = data[config.dataKey];
    const buffer = getFrameBuffer(frameResources, config.frameKey);
    if (!source || !buffer) {
      continue;
    }
    device.queue.writeBuffer(
      buffer,
      0,
      source.buffer as ArrayBuffer,
      source.byteOffset,
      source.byteLength
    );
  }
}

export function reallocateInstanceBuffers(
  device: GPUDevice,
  frameResources: FrameResources,
  data: InstanceBufferData
): void {
  const pool = extractBufferPool(frameResources);
  const replacements = new Map<BufferConfig, GPUBuffer | undefined>();

  for (const config of INSTANCE_BUFFER_CONFIGS) {
    const source = data[config.dataKey];
    if (!source) {
      continue;
    }
    const byteLength = source.byteLength;
    const previous = getFrameBuffer(frameResources, config.frameKey);
    const wasPooled = pool?.get(config.poolKey) === previous;
    const next =
      pool?.getOrCreate(config.poolKey, byteLength, config.usage, config.label) ??
      device.createBuffer({
        label: config.label,
        size: byteLength,
        usage: config.usage,
      });
    setFrameBuffer(frameResources, config.frameKey, next);
    replacements.set(config, previous && !wasPooled && previous !== next ? previous : undefined);
  }

  updateInstanceBuffers(device, frameResources, data);

  for (const oldBuffer of replacements.values()) {
    if (!oldBuffer) {
      continue;
    }
    try {
      oldBuffer.destroy();
    } catch {
      // ignore destroy failures
    }
  }
}

function extractBufferPool(frameResources: FrameResources): GPUBufferPool | undefined {
  return (frameResources as unknown as { bufferPool?: GPUBufferPool }).bufferPool;
}

function getFrameBuffer(
  frameResources: FrameResources,
  key: keyof FrameResources
): GPUBuffer | undefined {
  return (frameResources as unknown as Record<string, GPUBuffer | undefined>)[key as string];
}

function setFrameBuffer(
  frameResources: FrameResources,
  key: keyof FrameResources,
  buffer: GPUBuffer
): void {
  (frameResources as unknown as Record<string, GPUBuffer>)[key as string] = buffer;
}

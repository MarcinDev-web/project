import type { FrameResources } from '../resources/resources';
import type { GPUBufferPool } from './bufferPool';

/**
 * Instance buffer data interface using interleaved layout.
 * 
 * Interleaved layout (24 floats = 96 bytes per instance):
 * - offset: vec3 (3 floats) at offset 0
 * - colorScale: vec4 (4 floats) at offset 3
 * - secondaryColor: vec4 (4 floats) at offset 7
 * - emissiveColor: vec4 (4 floats) at offset 11
 * - materialParams: vec4 (4 floats) at offset 15
 * - rotation: vec4 (4 floats) at offset 19
 * - materialId: f32 (1 float) at offset 23
 */
export interface InstanceBufferData {
  /** Interleaved instance data (24 floats per instance) */
  instanceInterleavedData: Float32Array;
  /** Bounds data for frustum culling (4 floats per instance) */
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
    frameKey: 'instanceInterleavedBuffer',
    dataKey: 'instanceInterleavedData',
    poolKey: 'instance-interleaved',
    usage: RENDER_INSTANCE_USAGE,
    label: 'instance-interleaved-buffer',
  },
  {
    frameKey: 'instanceInterleavedStagingBuffer',
    dataKey: 'instanceInterleavedData',
    poolKey: 'instance-interleaved-staging',
    usage: STAGING_INSTANCE_USAGE,
    label: 'instance-interleaved-staging-buffer',
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

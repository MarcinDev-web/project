/**
 * Shared type definitions for the GPU-driven instance pipeline.
 *
 * Phase 1 introduces the buffer vocabulary; later phases will plug these
 * definitions into compute passes and upload helpers.
 */

export const INSTANCE_ATTRIBUTE_KEYS = [
  'instanceOffset',
  'instanceColorScale',
  'instanceSecondaryColor',
  'instanceEmissiveColor',
  'instanceMaterialParams',
  'instanceRotation',
  'instanceMaterialId',
] as const;

export type InstanceAttributeKey = (typeof INSTANCE_ATTRIBUTE_KEYS)[number];

/**
 * Generic map describing all per-instance attribute buffers.
 * TBuffer defaults to GPUBuffer but can be specialized (e.g. GPUBuffer | null in tests).
 */
export interface InstanceAttributeBufferSet<TBuffer = GPUBuffer> {
  instanceOffset: TBuffer;
  instanceColorScale: TBuffer;
  instanceSecondaryColor: TBuffer;
  instanceEmissiveColor: TBuffer;
  instanceMaterialParams: TBuffer;
  instanceRotation: TBuffer;
  instanceMaterialId: TBuffer;
}

/**
 * Logical grouping for the two buffer families we maintain:
 * - staging: CPU uploads + compute inputs
 * - render: final buffers consumed by the vertex stage
 */
export interface InstanceBufferPair<TBuffer = GPUBuffer> {
  staging: InstanceAttributeBufferSet<TBuffer>;
  render: InstanceAttributeBufferSet<TBuffer>;
}

/**
 * Packed layout used when uploading instance bounds to the GPU.
 * center.xyz contains world-space position, radius encodes the max extent.
 */
export interface InstanceBoundsLayout {
  center: [number, number, number];
  radius: number;
}

// Indirect draw command layout (5 x u32)
export const INDIRECT_COMMAND_WORDS = 5;
export const INDIRECT_COMMAND_BYTE_LENGTH = INDIRECT_COMMAND_WORDS * Uint32Array.BYTES_PER_ELEMENT;
export const INDIRECT_COMMAND_COUNT = 3; // opaque, transparent, overlay

export enum IndirectCommandOffset {
  OPAQUE = 0,
  TRANSPARENT = INDIRECT_COMMAND_BYTE_LENGTH,
  OVERLAY = INDIRECT_COMMAND_BYTE_LENGTH * 2,
}

export function buildIndirectDrawArgs(
  indexCount: number,
  opaqueCount: number,
  transparentCount: number
): Uint32Array {
  const totalCount = Math.max(opaqueCount + transparentCount, 0);
  const data = new Uint32Array(INDIRECT_COMMAND_COUNT * INDIRECT_COMMAND_WORDS);

  const writeCommand = (offset: number, count: number, firstInstance: number): void => {
    const base = offset / Uint32Array.BYTES_PER_ELEMENT;
    data[base + 0] = Math.max(indexCount, 0);
    data[base + 1] = Math.max(count, 0);
    data[base + 2] = 0;
    data[base + 3] = 0;
    data[base + 4] = Math.max(firstInstance, 0);
  };

  writeCommand(IndirectCommandOffset.OPAQUE, opaqueCount, 0);
  writeCommand(IndirectCommandOffset.TRANSPARENT, transparentCount, opaqueCount);
  writeCommand(IndirectCommandOffset.OVERLAY, totalCount, 0);

  return data;
}


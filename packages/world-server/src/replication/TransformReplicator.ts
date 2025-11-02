import type { SnapshotMessage } from '@engine/net-protocol';
import type { EcsReplicator, EcsReplicatorContext } from './EcsReplicator.js';
import type { ReplicationEntityRef } from './types.js';
import { BitWriter } from '@engine/net-protocol';
import type { Scene } from '@engine/world';
import { Transform } from '@engine/world';

/**
 * Quantization configuration for Transform component
 */
export interface TransformQuantization {
  positionBits: number; // Bits per position component (default: 14 = cm precision)
  rotationBits: number; // Bits per quaternion component (default: 16)
  positionScale: number; // Scale factor for position (default: 100 = cm)
}

const DEFAULT_QUANTIZATION: TransformQuantization = {
  positionBits: 14, // 14 bits = ±16384 units = ±163.84m with 0.01m precision
  rotationBits: 16, // 16 bits per quaternion component
  positionScale: 100, // Convert meters to cm (0.01m precision)
};

/**
 * Quantize position value
 */
function quantizePosition(value: number, scale: number): number {
  return Math.round(value * scale);
}

// Dequantize function kept for potential future use in deserialization
// @ts-expect-error Reserved for future deserialization
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _dequantizePosition(_quantized: number, _scale: number): number {
  throw new Error('Not yet implemented');
}

/**
 * Write quantized Vec3 to bitstream
 */
function writeQuantizedVec3(writer: BitWriter, vec: [number, number, number], bits: number): void {
  const quantized = [
    quantizePosition(vec[0], 100),
    quantizePosition(vec[1], 100),
    quantizePosition(vec[2], 100),
  ];

  // Write each component using specified bits
  for (let i = 0; i < 3; i++) {
    const v = quantized[i]!; // Array is guaranteed to have 3 elements
    // Simple encoding: write bits (signed)
    const sign = v < 0 ? 1 : 0;
    const abs = Math.abs(v);
    writer.writeByte((sign << (bits - 1)) | (abs & ((1 << (bits - 1)) - 1)));
    if (bits > 8) {
      writer.writeByte((abs >> 8) & 0xff);
    }
  }
}

/**
 * Replicator for Transform component (position, rotation)
 */
export class TransformReplicator implements EcsReplicator {
  constructor(
    private readonly scene: Scene,
    private readonly quantization: TransformQuantization = DEFAULT_QUANTIZATION
  ) {}

  buildSnapshot(
    _context: EcsReplicatorContext,
    entities: ReplicationEntityRef[],
    seq: number,
    ackInputSeq: number,
    baselineSeq?: number
  ): SnapshotMessage {
    const writer = new BitWriter();

    // Write entity count
    writer.writeByte(entities.length & 0xff);
    if (entities.length > 255) {
      writer.writeByte((entities.length >> 8) & 0xff);
    }

    // Write each entity's Transform data
    for (const ref of entities) {
      const entity = this.scene.findEntityById(ref.id.toString());
      if (!entity) continue;

      const transform = entity.getComponent(Transform);
      if (!transform) continue;

      // Write entity ID (simple: length-prefixed string representation)
      const idStr = ref.id.toString();
      writer.writeByte(idStr.length & 0xff);
      for (let i = 0; i < idStr.length; i++) {
        writer.writeByte(idStr.charCodeAt(i));
      }

      // Write position (quantized)
      const pos = transform.position;
      writeQuantizedVec3(writer, pos, this.quantization.positionBits);

      // Write rotation (quantized quaternion)
      const rot = transform.rotation;
      for (let i = 0; i < 4; i++) {
        // Quantize quaternion component to [-1, 1] -> [0, 65535]
        const q = rot[i]!;
        const quantized = Math.round((q + 1) * 32767.5); // Map [-1,1] to [0, 65535]
        writer.writeByte(quantized & 0xff);
        writer.writeByte((quantized >> 8) & 0xff);
      }
    }

    const payload = writer.toUint8Array();

    return {
      header: {
        seq,
        ackInputSeq,
        ...(baselineSeq !== undefined && { baselineSeq }),
        byteLength: payload.byteLength,
      },
      payload,
    };
  }
}


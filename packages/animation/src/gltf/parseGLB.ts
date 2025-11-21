/**
 * Minimal GLB (glTF Binary) v2.0 parser.
 * Supports JSON + one BIN chunk. External buffers/data URIs are not handled.
 */
import { convertFromGltf } from './convertFromGltf';
import { parseGlb, type ParsedGlb, type GLTF } from '@engine/asset-pipeline';

export type { ParsedGlb, GLTF };
export { parseGlb };

export function importFromGlb(buffer: ArrayBuffer) {
  const { gltf, binChunk } = parseGlb(buffer);
  const resolver = (bufferIndex: number) => {
    if (bufferIndex === 0 && binChunk) return binChunk;
    throw new Error(`Only single BIN chunk supported (index ${bufferIndex})`);
  };
  return convertFromGltf(gltf, resolver);
}
